import { dataPersistence } from './data-persistence';
import { PoolClient } from 'pg';

export interface BacktestStrategy {
  id: string;
  name: string;
  description: string;
  entry_conditions: {
    ai_score_min?: number;
    ai_score_max?: number;
    prediction_type?: 'bullish' | 'bearish' | 'neutral';
    confidence_min?: number;
    rug_risk_max?: 'low' | 'medium' | 'high';
    whale_activity_min?: number;
    social_sentiment_min?: number;
    volume_min?: number;
    market_cap_min?: number;
    market_cap_max?: number;
  };
  exit_conditions: {
    take_profit_pct?: number;
    stop_loss_pct?: number;
    max_hold_days?: number;
    trailing_stop_pct?: number;
  };
  position_sizing: {
    type: 'fixed_amount' | 'percentage' | 'kelly_criterion' | 'volatility_adjusted';
    value: number; // Amount in USD or percentage (0-100)
    max_position_size?: number; // Maximum position size in USD
  };
  risk_management: {
    max_positions?: number;
    max_drawdown_limit?: number; // Stop trading if drawdown exceeds this %
    correlation_limit?: number; // Don't take positions in highly correlated tokens
  };
}

export interface BacktestResult {
  strategy_id: string;
  period: {
    start_date: string;
    end_date: string;
    duration_days: number;
  };
  performance_metrics: {
    total_return: number;
    annualized_return: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    volatility: number;
    win_rate: number;
    profit_factor: number;
    calmar_ratio: number;
  };
  risk_metrics: {
    value_at_risk_95: number;
    expected_shortfall: number;
    downside_deviation: number;
    upside_capture: number;
    downside_capture: number;
  };
  trade_statistics: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    avg_winning_trade: number;
    avg_losing_trade: number;
    avg_trade_duration_days: number;
    largest_win: number;
    largest_loss: number;
  };
  portfolio_evolution: Array<{
    date: string;
    portfolio_value: number;
    cash: number;
    positions_value: number;
    drawdown: number;
    active_positions: number;
  }>;
  trades: Array<{
    token_mint: string;
    token_symbol: string;
    entry_date: string;
    exit_date?: string;
    entry_price: number;
    exit_price?: number;
    quantity: number;
    pnl: number;
    pnl_pct: number;
    hold_duration_days?: number;
    exit_reason: 'take_profit' | 'stop_loss' | 'max_hold' | 'strategy_exit' | 'active';
  }>;
  benchmark_comparison: {
    benchmark_return: number; // SOL buy-and-hold return
    alpha: number;
    beta: number;
    correlation: number;
    tracking_error: number;
    information_ratio: number;
  };
}

export class BacktestingEngine {
  private static instance: BacktestingEngine;

  public static getInstance(): BacktestingEngine {
    if (!BacktestingEngine.instance) {
      BacktestingEngine.instance = new BacktestingEngine();
    }
    return BacktestingEngine.instance;
  }

  // ================== MAIN BACKTESTING FUNCTION ==================

  async runBacktest(
    strategy: BacktestStrategy,
    startDate: string,
    endDate: string,
    initialCapital: number = 100000
  ): Promise<BacktestResult> {
    console.log(`🔄 Starting backtest for strategy: ${strategy.name}`);
    console.log(`📅 Period: ${startDate} to ${endDate}`);
    console.log(`💰 Initial Capital: $${initialCapital.toLocaleString()}`);

    try {
      // Get historical data for the period
      const historicalData = await this.getHistoricalData(startDate, endDate);
      
      if (historicalData.length === 0) {
        throw new Error('No historical data available for the specified period');
      }

      // Initialize portfolio state
      const portfolioState = {
        cash: initialCapital,
        positions: new Map<string, any>(),
        portfolio_value: initialCapital,
        max_portfolio_value: initialCapital,
        trades: [] as any[],
        daily_values: [] as any[],
        active_positions_count: 0
      };

      // Process each day
      const tradingDays = this.generateTradingDays(startDate, endDate);
      
      for (const currentDate of tradingDays) {
        await this.processDay(strategy, currentDate, portfolioState, historicalData);
        
        // Record daily portfolio value
        this.recordDailyValue(portfolioState, currentDate);
      }

      // Close all remaining positions at the end
      await this.closeAllPositions(portfolioState, endDate, historicalData);

      // Calculate performance metrics
      const result = await this.calculateResults(
        strategy,
        startDate,
        endDate,
        initialCapital,
        portfolioState
      );

      console.log(`✅ Backtest completed for ${strategy.name}`);
      console.log(`📊 Total Return: ${result.performance_metrics.total_return.toFixed(2)}%`);
      console.log(`📈 Sharpe Ratio: ${result.performance_metrics.sharpe_ratio.toFixed(2)}`);
      console.log(`📉 Max Drawdown: ${result.performance_metrics.max_drawdown.toFixed(2)}%`);

      return result;

    } catch (error) {
      console.error('❌ Backtest failed:', error);
      throw error;
    }
  }

