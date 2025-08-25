import { EventEmitter } from 'events';
import { quantumScanner } from './quantum-scanner';

// REAL-TIME SYNCHRONIZATION SYSTEM
// Provides continuous updates to connected clients

interface RealtimeUpdate {
  type: 'coin_update' | 'new_coin' | 'rug_alert' | 'whale_movement' | 'market_shift';
  data: any;
  timestamp: number;
  confidence: number;
}

interface QuantumAlert {
  type: 'profit_opportunity' | 'rug_pull_imminent' | 'whale_accumulation' | 'market_collapse';
  coin: {
    mint: string;
    symbol: string;
    name: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  timestamp: number;
}

class RealtimeSyncService extends EventEmitter {
  private connectedClients: Set<any> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = 0;
  private alertHistory: QuantumAlert[] = [];

  constructor() {
    super();
    this.startRealtimeSync();
  }

  // Start continuous real-time synchronization
  private startRealtimeSync(): void {
    console.log('🔄 REALTIME SYNC: Starting continuous data synchronization...');
    
    // Ultra-fast updates every 2 seconds for live feel
    this.updateInterval = setInterval(() => {
      this.processRealtimeUpdates();
    }, 2000);

    // Listen for quantum scanner events
    this.setupQuantumEventListeners();
  }

  // Setup event listeners for quantum scanner
  private setupQuantumEventListeners(): void {
    // Listen for new coin discoveries
    setInterval(() => {
      this.checkForNewCoins();
    }, 5000);

    // Listen for market state changes
    setInterval(() => {
      this.checkForMarketShifts();
    }, 3000);

    // Listen for whale movements
    setInterval(() => {
      this.checkForWhaleActivity();
    }, 4000);

    // Listen for rug pull alerts
    setInterval(() => {
      this.checkForRugPullAlerts();
    }, 6000);
  }

  // Process real-time updates
  private async processRealtimeUpdates(): Promise<void> {
    try {
      const currentTime = Date.now();
      
      // Get latest quantum data
      const quantumTokens = quantumScanner.getScannedTokens();
      const scanStats = quantumScanner.getScanningStats();

      // Check for significant changes
      const updates: RealtimeUpdate[] = [];

      // Check for score changes
      for (const token of quantumTokens.slice(0, 10)) {
        const marketData = quantumScanner.getRealTimeDataForToken(token.mint);
        
        if (marketData) {
          // Check for significant price changes
          if (Math.abs(marketData.change24h) > 15) {
            updates.push({
              type: 'coin_update',
              data: {
                mint: token.mint,
                symbol: token.symbol,
                name: token.name,
                change24h: marketData.change24h,
                quantumScore: token.quantumScore,
                marketQuantumState: token.marketQuantumState,
                alert: Math.abs(marketData.change24h) > 30 ? 'major_movement' : 'significant_change'
              },
              timestamp: currentTime,
              confidence: token.quantumScore
            });
          }

          // Check for quantum state changes
          if (token.marketQuantumState === 'collapse_bull' && token.quantumScore > 80) {
            updates.push({
              type: 'market_shift',
              data: {
                mint: token.mint,
                symbol: token.symbol,
                previousState: 'superposition',
                newState: token.marketQuantumState,
                quantumScore: token.quantumScore,
                profitPotential: token.neuralProfitability
              },
              timestamp: currentTime,
              confidence: token.quantumScore
            });
          }
        }
      }

      // Emit updates to all connected clients
      if (updates.length > 0) {
        this.emit('updates', updates);
        this.broadcastToClients('realtime_updates', updates);
      }

      // Update stats
      this.broadcastToClients('scan_stats', {
        ...scanStats,
        totalTokensAnalyzed: quantumTokens.length,
        activeAnalysis: quantumTokens.filter(t => t.quantumScore > 60).length,
        timestamp: currentTime
      });

      this.lastUpdateTime = currentTime;

    } catch (error) {
      console.error('❌ Realtime sync error:', error);
    }
  }

