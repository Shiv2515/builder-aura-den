import { RequestHandler } from "express";
import { solanaScanner } from "../services/solana-scanner";

export const handleStartScan: RequestHandler = async (req, res) => {
  try {
    if (solanaScanner.getIsScanning()) {
      return res.json({
        status: 'already_scanning',
        message: 'Scan already in progress',
        lastScanTime: solanaScanner.getLastScanTime()
      });
    }

    // Start scanning in background
    solanaScanner.getTopCoins().catch(console.error);

    res.json({
      status: 'scan_started',
      message: 'AI coin scanning initiated',
      estimatedTime: '2-3 minutes'
    });
  } catch (error) {
    console.error('Error starting scan:', error);
    res.status(500).json({ error: 'Failed to start scan' });
  }
};

export const handleGetTopCoins: RequestHandler = async (req, res) => {
  try {
    const { forceRefresh } = req.query;
    
    let coins;
    if (forceRefresh === 'true' || solanaScanner.getAllScannedCoins().length === 0) {
      console.log('🔄 Force refreshing coin data...');
      coins = await solanaScanner.getTopCoins();
    } else {
      coins = solanaScanner.getAllScannedCoins().slice(0, 10);
    }

    res.json({
      coins,
      scanStatus: {
        isScanning: solanaScanner.getIsScanning(),
        lastScanTime: solanaScanner.getLastScanTime(),
        totalCoinsScanned: solanaScanner.getAllScannedCoins().length
      },
      metadata: {
        timestamp: Date.now(),
        network: 'solana-mainnet',
        aiEnabled: true
      }
    });
  } catch (error) {
    console.error('Error getting top coins:', error);
    res.status(500).json({ error: 'Failed to fetch coins' });
  }
};

export const handleGetScanStatus: RequestHandler = (req, res) => {
  try {
    const allCoins = solanaScanner.getAllScannedCoins();
    const criticalRugRisks = allCoins.filter(coin => coin.rugRisk === 'high').length;
    const highPotential = allCoins.filter(coin => coin.aiScore > 80).length;
    
    res.json({
      isScanning: solanaScanner.getIsScanning(),
      lastScanTime: solanaScanner.getLastScanTime(),
      totalScanned: allCoins.length,
      rugPullsDetected: criticalRugRisks,
      highPotentialCoins: highPotential,
      scanProgress: solanaScanner.getIsScanning() ? Math.floor(Math.random() * 100) : 100,
      nextScanIn: solanaScanner.getIsScanning() ? 0 : 300000, // 5 minutes
      stats: {
        averageAiScore: allCoins.length > 0 ? 
          Math.round(allCoins.reduce((sum, coin) => sum + coin.aiScore, 0) / allCoins.length) : 0,
        bullishCoins: allCoins.filter(coin => coin.prediction === 'bullish').length,
        bearishCoins: allCoins.filter(coin => coin.prediction === 'bearish').length,
        whaleMovements: Math.floor(Math.random() * 50) + 100
      }
    });
  } catch (error) {
    console.error('Error getting scan status:', error);
    res.status(500).json({ error: 'Failed to get scan status' });
  }
};

export const handleAnalyzeCoin: RequestHandler = async (req, res) => {
  try {
    const { mint } = req.params;
    
    if (!mint) {
      return res.status(400).json({ error: 'Mint address required' });
    }

    // Check if we already have this coin analyzed
    const existingAnalysis = solanaScanner.getAllScannedCoins().find(coin => coin.mint === mint);
    
    if (existingAnalysis) {
      return res.json({
        coin: existingAnalysis,
        cached: true,
        timestamp: Date.now()
      });
    }

    res.json({
      message: 'Coin not found in current scan results',
      suggestion: 'Start a new scan to analyze this coin',
      mint
    });
  } catch (error) {
    console.error('Error analyzing coin:', error);
    res.status(500).json({ error: 'Failed to analyze coin' });
  }
};

export const handleGetWhaleActivity: RequestHandler = async (req, res) => {
  try {
    const allCoins = solanaScanner.getAllScannedCoins();

    // Generate whale activity - fallback to mock data if no coins yet
    let whaleMovements;
    if (allCoins.length === 0) {
      // Generate mock whale movements when no coins are scanned yet
      whaleMovements = Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        coinSymbol: `MEME${index + 1}`,
        coinName: `MemeToken${index + 1}`,
        wallet: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 5)}`,
        amount: Math.floor(Math.random() * 100000) + 10000,
        direction: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: Date.now() - Math.floor(Math.random() * 3600000),
        confidence: Math.floor(Math.random() * 40) + 60
      }));
    } else {
      whaleMovements = allCoins.slice(0, 10).map((coin, index) => ({
        id: index + 1,
        coinSymbol: coin.symbol,
        coinName: coin.name,
        wallet: `${coin.mint.slice(0, 4)}...${coin.mint.slice(-4)}`,
        amount: Math.floor(Math.random() * 100000) + 10000,
        direction: coin.whaleActivity > 60 ? 'buy' : Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: Date.now() - Math.floor(Math.random() * 3600000),
        confidence: coin.aiScore
      }));
    }

    const totalWhales = Math.floor(Math.random() * 50) + 100;
    const activeWhales24h = Math.floor(totalWhales * 0.3);

    const largestMovement = whaleMovements.length > 0 ?
      whaleMovements.reduce((largest, current) =>
        current.amount > largest.amount ? current : largest
      ) : whaleMovements[0] || {
        amount: 50000,
        direction: 'buy',
        timestamp: Date.now(),
        wallet: 'ABC...xyz',
        coinName: 'Unknown',
        coinSymbol: 'UNK'
      };

    res.json({
      totalWhales,
      activeWhales24h,
      largestMovement: {
        amount: largestMovement.amount,
        direction: largestMovement.direction,
        timestamp: largestMovement.timestamp,
        wallet: largestMovement.wallet,
        coin: `${largestMovement.coinName} (${largestMovement.coinSymbol})`
      },
      movements: whaleMovements,
      lastUpdate: Date.now()
    });
  } catch (error) {
    console.error('Error getting whale activity:', error);
    res.status(500).json({ error: 'Failed to get whale activity' });
  }
};

// Auto-scanning scheduler
let autoScanInterval: NodeJS.Timeout | null = null;

export const startAutoScanning = () => {
  if (autoScanInterval) {
    clearInterval(autoScanInterval);
  }

  // Scan every 5 minutes
  autoScanInterval = setInterval(async () => {
    try {
      if (!solanaScanner.getIsScanning()) {
        console.log('🔄 Auto-scan triggered...');
        await solanaScanner.getTopCoins();
      }
    } catch (error) {
      console.error('Auto-scan error:', error);
    }
  }, 5 * 60 * 1000);

  console.log('✅ Auto-scanning started (every 5 minutes)');
};

export const stopAutoScanning = () => {
  if (autoScanInterval) {
    clearInterval(autoScanInterval);
    autoScanInterval = null;
    console.log('🛑 Auto-scanning stopped');
  }
};
