import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAIAnalysis, handleWhaleTracking } from "./routes/ai-analysis";
import {
  handleStartScan,
  handleGetTopCoins,
  handleGetScanStatus,
  handleAnalyzeCoin,
  handleGetWhaleActivity,
  handleGetAdvancedAnalysis,
  handleGetTimingAnalysis,
  handleGetContractAnalysis,
  startAutoScanning
} from "./routes/coin-scanner";

// Import institutional analytics routes
import {
  handleGetPerformanceReport,
  handleGetPredictionAccuracy,
  handleGetRiskMetrics,
  handleGetPortfolioPerformance,
  handleGetTokenHistory,
  handleGetMarketOverview,
  handleGetRealTimeMetrics,
  handleGetWebSocketStats,
  handleSendMarketAlert,
  validateSubscriptionTier
} from "./routes/analytics";

// Import database connection
import { db } from "./database/connection";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/ai-analysis", handleAIAnalysis);
  app.get("/api/whale-tracking", handleWhaleTracking);

  // Real coin scanning endpoints
  app.post("/api/scan/start", handleStartScan);
  app.get("/api/scan/coins", handleGetTopCoins);
  app.get("/api/scan/status", handleGetScanStatus);
  app.get("/api/scan/analyze/:mint", handleAnalyzeCoin);
  app.get("/api/scan/whale-activity", handleGetWhaleActivity);
  app.get("/api/scan/advanced/:mint", handleGetAdvancedAnalysis);
  app.get("/api/scan/timing/:mint", handleGetTimingAnalysis);
  app.get("/api/scan/contract/:mint", handleGetContractAnalysis);

  // Institutional Analytics Endpoints (Investor Fund Ready)
  app.get("/api/analytics/performance", validateSubscriptionTier, handleGetPerformanceReport);
  app.get("/api/analytics/accuracy", validateSubscriptionTier, handleGetPredictionAccuracy);
  app.get("/api/analytics/risk", validateSubscriptionTier, handleGetRiskMetrics);
  app.get("/api/analytics/portfolio", validateSubscriptionTier, handleGetPortfolioPerformance);
  app.get("/api/analytics/token/:mint/history", validateSubscriptionTier, handleGetTokenHistory);
  app.get("/api/analytics/market", validateSubscriptionTier, handleGetMarketOverview);
  app.get("/api/analytics/realtime", validateSubscriptionTier, handleGetRealTimeMetrics);
  app.get("/api/analytics/websocket", validateSubscriptionTier, handleGetWebSocketStats);
  app.post("/api/analytics/alert", validateSubscriptionTier, handleSendMarketAlert);

  // Database health check endpoint
  app.get("/api/health/database", async (_req, res) => {
    try {
      const isHealthy = await db.healthCheck();
      res.json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        database: 'postgresql',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // Initialize database connection
  initializeDatabase();

  // Start auto-scanning when server starts
  startAutoScanning();

  return app;
}

// Initialize database and handle connection
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing institutional database...');

    // Check database health
    const isHealthy = await db.healthCheck();
    if (isHealthy) {
      console.log('✅ Database connection established');

      // Initialize tables if needed
      await db.initialize();
      console.log('✅ Database schema verified');
    } else {
      console.log('⚠️ Database connection failed - running without persistence');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.log('⚠️ Continuing without database persistence...');
  }
}
