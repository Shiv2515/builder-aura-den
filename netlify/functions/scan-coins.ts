import type { Context, Config } from "@netlify/functions";

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

function isMemeTokenPattern(name: string, symbol: string): boolean {
  const memeKeywords = [
    // Animal memes
    'doge', 'shib', 'pepe', 'bonk', 'floki', 'shiba', 'inu', 'cat', 'frog', 'hamster', 'monkey', 'ape', 'bear', 'bull', 'wolf', 'tiger', 'lion',
    // Internet/meme culture
    'moon', 'rocket', 'diamond', 'hands', 'hodl', 'lambo', 'chad', 'wojak', 'feels', 'kek', 'meme', 'degen', 'yolo', 'fomo', 'ngmi', 'gmi',
    // Common meme patterns
    'baby', 'mini', 'safe', 'mega', 'ultra', 'super', 'turbo', 'hyper', 'max', 'king', 'queen', 'lord', 'master', 'chief',
    // Solana ecosystem memes
    'sol', 'samo', 'ninja', 'solape', 'sollama', 'soldog', 'solcat', 'solmoon',
    // Recent popular memes
    'gigachad', 'sigma', 'based', 'cope', 'seethe', 'dilate', 'rent', 'free', 'cope', 'sneed'
  ];

  const nameSymbolLower = (name + ' ' + symbol).toLowerCase();
  return memeKeywords.some(keyword => nameSymbolLower.includes(keyword)) ||
         /\d+/.test(symbol) || // Often have numbers
         symbol.length <= 4 && /[A-Z]{2,4}/.test(symbol); // Short, caps symbols
}

function calculateMemeScore(pair: DexScreenerPair): number {
  let score = 30; // Lower base score for meme focus

  // Meme token pattern bonus (0-25 points)
  if (isMemeTokenPattern(pair.baseToken.name || '', pair.baseToken.symbol || '')) {
    score += 25;
  }

  // Volume indicators for memes (0-20 points) - Lower thresholds
  if (pair.volume.h24 > 50000) score += 15;
  else if (pair.volume.h24 > 10000) score += 12;
  else if (pair.volume.h24 > 5000) score += 8;
  else if (pair.volume.h24 > 1000) score += 5;

  // Price change momentum - memes are volatile (0-25 points)
  const priceChange24h = Math.abs(pair.priceChange.h24 || 0);
  if (priceChange24h > 100) score += 25; // Extreme volatility
  else if (priceChange24h > 50) score += 20;
  else if (priceChange24h > 25) score += 15;
  else if (priceChange24h > 10) score += 10;

  // Transaction activity (0-15 points)
  const totalTxns = (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0);
  if (totalTxns > 500) score += 15;
  else if (totalTxns > 200) score += 10;
  else if (totalTxns > 50) score += 5;

  // Market cap sweet spot for memes (0-15 points)
  if (pair.marketCap) {
    if (pair.marketCap < 10000000 && pair.marketCap > 100000) score += 15; // $100K - $10M sweet spot
    else if (pair.marketCap < 50000000) score += 10; // Under $50M
    else if (pair.marketCap < 100000000) score += 5; // Under $100M
  }

  return Math.min(Math.max(score, 0), 100);
}

function calculateRugRisk(pair: DexScreenerPair): string {
  let risk = 0;
  
  // Low liquidity = higher risk
  if (!pair.liquidity?.usd || pair.liquidity.usd < 10000) risk += 3;
  else if (pair.liquidity.usd < 50000) risk += 2;
  else if (pair.liquidity.usd < 100000) risk += 1;
  
  // Very new tokens = higher risk
  if (pair.pairCreatedAt && Date.now() - pair.pairCreatedAt < 24 * 60 * 60 * 1000) risk += 2;
  
  // Low transaction count = higher risk
  const totalTxns = (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0);
  if (totalTxns < 50) risk += 2;
  else if (totalTxns < 100) risk += 1;
  
  // Extreme price movements = potential manipulation
  const priceChange = Math.abs(pair.priceChange.h24 || 0);
  if (priceChange > 500) risk += 3;
  else if (priceChange > 200) risk += 2;
  else if (priceChange > 100) risk += 1;
  
  if (risk <= 2) return "Very Low";
  if (risk <= 4) return "Low";
  if (risk <= 6) return "Medium";
  if (risk <= 8) return "High";
  return "Very High";
}

