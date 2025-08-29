import { db, Token, TokenPrice, AIPrediction, WhaleMovement } from '../database/connection';
import { PoolClient } from 'pg';

export class DataPersistenceService {
  private static instance: DataPersistenceService;

  public static getInstance(): DataPersistenceService {
    if (!DataPersistenceService.instance) {
      DataPersistenceService.instance = new DataPersistenceService();
    }
    return DataPersistenceService.instance;
  }

  // ================== TOKEN MANAGEMENT ==================

  async upsertToken(tokenData: {
    mint_address: string;
    symbol: string;
    name: string;
    decimals?: number;
    total_supply?: bigint;
    is_meme_coin?: boolean;
  }): Promise<string> {
    try {
      const result = await db.query(`
        INSERT INTO tokens (mint_address, symbol, name, decimals, total_supply, is_meme_coin, first_discovered)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (mint_address) DO UPDATE SET
          symbol = $2,
          name = $3,
          decimals = $4,
          total_supply = $5,
          is_meme_coin = $6,
          updated_at = NOW()
        RETURNING id
      `, [
        tokenData.mint_address,
        tokenData.symbol,
        tokenData.name,
        tokenData.decimals || 9,
        tokenData.total_supply || null,
        tokenData.is_meme_coin || false
      ]);

      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error upserting token:', error);
      throw error;
    }
  }

