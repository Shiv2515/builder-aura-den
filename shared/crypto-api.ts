export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  mcap: number;
  aiScore: number;
  rugRisk: 'low' | 'medium' | 'high';
  whaleActivity: number;
  socialBuzz: number;
  prediction: 'bullish' | 'bearish' | 'neutral';
  isScanning: boolean;
  holders?: number;
  transactions24h?: number;
}

export interface WhaleMovement {
  id: number;
  wallet: string;
  amount: number;
  direction: 'buy' | 'sell';
  timestamp: number;
  confidence: number;
}

export interface WhaleTrackingResponse {
  totalWhales: number;
  activeWhales24h: number;
  largestMovement: {
    amount: number;
    direction: 'buy' | 'sell';
    timestamp: number;
    wallet: string;
  };
  movements: WhaleMovement[];
}

export interface AIAnalysisRequest {
  coinData: {
    name: string;
    symbol: string;
    price: number;
    volume: number;
    marketCap: number;
    holders: number;
    transactions24h: number;
  };
  whaleMovements: Array<{
    amount: number;
    timestamp: number;
    type: 'buy' | 'sell';
  }>;
  socialData: {
    twitterMentions: number;
    redditPosts: number;
    sentiment: number;
  };
}

export interface AIAnalysisResponse {
  aiScore: number;
  rugPullRisk: 'low' | 'medium' | 'high';
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidenceLevel: number;
  reasoning: string;
  nextAnalysis: number;
}

export interface ScanningStats {
  totalScanned: number;
  rugPullsDetected: number;
  whaleMoves: number;
  highPotentialCoins: number;
  scanProgress: number;
}