  // ================== DATA COLLECTION ==================

  private async getHistoricalData(startDate: string, endDate: string): Promise<any[]> {
    try {
      // Get all tokens with data in the period
      const tokens = await dataPersistence.getAllActiveTokens();
      const historicalData = [];

      for (const token of tokens) {
        // Get price data
        const prices = await dataPersistence.getHistoricalPrices(
          token.mint_address, 
          '30d', 
          1000
        );

        // Get prediction data
        const predictions = await dataPersistence.getPredictionHistory(
          token.mint_address, 
          30
        );

        // Combine data by date
        const tokenData = {
          token,
          prices: prices.filter(p => 
            p.timestamp >= new Date(startDate) && 
            p.timestamp <= new Date(endDate)
          ),
          predictions: predictions.filter(p => 
            p.prediction_time >= new Date(startDate) && 
            p.prediction_time <= new Date(endDate)
          )
        };

        if (tokenData.prices.length > 0 || tokenData.predictions.length > 0) {
          historicalData.push(tokenData);
        }
      }

      return historicalData;
    } catch (error) {
      console.error('❌ Error getting historical data:', error);
      return [];
    }
  }

  // ================== TRADING SIMULATION ==================

  private async processDay(
    strategy: BacktestStrategy,
    currentDate: string,
    portfolioState: any,
    historicalData: any[]
  ): Promise<void> {
    const currentDateObj = new Date(currentDate);

    // 1. Check for exit conditions on existing positions
    await this.checkExitConditions(strategy, currentDate, portfolioState, historicalData);

    // 2. Look for new entry opportunities
    if (portfolioState.active_positions_count < (strategy.risk_management.max_positions || 10)) {
      await this.checkEntryConditions(strategy, currentDate, portfolioState, historicalData);
    }

    // 3. Update position values
    this.updatePositionValues(portfolioState, currentDate, historicalData);

    // 4. Check risk management rules
    this.checkRiskManagement(strategy, portfolioState);
  }

  private async checkEntryConditions(
    strategy: BacktestStrategy,
    currentDate: string,
    portfolioState: any,
    historicalData: any[]
  ): Promise<void> {
    for (const tokenData of historicalData) {
      // Find relevant prediction for this date
      const prediction = this.findPredictionForDate(tokenData.predictions, currentDate);
      const priceData = this.findPriceDataForDate(tokenData.prices, currentDate);

      if (!prediction || !priceData) continue;

      // Check if entry conditions are met
      if (this.meetsEntryConditions(strategy, prediction, priceData)) {
        // Calculate position size
        const positionSize = this.calculatePositionSize(
          strategy,
          portfolioState,
          priceData,
          prediction
        );

        if (positionSize > 0 && portfolioState.cash >= positionSize) {
          // Enter position
          this.enterPosition(
            tokenData.token,
            currentDate,
            priceData,
            positionSize,
            prediction,
            portfolioState
          );
        }
      }
    }
  }

