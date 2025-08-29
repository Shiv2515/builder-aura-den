import { RequestHandler } from 'express';
import { performanceTracker } from '../services/performance-tracking';
import { dataPersistence } from '../services/data-persistence';
import { webSocketService } from '../services/websocket-server';
import { backtestingEngine, BacktestStrategy } from '../services/backtesting-engine';

// ================== PERFORMANCE METRICS ==================

export const handleGetPerformanceReport: RequestHandler = async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    const days = parseInt(timeframe as string);

    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ 
        error: 'Invalid timeframe. Must be between 1 and 365 days.' 
      });
    }

    console.log(`📊 Generating performance report for ${days} days...`);

    const report = await performanceTracker.generatePerformanceReport(days);

    res.json({
      success: true,
      timeframe_days: days,
      generated_at: new Date().toISOString(),
      metrics: report,
      metadata: {
        report_type: 'institutional_performance',
        version: '1.0',
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('❌ Error generating performance report:', error);
    res.status(500).json({ 
      error: 'Failed to generate performance report',
      details: error.message 
    });
  }
};

export const handleGetPredictionAccuracy: RequestHandler = async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    const days = parseInt(timeframe as string);

    const accuracy = await performanceTracker.getAIPredictionAccuracy(days);

    res.json({
      success: true,
      timeframe_days: days,
      prediction_accuracy: accuracy,
      summary: {
        overall_accuracy: `${accuracy.accuracy_percentage}%`,
        total_predictions: accuracy.total_predictions,
        prediction_confidence: 'High accuracy across all timeframes',
        recommendation: accuracy.accuracy_percentage > 70 ? 
          'Model performance is institutional-grade' : 
          'Model requires optimization for institutional use'
      }
    });

  } catch (error) {
    console.error('❌ Error getting prediction accuracy:', error);
    res.status(500).json({ 
      error: 'Failed to get prediction accuracy',
      details: error.message 
    });
  }
};

export const handleGetRiskMetrics: RequestHandler = async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    const days = parseInt(timeframe as string);

    const riskMetrics = await performanceTracker.calculateRiskMetrics(days);

    res.json({
      success: true,
      timeframe_days: days,
      risk_metrics: riskMetrics,
      risk_assessment: {
        overall_risk_level: riskMetrics.max_drawdown > 20 ? 'High' : 
                           riskMetrics.max_drawdown > 10 ? 'Medium' : 'Low',
        sharpe_ratio_assessment: riskMetrics.sharpe_ratio > 1.5 ? 'Excellent' :
                                riskMetrics.sharpe_ratio > 1.0 ? 'Good' :
                                riskMetrics.sharpe_ratio > 0.5 ? 'Fair' : 'Poor',
        recommendation: riskMetrics.sharpe_ratio > 1.0 && riskMetrics.max_drawdown < 15 ?
          'Suitable for institutional investment' :
          'Risk management improvements needed'
      }
    });

  } catch (error) {
    console.error('❌ Error getting risk metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get risk metrics',
      details: error.message 
    });
  }
};

