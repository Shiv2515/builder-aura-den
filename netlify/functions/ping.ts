import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  try {
    const response = {
      message: "pong",
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
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
    console.error('Ping error:', error);
    return new Response(JSON.stringify({ 
      error: 'Service unavailable',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/api/ping"
};