  private async checkExitConditions(
    strategy: BacktestStrategy,
    currentDate: string,
    portfolioState: any,
    historicalData: any[]
  ): Promise<void> {
    const positionsToClose = [];

    for (const [mintAddress, position] of portfolioState.positions) {
      const tokenData = historicalData.find(td => td.token.mint_address === mintAddress);
      if (!tokenData) continue;

      const currentPrice = this.getCurrentPrice(tokenData.prices, currentDate);
      if (!currentPrice) continue;

      const pnlPct = ((currentPrice - position.entry_price) / position.entry_price) * 100;
      const holdDays = this.calculateHoldDays(position.entry_date, currentDate);

      let exitReason = null;

      // Check exit conditions
      if (strategy.exit_conditions.take_profit_pct && pnlPct >= strategy.exit_conditions.take_profit_pct) {
        exitReason = 'take_profit';
      } else if (strategy.exit_conditions.stop_loss_pct && pnlPct <= -strategy.exit_conditions.stop_loss_pct) {
        exitReason = 'stop_loss';
      } else if (strategy.exit_conditions.max_hold_days && holdDays >= strategy.exit_conditions.max_hold_days) {
        exitReason = 'max_hold';
      }

      if (exitReason) {
        positionsToClose.push({ mintAddress, exitReason, currentPrice });
      }
    }

    // Close positions
    for (const { mintAddress, exitReason, currentPrice } of positionsToClose) {
      this.exitPosition(mintAddress, currentDate, currentPrice, exitReason, portfolioState);
    }
  }

  private meetsEntryConditions(strategy: BacktestStrategy, prediction: any, priceData: any): boolean {
    const conditions = strategy.entry_conditions;

    // AI Score checks
    if (conditions.ai_score_min && prediction.ai_score < conditions.ai_score_min) return false;
    if (conditions.ai_score_max && prediction.ai_score > conditions.ai_score_max) return false;

    // Prediction type check
    if (conditions.prediction_type && prediction.prediction_type !== conditions.prediction_type) return false;

    // Confidence check
    if (conditions.confidence_min && prediction.confidence_level < conditions.confidence_min) return false;

    // Rug risk check
    if (conditions.rug_risk_max) {
      const riskOrder = { 'low': 1, 'medium': 2, 'high': 3 };
      if (riskOrder[prediction.rug_risk] > riskOrder[conditions.rug_risk_max]) return false;
    }

    // Volume check
    if (conditions.volume_min && priceData.volume_24h < conditions.volume_min) return false;

    // Market cap checks
    if (conditions.market_cap_min && priceData.market_cap < conditions.market_cap_min) return false;
    if (conditions.market_cap_max && priceData.market_cap > conditions.market_cap_max) return false;

    return true;
  }

  private calculatePositionSize(
    strategy: BacktestStrategy,
    portfolioState: any,
    priceData: any,
    prediction: any
  ): number {
    const sizing = strategy.position_sizing;
    let positionSize = 0;

    switch (sizing.type) {
      case 'fixed_amount':
        positionSize = sizing.value;
        break;

      case 'percentage':
        positionSize = (portfolioState.portfolio_value * sizing.value) / 100;
        break;

      case 'kelly_criterion':
        // Simplified Kelly formula: f = (bp - q) / b
        // where b = odds, p = win probability, q = lose probability
        const winRate = prediction.confidence_level / 100;
        const avgWin = 0.15; // Assume 15% average win
        const avgLoss = 0.08; // Assume 8% average loss
        const kelly = (avgWin * winRate - (1 - winRate)) / avgWin;
        positionSize = Math.max(0, Math.min(0.25, kelly)) * portfolioState.portfolio_value; // Cap at 25%
        break;

      case 'volatility_adjusted':
        // Adjust position size based on token volatility
        const volatility = this.estimateVolatility(priceData);
        const baseSize = (portfolioState.portfolio_value * sizing.value) / 100;
        positionSize = baseSize / Math.max(1, volatility * 10); // Reduce size for high volatility
        break;
    }

    // Apply maximum position size limit
    if (sizing.max_position_size) {
      positionSize = Math.min(positionSize, sizing.max_position_size);
    }

    // Ensure we don't exceed available cash
    positionSize = Math.min(positionSize, portfolioState.cash);

    return positionSize;
  }

