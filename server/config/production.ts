// Production configuration settings
export const PRODUCTION_CONFIG = {
  // API Rate Limiting
  SOLANA_RPC_DELAY: 3000, // 3 seconds between calls
  WHALE_CHECK_INTERVAL: 300000, // 5 minutes
  BLOCK_CHECK_INTERVAL: 60000, // 1 minute
  TOKEN_METRICS_INTERVAL: 600000, // 10 minutes
  
  // Cache Settings
  WHALE_DATA_CACHE: 900000, // 15 minutes
  HOLDER_DATA_CACHE: 1800000, // 30 minutes
  TOKEN_DATA_CACHE: 600000, // 10 minutes
  
  // Scanning Settings
  AUTO_SCAN_INTERVAL: 900000, // 15 minutes
  MAX_CONCURRENT_SCANS: 3,
  BATCH_SIZE: 20, // Reduced batch size for stability
  
  // Feature Flags
  ENABLE_REAL_TIME_MONITORING: true,
  ENABLE_WHALE_TRACKING: true,
  ENABLE_AI_ANALYSIS: true,
  FALLBACK_ON_API_ERRORS: true,
  
  // Performance Settings
  MAX_TOKENS_TO_SCAN: 50,
  MAX_WHALE_WALLETS: 5,
  API_TIMEOUT: 10000, // 10 seconds
  
  // Production Optimizations
  USE_CACHED_DATA_ON_ERROR: true,
  GRACEFUL_DEGRADATION: true,
  MINIMAL_LOGGING: false // Set to true for production
};

// Check if running in production
export const isProduction = process.env.NODE_ENV === 'production';

// Get production-optimized settings
export function getProductionSettings() {
  if (isProduction) {
    return PRODUCTION_CONFIG;
  }
  
  // Development settings (more aggressive)
  return {
    ...PRODUCTION_CONFIG,
    SOLANA_RPC_DELAY: 1000,
    WHALE_CHECK_INTERVAL: 120000, // 2 minutes
    AUTO_SCAN_INTERVAL: 300000, // 5 minutes
    WHALE_DATA_CACHE: 300000, // 5 minutes
    HOLDER_DATA_CACHE: 600000, // 10 minutes
  };
}
