interface MarketData {
  mint: string;
  symbol: string;
  price: number;
  volume: number;
  liquidity: number;
  whaleActivity: number;
  socialBuzz: number;
  timestamp: number;
}

interface MicroSignal {
  timestamp: number;
  signalType: 'buy' | 'sell' | 'hold' | 'strong_buy' | 'strong_sell';
  strength: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  expectedDuration: number; // seconds
  priceTarget: number;
  stopLoss: number;
}

interface TimingAnalysis {
  mint: string;
  currentSignal: MicroSignal;
  upcomingSignals: MicroSignal[];
  volatilityPrediction: {
    next15s: number;
    next1m: number;
    next5m: number;
    next15m: number;
  };
  optimalTiming: {
    bestEntryTime: number; // seconds from now
    bestExitTime: number; // seconds from now
    riskWindow: number; // seconds
  };
  marketMicrostructure: {
    bidAskSpread: number;
    marketDepth: number;
    orderFlowImbalance: number;
    liquidityScore: number;
  };
  technicalIndicators: {
    momentum: number;
    trend: number;
    reversal: number;
    breakout: number;
  };
  smartMoneyActivity: {
    whaleAccumulation: boolean;
    institutionalFlow: 'buying' | 'selling' | 'neutral';
    smartMoneyConfidence: number;
  };
}

class MicroTimingPredictor {
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private signalHistory: Map<string, MicroSignal[]> = new Map();

  async analyzeMicroTiming(marketData: MarketData): Promise<TimingAnalysis> {
    try {
      console.log(`⏱️ Analyzing micro-timing for ${marketData.symbol}`);

      // Update historical data
      this.updateHistory(marketData);

      // Generate current signal
      const currentSignal = await this.generateCurrentSignal(marketData);

      // Predict upcoming signals
      const upcomingSignals = await this.predictUpcomingSignals(marketData);

      // Calculate volatility predictions
      const volatilityPrediction = this.predictVolatility(marketData);

      // Determine optimal timing
      const optimalTiming = this.calculateOptimalTiming(marketData, currentSignal);

      // Analyze market microstructure
      const marketMicrostructure = this.analyzeMarketMicrostructure(marketData);

      // Calculate technical indicators
      const technicalIndicators = this.calculateTechnicalIndicators(marketData);

      // Analyze smart money activity
      const smartMoneyActivity = this.analyzeSmartMoneyActivity(marketData);

      return {
        mint: marketData.mint,
        currentSignal,
        upcomingSignals,
        volatilityPrediction,
        optimalTiming,
        marketMicrostructure,
        technicalIndicators,
        smartMoneyActivity
      };

    } catch (error) {
      console.error(`Error in micro-timing analysis for ${marketData.symbol}:`, error);
      return this.getFallbackAnalysis(marketData);
    }
  }

  private updateHistory(marketData: MarketData): void {
    const mint = marketData.mint;
    
    // Update price history (keep last 100 data points)
    if (!this.priceHistory.has(mint)) {
      this.priceHistory.set(mint, []);
    }
    const priceHist = this.priceHistory.get(mint)!;
    priceHist.push(marketData.price);
    if (priceHist.length > 100) priceHist.shift();

    // Update volume history
    if (!this.volumeHistory.has(mint)) {
      this.volumeHistory.set(mint, []);
    }
    const volumeHist = this.volumeHistory.get(mint)!;
    volumeHist.push(marketData.volume);
    if (volumeHist.length > 100) volumeHist.shift();
  }