  private enterPosition(
    token: any,
    date: string,
    priceData: any,
    positionSize: number,
    prediction: any,
    portfolioState: any
  ): void {
    const entryPrice = priceData.close_price;
    const quantity = positionSize / entryPrice;

    const position = {
      token_mint: token.mint_address,
      token_symbol: token.symbol,
      entry_date: date,
      entry_price: entryPrice,
      quantity: quantity,
      initial_value: positionSize,
      prediction: prediction
    };

    portfolioState.positions.set(token.mint_address, position);
    portfolioState.cash -= positionSize;
    portfolioState.active_positions_count++;

    console.log(`📈 ENTER: ${token.symbol} at $${entryPrice.toFixed(6)} (${quantity.toFixed(0)} tokens, $${positionSize.toFixed(0)})`);
  }

  private exitPosition(
    mintAddress: string,
    date: string,
    exitPrice: number,
    exitReason: string,
    portfolioState: any
  ): void {
    const position = portfolioState.positions.get(mintAddress);
    if (!position) return;

    const exitValue = position.quantity * exitPrice;
    const pnl = exitValue - position.initial_value;
    const pnlPct = (pnl / position.initial_value) * 100;
    const holdDays = this.calculateHoldDays(position.entry_date, date);

    const trade = {
      token_mint: position.token_mint,
      token_symbol: position.token_symbol,
      entry_date: position.entry_date,
      exit_date: date,
      entry_price: position.entry_price,
      exit_price: exitPrice,
      quantity: position.quantity,
      pnl: pnl,
      pnl_pct: pnlPct,
      hold_duration_days: holdDays,
      exit_reason: exitReason
    };

    portfolioState.trades.push(trade);
    portfolioState.cash += exitValue;
    portfolioState.positions.delete(mintAddress);
    portfolioState.active_positions_count--;

    console.log(`📉 EXIT: ${position.token_symbol} at $${exitPrice.toFixed(6)} (${exitReason}, PnL: ${pnlPct.toFixed(1)}%)`);
  }

  // ================== UTILITY FUNCTIONS ==================

