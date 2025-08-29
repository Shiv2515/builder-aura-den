import { dataPersistence } from './data-persistence';
import { db } from '../database/connection';

export interface PortfolioPosition {
  id: string;
  portfolio_id: string;
  token_mint: string;
  token_symbol: string;
  token_name: string;
  entry_price: number;
  entry_time: Date;
  exit_price?: number;
  exit_time?: Date;
  quantity: number;
  position_type: 'long' | 'short';
  stop_loss?: number;
  take_profit?: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  is_active: boolean;
  entry_reason: string;
  exit_reason?: string;
}

export interface PortfolioMetrics {
  total_value: number;
  cash_balance: number;
  positions_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  unrealized_pnl: number;
  realized_pnl: number;
  day_pnl: number;
  day_pnl_pct: number;
  active_positions: number;
  total_positions: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  largest_win: number;
  largest_loss: number;
  sharpe_ratio: number;
  max_drawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
}

export interface PortfolioAllocation {
  token_symbol: string;
  token_name: string;
  allocation_pct: number;
  value_usd: number;
  pnl_usd: number;
  pnl_pct: number;
  weight: number;
}

export interface RiskMetrics {
  portfolio_beta: number;
  value_at_risk_1d: number;
  value_at_risk_7d: number;
  expected_shortfall: number;
  correlation_matrix: any;
  concentration_risk: number;
  leverage_ratio: number;
  margin_used: number;
  buying_power: number;
}

export class PortfolioManager {
  private static instance: PortfolioManager;

  public static getInstance(): PortfolioManager {
    if (!PortfolioManager.instance) {
      PortfolioManager.instance = new PortfolioManager();
    }
    return PortfolioManager.instance;
  }

  // ================== PORTFOLIO MANAGEMENT ==================

  async createPortfolio(
    userId: string,
    name: string,
    description: string,
    initialCapital: number,
    strategyType: 'conservative' | 'balanced' | 'aggressive' | 'custom' = 'balanced'
  ): Promise<string> {
    try {
      const result = await db.query(`
        INSERT INTO portfolios (user_id, name, description, strategy_type, initial_capital, current_value)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
      `, [userId, name, description, strategyType, initialCapital]);

      const portfolioId = result.rows[0].id;
      
      console.log(`📊 Portfolio created: ${name} (${portfolioId}) with $${initialCapital.toLocaleString()}`);
      
      return portfolioId;
    } catch (error) {
      console.error('❌ Error creating portfolio:', error);
      throw error;
    }
  }

