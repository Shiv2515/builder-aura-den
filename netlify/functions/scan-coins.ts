import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock high-potential coins data
    const mockCoins = [
      {
        mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
        name: "ElonCoin",
        symbol: "ELON",
        price: 0.000234,
        change24h: 45.67,
        marketCap: 2340000,
        volume24h: 567890,
        aiScore: 85,
        confidence: 0.92,
        rugRisk: "Low",
        whaleActivity: "High",
        lastUpdated: new Date().toISOString()
      },
      {
        mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        name: "MemeKing",
        symbol: "KING",
        price: 0.001567,
        change24h: 78.23,
        marketCap: 5670000,
        volume24h: 1234567,
        aiScore: 92,
        confidence: 0.88,
        rugRisk: "Very Low",
        whaleActivity: "Medium",
        lastUpdated: new Date().toISOString()
      },
      {
        mint: "DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ",
        name: "RocketFuel",
        symbol: "FUEL",
        price: 0.000089,
        change24h: 156.78,
        marketCap: 890000,
        volume24h: 234567,
        aiScore: 78,
        confidence: 0.85,
        rugRisk: "Medium",
        whaleActivity: "High",
        lastUpdated: new Date().toISOString()
      },
      {
        mint: "11111111111111111111111111111112",
        name: "PumpToken",
        symbol: "PUMP",
        price: 0.002345,
        change24h: 234.56,
        marketCap: 12340000,
        volume24h: 3456789,
        aiScore: 95,
        confidence: 0.95,
        rugRisk: "Very Low",
        whaleActivity: "Very High",
        lastUpdated: new Date().toISOString()
      }
    ];

    return new Response(JSON.stringify({
      success: true,
      coins: mockCoins,
      totalFound: mockCoins.length,
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
  } catch (error) {
    console.error('Scan coins error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get coins',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/api/scan/coins"
};
