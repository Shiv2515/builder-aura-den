import { RequestHandler } from "express";

interface AIAnalysisRequest {
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

interface AIAnalysisResponse {
  aiScore: number;
  rugPullRisk: 'low' | 'medium' | 'high';
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidenceLevel: number;
  reasoning: string;
  nextAnalysis: number;
}

export const handleAIAnalysis: RequestHandler = async (req, res) => {
  try {
    const { coinData, whaleMovements, socialData }: AIAnalysisRequest = req.body;

    // For prototype, we'll simulate AI analysis
    // In production, this would call OpenAI API with the provided key
    const mockAnalysis = await simulateAIAnalysis(coinData, whaleMovements, socialData);

    const response: AIAnalysisResponse = {
      aiScore: mockAnalysis.score,
      rugPullRisk: mockAnalysis.rugRisk,
      prediction: mockAnalysis.prediction,
      confidenceLevel: mockAnalysis.confidence,
      reasoning: mockAnalysis.reasoning,
      nextAnalysis: Date.now() + 300000 // 5 minutes
    };

    res.json(response);
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze coin data' });
  }
};

async function simulateAIAnalysis(
  coinData: any, 
  whaleMovements: any[], 
  socialData: any
): Promise<{
  score: number;
  rugRisk: 'low' | 'medium' | 'high';
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reasoning: string;
}> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Calculate score based on various factors
  let score = 50;
  
  // Volume analysis
  if (coinData.volume > 1000000) score += 15;
  else if (coinData.volume > 100000) score += 10;
  else score -= 10;

  // Whale movement analysis
  const recentBuys = whaleMovements.filter(m => m.type === 'buy' && m.timestamp > Date.now() - 86400000).length;
  const recentSells = whaleMovements.filter(m => m.type === 'sell' && m.timestamp > Date.now() - 86400000).length;
  
  if (recentBuys > recentSells) score += 20;
  else if (recentSells > recentBuys) score -= 15;

  // Social sentiment
  if (socialData.sentiment > 0.7) score += 15;
  else if (socialData.sentiment < 0.3) score -= 20;

  // Holders analysis
  if (coinData.holders > 10000) score += 10;
  else if (coinData.holders < 1000) score -= 15;

  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine rug pull risk
  let rugRisk: 'low' | 'medium' | 'high' = 'medium';
  if (score > 70 && coinData.holders > 5000) rugRisk = 'low';
  else if (score < 40 || coinData.holders < 500) rugRisk = 'high';

  // Determine prediction
  let prediction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (score > 75) prediction = 'bullish';
  else if (score < 35) prediction = 'bearish';

  // Calculate confidence
  const confidence = Math.min(95, Math.max(20, score + Math.random() * 20));

  const reasoning = generateReasoning(score, rugRisk, prediction, coinData, whaleMovements, socialData);

  return { score, rugRisk, prediction, confidence, reasoning };
}

function generateReasoning(
  score: number, 
  rugRisk: string, 
  prediction: string, 
  coinData: any, 
  whaleMovements: any[], 
  socialData: any
): string {
  const factors = [];
  
  if (coinData.volume > 1000000) {
    factors.push("High trading volume indicates strong market interest");
  }
  
  const recentBuys = whaleMovements.filter(m => m.type === 'buy' && m.timestamp > Date.now() - 86400000).length;
  if (recentBuys > 2) {
    factors.push("Significant whale accumulation detected in last 24h");
  }
  
  if (socialData.sentiment > 0.7) {
    factors.push("Overwhelmingly positive social sentiment");
  } else if (socialData.sentiment < 0.3) {
    factors.push("Concerning negative social sentiment");
  }
  
  if (coinData.holders > 10000) {
    factors.push("Strong holder base indicates project stability");
  }
  
  if (rugRisk === 'low') {
    factors.push("Low rug pull risk due to established metrics");
  } else if (rugRisk === 'high') {
    factors.push("High rug pull risk - exercise extreme caution");
  }

  return factors.join(". ") + ".";
}

export const handleWhaleTracking: RequestHandler = async (req, res) => {
  // Simulate whale wallet movements
  const mockWhaleData = {
    totalWhales: 127,
    activeWhales24h: 23,
    largestMovement: {
      amount: 50000,
      direction: 'buy',
      timestamp: Date.now() - 3600000,
      wallet: '7xKXt...9zQm'
    },
    movements: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      wallet: `${Math.random().toString(36).substring(2, 7)}...${Math.random().toString(36).substring(2, 5)}`,
      amount: Math.floor(Math.random() * 100000) + 10000,
      direction: Math.random() > 0.5 ? 'buy' : 'sell',
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
      confidence: Math.floor(Math.random() * 40) + 60
    }))
  };

  res.json(mockWhaleData);
};