  private findPredictionForDate(predictions: any[], date: string): any {
    const targetDate = new Date(date);
    return predictions.find(p => {
      const predDate = new Date(p.prediction_time);
      return Math.abs(predDate.getTime() - targetDate.getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
    });
  }

  private findPriceDataForDate(prices: any[], date: string): any {
    const targetDate = new Date(date);
    return prices.find(p => {
      const priceDate = new Date(p.timestamp);
      return Math.abs(priceDate.getTime() - targetDate.getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
    });
  }

  private getCurrentPrice(prices: any[], date: string): number | null {
    const priceData = this.findPriceDataForDate(prices, date);
    return priceData ? parseFloat(priceData.close_price) : null;
  }

  private calculateHoldDays(entryDate: string, exitDate: string): number {
    const entry = new Date(entryDate);
    const exit = new Date(exitDate);
    return Math.floor((exit.getTime() - entry.getTime()) / (24 * 60 * 60 * 1000));
  }

  private estimateVolatility(priceData: any): number {
    // Simplified volatility estimation
    const price = parseFloat(priceData.close_price);
    const high = parseFloat(priceData.high_price);
    const low = parseFloat(priceData.low_price);
    return (high - low) / price; // Daily range as volatility proxy
  }

  private generateTradingDays(startDate: string, endDate: string): string[] {
    const days = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private updatePositionValues(portfolioState: any, date: string, historicalData: any[]): void {
    let totalPositionValue = 0;

    for (const [mintAddress, position] of portfolioState.positions) {
      const tokenData = historicalData.find(td => td.token.mint_address === mintAddress);
      if (tokenData) {
        const currentPrice = this.getCurrentPrice(tokenData.prices, date);
        if (currentPrice) {
          position.current_price = currentPrice;
          position.current_value = position.quantity * currentPrice;
          totalPositionValue += position.current_value;
        }
      }
    }

    portfolioState.portfolio_value = portfolioState.cash + totalPositionValue;
    portfolioState.max_portfolio_value = Math.max(portfolioState.max_portfolio_value, portfolioState.portfolio_value);
  }

  private recordDailyValue(portfolioState: any, date: string): void {
    const positionsValue = Array.from(portfolioState.positions.values())
      .reduce((sum: number, pos: any) => sum + (pos.current_value || pos.initial_value), 0);

    const drawdown = ((portfolioState.max_portfolio_value - portfolioState.portfolio_value) / portfolioState.max_portfolio_value) * 100;

    portfolioState.daily_values.push({
      date,
      portfolio_value: portfolioState.portfolio_value,
      cash: portfolioState.cash,
      positions_value: positionsValue,
      drawdown: Math.max(0, drawdown),
      active_positions: portfolioState.active_positions_count
    });
  }

  private checkRiskManagement(strategy: BacktestStrategy, portfolioState: any): void {
    // Check maximum drawdown limit
    if (strategy.risk_management.max_drawdown_limit) {
      const currentDrawdown = ((portfolioState.max_portfolio_value - portfolioState.portfolio_value) / portfolioState.max_portfolio_value) * 100;
      
      if (currentDrawdown > strategy.risk_management.max_drawdown_limit) {
        console.log(`⚠️ Maximum drawdown limit exceeded: ${currentDrawdown.toFixed(2)}%`);
        // In a real implementation, this would stop trading
      }
    }
  }

  private async closeAllPositions(portfolioState: any, endDate: string, historicalData: any[]): Promise<void> {
    for (const [mintAddress, position] of portfolioState.positions) {
      const tokenData = historicalData.find(td => td.token.mint_address === mintAddress);
      if (tokenData) {
        const finalPrice = this.getCurrentPrice(tokenData.prices, endDate);
        if (finalPrice) {
          this.exitPosition(mintAddress, endDate, finalPrice, 'strategy_exit', portfolioState);
        }
      }
    }
  }

  // ================== RESULTS CALCULATION ==================

  private async calculateResults(
    strategy: BacktestStrategy,
    startDate: string,
    endDate: string,
    initialCapital: number,
    portfolioState: any
  ): Promise<BacktestResult> {
    const finalValue = portfolioState.portfolio_value;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
    const durationDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000);
    const annualizedReturn = (Math.pow(finalValue / initialCapital, 365 / durationDays) - 1) * 100;

    // Calculate performance metrics
    const dailyReturns = this.calculateDailyReturns(portfolioState.daily_values);
    const performanceMetrics = this.calculatePerformanceMetrics(dailyReturns, totalReturn, annualizedReturn);
    const riskMetrics = this.calculateRiskMetrics(dailyReturns);
    const tradeStatistics = this.calculateTradeStatistics(portfolioState.trades);

    // Calculate benchmark comparison (SOL buy-and-hold)
    const benchmarkComparison = await this.calculateBenchmarkComparison(
      startDate,
      endDate,
      initialCapital,
      dailyReturns
    );

    return {
      strategy_id: strategy.id,
      period: {
        start_date: startDate,
        end_date: endDate,
        duration_days: Math.floor(durationDays)
      },
      performance_metrics: performanceMetrics,
      risk_metrics: riskMetrics,
      trade_statistics: tradeStatistics,
      portfolio_evolution: portfolioState.daily_values,
      trades: portfolioState.trades,
      benchmark_comparison: benchmarkComparison
    };
  }

  private calculateDailyReturns(dailyValues: any[]): number[] {
    const returns = [];
    for (let i = 1; i < dailyValues.length; i++) {
      const prevValue = dailyValues[i - 1].portfolio_value;
      const currentValue = dailyValues[i].portfolio_value;
      const dailyReturn = (currentValue - prevValue) / prevValue;
      returns.push(dailyReturn);
    }
    return returns;
  }

  private calculatePerformanceMetrics(
    dailyReturns: number[],
    totalReturn: number,
    annualizedReturn: number
  ): BacktestResult['performance_metrics'] {
    if (dailyReturns.length === 0) {
      return {
        total_return: totalReturn,
        annualized_return: annualizedReturn,
        sharpe_ratio: 0,
        sortino_ratio: 0,
        max_drawdown: 0,
        volatility: 0,
        win_rate: 0,
        profit_factor: 0,
        calmar_ratio: 0
      };
    }

    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const volatility = Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length) * Math.sqrt(252);
    
    const riskFreeRate = 0.02; // 2% annual risk-free rate
    const sharpeRatio = volatility > 0 ? (annualizedReturn / 100 - riskFreeRate) / volatility : 0;

    // Calculate Sortino ratio (downside deviation)
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downsideDeviation = negativeReturns.length > 0 ?
      Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length) * Math.sqrt(252) :
      0;
    const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn / 100 - riskFreeRate) / downsideDeviation : 0;