  private async generateCurrentSignal(marketData: MarketData): Promise<MicroSignal> {
    const priceHist = this.priceHistory.get(marketData.mint) || [];
    const volumeHist = this.volumeHistory.get(marketData.mint) || [];

    // Calculate momentum indicators
    const shortTermMomentum = this.calculateMomentum(priceHist, 5);
    const mediumTermMomentum = this.calculateMomentum(priceHist, 20);
    
    // Volume analysis
    const volumeTrend = this.calculateVolumeTrend(volumeHist);
    
    // Whale activity impact
    const whaleImpact = marketData.whaleActivity / 100;
    
    // Social sentiment impact
    const socialImpact = marketData.socialBuzz / 100;

    // Combine all factors
    let signalStrength = 0;
    signalStrength += shortTermMomentum * 30;
    signalStrength += mediumTermMomentum * 20;
    signalStrength += volumeTrend * 25;
    signalStrength += whaleImpact * 15;
    signalStrength += socialImpact * 10;

    // Determine signal type
    let signalType: MicroSignal['signalType'];
    if (signalStrength > 80) signalType = 'strong_buy';
    else if (signalStrength > 60) signalType = 'buy';
    else if (signalStrength < 20) signalType = 'strong_sell';
    else if (signalStrength < 40) signalType = 'sell';
    else signalType = 'hold';

    // Calculate confidence based on convergence of indicators
    const confidence = this.calculateConfidence(shortTermMomentum, mediumTermMomentum, volumeTrend, whaleImpact);

    // Generate reasoning
    const reasoning = this.generateSignalReasoning(signalType, shortTermMomentum, volumeTrend, whaleImpact, socialImpact);

    // Calculate targets
    const priceTarget = this.calculatePriceTarget(marketData.price, signalType, signalStrength);
    const stopLoss = this.calculateStopLoss(marketData.price, signalType);

    return {
      timestamp: Date.now(),
      signalType,
      strength: Math.floor(Math.abs(signalStrength - 50) * 2), // Convert to 0-100
      confidence: Math.floor(confidence * 100),
      reasoning,
      expectedDuration: this.calculateSignalDuration(signalType, confidence),
      priceTarget,
      stopLoss
    };
  }

  private async predictUpcomingSignals(marketData: MarketData): Promise<MicroSignal[]> {
    const upcomingSignals: MicroSignal[] = [];
    const baseTime = Date.now();

    // Predict signals for next 15 minutes at 15-second intervals
    for (let i = 1; i <= 60; i++) {
      const futureTime = baseTime + (i * 15 * 1000); // 15 seconds intervals
      
      // Use Monte Carlo simulation for future predictions
      const futureSignal = this.simulateFutureSignal(marketData, i * 15);
      futureSignal.timestamp = futureTime;
      
      upcomingSignals.push(futureSignal);
    }

    return upcomingSignals.slice(0, 20); // Return next 20 signals (5 minutes)
  }

  private simulateFutureSignal(marketData: MarketData, secondsAhead: number): MicroSignal {
    // Simulate market evolution
    const volatility = this.estimateVolatility(marketData);
    const trend = this.estimateTrend(marketData);
    
    // Random walk with drift
    const drift = trend * (secondsAhead / 3600); // hourly trend
    const randomComponent = (Math.random() - 0.5) * volatility * Math.sqrt(secondsAhead / 3600);
    
    const futurePrice = marketData.price * (1 + drift + randomComponent);
    const priceChange = (futurePrice - marketData.price) / marketData.price;

    // Determine signal based on predicted price change
    let signalType: MicroSignal['signalType'];
    let strength: number;

    if (priceChange > 0.05) {
      signalType = 'strong_buy';
      strength = 85;
    } else if (priceChange > 0.02) {
      signalType = 'buy';
      strength = 70;
    } else if (priceChange < -0.05) {
      signalType = 'strong_sell';
      strength = 85;
    } else if (priceChange < -0.02) {
      signalType = 'sell';
      strength = 70;
    } else {
      signalType = 'hold';
      strength = 50;
    }

    const confidence = Math.max(30, 90 - (secondsAhead / 10)); // Confidence decreases with time

    return {
      timestamp: 0, // Will be set by caller
      signalType,
      strength,
      confidence,
      reasoning: `Predicted ${signalType} signal based on trend analysis`,
      expectedDuration: 60,
      priceTarget: futurePrice,
      stopLoss: marketData.price * (signalType.includes('buy') ? 0.95 : 1.05)
    };
  }

  private predictVolatility(marketData: MarketData): TimingAnalysis['volatilityPrediction'] {
    const priceHist = this.priceHistory.get(marketData.mint) || [];
    const baseVolatility = this.calculateHistoricalVolatility(priceHist);
    
    // Adjust for current market conditions
    const whaleMultiplier = 1 + (marketData.whaleActivity / 200); // Higher whale activity = higher volatility
    const socialMultiplier = 1 + (marketData.socialBuzz / 300); // Higher social buzz = higher volatility
    const liquidityMultiplier = Math.max(0.5, 2 - (marketData.liquidity / 1000000)); // Lower liquidity = higher volatility

    const adjustedVolatility = baseVolatility * whaleMultiplier * socialMultiplier * liquidityMultiplier;

    return {
      next15s: adjustedVolatility * 0.1,
      next1m: adjustedVolatility * 0.3,
      next5m: adjustedVolatility * 0.7,
      next15m: adjustedVolatility * 1.2
    };
  }

