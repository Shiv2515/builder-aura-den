-- PulseSignal AI - Institutional Database Schema
-- Designed for fund-grade data storage and analytics

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'retail' CHECK (subscription_tier IN ('retail', 'pro', 'institutional')),
    api_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Token Master Data
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    decimals INTEGER DEFAULT 9,
    total_supply BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_discovered TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_meme_coin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Historical Price Data (OHLCV)
CREATE TABLE token_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open_price DECIMAL(20, 10) NOT NULL,
    high_price DECIMAL(20, 10) NOT NULL,
    low_price DECIMAL(20, 10) NOT NULL,
    close_price DECIMAL(20, 10) NOT NULL,
    volume_24h DECIMAL(20, 2) DEFAULT 0,
    market_cap DECIMAL(20, 2) DEFAULT 0,
    liquidity_usd DECIMAL(20, 2) DEFAULT 0,
    holders_count INTEGER DEFAULT 0,
    source VARCHAR(50) DEFAULT 'dexscreener',
    UNIQUE(token_id, timestamp, source)
);

-- AI Predictions and Performance Tracking
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
    prediction_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ai_score DECIMAL(5, 2) NOT NULL CHECK (ai_score >= 0 AND ai_score <= 100),
    prediction_type VARCHAR(20) NOT NULL CHECK (prediction_type IN ('bullish', 'bearish', 'neutral')),
    confidence_level DECIMAL(5, 2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 100),
    time_horizon VARCHAR(20) DEFAULT '24h' CHECK (time_horizon IN ('1h', '4h', '24h', '7d', '30d')),
    target_price DECIMAL(20, 10),
    stop_loss DECIMAL(20, 10),
    rug_risk VARCHAR(10) CHECK (rug_risk IN ('low', 'medium', 'high')),
    whale_activity_score INTEGER DEFAULT 0,
    social_sentiment_score DECIMAL(5, 2) DEFAULT 0,
    model_version VARCHAR(20) DEFAULT 'v1.0',
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prediction Performance Tracking
CREATE TABLE prediction_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id UUID REFERENCES ai_predictions(id) ON DELETE CASCADE,
    actual_price_change DECIMAL(10, 4),
    actual_return_pct DECIMAL(10, 4),
    prediction_accuracy DECIMAL(5, 2),
    outcome_type VARCHAR(20) CHECK (outcome_type IN ('correct', 'incorrect', 'partial')),
    evaluation_time TIMESTAMP WITH TIME ZONE,
    max_price_reached DECIMAL(20, 10),
    min_price_reached DECIMAL(20, 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Whale Movement Tracking
CREATE TABLE whale_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL,
    transaction_signature VARCHAR(100) UNIQUE,
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('buy', 'sell')),
    amount_tokens DECIMAL(20, 10) NOT NULL,
    amount_usd DECIMAL(20, 2),
    price_at_transaction DECIMAL(20, 10),
    transaction_time TIMESTAMP WITH TIME ZONE NOT NULL,
    confidence_score DECIMAL(5, 2) DEFAULT 0,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio Tracking for Users
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    strategy_type VARCHAR(50) DEFAULT 'balanced' CHECK (strategy_type IN ('conservative', 'balanced', 'aggressive', 'custom')),
    initial_capital DECIMAL(20, 2) NOT NULL,
    current_value DECIMAL(20, 2) DEFAULT 0,
    total_return_pct DECIMAL(10, 4) DEFAULT 0,
    max_drawdown_pct DECIMAL(10, 4) DEFAULT 0,
    sharpe_ratio DECIMAL(10, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio Positions
CREATE TABLE portfolio_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
    entry_price DECIMAL(20, 10) NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    exit_price DECIMAL(20, 10),
    exit_time TIMESTAMP WITH TIME ZONE,
    quantity DECIMAL(20, 10) NOT NULL,
    position_type VARCHAR(10) DEFAULT 'long' CHECK (position_type IN ('long', 'short')),
    stop_loss DECIMAL(20, 10),
    take_profit DECIMAL(20, 10),
    current_price DECIMAL(20, 10),
    unrealized_pnl DECIMAL(20, 2) DEFAULT 0,
    realized_pnl DECIMAL(20, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(portfolio_id, token_id, entry_time)
);

-- Risk Management and Analytics
CREATE TABLE risk_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    calculation_date DATE NOT NULL,
    value_at_risk_1d DECIMAL(10, 4), -- 1-day VaR at 95% confidence
    value_at_risk_7d DECIMAL(10, 4), -- 7-day VaR at 95% confidence
    expected_shortfall DECIMAL(10, 4), -- Expected Shortfall (CVaR)
    volatility_annualized DECIMAL(10, 4),
    beta_to_sol DECIMAL(10, 4), -- Beta relative to SOL
    correlation_to_btc DECIMAL(10, 4), -- Correlation to BTC
    max_drawdown_current DECIMAL(10, 4),
    sharpe_ratio_30d DECIMAL(10, 4),
    sortino_ratio_30d DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(portfolio_id, calculation_date)
);

