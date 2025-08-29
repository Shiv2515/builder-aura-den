import { Pool, PoolClient } from 'pg';

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pulsesignal_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(DB_CONFIG);

// Database connection class
export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = pool;
    this.setupEventHandlers();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private setupEventHandlers() {
    this.pool.on('connect', (client) => {
      console.log('✅ New database client connected');
    });

    this.pool.on('error', (err, client) => {
      console.error('❌ Unexpected error on idle database client:', err);
    });

    this.pool.on('remove', (client) => {
      console.log('🔌 Database client removed from pool');
    });
  }

  // Execute a query
  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`📊 Query executed in ${duration}ms:`, text.substring(0, 100));
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  }

  // Get a client from the pool for transactions
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // Execute a transaction
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as server_time');
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }

  // Initialize database with schema
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing database...');
      
      // Check if tables exist
      const tablesExist = await this.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tokens'
      `);

      if (parseInt(tablesExist.rows[0].count) === 0) {
        console.log('📋 Creating database schema...');
        // In production, you'd run migrations instead
        console.log('⚠️ Please run the schema.sql file manually to create tables');
      } else {
        console.log('✅ Database schema already exists');
      }

      // Insert default data sources
      await this.insertDefaultDataSources();
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  private async insertDefaultDataSources(): Promise<void> {
    const dataSources = [
      {
        name: 'dexscreener',
        type: 'price_feed',
        endpoint: 'https://api.dexscreener.com/latest/dex/tokens/',
        reliability: 85.0,
        rate_limit: 300
      },
      {
        name: 'jupiter',
        type: 'price_feed', 
        endpoint: 'https://price.jup.ag/v4/price',
        reliability: 90.0,
        rate_limit: 600
      },
      {
        name: 'solana_rpc',
        type: 'blockchain',
        endpoint: 'https://api.mainnet-beta.solana.com',
        reliability: 95.0,
        rate_limit: 100
      },
      {
        name: 'openai',
        type: 'social',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        reliability: 85.0,
        rate_limit: 60
      }
    ];

    for (const source of dataSources) {
      try {
        await this.query(`
          INSERT INTO data_sources (source_name, source_type, api_endpoint, reliability_score, rate_limit_per_minute, last_update)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (source_name) DO UPDATE SET
            api_endpoint = $3,
            reliability_score = $4,
            rate_limit_per_minute = $5,
            last_update = NOW()
        `, [source.name, source.type, source.endpoint, source.reliability, source.rate_limit]);
      } catch (error) {
        console.log(`⚠️ Could not insert data source ${source.name}:`, error.message);
      }
    }
  }

  // Close the pool
  async close(): Promise<void> {
    await this.pool.end();
    console.log('🔌 Database connection pool closed');
  }
}

// Export singleton instance
export const db = Database.getInstance();

// Export types for better TypeScript support
export interface Token {
  id: string;
  mint_address: string;
  symbol: string;
  name: string;
  decimals: number;
  total_supply: bigint;
  created_at: Date;
  first_discovered: Date;
  is_meme_coin: boolean;
  is_active: boolean;
}

export interface TokenPrice {
  id: string;
  token_id: string;
  timestamp: Date;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume_24h: number;
  market_cap: number;
  liquidity_usd: number;
  holders_count: number;
  source: string;
}

export interface AIPrediction {
  id: string;
  token_id: string;
  prediction_time: Date;
  ai_score: number;
  prediction_type: 'bullish' | 'bearish' | 'neutral';
  confidence_level: number;
  time_horizon: '1h' | '4h' | '24h' | '7d' | '30d';
  target_price?: number;
  stop_loss?: number;
  rug_risk: 'low' | 'medium' | 'high';
  whale_activity_score: number;
  social_sentiment_score: number;
  model_version: string;
  reasoning: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  strategy_type: 'conservative' | 'balanced' | 'aggressive' | 'custom';
  initial_capital: number;
  current_value: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  created_at: Date;
  updated_at: Date;
}

export interface WhaleMovement {
  id: string;
  token_id: string;
  wallet_address: string;
  transaction_signature: string;
  movement_type: 'buy' | 'sell';
  amount_tokens: number;
  amount_usd: number;
  price_at_transaction: number;
  transaction_time: Date;
  confidence_score: number;
  detected_at: Date;
}
