import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { dataPersistence } from './data-persistence';
import { performanceTracker } from './performance-tracking';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  user_id?: string;
  subscription_tier: 'retail' | 'pro' | 'institutional';
  rate_limit: {
    messages_per_minute: number;
    current_count: number;
    last_reset: number;
  };
}

interface RealTimeMessage {
  type: 'token_price' | 'ai_prediction' | 'whale_movement' | 'performance_update' | 'market_alert';
  timestamp: string;
  data: any;
  subscription_tier_required?: 'retail' | 'pro' | 'institutional';
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Initialize WebSocket server
  initialize(server: Server): void {
    console.log('🔌 Initializing WebSocket server for real-time data feeds...');

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    // Start real-time data broadcasting
    this.startRealTimeUpdates();

    console.log('✅ WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      subscription_tier: 'retail', // Default tier
      rate_limit: {
        messages_per_minute: 60, // Retail default
        current_count: 0,
        last_reset: Date.now()
      }
    };

    this.clients.set(clientId, client);
    
    console.log(`🔗 New WebSocket client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        client_id: clientId,
        message: 'Connected to PulseSignal AI real-time feed',
        available_channels: [
          'token_prices',
          'ai_predictions', 
          'whale_movements',
          'performance_metrics',
          'market_alerts'
        ]
      }
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket client error (${clientId}):`, error);
      this.handleDisconnection(clientId);
    });
  }

  private handleMessage(clientId: string, data: any): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Check rate limiting
      if (!this.checkRateLimit(client)) {
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: 'Rate limit exceeded' }
        });
        return;
      }

      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.channels || []);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.channels || []);
          break;
          
        case 'authenticate':
          this.handleAuthentication(clientId, message.api_key);
          break;
          
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', data: {} });
          break;
          
        default:
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: 'Unknown message type' }
          });
      }
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  private handleSubscription(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const channel of channels) {
      // Check subscription tier permissions
      if (this.isChannelAllowed(channel, client.subscription_tier)) {
        client.subscriptions.add(channel);
        console.log(`📡 Client ${clientId} subscribed to ${channel}`);
      } else {
        this.sendToClient(clientId, {
          type: 'error',
          data: { 
            message: `Channel '${channel}' requires higher subscription tier`,
            required_tier: this.getRequiredTier(channel)
          }
        });
      }
    }

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { 
        subscriptions: Array.from(client.subscriptions),
        subscription_tier: client.subscription_tier
      }
    });
  }

  private handleUnsubscription(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const channel of channels) {
      client.subscriptions.delete(channel);
      console.log(`📡 Client ${clientId} unsubscribed from ${channel}`);
    }

    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      data: { subscriptions: Array.from(client.subscriptions) }
    });
  }

  private handleAuthentication(clientId: string, apiKey: string): void {
    // In production, validate API key against database
    const client = this.clients.get(clientId);
    if (!client) return;

    // Mock authentication logic
    if (apiKey === 'sample_api_key_123') {
      client.subscription_tier = 'institutional';
      client.rate_limit.messages_per_minute = 1000; // Higher rate limit
      
      this.sendToClient(clientId, {
        type: 'authentication_success',
        data: { 
          subscription_tier: 'institutional',
          rate_limit: 1000
        }
      });
    } else {
      this.sendToClient(clientId, {
        type: 'authentication_failed',
        data: { message: 'Invalid API key' }
      });
    }
  }

  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`🔌 Client disconnected: ${clientId}`);
  }

  // ================== REAL-TIME DATA BROADCASTING ==================

  private startRealTimeUpdates(): void {
    console.log('📡 Starting real-time data broadcasting...');

    // Token price updates (every 10 seconds)
    const priceInterval = setInterval(async () => {
      await this.broadcastTokenPrices();
    }, 10000);
    this.updateIntervals.set('prices', priceInterval);

    // AI predictions updates (every 30 seconds)
    const predictionInterval = setInterval(async () => {
      await this.broadcastAIPredictions();
    }, 30000);
    this.updateIntervals.set('predictions', predictionInterval);

    // Whale movements (every 5 seconds)
    const whaleInterval = setInterval(async () => {
      await this.broadcastWhaleMovements();
    }, 5000);
    this.updateIntervals.set('whales', whaleInterval);

    // Performance metrics (every 60 seconds)
    const performanceInterval = setInterval(async () => {
      await this.broadcastPerformanceMetrics();
    }, 60000);
    this.updateIntervals.set('performance', performanceInterval);

    console.log('✅ Real-time broadcasting started');
  }

  private async broadcastTokenPrices(): Promise<void> {
    try {
      // Get recent price updates from all active tokens
      const tokens = await dataPersistence.getAllActiveTokens();
      
      for (const token of tokens.slice(0, 10)) { // Limit to top 10 for performance
        const recentPrices = await dataPersistence.getHistoricalPrices(token.mint_address, '1h', 1);
        
        if (recentPrices.length > 0) {
          const latestPrice = recentPrices[0];
          
          this.broadcast({
            type: 'token_price',
            timestamp: new Date().toISOString(),
            data: {
              mint_address: token.mint_address,
              symbol: token.symbol,
              name: token.name,
              price: parseFloat(latestPrice.close_price.toString()),
              volume_24h: parseFloat(latestPrice.volume_24h.toString()),
              market_cap: parseFloat(latestPrice.market_cap.toString()),
              timestamp: latestPrice.timestamp
            }
          }, 'token_prices');
        }
      }
    } catch (error) {
      console.error('❌ Error broadcasting token prices:', error);
    }
  }

  private async broadcastAIPredictions(): Promise<void> {
    try {
      // Get recent AI predictions
      const accuracy = await dataPersistence.calculatePredictionAccuracy(1);
      
      this.broadcast({
        type: 'ai_prediction',
        timestamp: new Date().toISOString(),
        data: {
          daily_accuracy: accuracy.accuracy_percentage,
          total_predictions_24h: accuracy.total_predictions,
          confidence_level: accuracy.avg_confidence,
          model_status: 'active'
        },
        subscription_tier_required: 'pro'
      }, 'ai_predictions');
    } catch (error) {
      console.error('❌ Error broadcasting AI predictions:', error);
    }
  }

  private async broadcastWhaleMovements(): Promise<void> {
    try {
      // Get recent whale movements
      const whaleMovements = await dataPersistence.getRecentWhaleMovements(1, 5);
      
      for (const movement of whaleMovements) {
        this.broadcast({
          type: 'whale_movement',
          timestamp: new Date().toISOString(),
          data: {
            token: {
              symbol: movement.symbol,
              name: movement.name,
              mint_address: movement.mint_address
            },
            wallet: movement.wallet_address,
            type: movement.movement_type,
            amount_usd: movement.amount_usd,
            timestamp: movement.transaction_time,
            confidence: movement.confidence_score
          },
          subscription_tier_required: 'pro'
        }, 'whale_movements');
      }
    } catch (error) {
      console.error('❌ Error broadcasting whale movements:', error);
    }
  }

  private async broadcastPerformanceMetrics(): Promise<void> {
    try {
      // Get real-time performance metrics
      await performanceTracker.updateRealTimeMetrics();
      const accuracy = await dataPersistence.calculatePredictionAccuracy(7);
      
      this.broadcast({
        type: 'performance_update',
        timestamp: new Date().toISOString(),
        data: {
          weekly_accuracy: accuracy.accuracy_percentage,
          total_predictions: accuracy.total_predictions,
          system_status: 'operational',
          active_tokens: await dataPersistence.getAllActiveTokens().then(tokens => tokens.length)
        },
        subscription_tier_required: 'institutional'
      }, 'performance_metrics');
    } catch (error) {
      console.error('❌ Error broadcasting performance metrics:', error);
    }
  }

  // ================== UTILITY METHODS ==================

  private broadcast(message: RealTimeMessage, channel: string): void {
    const payload = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.subscriptions.has(channel)) {
        // Check subscription tier permissions
        if (message.subscription_tier_required && 
            !this.hasPermission(client.subscription_tier, message.subscription_tier_required)) {
          return;
        }
        
        // Check rate limiting
        if (!this.checkRateLimit(client)) {
          return;
        }
        
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(payload);
          }
        } catch (error) {
          console.error(`❌ Error sending to client ${client.id}:`, error);
        }
      }
    });
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error(`❌ Error sending message to client ${clientId}:`, error);
    }
  }

  private checkRateLimit(client: WebSocketClient): boolean {
    const now = Date.now();
    const oneMinute = 60 * 1000;
    
    // Reset counter if a minute has passed
    if (now - client.rate_limit.last_reset > oneMinute) {
      client.rate_limit.current_count = 0;
      client.rate_limit.last_reset = now;
    }
    
    // Check if under limit
    if (client.rate_limit.current_count >= client.rate_limit.messages_per_minute) {
      return false;
    }
    
    client.rate_limit.current_count++;
    return true;
  }

  private isChannelAllowed(channel: string, tier: string): boolean {
    const channelPermissions = {
      'token_prices': ['retail', 'pro', 'institutional'],
      'ai_predictions': ['pro', 'institutional'],
      'whale_movements': ['pro', 'institutional'],
      'performance_metrics': ['institutional'],
      'market_alerts': ['retail', 'pro', 'institutional']
    };

    return channelPermissions[channel]?.includes(tier) || false;
  }

  private getRequiredTier(channel: string): string {
    const tierMap = {
      'token_prices': 'retail',
      'ai_predictions': 'pro',
      'whale_movements': 'pro',
      'performance_metrics': 'institutional',
      'market_alerts': 'retail'
    };

    return tierMap[channel] || 'institutional';
  }

  private hasPermission(userTier: string, requiredTier: string): boolean {
    const tierOrder = ['retail', 'pro', 'institutional'];
    const userLevel = tierOrder.indexOf(userTier);
    const requiredLevel = tierOrder.indexOf(requiredTier);
    
    return userLevel >= requiredLevel;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ================== PUBLIC METHODS ==================

  // Get connection statistics
  getStats(): {
    total_connections: number;
    connections_by_tier: Record<string, number>;
    active_subscriptions: Record<string, number>;
  } {
    const stats = {
      total_connections: this.clients.size,
      connections_by_tier: { retail: 0, pro: 0, institutional: 0 },
      active_subscriptions: {}
    };

    this.clients.forEach((client) => {
      stats.connections_by_tier[client.subscription_tier]++;
      
      client.subscriptions.forEach((subscription) => {
        stats.active_subscriptions[subscription] = (stats.active_subscriptions[subscription] || 0) + 1;
      });
    });

    return stats;
  }

  // Send custom alert to all connected clients
  sendMarketAlert(alert: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    token_mint?: string;
  }): void {
    this.broadcast({
      type: 'market_alert',
      timestamp: new Date().toISOString(),
      data: alert
    }, 'market_alerts');
  }

  // Shutdown WebSocket server
  shutdown(): void {
    console.log('🔌 Shutting down WebSocket server...');
    
    // Clear all intervals
    this.updateIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();

    // Close all client connections
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    console.log('✅ WebSocket server shutdown complete');
  }
}

export const webSocketService = WebSocketService.getInstance();