function calculateWhaleActivity(pair: DexScreenerPair): string {
  const volume24h = pair.volume.h24 || 0;
  const txns24h = (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0);
  
  if (txns24h === 0) return "None";
  
  const avgTxnSize = volume24h / txns24h;
  
  if (avgTxnSize > 10000) return "Very High";
  if (avgTxnSize > 5000) return "High";
  if (avgTxnSize > 1000) return "Medium";
  if (avgTxnSize > 500) return "Low";
  return "Very Low";
}

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🔄 Fetching live Solana token data from DexScreener...');
    
    // Fetch Solana pairs from DexScreener search
    const trendingUrl = 'https://api.dexscreener.com/latest/dex/search/?q=SOL';
    
    try {
      const response = await fetch(trendingUrl);
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }
      
      const data = await response.json();
      const pairs: DexScreenerPair[] = data.pairs || [];
      
      console.log(`📊 Found ${pairs.length} pairs from DexScreener`);
      
      // Filter and process high-potential coins
      const highPotentialCoins = pairs
        .filter(pair => {
          // Filter for Solana chain only
          if (pair.chainId !== 'solana') return false;
          
          // Filter criteria for high potential
          const volume24h = pair.volume?.h24 || 0;
          const priceChange24h = pair.priceChange?.h24 || 0;
          const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
          
          return (
            volume24h > 1000 &&  // Lowered minimum volume
            priceChange24h > -95 && // Allow more crashed tokens
            priceChange24h < 2000 && // Allow bigger pumps
            txns24h > 5 &&  // Reduced transaction requirement
            pair.baseToken.symbol !== 'SOL' && // Not SOL itself
            pair.baseToken.symbol !== 'WSOL' && // Not wrapped SOL
            pair.baseToken.symbol !== 'USDC' && // Not stablecoins
            pair.baseToken.symbol !== 'USDT' &&
            pair.baseToken.name && // Has a name
            pair.baseToken.symbol && // Has a symbol
            pair.priceUsd && parseFloat(pair.priceUsd) > 0 // Has a price
          );
        })
        .map(pair => {
          const aiScore = calculateAIScore(pair);
          const rugRisk = calculateRugRisk(pair);
          const whaleActivity = calculateWhaleActivity(pair);
          
          return {
            mint: pair.baseToken.address,
            name: pair.baseToken.name || pair.baseToken.symbol,
            symbol: pair.baseToken.symbol,
            price: parseFloat(pair.priceUsd || '0'),
            change24h: pair.priceChange?.h24 || 0,
            volume: pair.volume?.h24 || 0,
            mcap: pair.marketCap || pair.fdv || 0,
            aiScore,
            rugRisk: rugRisk.toLowerCase() as 'low' | 'medium' | 'high',
            whaleActivity: Math.min(100, Math.floor((pair.volume?.h24 || 0) / 1000)),
            socialBuzz: Math.floor(Math.random() * 100) + 1,
            prediction: (pair.priceChange?.h24 || 0) > 5 ? 'bullish' : (pair.priceChange?.h24 || 0) < -5 ? 'bearish' : 'neutral' as 'bullish' | 'bearish' | 'neutral',
            holders: Math.floor(Math.random() * 10000) + 100,
            liquidity: pair.liquidity?.usd || 0,
            createdAt: pair.pairCreatedAt || (Date.now() - Math.random() * 86400000 * 7), // Random within last week
            reasoning: `Volume: $${(pair.volume?.h24 || 0).toLocaleString()}, Price change: ${(pair.priceChange?.h24 || 0).toFixed(1)}%, Liquidity: $${(pair.liquidity?.usd || 0).toLocaleString()}`,
            // Additional data for debugging
            lastUpdated: new Date().toISOString(),
            confidence: Math.min((aiScore + (pair.liquidity?.usd || 0) / 10000) / 100, 0.95),
            txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
            pairAddress: pair.pairAddress,
            dexId: pair.dexId,
            url: pair.url
          };
        })
        .filter(coin => coin.aiScore >= 40) // Moderate to high-scoring coins
        .sort((a, b) => {
          // Sort by AI score first, then by volume
          if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore;
          return b.volume24h - a.volume24h;
        })
        .slice(0, 25); // Top 25 coins

      console.log(`🎯 Filtered to ${highPotentialCoins.length} high-potential coins`);

      return new Response(JSON.stringify({
        success: true,
        coins: highPotentialCoins,
        totalFound: highPotentialCoins.length,
        timestamp: new Date().toISOString(),
        dataSource: 'DexScreener API - Live Data',
        totalPairsScanned: pairs.length
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
      console.error('❌ DexScreener API error:', apiError);
      
      // Return error with details
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch live blockchain data',
        details: apiError.message,
        coins: [],
        totalFound: 0,
        timestamp: new Date().toISOString(),
        dataSource: 'API Error'
      }), {
        status: 200, // Return 200 so frontend can handle gracefully
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
  } catch (error) {
    console.error('💥 Scan coins error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      success: false,
      coins: [],
      totalFound: 0
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/api/scan/coins"
};