  // Check for new coins
  private checkForNewCoins(): void {
    try {
      const quantumTokens = quantumScanner.getScannedTokens();
      const newCoins = quantumTokens.filter(token => {
        const marketData = quantumScanner.getRealTimeDataForToken(token.mint);
        const ageInMinutes = marketData ? (Date.now() - marketData.createdAt) / 60000 : 0;
        return ageInMinutes < 30; // New in last 30 minutes
      });

      for (const coin of newCoins.slice(0, 3)) {
        const marketData = quantumScanner.getRealTimeDataForToken(coin.mint);
        
        this.broadcastToClients('new_coin', {
          mint: coin.mint,
          symbol: coin.symbol,
          name: coin.name,
          quantumScore: coin.quantumScore,
          marketQuantumState: coin.marketQuantumState,
          neuralProfitability: coin.neuralProfitability,
          rugPullProbability: coin.rugPullProbability,
          marketData,
          timestamp: Date.now()
        });

        // Generate alert if high potential
        if (coin.quantumScore > 75 && coin.rugPullProbability < 0.3) {
          this.generateAlert({
            type: 'profit_opportunity',
            coin: {
              mint: coin.mint,
              symbol: coin.symbol,
              name: coin.name
            },
            severity: 'high',
            data: {
              quantumScore: coin.quantumScore,
              profitPotential: coin.neuralProfitability,
              riskLevel: coin.rugPullProbability,
              marketState: coin.marketQuantumState
            },
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('❌ New coin check error:', error);
    }
  }

  // Check for market shifts
  private checkForMarketShifts(): void {
    try {
      const quantumTokens = quantumScanner.getScannedTokens();
      
      // Detect major market movements
      const bullishCollapse = quantumTokens.filter(t => t.marketQuantumState === 'collapse_bull').length;
      const bearishCollapse = quantumTokens.filter(t => t.marketQuantumState === 'collapse_bear').length;
      const totalTokens = quantumTokens.length;

      if (totalTokens > 5) {
        const bullishRatio = bullishCollapse / totalTokens;
        const bearishRatio = bearishCollapse / totalTokens;

        if (bullishRatio > 0.6) {
          this.broadcastToClients('market_shift', {
            type: 'bull_market_detected',
            bullishTokens: bullishCollapse,
            totalTokens,
            confidence: Math.floor(bullishRatio * 100),
            timestamp: Date.now()
          });
        } else if (bearishRatio > 0.6) {
          this.broadcastToClients('market_shift', {
            type: 'bear_market_detected',
            bearishTokens: bearishCollapse,
            totalTokens,
            confidence: Math.floor(bearishRatio * 100),
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('❌ Market shift check error:', error);
    }
  }

  // Check for whale activity
  private checkForWhaleActivity(): void {
    try {
      const quantumTokens = quantumScanner.getScannedTokens();
      
      const significantWhaleActivity = quantumTokens.filter(token => {
        return token.whaleEntropy < 0.3 && token.quantumScore > 60;
      });

      for (const token of significantWhaleActivity.slice(0, 2)) {
        this.broadcastToClients('whale_movement', {
          mint: token.mint,
          symbol: token.symbol,
          whaleEntropy: token.whaleEntropy,
          quantumScore: token.quantumScore,
          marketQuantumState: token.marketQuantumState,
          timestamp: Date.now(),
          severity: token.whaleEntropy < 0.2 ? 'high' : 'medium'
        });

        // Generate whale accumulation alert
        if (token.whaleEntropy < 0.2 && token.marketQuantumState === 'collapse_bull') {
          this.generateAlert({
            type: 'whale_accumulation',
            coin: {
              mint: token.mint,
              symbol: token.symbol,
              name: token.name
            },
            severity: 'critical',
            data: {
              whaleEntropy: token.whaleEntropy,
              quantumScore: token.quantumScore,
              marketState: token.marketQuantumState
            },
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('❌ Whale activity check error:', error);
    }
  }

  // Check for rug pull alerts
  private checkForRugPullAlerts(): void {
    try {
      const quantumTokens = quantumScanner.getScannedTokens();
      
      const rugRiskTokens = quantumTokens.filter(token => 
        token.rugPullProbability > 0.8 && token.quantumScore < 30
      );

      for (const token of rugRiskTokens.slice(0, 3)) {
        this.broadcastToClients('rug_alert', {
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          rugPullProbability: token.rugPullProbability,
          quantumScore: token.quantumScore,
          marketQuantumState: token.marketQuantumState,
          severity: 'critical',
          timestamp: Date.now()
        });

        // Generate critical rug pull alert
        this.generateAlert({
          type: 'rug_pull_imminent',
          coin: {
            mint: token.mint,
            symbol: token.symbol,
            name: token.name
          },
          severity: 'critical',
          data: {
            rugPullProbability: token.rugPullProbability,
            quantumScore: token.quantumScore,
            liquidityVelocity: token.liquidityVelocity
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('❌ Rug pull check error:', error);
    }
  }

  // Generate quantum alert
  private generateAlert(alert: QuantumAlert): void {
    this.alertHistory.unshift(alert);
    
    // Keep only last 50 alerts
    if (this.alertHistory.length > 50) {
      this.alertHistory = this.alertHistory.slice(0, 50);
    }

    // Broadcast alert
    this.broadcastToClients('quantum_alert', alert);
    
    console.log(`🚨 QUANTUM ALERT: ${alert.type} for ${alert.coin.symbol} (${alert.severity})`);
  }

  // Add client connection
  public addClient(client: any): void {
    this.connectedClients.add(client);
    console.log(`📡 Client connected. Total: ${this.connectedClients.size}`);
    
    // Send initial data
    client.emit('connection_established', {
      message: 'Connected to Quantum Real-time Feed',
      timestamp: Date.now(),
      totalTokensTracked: quantumScanner.getScannedTokens().length
    });
  }

  // Remove client connection
  public removeClient(client: any): void {
    this.connectedClients.delete(client);
    console.log(`📡 Client disconnected. Total: ${this.connectedClients.size}`);
  }

  // Broadcast to all connected clients
  private broadcastToClients(event: string, data: any): void {
    if (this.connectedClients.size === 0) return;
    
    for (const client of this.connectedClients) {
      try {
        client.emit(event, data);
      } catch (error) {
        console.error('❌ Client broadcast error:', error);
        this.connectedClients.delete(client);
      }
    }
  }

  // Get recent alerts
  public getRecentAlerts(limit: number = 20): QuantumAlert[] {
    return this.alertHistory.slice(0, limit);
  }

  // Get sync statistics
  public getSyncStats(): any {
    return {
      connectedClients: this.connectedClients.size,
      lastUpdateTime: this.lastUpdateTime,
      totalAlerts: this.alertHistory.length,
      uptime: Date.now() - this.lastUpdateTime,
      isActive: !!this.updateInterval
    };
  }

  // Stop real-time sync
  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.connectedClients.clear();
    console.log('🛑 Real-time sync stopped');
  }
}

// Export singleton instance
export const realtimeSync = new RealtimeSyncService();
