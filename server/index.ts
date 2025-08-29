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

  // Start auto-scanning when server starts
  startAutoScanning();

  return app;
}