    // Calculate maximum drawdown
    let maxDrawdown = 0;
    let peak = 1;
    for (const returnVal of dailyReturns) {
      peak = Math.max(peak, peak * (1 + returnVal));
      const drawdown = (peak - peak * (1 + returnVal)) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    const calmarRatio = maxDrawdown > 0 ? (annualizedReturn / 100) / maxDrawdown : 0;

    return {
      total_return: Number(totalReturn.toFixed(2)),
      annualized_return: Number(annualizedReturn.toFixed(2)),
      sharpe_ratio: Number(sharpeRatio.toFixed(3)),
      sortino_ratio: Number(sortinoRatio.toFixed(3)),
      max_drawdown: Number((maxDrawdown * 100).toFixed(2)),
      volatility: Number((volatility * 100).toFixed(2)),
      win_rate: 0, // Will be calculated from trade statistics
      profit_factor: 0, // Will be calculated from trade statistics
      calmar_ratio: Number(calmarRatio.toFixed(3))
    };
  }

  private calculateRiskMetrics(dailyReturns: number[]): BacktestResult['risk_metrics'] {
    if (dailyReturns.length === 0) {
      return {
        value_at_risk_95: 0,
        expected_shortfall: 0,
        downside_deviation: 0,
        upside_capture: 0,
        downside_capture: 0
      };
    }

    // Sort returns for VaR calculation
    const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const valueAtRisk95 = Math.abs(sortedReturns[var95Index] || 0) * 100;

    // Expected Shortfall (average of returns below VaR)
    const expectedShortfall = sortedReturns.slice(0, var95Index + 1)
      .reduce((sum, r) => sum + Math.abs(r), 0) / (var95Index + 1) * 100;

    // Downside deviation
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const downsideReturns = dailyReturns.filter(r => r < avgReturn);
    const downsideDeviation = downsideReturns.length > 0 ?
      Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / downsideReturns.length) * Math.sqrt(252) * 100 :
      0;