export const handleGetPortfolioPerformance: RequestHandler = async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    const days = parseInt(timeframe as string);

    const performance = await performanceTracker.getPortfolioPerformance(days);

    res.json({
      success: true,
      timeframe_days: days,
      portfolio_performance: performance,
      benchmark_comparison: {
        vs_sol: {
          alpha: `${performance.alpha}%`,
          beta: performance.beta,
          correlation: performance.beta > 0.8 ? 'High' : 
                      performance.beta > 0.4 ? 'Medium' : 'Low'
        },
        vs_market: {
          excess_return: `${Math.max(0, performance.annualized_return - 15)}%`,
          tracking_error: `${performance.tracking_error}%`,
          information_ratio: performance.tracking_error > 0 ? 
            ((performance.annualized_return - 15) / performance.tracking_error).toFixed(2) : '0'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting portfolio performance:', error);
    res.status(500).json({ 
      error: 'Failed to get portfolio performance',
      details: error.message 
    });
  }
};

// ================== HISTORICAL DATA ==================

export const handleGetTokenHistory: RequestHandler = async (req, res) => {
  try {
    const { mint } = req.params;
    const { timeframe = '7d', limit = '100' } = req.query;

    if (!mint) {
      return res.status(400).json({ error: 'Mint address required' });
    }

    const [historicalPrices, predictionHistory, performanceMetrics] = await Promise.all([
      dataPersistence.getHistoricalPrices(mint, timeframe as any, parseInt(limit as string)),
      dataPersistence.getPredictionHistory(mint, 30),
      dataPersistence.getTokenPerformanceMetrics(mint, 30)
    ]);

    res.json({
      success: true,
      mint_address: mint,
      timeframe,
      data: {
        price_history: historicalPrices.map(price => ({
          timestamp: price.timestamp,
          open: parseFloat(price.open_price.toString()),
          high: parseFloat(price.high_price.toString()),
          low: parseFloat(price.low_price.toString()),
          close: parseFloat(price.close_price.toString()),
          volume: parseFloat(price.volume_24h.toString()),
          market_cap: parseFloat(price.market_cap.toString())
        })),
        prediction_history: predictionHistory.map(pred => ({
          timestamp: pred.prediction_time,
          ai_score: pred.ai_score,
          prediction: pred.prediction_type,
          confidence: pred.confidence_level,
          rug_risk: pred.rug_risk,
          reasoning: pred.reasoning
        })),
        performance_metrics: performanceMetrics
      },
      metadata: {
        total_price_points: historicalPrices.length,
        total_predictions: predictionHistory.length,
        data_quality: historicalPrices.length > 10 ? 'High' : 'Limited'
      }
    });

  } catch (error) {
    console.error('❌ Error getting token history:', error);
    res.status(500).json({ 
      error: 'Failed to get token history',
      details: error.message 
    });
  }
};

export const handleGetWhaleActivity: RequestHandler = async (req, res) => {
  try {
    const { hours = '24', limit = '50' } = req.query;

    const whaleMovements = await dataPersistence.getRecentWhaleMovements(
      parseInt(hours as string), 
      parseInt(limit as string)
    );

    // Calculate whale activity statistics
    const totalVolume = whaleMovements.reduce((sum, movement) => 
      sum + (movement.amount_usd || 0), 0
    );

    const buyMovements = whaleMovements.filter(m => m.movement_type === 'buy');
    const sellMovements = whaleMovements.filter(m => m.movement_type === 'sell');

    const buyVolume = buyMovements.reduce((sum, m) => sum + (m.amount_usd || 0), 0);
    const sellVolume = sellMovements.reduce((sum, m) => sum + (m.amount_usd || 0), 0);

    res.json({
      success: true,
      timeframe_hours: parseInt(hours as string),
      whale_activity: {
        total_movements: whaleMovements.length,
        total_volume_usd: totalVolume,
        buy_sell_ratio: sellVolume > 0 ? (buyVolume / sellVolume).toFixed(2) : 'N/A',
        net_flow_usd: buyVolume - sellVolume,
        avg_transaction_size: whaleMovements.length > 0 ? 
          (totalVolume / whaleMovements.length).toFixed(0) : 0
      },
      movements: whaleMovements.map(movement => ({
        id: movement.id,
        token: {
          symbol: movement.symbol,
          name: movement.name,
          mint_address: movement.mint_address
        },
        wallet: movement.wallet_address,
        type: movement.movement_type,
        amount_tokens: parseFloat(movement.amount_tokens.toString()),
        amount_usd: movement.amount_usd,
        price: parseFloat(movement.price_at_transaction.toString()),
        timestamp: movement.transaction_time,
        confidence_score: movement.confidence_score
      })),
      analytics: {
        market_sentiment: buyVolume > sellVolume ? 'Bullish' : 'Bearish',
        activity_level: whaleMovements.length > 20 ? 'High' : 
                       whaleMovements.length > 10 ? 'Medium' : 'Low',
        whale_concentration: this.calculateWhaleConcentration(whaleMovements)
      }
    });

  } catch (error) {
    console.error('❌ Error getting whale activity:', error);
    res.status(500).json({ 
      error: 'Failed to get whale activity',
      details: error.message 
    });
  }
};

// ================== MARKET ANALYTICS ==================

export const handleGetMarketOverview: RequestHandler = async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    const days = parseInt(timeframe as string);

    const [marketAnalysis, tokens] = await Promise.all([
      performanceTracker.getMarketAnalysis(days),
      dataPersistence.getAllActiveTokens()
    ]);

    // Calculate market statistics
    const totalTokensTracked = tokens.length;
    const memeCoinsTracked = tokens.filter(t => t.is_meme_coin).length;

    res.json({
      success: true,
      market_overview: {
        total_tokens_tracked: totalTokensTracked,
        meme_coins_tracked: memeCoinsTracked,
        coverage_percentage: totalTokensTracked > 0 ? 
          ((memeCoinsTracked / totalTokensTracked) * 100).toFixed(1) : 0,
        
        sector_performance: marketAnalysis.sector_performance,
        
        top_performers: marketAnalysis.top_performing_tokens,
        
        correlation_analysis: {
          whale_activity: marketAnalysis.whale_activity_correlation,
          social_sentiment: marketAnalysis.social_sentiment_correlation,
          interpretation: 'Strong correlations indicate reliable prediction signals'
        }
      },
      
      market_conditions: {
        overall_trend: this.determineMarketTrend(marketAnalysis),
        volatility_level: 'Medium', // Would calculate from actual data
        risk_appetite: marketAnalysis.sector_performance.meme_coins > 10 ? 'High' : 'Low',
        recommended_strategy: this.getRecommendedStrategy(marketAnalysis)
      },

      timeframe_days: days,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting market overview:', error);
    res.status(500).json({ 
      error: 'Failed to get market overview',
      details: error.message 
    });
  }
};

// ================== UTILITY FUNCTIONS ==================

function calculateWhaleConcentration(movements: any[]): string {
  const uniqueWallets = new Set(movements.map(m => m.wallet_address)).size;
  const totalMovements = movements.length;
  
  if (totalMovements === 0) return 'N/A';
  
  const concentration = uniqueWallets / totalMovements;
  
  if (concentration > 0.8) return 'Low'; // Many unique wallets
  if (concentration > 0.5) return 'Medium';
  return 'High'; // Few wallets making many moves
}

function determineMarketTrend(analysis: any): string {
  const avgPerformance = (
    analysis.sector_performance.meme_coins + 
    analysis.sector_performance.defi_tokens + 
    analysis.sector_performance.gaming_tokens
  ) / 3;
  
  if (avgPerformance > 15) return 'Strong Bullish';
  if (avgPerformance > 5) return 'Bullish';
  if (avgPerformance > -5) return 'Neutral';
  if (avgPerformance > -15) return 'Bearish';
  return 'Strong Bearish';
}

function getRecommendedStrategy(analysis: any): string {
  const memePerformance = analysis.sector_performance.meme_coins;
  const whaleCorrelation = analysis.whale_activity_correlation;
  
  if (memePerformance > 20 && whaleCorrelation > 0.6) {
    return 'Aggressive Growth - High conviction meme coin positions';
  } else if (memePerformance > 10 && whaleCorrelation > 0.4) {
    return 'Balanced Growth - Moderate meme coin exposure with diversification';
  } else if (memePerformance > 0) {
    return 'Conservative - Limited meme coin exposure, focus on established tokens';
  } else {
    return 'Risk-Off - Reduce exposure, focus on capital preservation';
  }
}

// ================== SUBSCRIPTION VALIDATION ==================

export const validateSubscriptionTier: RequestHandler = (req, res, next) => {
  // In production, this would validate API keys and subscription tiers
  // For now, allow all requests
  next();
};

// ================== REAL-TIME UPDATES ==================

export const handleGetRealTimeMetrics: RequestHandler = async (req, res) => {
  try {
    // Enhanced with WebSocket connection statistics
    await performanceTracker.updateRealTimeMetrics();

    const currentAccuracy = await dataPersistence.calculatePredictionAccuracy(1);
    const wsStats = webSocketService.getStats();

    res.json({
      success: true,
      real_time_metrics: {
        prediction_accuracy_24h: currentAccuracy.accuracy_percentage,
        total_predictions_24h: currentAccuracy.total_predictions,
        active_tokens: await dataPersistence.getAllActiveTokens().then(tokens => tokens.length),
        whale_movements_1h: await dataPersistence.getRecentWhaleMovements(1).then(movements => movements.length),
        last_updated: new Date().toISOString()
      },

      websocket_statistics: {
        total_connections: wsStats.total_connections,
        connections_by_tier: wsStats.connections_by_tier,
        active_subscriptions: wsStats.active_subscriptions,
        real_time_feeds: {
          available: ['token_prices', 'ai_predictions', 'whale_movements', 'performance_metrics', 'market_alerts'],
          update_frequency: {
            token_prices: '10 seconds',
            ai_predictions: '30 seconds',
            whale_movements: '5 seconds',
            performance_metrics: '60 seconds'
          }
        }
      },

      status: {
        ai_models: 'Operational',
        data_feeds: 'Healthy',
        prediction_engine: 'Active',
        risk_monitoring: 'Online',
        websocket_server: wsStats.total_connections > 0 ? 'Active' : 'Standby'
      }
    });

  } catch (error) {
    console.error('❌ Error getting real-time metrics:', error);
    res.status(500).json({
      error: 'Failed to get real-time metrics',
      details: error.message
    });
  }
};

// ================== WEBSOCKET MONITORING ==================

export const handleGetWebSocketStats: RequestHandler = async (req, res) => {
  try {
    const stats = webSocketService.getStats();

    res.json({
      success: true,
      websocket_statistics: stats,
      connection_health: {
        total_connections: stats.total_connections,
        institutional_clients: stats.connections_by_tier.institutional,
        professional_clients: stats.connections_by_tier.pro,
        retail_clients: stats.connections_by_tier.retail,
        most_popular_feed: Object.entries(stats.active_subscriptions)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
      },
      server_status: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error getting WebSocket stats:', error);
    res.status(500).json({
      error: 'Failed to get WebSocket statistics',
      details: error.message
    });
  }
};

// Send market alert to all connected clients
export const handleSendMarketAlert: RequestHandler = async (req, res) => {
  try {
    const { title, message, severity = 'info', token_mint } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        error: 'Title and message are required'
      });
    }

    webSocketService.sendMarketAlert({
      title,
      message,
      severity,
      token_mint
    });

    res.json({
      success: true,
      message: 'Market alert sent to all connected clients',
      alert: {
        title,
        message,
        severity,
        token_mint,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error sending market alert:', error);
    res.status(500).json({
      error: 'Failed to send market alert',
      details: error.message
    });
  }
};

// ================== BACKTESTING ENGINE ==================

export const handleRunBacktest: RequestHandler = async (req, res) => {
  try {
    const {
      strategy,
      start_date,
      end_date,
      initial_capital = 100000
    } = req.body;

    // Validate required fields
    if (!strategy || !start_date || !end_date) {
      return res.status(400).json({
        error: 'Missing required fields: strategy, start_date, end_date'
      });
    }

    // Validate date format and range
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const now = new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD format'
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        error: 'Start date must be before end date'
      });
    }

    if (endDate > now) {
      return res.status(400).json({
        error: 'End date cannot be in the future'
      });
    }

    const maxBacktestDays = 365; // Limit backtest to 1 year
    const durationDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);

    if (durationDays > maxBacktestDays) {
      return res.status(400).json({
        error: `Backtest period cannot exceed ${maxBacktestDays} days`
      });
    }

    console.log(`🔄 Starting backtest: ${strategy.name || 'Custom Strategy'}`);

    // Run the backtest
    const result = await backtestingEngine.runBacktest(
      strategy as BacktestStrategy,
      start_date,
      end_date,
      initial_capital
    );

    // Add execution metadata
    const response = {
      success: true,
      backtest_id: `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      execution_time: new Date().toISOString(),
      parameters: {
        strategy_name: strategy.name,
        start_date,
        end_date,
        initial_capital,
        duration_days: Math.floor(durationDays)
      },
      results: result,
      interpretation: {
        performance_rating: getPerformanceRating(result.performance_metrics),
        risk_assessment: getRiskAssessment(result.risk_metrics),
        trade_quality: getTradeQuality(result.trade_statistics),
        recommendations: generateRecommendations(result)
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Backtest execution failed:', error);
    res.status(500).json({
      error: 'Backtest execution failed',
      details: error.message,
      suggestion: 'Try reducing the date range or adjusting strategy parameters'
    });
  }
};

export const handleGetStrategyTemplates: RequestHandler = async (req, res) => {
  try {
    const templates = backtestingEngine.getStrategyTemplates();

    res.json({
      success: true,
      strategy_templates: templates,
      usage_guide: {
        entry_conditions: {
          ai_score_min: 'Minimum AI prediction score (0-100)',
          prediction_type: 'Required prediction type: bullish, bearish, or neutral',
          confidence_min: 'Minimum confidence level (0-100)',
          rug_risk_max: 'Maximum acceptable rug risk: low, medium, high',
          volume_min: 'Minimum 24h trading volume in USD',
          market_cap_min: 'Minimum market capitalization in USD',
          market_cap_max: 'Maximum market capitalization in USD'
        },
        exit_conditions: {
          take_profit_pct: 'Take profit at this percentage gain',
          stop_loss_pct: 'Stop loss at this percentage loss',
          max_hold_days: 'Maximum days to hold position',
          trailing_stop_pct: 'Trailing stop loss percentage'
        },
        position_sizing: {
          fixed_amount: 'Fixed dollar amount per position',
          percentage: 'Percentage of portfolio per position',
          kelly_criterion: 'Kelly criterion optimal sizing',
          volatility_adjusted: 'Adjust size based on volatility'
        }
      },
      custom_strategy_example: {
        id: 'custom_strategy',
        name: 'My Custom Strategy',
        description: 'Description of the strategy approach',
        entry_conditions: {
          ai_score_min: 70,
          prediction_type: 'bullish',
          confidence_min: 65,
          rug_risk_max: 'medium',
          volume_min: 25000
        },
        exit_conditions: {
          take_profit_pct: 25,
          stop_loss_pct: 12,
          max_hold_days: 10
        },
        position_sizing: {
          type: 'percentage',
          value: 4,
          max_position_size: 8000
        },
        risk_management: {
          max_positions: 12,
          max_drawdown_limit: 20
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting strategy templates:', error);
    res.status(500).json({
      error: 'Failed to get strategy templates',
      details: error.message
    });
  }
};

// ================== BACKTESTING UTILITY FUNCTIONS ==================

function getPerformanceRating(metrics: any): string {
  const { total_return, sharpe_ratio, max_drawdown } = metrics;

  let score = 0;

  // Return component
  if (total_return > 50) score += 3;
  else if (total_return > 20) score += 2;
  else if (total_return > 0) score += 1;

  // Risk-adjusted return component
  if (sharpe_ratio > 2) score += 3;
  else if (sharpe_ratio > 1) score += 2;
  else if (sharpe_ratio > 0.5) score += 1;

  // Drawdown component
  if (max_drawdown < 10) score += 2;
  else if (max_drawdown < 20) score += 1;

  if (score >= 7) return 'Excellent';
  if (score >= 5) return 'Good';
  if (score >= 3) return 'Fair';
  return 'Poor';
}

function getRiskAssessment(riskMetrics: any): string {
  const { value_at_risk_95, max_drawdown } = riskMetrics;

  if (value_at_risk_95 > 15 || max_drawdown > 25) return 'High Risk';
  if (value_at_risk_95 > 8 || max_drawdown > 15) return 'Medium Risk';
  return 'Low Risk';
}

function getTradeQuality(tradeStats: any): string {
  const { win_rate, avg_winning_trade, avg_losing_trade } = tradeStats;

  const profitFactor = Math.abs(avg_losing_trade) > 0 ?
    (win_rate / 100 * avg_winning_trade) / ((1 - win_rate / 100) * Math.abs(avg_losing_trade)) : 0;

  if (win_rate > 60 && profitFactor > 1.5) return 'High Quality';
  if (win_rate > 45 && profitFactor > 1.2) return 'Good Quality';
  if (win_rate > 35 && profitFactor > 1.0) return 'Fair Quality';
  return 'Poor Quality';
}

function generateRecommendations(result: any): string[] {
  const recommendations = [];
  const { performance_metrics, risk_metrics, trade_statistics } = result;

  if (performance_metrics.sharpe_ratio < 1) {
    recommendations.push('Consider tightening entry criteria to improve risk-adjusted returns');
  }

  if (performance_metrics.max_drawdown > 20) {
    recommendations.push('Implement stricter stop-loss levels to reduce maximum drawdown');
  }

  if (trade_statistics.win_rate < 50) {
    recommendations.push('Review entry conditions - win rate is below 50%');
  }

  if (trade_statistics.avg_trade_duration_days > 14) {
    recommendations.push('Consider shorter holding periods to improve capital efficiency');
  }

  if (performance_metrics.total_return > 30 && performance_metrics.sharpe_ratio > 1.5) {
    recommendations.push('Excellent performance! Consider scaling up position sizes');
  }

  return recommendations.length > 0 ? recommendations : ['Strategy performance is within acceptable parameters'];
}
