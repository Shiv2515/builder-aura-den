import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock successful scan start
    const response = {
      success: true,
      message: "Scan started successfully",
      scanId: `scan_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Scan start error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to start scan',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/api/scan/start"
};
