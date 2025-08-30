import type { Context, Config } from "@netlify/functions";

interface TrendingCoin {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  rank: number;
  trendScore: number;
  momentum: 'bullish' | 'bearish' | 'neutral';
  riskLevel: 'low' | 'medium' | 'high';
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
  fdv?: number;
  marketCap?: number;
  liquidity?: {
    usd: number;
  };
  pairCreatedAt?: number;
}

function calculateTrendScore(pair: DexScreenerPair): number {
  let score = 0;
  
  // Price momentum (40% weight)
  const priceChange24h = pair.priceChange?.h24 || 0;
  const priceChange1h = pair.priceChange?.h1 || 0;
  
  if (priceChange24h > 20) score += 40;
  else if (priceChange24h > 10) score += 30;
  else if (priceChange24h > 5) score += 20;
  else if (priceChange24h > 0) score += 10;
  
  // Short-term momentum bonus
  if (priceChange1h > 5) score += 10;
  else if (priceChange1h > 2) score += 5;
  
  // Volume activity (30% weight)
  const volume24h = pair.volume?.h24 || 0;
  if (volume24h > 500000) score += 30;
  else if (volume24h > 100000) score += 25;
  else if (volume24h > 50000) score += 20;
  else if (volume24h > 10000) score += 15;
  else if (volume24h > 5000) score += 10;
  
  // Transaction activity (20% weight)
  const totalTxns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
  if (totalTxns > 1000) score += 20;
  else if (totalTxns > 500) score += 15;
  else if (totalTxns > 100) score += 10;
  else if (totalTxns > 50) score += 5;
  
  // Liquidity factor (10% weight)
  const liquidity = pair.liquidity?.usd || 0;
  if (liquidity > 100000) score += 10;
  else if (liquidity > 50000) score += 7;
  else if (liquidity > 20000) score += 5;
  else if (liquidity > 10000) score += 3;
  
  return Math.min(score, 100);
}

function determineMomentum(pair: DexScreenerPair): 'bullish' | 'bearish' | 'neutral' {
  const priceChange24h = pair.priceChange?.h24 || 0;
  const priceChange1h = pair.priceChange?.h1 || 0;
  const volume24h = pair.volume?.h24 || 0;
  
  // Strong bullish signals
  if (priceChange24h > 15 && priceChange1h > 2 && volume24h > 50000) {
    return 'bullish';
  }
  
  // Bearish signals
  if (priceChange24h < -10 || priceChange1h < -5) {
    return 'bearish';
  }
  
  // Moderate bullish
  if (priceChange24h > 5 && volume24h > 20000) {
    return 'bullish';
  }
  
  return 'neutral';
}

function assessRiskLevel(pair: DexScreenerPair): 'low' | 'medium' | 'high' {
  let riskFactors = 0;
  
  // Low liquidity = higher risk
  const liquidity = pair.liquidity?.usd || 0;
  if (liquidity < 20000) riskFactors += 2;
  else if (liquidity < 50000) riskFactors += 1;
  
  // Extreme price changes = higher risk
  const priceChange = Math.abs(pair.priceChange?.h24 || 0);
  if (priceChange > 200) riskFactors += 3;
  else if (priceChange > 100) riskFactors += 2;
  else if (priceChange > 50) riskFactors += 1;
  
  // Low transaction activity = higher risk
  const totalTxns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
  if (totalTxns < 50) riskFactors += 2;
  else if (totalTxns < 100) riskFactors += 1;
  
  // Very new pairs = higher risk
  if (pair.pairCreatedAt && Date.now() - pair.pairCreatedAt < 24 * 60 * 60 * 1000) {
    riskFactors += 1;
  }
  
  if (riskFactors <= 2) return 'low';
  if (riskFactors <= 4) return 'medium';
  return 'high';
}

export default async (req: Request, context: Context) => {
  try {
    console.log('📈 Fetching trending Solana coins...');

    try {
      // Fetch trending data from DexScreener
      const response = await fetch('https://api.dexscreener.com/latest/dex/search/?q=solana');
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }
      
      const data = await response.json();
      const pairs: DexScreenerPair[] = data.pairs || [];
      
      // Process and rank trending coins
      const trendingCoins: TrendingCoin[] = pairs
        .filter(pair => {
          return (
            pair.chainId === 'solana' &&
            pair.baseToken.symbol !== 'SOL' &&
            pair.baseToken.symbol !== 'WSOL' &&
            pair.baseToken.symbol !== 'USDC' &&
            pair.baseToken.symbol !== 'USDT' &&
            (pair.volume?.h24 || 0) > 5000 &&
            pair.priceUsd &&
            parseFloat(pair.priceUsd) > 0
          );
        })
        .map(pair => {
          const trendScore = calculateTrendScore(pair);
          const momentum = determineMomentum(pair);
          const riskLevel = assessRiskLevel(pair);
          
          return {
            mint: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name || pair.baseToken.symbol,
            price: parseFloat(pair.priceUsd || '0'),
            change24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            marketCap: pair.marketCap || pair.fdv || 0,
            rank: 0, // Will be set after sorting
            trendScore,
            momentum,
            riskLevel
          };
        })
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 50) // Top 50 trending
        .map((coin, index) => ({ ...coin, rank: index + 1 }));

      // Categorize trending coins
      const categories = {
        hottest: trendingCoins.slice(0, 10),
        risers: trendingCoins.filter(coin => coin.change24h > 20).slice(0, 15),
        highVolume: trendingCoins.filter(coin => coin.volume24h > 100000).slice(0, 10),
        lowRisk: trendingCoins.filter(coin => coin.riskLevel === 'low').slice(0, 10)
      };

      console.log(`🎯 Found ${trendingCoins.length} trending coins`);

      return new Response(JSON.stringify({
        success: true,
        trending: trendingCoins,
        categories,
        summary: {
          totalTrending: trendingCoins.length,
          averageTrendScore: trendingCoins.reduce((sum, coin) => sum + coin.trendScore, 0) / trendingCoins.length,
          bullishCoins: trendingCoins.filter(coin => coin.momentum === 'bullish').length,
          bearishCoins: trendingCoins.filter(coin => coin.momentum === 'bearish').length,
          lowRiskCoins: trendingCoins.filter(coin => coin.riskLevel === 'low').length,
          totalVolume: trendingCoins.reduce((sum, coin) => sum + coin.volume24h, 0)
        },
        timestamp: new Date().toISOString(),
        dataSource: 'DexScreener Live API',
        updateFrequency: '30 seconds'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      
    } catch (apiError) {
      console.error('❌ Trending coins API error:', apiError);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch trending data',
        details: apiError.message,
        trending: [],
        categories: { hottest: [], risers: [], highVolume: [], lowRisk: [] },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
  } catch (error) {
    console.error('💥 Trending coins error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      success: false
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/api/trending"
};
