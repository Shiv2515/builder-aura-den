import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Shield, 
  Zap, 
  Brain,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Activity,
  DollarSign,
  Users,
  RefreshCw,
  Loader,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhaleTracker } from '@/components/WhaleTracker';
import { RugPullAlerts } from '@/components/RugPullAlerts';
import { CoinDetailsModal } from '@/components/CoinDetailsModal';

interface CoinData {
  mint: string;
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
  holders: number;
  liquidity: number;
  createdAt: number;
  reasoning: string;
  // Quantum metrics
  quantumMetrics?: {
    neuralProfitability: number;
    rugPullProbability: number;
    liquidityVelocity: number;
    whaleEntropy: number;
    marketQuantumState: string;
    temporalSignals: any;
    proprietaryMetrics: any;
  };
}

interface ScanStatus {
  isScanning: boolean;
  lastScanTime: number;
  totalScanned: number;
  rugPullsDetected: number;
  highPotentialCoins: number;
  scanProgress: number;
  nextScanIn: number;
  stats: {
    averageAiScore: number;
    bullishCoins: number;
    bearishCoins: number;
    whaleMovements: number;
  };
  quantumState?: string;
  algorithm?: string;
  dataIntegrity?: string;
}

export default function Index() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // QUANTUM SCANNER: 100% Live Data - No Fallback
  const fetchScanStatus = async (retryCount = 0) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/scan/status', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Quantum scanner status unavailable: ${response.status}`);
      }
      
      const data = await response.json();
      setScanStatus(data);
    } catch (err) {
      console.error('Error fetching scan status:', err);
      
      if (retryCount < 2 && !err.name?.includes('Abort')) {
        setTimeout(() => fetchScanStatus(retryCount + 1), (retryCount + 1) * 2000);
        return;
      }
      
      // NO FALLBACK - Quantum scanner provides 100% live data only
      setError('Unable to connect to quantum scanner. Please refresh the page.');
    }
  };

  // QUANTUM SCANNER: 100% Live Data - No Fallback
  const fetchCoins = async (forceRefresh = false, retryCount = 0) => {
    try {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`/api/scan/coins${forceRefresh ? '?forceRefresh=true' : ''}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Quantum scanner unavailable: ${response.status}`);
      }

      const data = await response.json();
      setCoins(data.coins || []);
      setLastUpdate(new Date());

      if (data.scanStatus) {
        setScanStatus(data.scanStatus);
      }
    } catch (err) {
      console.error('Error fetching coins:', err);

      if (retryCount < 2 && !err.name?.includes('Abort')) {
        setTimeout(() => fetchCoins(forceRefresh, retryCount + 1), (retryCount + 1) * 2000);
        return;
      }

      // NO FALLBACK - Live data only
      setError('Quantum scanner temporarily unavailable. Live data analysis in progress.');
    } finally {
      setIsLoading(false);
    }
  };

  const startNewScan = async () => {
    try {
      setError(null);
      const response = await fetch('/api/scan/start', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Failed to start scan: ${response.status}`);
      }

      const data = await response.json();
      console.log('Scan started:', data.message);

      setTimeout(() => fetchCoins(), 5000);
    } catch (err) {
      console.error('Error starting scan:', err);
      setError(`Failed to start scan: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchCoins();
    fetchScanStatus();

    // Auto-refresh every 60 seconds for better reliability
    const interval = setInterval(() => {
      fetchScanStatus();
      if (!scanStatus?.isScanning) {
        fetchCoins();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'bullish': return 'text-green-400';
      case 'bearish': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const openCoinDetails = (coin: CoinData) => {
    setSelectedCoin(coin);
    setIsDetailsModalOpen(true);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4">
        <div className="container mx-auto max-w-6xl">
          <Alert className="border-red-500/50 bg-red-950/50 mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-200">
              {error}
            </AlertDescription>
          </Alert>
          <div className="text-center py-12">
            <Button onClick={() => window.location.reload()} className="bg-accent hover:bg-accent/90">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-accent via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            🌀 QUANTUM AI SCANNER
          </h1>
          <p className="text-gray-400 text-lg">
            {scanStatus?.algorithm || 'Neural Quantum Analysis v2.0'} • {scanStatus?.dataIntegrity || 'Live Blockchain Feed'}
          </p>
          {scanStatus?.quantumState && (
            <p className="text-accent text-sm">
              Quantum State: {scanStatus.quantumState.slice(0, 16)}...
            </p>
          )}
        </div>

        {/* Scanning Status */}
        {scanStatus && (
          <Card className="bg-card/80 backdrop-blur-sm border-border mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-accent" />
                  <span>Real-Time Quantum Analysis</span>
                  {scanStatus.isScanning && (
                    <Loader className="h-4 w-4 animate-spin text-accent" />
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => fetchCoins(true)}
                    className="border-accent text-accent hover:bg-accent/10"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Enhanced Status Message */}
              {scanStatus.statusMessage && (
                <div className="mb-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <p className="text-accent font-medium text-center">
                    {scanStatus.statusMessage}
                  </p>
                  {scanStatus.platformsScanned && (
                    <div className="mt-2 text-center">
                      <p className="text-xs text-gray-400 mb-1">Scanning Platforms:</p>
                      <div className="flex flex-wrap justify-center gap-1">
                        {scanStatus.platformsScanned.map((platform, index) => (
                          <Badge key={index} variant="outline" className="text-xs border-accent/30 text-accent">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{scanStatus.totalScanned}</div>
                  <div className="text-sm text-gray-400">Tokens Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{scanStatus.highPotentialCoins}</div>
                  <div className="text-sm text-gray-400">High Potential</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{scanStatus.rugPullsDetected}</div>
                  <div className="text-sm text-gray-400">Rug Pulls Detected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{scanStatus.stats.averageAiScore}</div>
                  <div className="text-sm text-gray-400">Avg AI Score</div>
                </div>
              </div>
              <Progress value={scanStatus.scanProgress} className="mb-2" />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Last update: {formatTimeAgo(scanStatus.lastScanTime)}</span>
                <span>{scanStatus.scanProgress}% Complete</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Coins */}
        <div className="grid gap-6">
          {isLoading && coins.length === 0 ? (
            <Card className="bg-card/80 backdrop-blur-sm border-border">
              <CardContent className="p-8 text-center">
                <Loader className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
                <p className="text-gray-400">Quantum AI analyzing blockchain...</p>
                <p className="text-xs text-gray-500 mt-2">Live data processing in progress</p>
              </CardContent>
            </Card>
          ) : coins.length === 0 ? (
            <Card className="bg-card/80 backdrop-blur-sm border-border">
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 text-accent mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No tokens meet quantum analysis criteria yet</p>
                <Button onClick={startNewScan} className="bg-accent hover:bg-accent/90">
                  <Zap className="mr-2 h-4 w-4" />
                  Start Quantum Scan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {coins.map((coin) => (
                <Card 
                  key={coin.mint} 
                  className="bg-card/80 backdrop-blur-sm border-border hover:border-accent/50 transition-all cursor-pointer"
                  onClick={() => openCoinDetails(coin)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-accent to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {coin.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{coin.name}</h3>
                          <p className="text-gray-400">{coin.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{formatPrice(coin.price)}</div>
                        <div className={cn("flex items-center", coin.change24h >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {coin.change24h >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                          {Math.abs(coin.change24h).toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-400">AI Score</div>
                        <div className="font-bold text-accent">{coin.aiScore}/100</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Market Cap</div>
                        <div className="font-bold">{formatNumber(coin.mcap)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Volume 24h</div>
                        <div className="font-bold">{formatNumber(coin.volume)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Holders</div>
                        <div className="font-bold">{coin.holders.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <Badge variant="outline" className={cn("border-current", getRiskColor(coin.rugRisk))}>
                          <Shield className="h-3 w-3 mr-1" />
                          {coin.rugRisk.toUpperCase()} RISK
                        </Badge>
                        <Badge variant="outline" className={cn("border-current", getPredictionColor(coin.prediction))}>
                          {coin.prediction === 'bullish' ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                           coin.prediction === 'bearish' ? <TrendingDown className="h-3 w-3 mr-1" /> :
                           <Activity className="h-3 w-3 mr-1" />}
                          {coin.prediction.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <Wallet className="h-4 w-4" />
                        <span>{coin.whaleActivity}% Whale</span>
                        <Users className="h-4 w-4" />
                        <span>{coin.socialBuzz}% Buzz</span>
                      </div>
                    </div>

                    {/* Quantum Metrics */}
                    {coin.quantumMetrics && (
                      <div className="border-t border-border pt-4 mt-4">
                        <div className="text-xs text-accent mb-2">🌀 QUANTUM METRICS</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <div className="text-gray-400">Profit Potential</div>
                            <div className="font-bold text-green-400">{(coin.quantumMetrics.neuralProfitability * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Rug Risk</div>
                            <div className="font-bold text-red-400">{(coin.quantumMetrics.rugPullProbability * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Whale Entropy</div>
                            <div className="font-bold text-blue-400">{(coin.quantumMetrics.whaleEntropy * 100).toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Market State</div>
                            <div className="font-bold text-purple-400">{coin.quantumMetrics.marketQuantumState.split('_')[1] || 'SUPERPOS'}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-xs text-gray-300">{coin.reasoning}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Whale Tracker */}
        <WhaleTracker />

        {/* Rug Pull Alerts */}
        <RugPullAlerts />

        {/* Last Update */}
        <div className="text-center text-xs text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()} • 
          Data source: Quantum Neural Analysis • 
          {coins.length} tokens analyzed
        </div>
      </div>

      {/* Coin Details Modal */}
      {selectedCoin && (
        <CoinDetailsModal
          coin={selectedCoin}
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}
    </div>
  );
}
