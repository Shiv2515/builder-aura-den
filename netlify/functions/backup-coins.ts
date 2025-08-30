import type { Context, Config } from "@netlify/functions";

// Backup function using CoinGecko API for guaranteed live data
export default async (req: Request, context: Context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers
      });
    }

    console.log('🎭 Backup API called - No mock data mode enabled');

    // Return error immediately since we don't generate any mock/backup data
    return new Response(JSON.stringify({
      success: false,
      error: 'Backup API disabled - Real data only mode',
      message: 'This backup API has been disabled to prevent mock data generation. Only real DexScreener data is served.',
      coins: [],
      totalFound: 0,
      timestamp: new Date().toISOString(),
      dataSource: 'Real Data Only Mode'
    }), {
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error('💥 Backup coins error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      success: false
    }), {
      status: 500,
      headers
    });
  }
};

export const config: Config = {
  path: "/api/backup-coins"
};
