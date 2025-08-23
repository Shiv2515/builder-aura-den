// EMERGENCY: Ultra-conservative settings to stop rate limiting
export const PRODUCTION_CONFIG = {
  // EMERGENCY: Dramatically increased delays to stop rate limiting
  SOLANA_RPC_DELAY: 10000, // 10 seconds between calls (testing new RPC)
  WHALE_CHECK_INTERVAL: 3600000, // 1 HOUR
  BLOCK_CHECK_INTERVAL: 3600000, // 1 HOUR
  TOKEN_METRICS_INTERVAL: 7200000, // 2 HOURS

  // EMERGENCY: Much longer cache to avoid API calls
  WHALE_DATA_CACHE: 14400000, // 4 hours
  HOLDER_DATA_CACHE: 28800000, // 8 hours
  TOKEN_DATA_CACHE: 7200000, // 2 hours

  // EMERGENCY: Disable all scanning temporarily
  AUTO_SCAN_INTERVAL: 7200000, // 2 HOURS
  MAX_CONCURRENT_SCANS: 0, // NO concurrent scans
  BATCH_SIZE: 1, // Only 1 at a time

  // QuickNode: Re-enable features with premium RPC
  ENABLE_REAL_TIME_MONITORING: true,
  ENABLE_WHALE_TRACKING: true, // Re-enabled
  ENABLE_AI_ANALYSIS: true,
  FALLBACK_ON_API_ERRORS: true,

  // EMERGENCY: Minimal settings
  MAX_TOKENS_TO_SCAN: 1, // Only 1 token
  MAX_WHALE_WALLETS: 0, // NO wallet checks
  API_TIMEOUT: 60000, // 1 minute timeout

  // EMERGENCY: Full fallback mode
  USE_CACHED_DATA_ON_ERROR: true,
  GRACEFUL_DEGRADATION: true,
  MINIMAL_LOGGING: true,
  EMERGENCY_MODE: false // Disabled for QuickNode premium RPC
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
