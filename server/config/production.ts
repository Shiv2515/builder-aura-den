// Production configuration settings - Ultra-conservative to avoid rate limits
export const PRODUCTION_CONFIG = {
  // API Rate Limiting - Much more conservative
  SOLANA_RPC_DELAY: 8000, // 8 seconds between calls
  WHALE_CHECK_INTERVAL: 1800000, // 30 minutes
  BLOCK_CHECK_INTERVAL: 300000, // 5 minutes
  TOKEN_METRICS_INTERVAL: 1800000, // 30 minutes

  // Cache Settings - Much longer
  WHALE_DATA_CACHE: 3600000, // 1 hour
  HOLDER_DATA_CACHE: 7200000, // 2 hours
  TOKEN_DATA_CACHE: 1800000, // 30 minutes

  // Scanning Settings - Very conservative
  AUTO_SCAN_INTERVAL: 1800000, // 30 minutes
  MAX_CONCURRENT_SCANS: 1, // Only 1 concurrent scan
  BATCH_SIZE: 5, // Much smaller batch size

  // Feature Flags - Disable AI to avoid OpenAI quota issues
  ENABLE_REAL_TIME_MONITORING: false, // Disable to reduce API calls
  ENABLE_WHALE_TRACKING: true,
  ENABLE_AI_ANALYSIS: false, // Disable to avoid OpenAI quota issues
  FALLBACK_ON_API_ERRORS: true,

  // Performance Settings - Very limited
  MAX_TOKENS_TO_SCAN: 10, // Much fewer tokens
  MAX_WHALE_WALLETS: 2, // Fewer wallets to check
  API_TIMEOUT: 30000, // 30 seconds

  // Production Optimizations
  USE_CACHED_DATA_ON_ERROR: true,
  GRACEFUL_DEGRADATION: true,
  MINIMAL_LOGGING: true // Enable for production
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
