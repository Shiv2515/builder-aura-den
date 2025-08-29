import path from "path";
import { createServer } from "./index";
import * as express from "express";
import { createServer as createHttpServer } from "http";
import { webSocketService } from "./services/websocket-server";

const app = createServer();
const port = process.env.PORT || 3000;

// Create HTTP server to support both Express and WebSocket
const httpServer = createHttpServer(app);

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// Serve static files
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

// Initialize WebSocket server
webSocketService.initialize(httpServer);

httpServer.listen(port, () => {
  console.log(`🚀 PulseSignal AI server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
  console.log(`📡 WebSocket: ws://localhost:${port}/ws`);
  console.log(`💼 Institutional Analytics: ENABLED`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  webSocketService.shutdown();
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  webSocketService.shutdown();
  httpServer.close(() => {
    process.exit(0);
  });
});