    return {
      value_at_risk_95: Number(valueAtRisk95.toFixed(2)),
      expected_shortfall: Number(expectedShortfall.toFixed(2)),
      downside_deviation: Number(downsideDeviation.toFixed(2)),
      upside_capture: 0, // Would need benchmark data
      downside_capture: 0 // Would need benchmark data
    };
  }

  private calculateTradeStatistics(trades: any[]): BacktestResult['trade_statistics'] {
    if (trades.length === 0) {
      return {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        avg_winning_trade: 0,
        avg_losing_trade: 0,
        avg_trade_duration_days: 0,
        largest_win: 0,
        largest_loss: 0
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);

    const avgWinningTrade = winningTrades.length > 0 ?
      winningTrades.reduce((sum, t) => sum + t.pnl_pct, 0) / winningTrades.length : 0;

    const avgLosingTrade = losingTrades.length > 0 ?
      losingTrades.reduce((sum, t) => sum + t.pnl_pct, 0) / losingTrades.length : 0;

    const avgDuration = trades.reduce((sum, t) => sum + (t.hold_duration_days || 0), 0) / trades.length;

    const largestWin = Math.max(...trades.map(t => t.pnl_pct), 0);
    const largestLoss = Math.min(...trades.map(t => t.pnl_pct), 0);

    return {
      total_trades: trades.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      avg_winning_trade: Number(avgWinningTrade.toFixed(2)),
      avg_losing_trade: Number(avgLosingTrade.toFixed(2)),
      avg_trade_duration_days: Number(avgDuration.toFixed(1)),
      largest_win: Number(largestWin.toFixed(2)),
      largest_loss: Number(largestLoss.toFixed(2))
    };
  }

  private async calculateBenchmarkComparison(
    startDate: string,
    endDate: string,
    initialCapital: number,
    portfolioReturns: number[]
  ): Promise<BacktestResult['benchmark_comparison']> {
    // Mock SOL benchmark data
    const solReturn = 150; // Assume 150% return for SOL in the period
    const benchmarkReturns = this.generateBenchmarkReturns(portfolioReturns.length, solReturn / 100);

    const alpha = this.calculateAlpha(portfolioReturns, benchmarkReturns);
    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns);
    const correlation = this.calculateCorrelation(portfolioReturns, benchmarkReturns);
    const trackingError = this.calculateTrackingError(portfolioReturns, benchmarkReturns);

    return {
      benchmark_return: Number(solReturn.toFixed(2)),
      alpha: Number(alpha.toFixed(4)),
      beta: Number(beta.toFixed(3)),
      correlation: Number(correlation.toFixed(3)),
      tracking_error: Number(trackingError.toFixed(2)),
      information_ratio: trackingError > 0 ? Number((alpha / trackingError).toFixed(3)) : 0
    };
  }

  // Helper methods for statistical calculations
  private generateBenchmarkReturns(length: number, totalReturn: number): number[] {
    const dailyReturn = Math.pow(1 + totalReturn, 1 / length) - 1;
    const volatility = 0.03; // 3% daily volatility for SOL
    
    const returns = [];
    for (let i = 0; i < length; i++) {
      const randomFactor = (Math.random() - 0.5) * volatility;
      returns.push(dailyReturn + randomFactor);
    }
    return returns;
  }

  private calculateAlpha(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;
    
    const portfolioAvg = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const benchmarkAvg = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns);
    
    return (portfolioAvg - 0.02 / 252) - beta * (benchmarkAvg - 0.02 / 252); // Daily alpha
  }

  private calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 1;
    
    const portfolioAvg = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const benchmarkAvg = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
    
    let covariance = 0;
    let benchmarkVariance = 0;
    
    for (let i = 0; i < portfolioReturns.length; i++) {
      const portfolioDiff = portfolioReturns[i] - portfolioAvg;
      const benchmarkDiff = benchmarkReturns[i] - benchmarkAvg;
      
      covariance += portfolioDiff * benchmarkDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }
    
    return benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
  }

  private calculateCorrelation(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;
    
    const n = portfolioReturns.length;
    const sumX = portfolioReturns.reduce((sum, r) => sum + r, 0);
    const sumY = benchmarkReturns.reduce((sum, r) => sum + r, 0);
    const sumXY = portfolioReturns.reduce((sum, r, i) => sum + r * benchmarkReturns[i], 0);
    const sumX2 = portfolioReturns.reduce((sum, r) => sum + r * r, 0);
    const sumY2 = benchmarkReturns.reduce((sum, r) => sum + r * r, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateTrackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;
    
    const trackingDifferences = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
    const mean = trackingDifferences.reduce((sum, d) => sum + d, 0) / trackingDifferences.length;
    const variance = trackingDifferences.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / trackingDifferences.length;
    
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized tracking error in %
  }

  // ================== STRATEGY TEMPLATES ==================

  getStrategyTemplates(): BacktestStrategy[] {
    return [
      {
        id: 'high_confidence_momentum',
        name: 'High Confidence Momentum',
        description: 'Buy tokens with high AI scores and bullish predictions',
        entry_conditions: {
          ai_score_min: 80,
          prediction_type: 'bullish',
          confidence_min: 75,
          rug_risk_max: 'medium',
          volume_min: 50000
        },
        exit_conditions: {
          take_profit_pct: 30,
          stop_loss_pct: 15,
          max_hold_days: 7
        },
        position_sizing: {
          type: 'percentage',
          value: 5, // 5% per position
          max_position_size: 10000
        },
        risk_management: {
          max_positions: 10,
          max_drawdown_limit: 25
        }
      },
      {
        id: 'conservative_value',
        name: 'Conservative Value',
        description: 'Conservative approach focusing on lower risk tokens',
        entry_conditions: {
          ai_score_min: 60,
          confidence_min: 60,
          rug_risk_max: 'low',
          volume_min: 100000,
          market_cap_min: 1000000
        },
        exit_conditions: {
          take_profit_pct: 20,
          stop_loss_pct: 10,
          max_hold_days: 14
        },
        position_sizing: {
          type: 'percentage',
          value: 3, // 3% per position
          max_position_size: 5000
        },
        risk_management: {
          max_positions: 15,
          max_drawdown_limit: 15
        }
      }
    ];
  }
}

export const backtestingEngine = BacktestingEngine.getInstance();
