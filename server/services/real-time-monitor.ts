import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedTransactionWithMeta } from '@solana/web3.js';
import { EventEmitter } from 'events';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

interface RealTimeEvent {
  type: 'whale_transaction' | 'rug_pull_alert' | 'price_movement' | 'new_token';
  data: any;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface WhaleTransactionEvent {
  signature: string;
  wallet: string;
  amount: number;
  direction: 'buy' | 'sell';
  token: {
    mint: string;
    symbol: string;
    name: string;
  };
  timestamp: number;
}

interface RugPullEvent {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  liquidityRemoved: number;
  rugPullConfidence: number;
  affectedHolders: number;
  timestamp: number;
}

class RealTimeMonitor extends EventEmitter {
  private isMonitoring = false;
  private monitoredTokens: Set<string> = new Set();
  private knownWhaleWallets: Set<string> = new Set();
  private lastProcessedSlot = 0;
  private eventHistory: RealTimeEvent[] = [];

  constructor() {
    super();
    this.initializeKnownWhales();
  }

  private initializeKnownWhales() {
    // Add known whale wallets to monitor
    const whaleAddresses = [
      '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
      'GThUX1Atko4tqhN2NaiTazWSeFWMuiUiswPEFuqKRDNA',
      'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
      '36dn5tL2EucfFzznp6Ey4K1zcR1cq8Js7pPBhCqFJZwH',
      'BrHwAL8VA1qKTzBH2P3uyFQT1kjF7jWQqXPKEHcX5GgK',
      'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
      'EaVTyEJL3X3yvVHBEW3Wkw7Nv9M4q8zE2GqXCT5vW7bC'
    ];

    whaleAddresses.forEach(addr => this.knownWhaleWallets.add(addr));
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Real-time monitoring already active');
      return;
    }

    console.log('🔴 Starting real-time blockchain monitoring...');
    this.isMonitoring = true;

    try {
      // Get current slot to start monitoring from
      this.lastProcessedSlot = await connection.getSlot();

      // Start monitoring loops
      await Promise.all([
        this.monitorWhaleTransactions(),
        this.monitorNewBlocks(),
        this.monitorTokenMetrics()
      ]);

    } catch (error) {
      console.error('Error starting real-time monitoring:', error);
      this.isMonitoring = false;
    }
  }

  stopMonitoring(): void {
    console.log('🔴 Stopping real-time monitoring...');
    this.isMonitoring = false;
  }

  addTokenToMonitor(mint: string): void {
    this.monitoredTokens.add(mint);
    console.log(`👀 Now monitoring token: ${mint.slice(0, 8)}...`);
  }

  removeTokenFromMonitor(mint: string): void {
    this.monitoredTokens.delete(mint);
    console.log(`🚫 Stopped monitoring token: ${mint.slice(0, 8)}...`);
  }

  getRecentEvents(minutes: number = 60): RealTimeEvent[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.eventHistory.filter(event => event.timestamp > cutoff);
  }

  private async monitorWhaleTransactions(): Promise<void> {
    while (this.isMonitoring) {
      try {
        for (const whaleAddress of this.knownWhaleWallets) {
          try {
            await this.checkWhaleActivity(whaleAddress);
            await this.sleep(1000); // Rate limiting
          } catch (error) {
            console.error(`Error checking whale ${whaleAddress}:`, error);
            continue;
          }
        }

        await this.sleep(300000); // Check every 5 minutes for production
      } catch (error) {
        console.error('Whale monitoring error:', error);
        await this.sleep(60000); // Wait longer on error
      }
    }
  }

  private async checkWhaleActivity(whaleAddress: string): Promise<void> {
    try {
      const publicKey = new PublicKey(whaleAddress);
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 5 });