-- Market Data Sources and Quality
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name VARCHAR(50) UNIQUE NOT NULL,
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('price_feed', 'social', 'blockchain', 'news')),
    api_endpoint VARCHAR(255),
    reliability_score DECIMAL(5, 2) DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Trail for Compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription and Billing
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('retail', 'pro', 'institutional')),
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    price_usd DECIMAL(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
    stripe_subscription_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_tokens_mint_address ON tokens(mint_address);
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_token_prices_token_timestamp ON token_prices(token_id, timestamp DESC);
CREATE INDEX idx_token_prices_timestamp ON token_prices(timestamp DESC);
CREATE INDEX idx_ai_predictions_token_time ON ai_predictions(token_id, prediction_time DESC);
CREATE INDEX idx_ai_predictions_score ON ai_predictions(ai_score DESC);
CREATE INDEX idx_whale_movements_token_time ON whale_movements(token_id, transaction_time DESC);
CREATE INDEX idx_whale_movements_wallet ON whale_movements(wallet_address);
CREATE INDEX idx_portfolio_positions_portfolio ON portfolio_positions(portfolio_id, is_active);
CREATE INDEX idx_risk_metrics_portfolio_date ON risk_metrics(portfolio_id, calculation_date DESC);
CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, timestamp DESC);

-- Functions for automated calculations
CREATE OR REPLACE FUNCTION update_portfolio_value()
RETURNS TRIGGER AS $$
BEGIN
    -- Update portfolio current value when positions change
    UPDATE portfolios 
    SET current_value = (
        SELECT COALESCE(SUM(quantity * COALESCE(current_price, entry_price)), 0)
        FROM portfolio_positions 
        WHERE portfolio_id = NEW.portfolio_id AND is_active = TRUE
    ),
    updated_at = NOW()
    WHERE id = NEW.portfolio_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update portfolio values
CREATE TRIGGER trigger_update_portfolio_value
    AFTER INSERT OR UPDATE ON portfolio_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_value();

-- Function to calculate returns
CREATE OR REPLACE FUNCTION calculate_portfolio_returns(portfolio_uuid UUID, start_date DATE, end_date DATE)
RETURNS TABLE(
    daily_return DECIMAL(10, 4),
    cumulative_return DECIMAL(10, 4),
    volatility DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4)
) AS $$
DECLARE
    initial_value DECIMAL(20, 2);
    final_value DECIMAL(20, 2);
BEGIN
    -- Get initial portfolio value
    SELECT current_value INTO initial_value 
    FROM portfolios WHERE id = portfolio_uuid;
    
    -- Calculate and return metrics
    -- This is a simplified version - full implementation would be more complex
    RETURN QUERY
    SELECT 
        0.0::DECIMAL(10, 4) as daily_return,
        0.0::DECIMAL(10, 4) as cumulative_return, 
        0.0::DECIMAL(10, 4) as volatility,
        0.0::DECIMAL(10, 4) as max_drawdown;
END;
$$ LANGUAGE plpgsql;

-- Views for common queries
CREATE VIEW portfolio_performance AS
SELECT 
    p.id,
    p.name,
    p.current_value,
    p.initial_capital,
    ROUND(((p.current_value - p.initial_capital) / p.initial_capital * 100), 2) as total_return_pct,
    p.max_drawdown_pct,
    p.sharpe_ratio,
    COUNT(pp.id) as active_positions,
    p.updated_at
FROM portfolios p
LEFT JOIN portfolio_positions pp ON p.id = pp.portfolio_id AND pp.is_active = TRUE
GROUP BY p.id, p.name, p.current_value, p.initial_capital, p.max_drawdown_pct, p.sharpe_ratio, p.updated_at;

CREATE VIEW token_performance_summary AS
SELECT 
    t.symbol,
    t.name,
    tp.close_price as current_price,
    tp.market_cap,
    tp.volume_24h,
    AVG(ap.ai_score) as avg_ai_score,
    COUNT(ap.id) as prediction_count,
    COUNT(wm.id) as whale_movement_count
FROM tokens t
LEFT JOIN token_prices tp ON t.id = tp.token_id 
LEFT JOIN ai_predictions ap ON t.id = ap.token_id
LEFT JOIN whale_movements wm ON t.id = wm.token_id
WHERE tp.timestamp = (SELECT MAX(timestamp) FROM token_prices WHERE token_id = t.id)
GROUP BY t.id, t.symbol, t.name, tp.close_price, tp.market_cap, tp.volume_24h;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