  async getTokenByMint(mint_address: string): Promise<Token | null> {
    try {
      const result = await db.query(
        'SELECT * FROM tokens WHERE mint_address = $1',
        [mint_address]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting token by mint:', error);
      return null;
    }
  }

  async getAllActiveTokens(): Promise<Token[]> {
    try {
      const result = await db.query(
        'SELECT * FROM tokens WHERE is_active = TRUE ORDER BY first_discovered DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting active tokens:', error);
      return [];
    }
  }

  // ================== PRICE DATA MANAGEMENT ==================

  async storePriceData(priceData: {
    mint_address: string;
    timestamp: Date;
    open_price: number;
    high_price: number;
    low_price: number;
    close_price: number;
    volume_24h?: number;
    market_cap?: number;
    liquidity_usd?: number;
    holders_count?: number;
    source?: string;
  }): Promise<void> {
    try {
      // Get or create token
      const tokenId = await this.upsertToken({
        mint_address: priceData.mint_address,
        symbol: 'UNKNOWN',
        name: 'Unknown Token'
      });

      await db.query(`
        INSERT INTO token_prices (
          token_id, timestamp, open_price, high_price, low_price, close_price,
          volume_24h, market_cap, liquidity_usd, holders_count, source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (token_id, timestamp, source) DO UPDATE SET
          open_price = $3,
          high_price = $4,
          low_price = $5,
          close_price = $6,
          volume_24h = $7,
          market_cap = $8,
          liquidity_usd = $9,
          holders_count = $10
      `, [
        tokenId,
        priceData.timestamp,
        priceData.open_price,
        priceData.high_price,
        priceData.low_price,
        priceData.close_price,
        priceData.volume_24h || 0,
        priceData.market_cap || 0,
        priceData.liquidity_usd || 0,
        priceData.holders_count || 0,
        priceData.source || 'system'
      ]);

      console.log(`💾 Stored price data for ${priceData.mint_address} at ${priceData.timestamp}`);
    } catch (error) {
      console.error('❌ Error storing price data:', error);
      throw error;
    }
  }

  async getHistoricalPrices(
    mint_address: string, 
    timeframe: '1h' | '4h' | '1d' | '7d' | '30d' = '1d',
    limit: number = 100
  ): Promise<TokenPrice[]> {
    try {
      const token = await this.getTokenByMint(mint_address);
      if (!token) return [];

      const timeFrameMap = {
        '1h': '1 hour',
        '4h': '4 hours',
        '1d': '1 day',
        '7d': '7 days',
        '30d': '30 days'
      };

      const result = await db.query(`
        SELECT * FROM token_prices 
        WHERE token_id = $1 
        AND timestamp >= NOW() - INTERVAL '${timeFrameMap[timeframe]}'
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [token.id, limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting historical prices:', error);
      return [];
    }
  }

  // ================== AI PREDICTION TRACKING ==================

  async storeAIPrediction(prediction: {
    mint_address: string;
    ai_score: number;
    prediction_type: 'bullish' | 'bearish' | 'neutral';
    confidence_level: number;
    time_horizon?: '1h' | '4h' | '24h' | '7d' | '30d';
    target_price?: number;
    stop_loss?: number;
    rug_risk: 'low' | 'medium' | 'high';
    whale_activity_score?: number;
    social_sentiment_score?: number;
    model_version?: string;
    reasoning?: string;
  }): Promise<string> {
    try {
      const token = await this.getTokenByMint(prediction.mint_address);
      if (!token) {
        throw new Error(`Token not found: ${prediction.mint_address}`);
      }

      const result = await db.query(`
        INSERT INTO ai_predictions (
          token_id, ai_score, prediction_type, confidence_level, time_horizon,
          target_price, stop_loss, rug_risk, whale_activity_score, 
          social_sentiment_score, model_version, reasoning
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        token.id,
        prediction.ai_score,
        prediction.prediction_type,
        prediction.confidence_level,
        prediction.time_horizon || '24h',
        prediction.target_price,
        prediction.stop_loss,
        prediction.rug_risk,
        prediction.whale_activity_score || 0,
        prediction.social_sentiment_score || 0,
        prediction.model_version || 'v1.0',
        prediction.reasoning
      ]);

      console.log(`🧠 Stored AI prediction for ${prediction.mint_address}: ${prediction.prediction_type} (${prediction.ai_score}%)`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error storing AI prediction:', error);
      throw error;
    }
  }

  async getPredictionHistory(
    mint_address: string,
    days: number = 30
  ): Promise<AIPrediction[]> {
    try {
      const token = await this.getTokenByMint(mint_address);
      if (!token) return [];

      const result = await db.query(`
        SELECT * FROM ai_predictions 
        WHERE token_id = $1 
        AND prediction_time >= NOW() - INTERVAL '${days} days'
        ORDER BY prediction_time DESC
      `, [token.id]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting prediction history:', error);
      return [];
    }
  }

  // ================== PERFORMANCE TRACKING ==================

  async calculatePredictionAccuracy(days: number = 7): Promise<{
    total_predictions: number;
    correct_predictions: number;
    accuracy_percentage: number;
    avg_confidence: number;
  }> {
    try {
      const result = await db.query(`
        WITH prediction_outcomes AS (
          SELECT 
            ap.id,
            ap.ai_score,
            ap.prediction_type,
            ap.confidence_level,
            ap.prediction_time,
            ap.target_price,
            tp_start.close_price as start_price,
            tp_end.close_price as end_price,
            CASE 
              WHEN ap.prediction_type = 'bullish' AND tp_end.close_price > tp_start.close_price THEN true
              WHEN ap.prediction_type = 'bearish' AND tp_end.close_price < tp_start.close_price THEN true
              WHEN ap.prediction_type = 'neutral' AND ABS(tp_end.close_price - tp_start.close_price) / tp_start.close_price < 0.05 THEN true
              ELSE false
            END as is_correct
          FROM ai_predictions ap
          JOIN token_prices tp_start ON ap.token_id = tp_start.token_id 
            AND tp_start.timestamp <= ap.prediction_time
            AND tp_start.timestamp > ap.prediction_time - INTERVAL '1 hour'
          JOIN token_prices tp_end ON ap.token_id = tp_end.token_id
            AND tp_end.timestamp >= ap.prediction_time + INTERVAL '24 hours'
            AND tp_end.timestamp < ap.prediction_time + INTERVAL '25 hours'
          WHERE ap.prediction_time >= NOW() - INTERVAL '${days} days'
        )
        SELECT 
          COUNT(*) as total_predictions,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_predictions,
          ROUND(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as accuracy_percentage,
          ROUND(AVG(confidence_level), 2) as avg_confidence
        FROM prediction_outcomes
      `);

      return result.rows[0] || {
        total_predictions: 0,
        correct_predictions: 0,
        accuracy_percentage: 0,
        avg_confidence: 0
      };
    } catch (error) {
      console.error('❌ Error calculating prediction accuracy:', error);
      return {
        total_predictions: 0,
        correct_predictions: 0,
        accuracy_percentage: 0,
        avg_confidence: 0
      };
    }
  }

  // ================== WHALE MOVEMENT TRACKING ==================

  async storeWhaleMovement(movement: {
    mint_address: string;
    wallet_address: string;
    transaction_signature: string;
    movement_type: 'buy' | 'sell';
    amount_tokens: number;
    amount_usd?: number;
    price_at_transaction: number;
    transaction_time: Date;
    confidence_score?: number;
  }): Promise<void> {
    try {
      const token = await this.getTokenByMint(movement.mint_address);
      if (!token) {
        throw new Error(`Token not found: ${movement.mint_address}`);
      }

      await db.query(`
        INSERT INTO whale_movements (
          token_id, wallet_address, transaction_signature, movement_type,
          amount_tokens, amount_usd, price_at_transaction, transaction_time, confidence_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (transaction_signature) DO NOTHING
      `, [
        token.id,
        movement.wallet_address,
        movement.transaction_signature,
        movement.movement_type,
        movement.amount_tokens,
        movement.amount_usd,
        movement.price_at_transaction,
        movement.transaction_time,
        movement.confidence_score || 0
      ]);

      console.log(`🐋 Stored whale movement: ${movement.wallet_address} ${movement.movement_type} ${movement.amount_usd?.toLocaleString()} USD`);
    } catch (error) {
      console.error('❌ Error storing whale movement:', error);
      throw error;
    }
  }

  async getRecentWhaleMovements(hours: number = 24, limit: number = 50): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          wm.*,
          t.symbol,
          t.name,
          t.mint_address
        FROM whale_movements wm
        JOIN tokens t ON wm.token_id = t.id
        WHERE wm.transaction_time >= NOW() - INTERVAL '${hours} hours'
        ORDER BY wm.transaction_time DESC, wm.amount_usd DESC NULLS LAST
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting recent whale movements:', error);
      return [];
    }
  }

  // ================== ANALYTICS ==================

  async getTokenPerformanceMetrics(mint_address: string, days: number = 30): Promise<{
    price_change_pct: number;
    volatility: number;
    max_drawdown: number;
    sharpe_ratio: number;
    total_volume: number;
    whale_activity_count: number;
    ai_score_trend: number;
  }> {
    try {
      const token = await this.getTokenByMint(mint_address);
      if (!token) {
        return {
          price_change_pct: 0,
          volatility: 0,
          max_drawdown: 0,
          sharpe_ratio: 0,
          total_volume: 0,
          whale_activity_count: 0,
          ai_score_trend: 0
        };
      }

      const result = await db.query(`
        WITH price_data AS (
          SELECT 
            close_price,
            volume_24h,
            timestamp,
            LAG(close_price) OVER (ORDER BY timestamp) as prev_price
          FROM token_prices 
          WHERE token_id = $1 
          AND timestamp >= NOW() - INTERVAL '${days} days'
          ORDER BY timestamp
        ),
        returns AS (
          SELECT 
            (close_price - prev_price) / prev_price as daily_return,
            volume_24h,
            close_price
          FROM price_data 
          WHERE prev_price IS NOT NULL
        ),
        first_last_prices AS (
          SELECT 
            FIRST_VALUE(close_price) OVER (ORDER BY timestamp) as first_price,
            LAST_VALUE(close_price) OVER (ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as last_price
          FROM price_data
          LIMIT 1
        )
        SELECT 
          COALESCE(ROUND(((fsp.last_price - fsp.first_price) / fsp.first_price * 100), 2), 0) as price_change_pct,
          COALESCE(ROUND(STDDEV(r.daily_return) * SQRT(365) * 100, 2), 0) as volatility,
          COALESCE(SUM(r.volume_24h), 0) as total_volume,
          COUNT(r.daily_return) as data_points
        FROM returns r
        CROSS JOIN first_last_prices fsp
      `, [token.id]);

      const priceMetrics = result.rows[0];

      // Get whale activity count
      const whaleResult = await db.query(`
        SELECT COUNT(*) as whale_count
        FROM whale_movements 
        WHERE token_id = $1 
        AND transaction_time >= NOW() - INTERVAL '${days} days'
      `, [token.id]);

      // Get AI score trend
      const aiTrendResult = await db.query(`
        SELECT 
          AVG(ai_score) as avg_score,
          COUNT(*) as prediction_count
        FROM ai_predictions 
        WHERE token_id = $1 
        AND prediction_time >= NOW() - INTERVAL '${days} days'
      `, [token.id]);

      return {
        price_change_pct: parseFloat(priceMetrics.price_change_pct) || 0,
        volatility: parseFloat(priceMetrics.volatility) || 0,
        max_drawdown: 0, // Would need more complex calculation
        sharpe_ratio: 0, // Would need risk-free rate
        total_volume: parseFloat(priceMetrics.total_volume) || 0,
        whale_activity_count: parseInt(whaleResult.rows[0].whale_count) || 0,
        ai_score_trend: parseFloat(aiTrendResult.rows[0].avg_score) || 0
      };
    } catch (error) {
      console.error('❌ Error getting token performance metrics:', error);
      return {
        price_change_pct: 0,
        volatility: 0,
        max_drawdown: 0,
        sharpe_ratio: 0,
        total_volume: 0,
        whale_activity_count: 0,
        ai_score_trend: 0
      };
    }
  }

  // ================== BULK OPERATIONS ==================

  async bulkStorePriceData(priceDataArray: any[]): Promise<void> {
    if (priceDataArray.length === 0) return;

    try {
      await db.transaction(async (client: PoolClient) => {
        for (const priceData of priceDataArray) {
          await this.storePriceData(priceData);
        }
      });

      console.log(`💾 Bulk stored ${priceDataArray.length} price data records`);
    } catch (error) {
      console.error('❌ Error in bulk store price data:', error);
      throw error;
    }
  }

  async cleanup(daysToKeep: number = 90): Promise<void> {
    try {
      // Clean up old price data
      const priceCleanup = await db.query(`
        DELETE FROM token_prices 
        WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
      `);

      // Clean up old audit logs
      const auditCleanup = await db.query(`
        DELETE FROM audit_logs 
        WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
      `);

      console.log(`🧹 Cleaned up ${priceCleanup.rowCount} old price records and ${auditCleanup.rowCount} audit logs`);
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }
}

export const dataPersistence = DataPersistenceService.getInstance();