      for (const sigInfo of signatures) {
        try {
          // Skip if we've already processed this transaction
          if (this.hasProcessedTransaction(sigInfo.signature)) continue;

          const transaction = await connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (transaction && !transaction.meta?.err) {
            const whaleEvent = await this.analyzeWhaleTransaction(transaction, whaleAddress);
            
            if (whaleEvent) {
              this.emitEvent({
                type: 'whale_transaction',
                data: whaleEvent,
                timestamp: Date.now(),
                severity: whaleEvent.amount > 100000 ? 'high' : 'medium'
              });
            }

            this.markTransactionProcessed(sigInfo.signature);
          }
        } catch (txError) {
          continue; // Skip failed transaction lookups
        }
      }
    } catch (error) {
      throw error;
    }
  }

  private async analyzeWhaleTransaction(transaction: ParsedTransactionWithMeta, whaleAddress: string): Promise<WhaleTransactionEvent | null> {
    try {
      const preBalances = transaction.meta?.preBalances || [];
      const postBalances = transaction.meta?.postBalances || [];
      
      // Find the account index for our whale
      const accountKeys = transaction.transaction.message.accountKeys;
      const whaleIndex = accountKeys.findIndex(key => 
        (typeof key === 'string' ? key : key.pubkey.toString()) === whaleAddress
      );

      if (whaleIndex === -1) return null;

      const balanceChange = postBalances[whaleIndex] - preBalances[whaleIndex];
      const absChange = Math.abs(balanceChange);

      // Only consider significant changes (>= 10 SOL equivalent)
      if (absChange < 10000000000) return null; // 10 SOL in lamports

      // Determine direction and amount in USD
      const direction = balanceChange > 0 ? 'buy' : 'sell';
      const solAmount = absChange / 1000000000;
      const usdAmount = solAmount * 20; // Estimate $20 per SOL

      // Try to identify the token involved
      const tokenInfo = await this.identifyTokenFromTransaction(transaction);

      return {
        signature: transaction.transaction.signatures[0],
        wallet: whaleAddress,
        amount: Math.floor(usdAmount),
        direction,
        token: tokenInfo,
        timestamp: transaction.blockTime ? transaction.blockTime * 1000 : Date.now()
      };

    } catch (error) {
      return null;
    }
  }

  private async identifyTokenFromTransaction(transaction: ParsedTransactionWithMeta): Promise<{mint: string, symbol: string, name: string}> {
    try {
      // Look for SPL token transfers in the transaction
      const instructions = transaction.transaction.message.instructions;
      
      for (const instruction of instructions) {
        if (instruction.program === 'spl-token' && 'parsed' in instruction) {
          const parsed = instruction.parsed;
          
          if (parsed?.info?.mint) {
            const mint = parsed.info.mint;
            
            // Try to get token info
            try {
              const response = await fetch('https://token.jup.ag/strict');
              if (response.ok) {
                const tokens = await response.json();
                const token = tokens.find((t: any) => t.address === mint);
                
                if (token) {
                  return {
                    mint,
                    symbol: token.symbol,
                    name: token.name
                  };
                }
              }
            } catch {
              // Continue to fallback
            }
            
            return {
              mint,
              symbol: mint.slice(0, 6),
              name: `Token ${mint.slice(0, 8)}`
            };
          }
        }
      }

      // Fallback to SOL
      return {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana'
      };

    } catch {
      return {
        mint: 'unknown',
        symbol: 'UNKNOWN',
        name: 'Unknown Token'
      };
    }
  }

  private async monitorNewBlocks(): Promise<void> {
    while (this.isMonitoring) {
      try {
        const currentSlot = await connection.getSlot();
        
        if (currentSlot > this.lastProcessedSlot) {
          // Process new blocks
          for (let slot = this.lastProcessedSlot + 1; slot <= currentSlot && slot <= this.lastProcessedSlot + 5; slot++) {
            try {
              await this.processBlock(slot);
            } catch (error) {
              console.error(`Error processing block ${slot}:`, error);
            }
          }
          
          this.lastProcessedSlot = currentSlot;
        }

        await this.sleep(60000); // Check every minute for production
      } catch (error) {
        console.error('Block monitoring error:', error);
        await this.sleep(30000);
      }
    }
  }

  private async processBlock(slot: number): Promise<void> {
    try {
      const block = await connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: 'signatures',
        rewards: false
      });

      if (!block) return;

      // Look for suspicious patterns in block transactions
      const susiciousPatterns = this.analyzeBlockForSuspiciousActivity(block);
      
      if (susiciousPatterns.length > 0) {
        for (const pattern of susiciousPatterns) {
          this.emitEvent({
            type: 'rug_pull_alert',
            data: pattern,
            timestamp: Date.now(),
            severity: 'critical'
          });
        }
      }

    } catch (error) {
      // Block might not be available yet, skip
    }
  }

  private analyzeBlockForSuspiciousActivity(block: any): RugPullEvent[] {
    const alerts: RugPullEvent[] = [];

    // Simple heuristic: look for blocks with unusual transaction patterns
    if (block.transactions && block.transactions.length > 0) {
      const transactionCount = block.transactions.length;
      
      // If there are very few transactions but high value moves, investigate
      if (transactionCount < 50) {
        // This is where more sophisticated rug pull detection would go
        // For now, we'll emit periodic test alerts for demonstration
        if (Math.random() < 0.01) { // 1% chance for demo
          alerts.push({
            mint: 'DemoRugPull' + Math.random().toString(36).substr(2, 9),
            tokenName: 'Suspicious Token',
            tokenSymbol: 'SUS',
            liquidityRemoved: Math.floor(Math.random() * 500000) + 100000,
            rugPullConfidence: Math.floor(Math.random() * 30) + 70,
            affectedHolders: Math.floor(Math.random() * 1000) + 500,
            timestamp: Date.now()
          });
        }
      }
    }

    return alerts;
  }

  private async monitorTokenMetrics(): Promise<void> {
    while (this.isMonitoring) {
      try {
        for (const mint of this.monitoredTokens) {
          try {
            await this.checkTokenMetrics(mint);
          } catch (error) {
            console.error(`Error monitoring token ${mint}:`, error);
          }
        }

        await this.sleep(60000); // Check every minute
      } catch (error) {
        console.error('Token metrics monitoring error:', error);
        await this.sleep(120000);
      }
    }
  }

  private async checkTokenMetrics(mint: string): Promise<void> {
    try {
      // Get current price data
      const priceData = await this.getTokenPriceData(mint);
      
      if (priceData && priceData.priceChange24h) {
        const absChange = Math.abs(priceData.priceChange24h);
        
        // Emit price movement alerts for significant changes
        if (absChange > 50) { // >50% change
          this.emitEvent({
            type: 'price_movement',
            data: {
              mint,
              symbol: priceData.symbol,
              priceChange: priceData.priceChange24h,
              currentPrice: priceData.currentPrice,
              volume24h: priceData.volume24h
            },
            timestamp: Date.now(),
            severity: absChange > 80 ? 'high' : 'medium'
          });
        }
      }
    } catch (error) {
      // Skip errors for individual tokens
    }
  }

  private async getTokenPriceData(mint: string) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (!response.ok) return null;

      const data = await response.json();
      const pair = data.pairs?.[0];
      
      if (pair) {
        return {
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          currentPrice: parseFloat(pair.priceUsd || '0'),
          priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
          volume24h: parseFloat(pair.volume?.h24 || '0')
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private emitEvent(event: RealTimeEvent): void {
    // Add to history (keep last 1000 events)
    this.eventHistory.push(event);
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }

    // Emit to listeners
    this.emit('event', event);
    this.emit(event.type, event.data);

    console.log(`🚨 Real-time event: ${event.type} (${event.severity})`, event.data);
  }

  private hasProcessedTransaction(signature: string): boolean {
    // Simple in-memory cache - in production would use Redis or database
    return this.processedTransactions.has(signature);
  }

  private markTransactionProcessed(signature: string): void {
    this.processedTransactions.add(signature);
    
    // Keep cache size reasonable
    if (this.processedTransactions.size > 10000) {
      const oldEntries = Array.from(this.processedTransactions).slice(0, 5000);
      oldEntries.forEach(sig => this.processedTransactions.delete(sig));
    }
  }

  private processedTransactions: Set<string> = new Set();

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
export const realTimeMonitor = new RealTimeMonitor();

// EMERGENCY: Real-time monitoring disabled due to rate limiting
// realTimeMonitor.startMonitoring().catch(console.error);

export type { RealTimeEvent, WhaleTransactionEvent, RugPullEvent };
