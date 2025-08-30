import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock scan status with some activity
    const response = {
      isScanning: true,
      coinsScanned: Math.floor(Math.random() * 50) + 10,
      rugPullsDetected: Math.floor(Math.random() * 3),
      whaleMoves: Math.floor(Math.random() * 8) + 2,
      highPotential: Math.floor(Math.random() * 5) + 1,
      lastUpdate: new Date().toISOString(),
      systemStatus: "Ready",
      blockchainAnalysis: true,
      openaiProcessing: true,
      whaleTracking: true
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Scan status error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get scan status',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/api/scan/status"
};
