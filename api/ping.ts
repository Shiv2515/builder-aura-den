import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = {
      message: "pong",
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      platform: "Vercel",
      region: process.env.VERCEL_REGION || "unknown",
      deployment: process.env.VERCEL_URL || "local"
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Ping error:', error);
    return res.status(500).json({ 
      error: 'Service unavailable',
      details: error.message 
    });
  }
}