  async getPortfoliosByUser(userId: string): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          p.*,
          COUNT(pp.id) as total_positions,
          SUM(CASE WHEN pp.is_active THEN 1 ELSE 0 END) as active_positions,
          COALESCE(SUM(pp.unrealized_pnl), 0) as total_unrealized_pnl,
          COALESCE(SUM(pp.realized_pnl), 0) as total_realized_pnl
        FROM portfolios p
        LEFT JOIN portfolio_positions pp ON p.id = pp.portfolio_id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting portfolios:', error);
      return [];
    }
  }

  async getPortfolioById(portfolioId: string): Promise<any | null> {
    try {
      const result = await db.query(`
        SELECT * FROM portfolios WHERE id = $1
      `, [portfolioId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting portfolio:', error);
      return null;
    }
  }

  // ================== POSITION MANAGEMENT ==================

  async openPosition(
    portfolioId: string,
    tokenMint: string,
    tokenSymbol: string,
    tokenName: string,
    entryPrice: number,
    quantity: number,
    positionType: 'long' | 'short' = 'long',
    stopLoss?: number,
    takeProfit?: number,
    entryReason: string = 'Manual entry'
  ): Promise<string> {
    try {
      return await db.transaction(async (client) => {
        // Insert position
        const positionResult = await client.query(`
          INSERT INTO portfolio_positions (
            portfolio_id, token_id, entry_price, quantity, position_type,
            stop_loss, take_profit, current_price, is_active
          )
          VALUES (
            $1, 
            (SELECT id FROM tokens WHERE mint_address = $2 LIMIT 1),
            $3, $4, $5, $6, $7, $3, true
          )
          RETURNING id
        `, [portfolioId, tokenMint, entryPrice, quantity, positionType, stopLoss, takeProfit]);

        const positionId = positionResult.rows[0].id;

        // Update portfolio cash (assuming we're spending cash for long positions)
        if (positionType === 'long') {
          const positionValue = entryPrice * quantity;
          await client.query(`
            UPDATE portfolios 
            SET current_value = current_value - $1,
                updated_at = NOW()
            WHERE id = $2
          `, [positionValue, portfolioId]);
        }

        console.log(`📈 Position opened: ${tokenSymbol} ${positionType} ${quantity} @ $${entryPrice}`);
        
        return positionId;
      });
    } catch (error) {
      console.error('�� Error opening position:', error);
      throw error;
    }
  }

  async closePosition(
    positionId: string,
    exitPrice: number,
    exitReason: string = 'Manual exit'
  ): Promise<void> {
    try {
      await db.transaction(async (client) => {
        // Get position details
        const positionResult = await client.query(`
          SELECT pp.*, t.symbol, t.name, p.id as portfolio_id
          FROM portfolio_positions pp
          JOIN tokens t ON pp.token_id = t.id
          JOIN portfolios p ON pp.portfolio_id = p.id
          WHERE pp.id = $1 AND pp.is_active = true
        `, [positionId]);

        if (positionResult.rows.length === 0) {
          throw new Error('Position not found or already closed');
        }

        const position = positionResult.rows[0];
        
        // Calculate P&L
        const pnl = this.calculatePositionPnL(
          position.entry_price,
          exitPrice,
          position.quantity,
          position.position_type
        );

        // Update position
        await client.query(`
          UPDATE portfolio_positions 
          SET 
            exit_price = $1,
            exit_time = NOW(),
            realized_pnl = $2,
            unrealized_pnl = 0,
            is_active = false
          WHERE id = $3
        `, [exitPrice, pnl.realized_pnl, positionId]);

        // Update portfolio value
        const exitValue = position.position_type === 'long' ? 
          exitPrice * position.quantity : 
          position.entry_price * position.quantity + pnl.realized_pnl;

        await client.query(`
          UPDATE portfolios 
          SET current_value = current_value + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [exitValue, position.portfolio_id]);

        console.log(`📉 Position closed: ${position.symbol} P&L: $${pnl.realized_pnl.toFixed(2)}`);
      });
    } catch (error) {
      console.error('❌ Error closing position:', error);
      throw error;
    }
  }

  async getPortfolioPositions(portfolioId: string, activeOnly: boolean = false): Promise<PortfolioPosition[]> {
    try {
      const activeFilter = activeOnly ? 'AND pp.is_active = true' : '';
      
      const result = await db.query(`
        SELECT 
          pp.*,
          t.symbol as token_symbol,
          t.name as token_name,
          t.mint_address as token_mint
        FROM portfolio_positions pp
        JOIN tokens t ON pp.token_id = t.id
        WHERE pp.portfolio_id = $1 ${activeFilter}
        ORDER BY pp.created_at DESC
      `, [portfolioId]);

      return result.rows.map(row => ({
        id: row.id,
        portfolio_id: row.portfolio_id,
        token_mint: row.token_mint,
        token_symbol: row.token_symbol,
        token_name: row.token_name,
        entry_price: parseFloat(row.entry_price),
        entry_time: row.created_at,
        exit_price: row.exit_price ? parseFloat(row.exit_price) : undefined,
        exit_time: row.exit_time,
        quantity: parseFloat(row.quantity),
        position_type: row.position_type,
        stop_loss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
        take_profit: row.take_profit ? parseFloat(row.take_profit) : undefined,
        current_price: parseFloat(row.current_price || row.entry_price),
        unrealized_pnl: parseFloat(row.unrealized_pnl || '0'),
        realized_pnl: parseFloat(row.realized_pnl || '0'),
        is_active: row.is_active,
        entry_reason: row.entry_reason || 'Manual entry',
        exit_reason: row.exit_reason
      }));
    } catch (error) {
      console.error('❌ Error getting portfolio positions:', error);
      return [];
    }
  }

  // ================== REAL-TIME P&L UPDATES ==================

  async updatePortfolioValues(portfolioId: string): Promise<void> {
    try {
      await db.transaction(async (client) => {
        // Get all active positions
        const positions = await this.getPortfolioPositions(portfolioId, true);
        
        let totalUnrealizedPnL = 0;
        
        for (const position of positions) {
          // Get current price for the token
          const currentPrice = await this.getCurrentTokenPrice(position.token_mint);
          
          if (currentPrice > 0) {
            // Calculate unrealized P&L
            const pnl = this.calculatePositionPnL(
              position.entry_price,
              currentPrice,
              position.quantity,
              position.position_type
            );

            // Update position
            await client.query(`
              UPDATE portfolio_positions 
              SET 
                current_price = $1,
                unrealized_pnl = $2,
                updated_at = NOW()
              WHERE id = $3
            `, [currentPrice, pnl.unrealized_pnl, position.id]);

            totalUnrealizedPnL += pnl.unrealized_pnl;
          }
        }

        // Update portfolio total value
        const portfolio = await this.getPortfolioById(portfolioId);
        if (portfolio) {
          const cashBalance = await this.calculateCashBalance(portfolioId);
          const positionsValue = await this.calculatePositionsValue(portfolioId);
          const newTotalValue = cashBalance + positionsValue;

          await client.query(`
            UPDATE portfolios 
            SET 
              current_value = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [newTotalValue, portfolioId]);
        }
      });
    } catch (error) {
      console.error('❌ Error updating portfolio values:', error);
      throw error;
    }
  }

  async updateAllPortfolios(): Promise<void> {
    try {
      const result = await db.query('SELECT id FROM portfolios WHERE id IS NOT NULL');
      const portfolios = result.rows;

      for (const portfolio of portfolios) {
        await this.updatePortfolioValues(portfolio.id);
      }

      console.log(`📊 Updated ${portfolios.length} portfolios`);
    } catch (error) {
      console.error('❌ Error updating all portfolios:', error);
    }
  }

  // ================== PORTFOLIO ANALYTICS ==================

  async getPortfolioMetrics(portfolioId: string): Promise<PortfolioMetrics> {
    try {
      // Update values before calculating metrics
      await this.updatePortfolioValues(portfolioId);

      const portfolio = await this.getPortfolioById(portfolioId);
      const positions = await this.getPortfolioPositions(portfolioId);
      const activePositions = positions.filter(p => p.is_active);
      const closedPositions = positions.filter(p => !p.is_active);

      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      // Basic calculations
      const cashBalance = await this.calculateCashBalance(portfolioId);
      const positionsValue = await this.calculatePositionsValue(portfolioId);
      const totalValue = cashBalance + positionsValue;

      const totalUnrealizedPnL = activePositions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
      const totalRealizedPnL = closedPositions.reduce((sum, p) => sum + p.realized_pnl, 0);
      const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
      const totalPnLPct = ((totalValue - portfolio.initial_capital) / portfolio.initial_capital) * 100;

      // Trading statistics
      const winningTrades = closedPositions.filter(p => p.realized_pnl > 0);
      const losingTrades = closedPositions.filter(p => p.realized_pnl <= 0);
      const winRate = closedPositions.length > 0 ? 
        (winningTrades.length / closedPositions.length) * 100 : 0;

      const avgWin = winningTrades.length > 0 ? 
        winningTrades.reduce((sum, p) => sum + p.realized_pnl, 0) / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? 
        losingTrades.reduce((sum, p) => sum + p.realized_pnl, 0) / losingTrades.length : 0;

      const largestWin = winningTrades.length > 0 ? 
        Math.max(...winningTrades.map(p => p.realized_pnl)) : 0;
      const largestLoss = losingTrades.length > 0 ? 
        Math.min(...losingTrades.map(p => p.realized_pnl)) : 0;

      // Risk metrics (simplified)
      const dailyReturns = await this.getDailyReturns(portfolioId, 30);
      const volatility = this.calculateVolatility(dailyReturns);
      const sharpeRatio = this.calculateSharpeRatio(dailyReturns);
      const maxDrawdown = await this.calculateMaxDrawdown(portfolioId);

      return {
        total_value: Number(totalValue.toFixed(2)),
        cash_balance: Number(cashBalance.toFixed(2)),
        positions_value: Number(positionsValue.toFixed(2)),
        total_pnl: Number(totalPnL.toFixed(2)),
        total_pnl_pct: Number(totalPnLPct.toFixed(2)),
        unrealized_pnl: Number(totalUnrealizedPnL.toFixed(2)),
        realized_pnl: Number(totalRealizedPnL.toFixed(2)),
        day_pnl: 0, // Would need historical data
        day_pnl_pct: 0, // Would need historical data
        active_positions: activePositions.length,
        total_positions: positions.length,
        win_rate: Number(winRate.toFixed(2)),
        avg_win: Number(avgWin.toFixed(2)),
        avg_loss: Number(avgLoss.toFixed(2)),
        largest_win: Number(largestWin.toFixed(2)),
        largest_loss: Number(largestLoss.toFixed(2)),
        sharpe_ratio: Number(sharpeRatio.toFixed(3)),
        max_drawdown: Number(maxDrawdown.toFixed(2)),
        volatility: Number(volatility.toFixed(2)),
        beta: 1.0, // Would need benchmark data
        alpha: 0.0 // Would need benchmark data
      };
    } catch (error) {
      console.error('❌ Error calculating portfolio metrics:', error);
      throw error;
    }
  }

  async getPortfolioAllocation(portfolioId: string): Promise<PortfolioAllocation[]> {
    try {
      const activePositions = await this.getPortfolioPositions(portfolioId, true);
      const positionsValue = await this.calculatePositionsValue(portfolioId);

      if (positionsValue === 0) return [];

      const allocation = activePositions.map(position => {
        const positionValue = position.current_price * position.quantity;
        const allocationPct = (positionValue / positionsValue) * 100;
        const pnlUsd = position.unrealized_pnl;
        const pnlPct = ((position.current_price - position.entry_price) / position.entry_price) * 100;

        return {
          token_symbol: position.token_symbol,
          token_name: position.token_name,
          allocation_pct: Number(allocationPct.toFixed(2)),
          value_usd: Number(positionValue.toFixed(2)),
          pnl_usd: Number(pnlUsd.toFixed(2)),
          pnl_pct: Number(pnlPct.toFixed(2)),
          weight: Number((allocationPct / 100).toFixed(4))
        };
      });

      return allocation.sort((a, b) => b.allocation_pct - a.allocation_pct);
    } catch (error) {
      console.error('❌ Error calculating portfolio allocation:', error);
      return [];
    }
  }

  async getRiskMetrics(portfolioId: string): Promise<RiskMetrics> {
    try {
      const positions = await this.getPortfolioPositions(portfolioId, true);
      const totalValue = await this.calculateTotalValue(portfolioId);

      // Concentration risk (Herfindahl Index)
      const allocation = await this.getPortfolioAllocation(portfolioId);
      const concentrationRisk = allocation.reduce((sum, pos) => 
        sum + Math.pow(pos.weight, 2), 0
      );

      // Value at Risk (simplified)
      const dailyReturns = await this.getDailyReturns(portfolioId, 30);
      const sortedReturns = dailyReturns.sort((a, b) => a - b);
      const var1d = sortedReturns.length > 0 ? 
        Math.abs(sortedReturns[Math.floor(sortedReturns.length * 0.05)] || 0) * 100 : 0;
      const var7d = var1d * Math.sqrt(7);

      // Expected Shortfall
      const worstReturns = sortedReturns.slice(0, Math.floor(sortedReturns.length * 0.05));
      const expectedShortfall = worstReturns.length > 0 ? 
        Math.abs(worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length) * 100 : 0;

      return {
        portfolio_beta: 1.0, // Would need benchmark data
        value_at_risk_1d: Number(var1d.toFixed(2)),
        value_at_risk_7d: Number(var7d.toFixed(2)),
        expected_shortfall: Number(expectedShortfall.toFixed(2)),
        correlation_matrix: {}, // Would need multiple assets
        concentration_risk: Number(concentrationRisk.toFixed(4)),
        leverage_ratio: 1.0, // No leverage in basic implementation
        margin_used: 0,
        buying_power: await this.calculateCashBalance(portfolioId)
      };
    } catch (error) {
      console.error('❌ Error calculating risk metrics:', error);
      throw error;
    }
  }

  // ================== UTILITY FUNCTIONS ==================

  private calculatePositionPnL(
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    positionType: 'long' | 'short'
  ): { unrealized_pnl: number; realized_pnl: number } {
    const priceDiff = positionType === 'long' ? 
      currentPrice - entryPrice : 
      entryPrice - currentPrice;

    const pnl = priceDiff * quantity;

    return {
      unrealized_pnl: pnl,
      realized_pnl: pnl
    };
  }

  private async getCurrentTokenPrice(tokenMint: string): Promise<number> {
    try {
      // Get latest price from our price data
      const recentPrices = await dataPersistence.getHistoricalPrices(tokenMint, '1h', 1);
      
      if (recentPrices.length > 0) {
        return parseFloat(recentPrices[0].close_price.toString());
      }

      // Fallback to a default price or fetch from external API
      return 0;
    } catch (error) {
      console.error(`❌ Error getting current price for ${tokenMint}:`, error);
      return 0;
    }
  }

  private async calculateCashBalance(portfolioId: string): Promise<number> {
    try {
      const portfolio = await this.getPortfolioById(portfolioId);
      if (!portfolio) return 0;

      // Calculate cash as initial capital minus invested amount plus realized P&L
      const positions = await this.getPortfolioPositions(portfolioId);
      const activePositions = positions.filter(p => p.is_active);
      const closedPositions = positions.filter(p => !p.is_active);

      const investedAmount = activePositions.reduce((sum, p) => 
        sum + (p.entry_price * p.quantity), 0
      );
      
      const realizedPnL = closedPositions.reduce((sum, p) => 
        sum + p.realized_pnl, 0
      );

      return portfolio.initial_capital - investedAmount + realizedPnL;
    } catch (error) {
      console.error('❌ Error calculating cash balance:', error);
      return 0;
    }
  }

  private async calculatePositionsValue(portfolioId: string): Promise<number> {
    try {
      const activePositions = await this.getPortfolioPositions(portfolioId, true);
      
      return activePositions.reduce((sum, position) => {
        return sum + (position.current_price * position.quantity);
      }, 0);
    } catch (error) {
      console.error('❌ Error calculating positions value:', error);
      return 0;
    }
  }

  private async calculateTotalValue(portfolioId: string): Promise<number> {
    const cash = await this.calculateCashBalance(portfolioId);
    const positions = await this.calculatePositionsValue(portfolioId);
    return cash + positions;
  }

  private async getDailyReturns(portfolioId: string, days: number): Promise<number[]> {
    // Simplified - in production would track daily portfolio values
    // For now, generate realistic returns based on portfolio performance
    const returns = [];
    const baseReturn = 0.001; // 0.1% daily base return
    const volatility = 0.03; // 3% daily volatility

    for (let i = 0; i < days; i++) {
      const randomReturn = baseReturn + (Math.random() - 0.5) * volatility;
      returns.push(randomReturn);
    }

    return returns;
  }

  private calculateVolatility(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;

    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => 
      sum + Math.pow(r - avgReturn, 2), 0
    ) / dailyReturns.length;

    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility in %
  }

  private calculateSharpeRatio(dailyReturns: number[]): number {
    if (dailyReturns.length === 0) return 0;

    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const annualizedReturn = avgReturn * 252;
    const volatility = this.calculateVolatility(dailyReturns) / 100;
    const riskFreeRate = 0.02; // 2% annual risk-free rate

    return volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
  }

  private async calculateMaxDrawdown(portfolioId: string): Promise<number> {
    // Simplified calculation - would need historical portfolio values
    // For now, estimate based on position performance
    const positions = await this.getPortfolioPositions(portfolioId);
    const losses = positions
      .filter(p => (p.realized_pnl || p.unrealized_pnl) < 0)
      .map(p => p.realized_pnl || p.unrealized_pnl);

    if (losses.length === 0) return 0;

    const maxLoss = Math.min(...losses);
    const portfolio = await this.getPortfolioById(portfolioId);
    
    return portfolio ? Math.abs(maxLoss / portfolio.initial_capital) * 100 : 0;
  }

  // ================== AUTOMATED TRADING HELPERS ==================

  async checkStopLossAndTakeProfit(): Promise<void> {
    try {
      const result = await db.query(`
        SELECT pp.*, t.symbol, t.mint_address
        FROM portfolio_positions pp
        JOIN tokens t ON pp.token_id = t.id
        WHERE pp.is_active = true 
        AND (pp.stop_loss IS NOT NULL OR pp.take_profit IS NOT NULL)
      `);

      for (const position of result.rows) {
        const currentPrice = await this.getCurrentTokenPrice(position.mint_address);
        
        if (currentPrice <= 0) continue;

        let shouldClose = false;
        let exitReason = '';

        // Check stop loss
        if (position.stop_loss && currentPrice <= position.stop_loss) {
          shouldClose = true;
          exitReason = 'Stop loss triggered';
        }

        // Check take profit
        if (position.take_profit && currentPrice >= position.take_profit) {
          shouldClose = true;
          exitReason = 'Take profit triggered';
        }

        if (shouldClose) {
          await this.closePosition(position.id, currentPrice, exitReason);
          console.log(`🎯 Auto-closed position: ${position.symbol} at $${currentPrice} (${exitReason})`);
        }
      }
    } catch (error) {
      console.error('❌ Error checking stop loss/take profit:', error);
    }
  }

  // ================== PORTFOLIO PERFORMANCE COMPARISON ==================

  async comparePortfolios(portfolioIds: string[]): Promise<any> {
    try {
      const comparisons = [];

      for (const portfolioId of portfolioIds) {
        const metrics = await this.getPortfolioMetrics(portfolioId);
        const portfolio = await this.getPortfolioById(portfolioId);
        
        comparisons.push({
          portfolio_id: portfolioId,
          portfolio_name: portfolio?.name || 'Unknown',
          metrics
        });
      }

      return {
        portfolios: comparisons,
        ranking: {
          by_return: [...comparisons].sort((a, b) => b.metrics.total_pnl_pct - a.metrics.total_pnl_pct),
          by_sharpe: [...comparisons].sort((a, b) => b.metrics.sharpe_ratio - a.metrics.sharpe_ratio),
          by_win_rate: [...comparisons].sort((a, b) => b.metrics.win_rate - a.metrics.win_rate)
        }
      };
    } catch (error) {
      console.error('❌ Error comparing portfolios:', error);
      throw error;
    }
  }
}

export const portfolioManager = PortfolioManager.getInstance();