  private calculateOptimalTiming(marketData: MarketData, currentSignal: MicroSignal): TimingAnalysis['optimalTiming'] {
    const volatility = this.estimateVolatility(marketData);
    
    let bestEntryTime = 0; // Now
    let bestExitTime = 300; // 5 minutes default
    let riskWindow = 60; // 1 minute

    // Adjust based on signal type and market conditions
    if (currentSignal.signalType === 'strong_buy') {
      bestEntryTime = 0; // Immediate entry
      bestExitTime = 180 + (currentSignal.confidence * 2); // 3-5 minutes
      riskWindow = 30; // Tight window for strong signals
    } else if (currentSignal.signalType === 'buy') {
      bestEntryTime = 15; // Wait 15 seconds for confirmation
      bestExitTime = 300; // 5 minutes
      riskWindow = 60;
    } else if (currentSignal.signalType.includes('sell')) {
      bestEntryTime = 0; // Immediate exit
      bestExitTime = 60; // Quick exit
      riskWindow = 30;
    } else {
      bestEntryTime = 60; // Wait for better signal
      bestExitTime = 600; // 10 minutes
      riskWindow = 120;
    }

    // Adjust for volatility
    if (volatility > 0.1) {
      riskWindow = Math.floor(riskWindow * 0.7); // Tighter windows in high volatility
    }

    return {
      bestEntryTime,
      bestExitTime,
      riskWindow
    };
  }

  private analyzeMarketMicrostructure(marketData: MarketData): TimingAnalysis['marketMicrostructure'] {
    // Simulate market microstructure analysis
    const bidAskSpread = Math.max(0.001, 0.01 / Math.sqrt(marketData.liquidity / 100000));
    const marketDepth = Math.min(100, marketData.liquidity / 10000);
    const orderFlowImbalance = (Math.random() - 0.5) * 2; // -1 to 1
    const liquidityScore = Math.min(100, marketData.liquidity / 10000);

    return {
      bidAskSpread,
      marketDepth,
      orderFlowImbalance,
      liquidityScore
    };
  }

  private calculateTechnicalIndicators(marketData: MarketData): TimingAnalysis['technicalIndicators'] {
    const priceHist = this.priceHistory.get(marketData.mint) || [];
    
    return {
      momentum: this.calculateMomentum(priceHist, 10) * 100,
      trend: this.estimateTrend(marketData) * 100,
      reversal: this.calculateReversalProbability(priceHist) * 100,
      breakout: this.calculateBreakoutProbability(priceHist, marketData.volume) * 100
    };
  }

  private analyzeSmartMoneyActivity(marketData: MarketData): TimingAnalysis['smartMoneyActivity'] {
    const whaleAccumulation = marketData.whaleActivity > 70;
    
    let institutionalFlow: 'buying' | 'selling' | 'neutral' = 'neutral';
    if (marketData.whaleActivity > 80) institutionalFlow = 'buying';
    else if (marketData.whaleActivity < 30) institutionalFlow = 'selling';

    const smartMoneyConfidence = Math.min(100, marketData.whaleActivity + marketData.socialBuzz / 2);

    return {
      whaleAccumulation,
      institutionalFlow,
      smartMoneyConfidence
    };
  }

  // Utility methods
  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    const current = prices[prices.length - 1];
    const previous = prices[prices.length - 1 - period];
    
