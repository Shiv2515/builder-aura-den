#!/usr/bin/env node

/**
 * PulseSignal AI - Database Initialization Script
 * 
 * This script initializes the PostgreSQL database for institutional-grade
 * data storage and analytics.
 * 
 * Usage:
 * 1. Ensure PostgreSQL is running
 * 2. Create database: createdb pulsesignal_ai
 * 3. Run: npm run init-db
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initializeDatabase() {
  console.log('🚀 PulseSignal AI - Database Initialization');
  console.log('==========================================');

  try {
    // Test database connection
    console.log('�� Testing database connection...');
    const isHealthy = await db.healthCheck();
    
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');

    // Read and execute schema
    console.log('📋 Reading database schema...');
    const schemaPath = join(__dirname, '../database/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('🔨 Creating database schema...');
    await db.query(schema);
    console.log('✅ Database schema created successfully');

    // Initialize with sample data if needed
    console.log('📊 Initializing with default data...');
    await initializeSampleData();
    console.log('✅ Sample data initialized');

    // Verify installation
    console.log('🔍 Verifying installation...');
    const verification = await verifyInstallation();
    
    if (verification.success) {
      console.log('✅ Database initialization completed successfully!');
      console.log('\n📈 Institutional Analytics Features:');
      console.log('   • Historical token price tracking');
      console.log('   • AI prediction performance analytics');
      console.log('   • Risk metrics and portfolio analysis');
      console.log('   • Whale movement tracking');
      console.log('   • Compliance and audit logging');
      console.log('\n🔗 API Endpoints:');
      console.log('   • GET /api/analytics/performance');
      console.log('   • GET /api/analytics/accuracy');
      console.log('   • GET /api/analytics/risk');
      console.log('   • GET /api/analytics/portfolio');
      console.log('   • GET /api/analytics/market');
      console.log('\n💼 Ready for institutional use!');
    } else {
      console.error('❌ Verification failed:', verification.errors);
    }

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL is installed and running');
    console.log('   2. Create database: createdb pulsesignal_ai');
    console.log('   3. Check database credentials in .env file');
    console.log('   4. Verify network connectivity');
    process.exit(1);
  } finally {
    await db.close();
  }
}

async function initializeSampleData() {
  try {
    // Initialize data sources
    await db.query(`
      INSERT INTO data_sources (source_name, source_type, api_endpoint, reliability_score, rate_limit_per_minute)
      VALUES 
        ('dexscreener', 'price_feed', 'https://api.dexscreener.com/latest/dex/tokens/', 85.0, 300),
        ('jupiter', 'price_feed', 'https://price.jup.ag/v4/price', 90.0, 600),
        ('solana_rpc', 'blockchain', 'https://api.mainnet-beta.solana.com', 95.0, 100),
        ('openai', 'social', 'https://api.openai.com/v1/chat/completions', 85.0, 60)
      ON CONFLICT (source_name) DO NOTHING
    `);

    console.log('   ✓ Data sources configured');

    // Create a sample user (for testing)
    await db.query(`
      INSERT INTO users (email, password_hash, subscription_tier, api_key)
      VALUES ('admin@pulsesignal.ai', 'hashed_password', 'institutional', 'sample_api_key_123')
      ON CONFLICT (email) DO NOTHING
    `);

    console.log('   ✓ Sample user created');

  } catch (error) {
    console.log('   ⚠️ Sample data initialization partially failed:', error.message);
  }
}

async function verifyInstallation(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Check if all main tables exist
    const tables = ['tokens', 'token_prices', 'ai_predictions', 'whale_movements', 'portfolios'];
    
    for (const table of tables) {
      const result = await db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);

      if (parseInt(result.rows[0].count) === 0) {
        errors.push(`Table '${table}' not found`);
      }
    }

    // Check if views exist
    const views = ['portfolio_performance', 'token_performance_summary'];
    
    for (const view of views) {
      const result = await db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = $1
      `, [view]);

      if (parseInt(result.rows[0].count) === 0) {
        errors.push(`View '${view}' not found`);
      }
    }

    // Check if functions exist
    const functions = ['update_portfolio_value', 'calculate_portfolio_returns'];
    
    for (const func of functions) {
      const result = await db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name = $1
      `, [func]);

      if (parseInt(result.rows[0].count) === 0) {
        errors.push(`Function '${func}' not found`);
      }
    }

    return { success: errors.length === 0, errors };

  } catch (error) {
    errors.push(`Verification error: ${error.message}`);
    return { success: false, errors };
  }
}

// Run the initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export { initializeDatabase };