    return (current - previous) / previous;
  }

  private calculateVolumeTrend(volumes: number[]): number {
    if (volumes.length < 2) return 0;
    
    const recent = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const older = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    
    return older > 0 ? (recent - older) / older : 0;
  }

  private calculateConfidence(momentum: number, mediumMomentum: number, volumeTrend: number, whaleImpact: number): number {
    // Confidence increases when indicators align
    const alignment = 1 - Math.abs(momentum - mediumMomentum);
    const volumeConfirmation = Math.abs(volumeTrend) > 0.1 ? 0.2 : 0;
    const whaleConfirmation = whaleImpact > 0.7 ? 0.3 : 0;
    
    return Math.min(0.95, 0.4 + alignment * 0.3 + volumeConfirmation + whaleConfirmation);
  }

  private generateSignalReasoning(signalType: string, momentum: number, volumeTrend: number, whaleImpact: number, socialImpact: number): string {
    const reasons = [];
    
    if (Math.abs(momentum) > 0.05) {
      reasons.push(`${momentum > 0 ? 'Positive' : 'Negative'} price momentum (${(momentum * 100).toFixed(1)}%)`);
    }
    
    if (Math.abs(volumeTrend) > 0.1) {
      reasons.push(`${volumeTrend > 0 ? 'Increasing' : 'Decreasing'} volume trend`);
    }
    
    if (whaleImpact > 0.7) {
      reasons.push('High whale activity detected');
    }
    
    if (socialImpact > 0.8) {
      reasons.push('Strong social media buzz');
    }

    return reasons.length > 0 ? reasons.join(', ') : `${signalType} signal based on technical analysis`;
  }

  private calculatePriceTarget(currentPrice: number, signalType: string, strength: number): number {
    const multiplier = strength / 100;
    
    switch (signalType) {
      case 'strong_buy':
        return currentPrice * (1 + 0.05 * multiplier);
      case 'buy':
        return currentPrice * (1 + 0.02 * multiplier);
      case 'strong_sell':
        return currentPrice * (1 - 0.05 * multiplier);
      case 'sell':
        return currentPrice * (1 - 0.02 * multiplier);
      default:
        return currentPrice;
    }
  }

  private calculateStopLoss(currentPrice: number, signalType: string): number {
    switch (signalType) {
      case 'strong_buy':
      case 'buy':
        return currentPrice * 0.95; // 5% stop loss
      case 'strong_sell':
      case 'sell':
        return currentPrice * 1.05; // 5% stop gain
      default:
        return currentPrice;
    }
  }

  private calculateSignalDuration(signalType: string, confidence: number): number {
    const baseDuration = signalType.includes('strong') ? 60 : 120;
    return Math.floor(baseDuration * confidence);
  }

  private estimateVolatility(marketData: MarketData): number {
    const priceHist = this.priceHistory.get(marketData.mint) || [];
    return this.calculateHistoricalVolatility(priceHist);
  }

  private calculateHistoricalVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.1; // Default volatility
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private estimateTrend(marketData: MarketData): number {
    const priceHist = this.priceHistory.get(marketData.mint) || [];
    if (priceHist.length < 10) return 0;
    
    const recent = priceHist.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const older = priceHist.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    
    return (recent - older) / older;
  }

  private calculateReversalProbability(prices: number[]): number {
    if (prices.length < 5) return 0.3;
    
    const trend = this.calculateMomentum(prices, 5);
    const volatility = this.calculateHistoricalVolatility(prices);
    
    // Higher probability of reversal with strong trends and high volatility
    return Math.min(0.8, Math.abs(trend) * 2 + volatility);
  }

  private calculateBreakoutProbability(prices: number[], volume: number): number {
    if (prices.length < 10) return 0.3;
    
    const volatility = this.calculateHistoricalVolatility(prices);
    const volumeScore = Math.min(1, volume / 1000000);
    
    // Higher volume and lower volatility suggest potential breakout
    return Math.min(0.9, volumeScore * 0.7 + (1 - volatility) * 0.3);
  }

  private getFallbackAnalysis(marketData: MarketData): TimingAnalysis {
    return {
      mint: marketData.mint,
      currentSignal: {
        timestamp: Date.now(),
        signalType: 'hold',
        strength: 50,
        confidence: 60,
        reasoning: 'Insufficient data for precise timing analysis',
        expectedDuration: 300,
        priceTarget: marketData.price,
        stopLoss: marketData.price * 0.95
      },
      upcomingSignals: [],
      volatilityPrediction: {
        next15s: 0.02,
        next1m: 0.05,
        next5m: 0.1,
        next15m: 0.15
      },
      optimalTiming: {
        bestEntryTime: 60,
        bestExitTime: 300,
        riskWindow: 120
      },
      marketMicrostructure: {
        bidAskSpread: 0.01,
        marketDepth: 50,
        orderFlowImbalance: 0,
        liquidityScore: 60
      },
      technicalIndicators: {
        momentum: 50,
        trend: 50,
        reversal: 30,
        breakout: 40
      },
      smartMoneyActivity: {
        whaleAccumulation: false,
        institutionalFlow: 'neutral',
        smartMoneyConfidence: 50
      }
    };
  }
}

export const microTimingPredictor = new MicroTimingPredictor();
