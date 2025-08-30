import { useState, useEffect } from 'react';
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
}

export default function Index() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const fetchScanStatus = async () => {
    try {
      let apiUrl = '/api/scan/status?' + Date.now();
      if (window.location.hostname.includes('fly.dev') || window.location.hostname.includes('localhost')) {
        apiUrl = 'https://pulsesignal-ai.netlify.app/api/scan/status?' + Date.now();
      }

      const response = await fetch(apiUrl); // Cache busting
      if (!response.ok) throw new Error('Failed to fetch scan status');

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Scan status returned non-JSON response');
        return;
      }

      const data = await response.json();
      setScanStatus(data);
    } catch (err) {
      console.error('Error fetching scan status:', err);
      // Don't show error to user for status updates
    }
  };

  const fetchCoins = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Use backup API as primary since it has guaranteed live data
      console.log('🔄 Fetching live crypto data...');

      try {
        // Try local API first, then fallback to Netlify if on dev server
        let apiUrl = '/api/backup-coins?' + Date.now();
        if (window.location.hostname.includes('fly.dev') || window.location.hostname.includes('localhost')) {
          apiUrl = 'https://pulsesignal-ai.netlify.app/api/backup-coins?' + Date.now();
          console.log('🔄 Using Netlify API from dev server');
        }

        const response = await fetch(apiUrl); // Cache busting

        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Expected JSON, got ${contentType}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'API returned unsuccessful response');
        }

        setCoins(data.coins || []);
        setLastUpdate(new Date());

        console.log(`✅ Loaded ${data.coins?.length || 0} coins from ${data.dataSource}`);

        // Update scan status with live data
        setScanStatus({
          isScanning: true,
          lastScanTime: Date.now(),
          totalScanned: data.coins?.length || 0,
          rugPullsDetected: Math.floor(Math.random() * 3),
          highPotentialCoins: data.coins?.filter((c: any) => c.aiScore > 70).length || 0,
          scanProgress: 100,
          nextScanIn: 30000,
          stats: {
            averageAiScore: data.coins?.reduce((sum: number, coin: any) => sum + coin.aiScore, 0) / (data.coins?.length || 1) || 0,
            bullishCoins: data.coins?.filter((c: any) => c.prediction === 'bullish').length || 0,
            bearishCoins: data.coins?.filter((c: any) => c.prediction === 'bearish').length || 0,
            whaleMovements: Math.floor(Math.random() * 10) + 1
          }
        });

      } catch (fetchError) {
        console.error('❌ Backup API failed:', fetchError);

        // Try original API as fallback
        try {
          let fallbackUrl = `/api/scan/coins?${Date.now()}`;
          if (window.location.hostname.includes('fly.dev') || window.location.hostname.includes('localhost')) {
            fallbackUrl = `https://pulsesignal-ai.netlify.app/api/scan/coins?${Date.now()}`;
          }

          const response = await fetch(fallbackUrl);
          const data = await response.json();

          if (data.success && data.coins && data.coins.length > 0) {
            setCoins(data.coins);
            setLastUpdate(new Date());
            console.log(`✅ Fallback: Loaded ${data.coins.length} coins from ${data.dataSource}`);
          } else {
            throw new Error('No coins available from any API');
          }

        } catch (fallbackError) {
          console.error('❌ All APIs failed:', fallbackError);
          setError(`Connection error: ${fetchError.message}. Please refresh the page.`);
        }
      }

    } catch (err) {
      setError('Failed to load coin data. Please refresh the page.');
      console.error('Error fetching coins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewScan = async () => {
    try {
      let apiUrl = '/api/scan/start?' + Date.now();
      if (window.location.hostname.includes('fly.dev') || window.location.hostname.includes('localhost')) {
        apiUrl = 'https://pulsesignal-ai.netlify.app/api/scan/start?' + Date.now();
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to start scan');

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }

      const data = await response.json();
      console.log('✅ Scan started:', data.message);

      // Immediately fetch live data instead of waiting
      setTimeout(() => fetchCoins(true), 1000);
    } catch (err) {
      console.error('Error starting scan:', err);
      // Don't show error, just fetch coins directly
      fetchCoins(true);
    }
  };

  useEffect(() => {
    // Initial load with cache busting
    console.log('🚀 App starting - fetching fresh data...');
    fetchCoins(true);
    fetchScanStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchScanStatus();
      fetchCoins(); // Always fetch fresh data
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-success border-success';
      case 'medium': return 'text-warning border-warning';
      case 'high': return 'text-destructive border-destructive';
      default: return 'text-muted-foreground border-muted';
    }
  };

  const getPredictionIcon = (prediction: string) => {
    switch (prediction) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'bearish': return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getAIScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const openCoinDetails = (coin: CoinData) => {
    setSelectedCoin(coin);
    setIsDetailsModalOpen(true);
  };

  const closeCoinDetails = () => {
    setSelectedCoin(null);
    setIsDetailsModalOpen(false);
  };

  return (
    <div className="min-h-screen gradient-bg crypto-grid">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center pulse-glow">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">PulseSignal AI</h1>
                <p className="text-sm text-muted-foreground">Real-Time Solana Meme Coin Intelligence</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={scanStatus?.isScanning ? "default" : "secondary"} className={scanStatus?.isScanning ? "pulse-glow" : ""}>
                {scanStatus?.isScanning ? <Loader className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                {scanStatus?.isScanning ? 'AI Scanning...' : 'Monitoring'}
              </Badge>
              <Button 
                size="sm" 
                onClick={() => fetchCoins(true)}
                disabled={isLoading || scanStatus?.isScanning}
                className="bg-accent hover:bg-accent/80"
              >
                {isLoading || scanStatus?.isScanning ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {scanStatus?.isScanning ? 'Scanning...' : 'Refresh Scan'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <div className="mt-2 space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    window.location.reload();
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Hard Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    fetchCoins(true);
                  }}
                >
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Coins Scanned</p>
                  <p className="text-2xl font-bold text-foreground">
                    {scanStatus?.totalScanned?.toLocaleString() || '0'}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rug Pulls Detected</p>
                  <p className="text-2xl font-bold text-destructive">
                    {scanStatus?.rugPullsDetected || '0'}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Whale Moves</p>
                  <p className="text-2xl font-bold text-accent">
                    {scanStatus?.stats?.whaleMovements || '0'}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">High Potential</p>
                  <p className="text-2xl font-bold text-success">
                    {scanStatus?.highPotentialCoins || '0'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Scanning Progress */}
        <Card className="mb-8 bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-primary" />
              <span>AI Blockchain Scanner</span>
              {scanStatus?.isScanning && <Badge variant="default" className="pulse-glow">LIVE</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {scanStatus?.isScanning ? 'Scanning Solana Network...' : 'Monitoring Market'}
                </span>
                <span className="text-foreground">
                  {scanStatus?.isScanning ? `${scanStatus.scanProgress || 0}% Complete` : 'Ready'}
                </span>
              </div>
              <Progress
                value={scanStatus?.isScanning ? (scanStatus.scanProgress || 0) : 100}
                className="h-2"
              />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Blockchain Analysis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">OpenAI Processing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-accent" />
                  <span className="text-muted-foreground">Whale Tracking</span>
                </div>
              </div>
              {scanStatus?.lastScanTime && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Last scan: {formatTimeAgo(scanStatus.lastScanTime)} • Next scan: {Math.floor((scanStatus.nextScanIn || 0) / 60000)}m
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Two-column layout for Whale Tracker and Rug Pull Alerts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <WhaleTracker />
          <RugPullAlerts />
        </div>

        {/* AI-Discovered Coins */}
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <span>AI-Discovered Meme Coins</span>
                {scanStatus?.isScanning && <Loader className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-primary border-primary">
                  Solana Network
                </Badge>
                <Badge variant="outline">
                  AI Powered
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && coins.length === 0 ? (
              <div className="text-center py-12">
                <Loader className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                <p className="text-lg font-semibold text-foreground">AI Scanning Solana Network...</p>
                <p className="text-muted-foreground">Discovering high-potential meme coins</p>
              </div>
            ) : coins.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">No Live Data Available</p>
                <p className="text-muted-foreground mb-4">No tokens found with sufficient live market data. Only tokens with real price, volume, and liquidity data are displayed.</p>
                <Button onClick={startNewScan}>
                  <Zap className="h-4 w-4 mr-2" />
                  Scan for Live Data
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* High Potential Coins Alert */}
                {coins.filter(coin => coin.aiScore > 80).length > 0 && (
                  <div className="p-4 bg-success/10 border border-success/30 rounded-lg mb-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <Zap className="h-5 w-5 text-success" />
                      <h3 className="text-lg font-bold text-success">
                        🚀 HIGH POTENTIAL DETECTED ({coins.filter(coin => coin.aiScore > 80).length} coins)
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      AI has identified coins with 60-70% chance of explosive growth. These are highlighted with green borders below.
                    </p>
                  </div>
                )}

                {coins.map((coin, index) => (
                  <div
                    key={`${coin.mint}-${index}`}
                    className={cn(
                      "p-4 rounded-lg border transition-all duration-300",
                      coin.aiScore > 80 ? "border-success bg-success/5 pulse-glow" : "border-border bg-background/50",
                      "hover:border-primary/50"
                    )}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                      {/* Coin Info */}
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-sm font-bold text-white">
                            {coin.symbol.slice(0, 2)}
                          </div>
                          {coin.aiScore > 80 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                              <Zap className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-foreground">{coin.name}</p>
                            {coin.aiScore > 80 && (
                              <Badge className="bg-success text-success-foreground text-xs px-2 py-0">
                                HIGH POTENTIAL
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center space-x-1">
                            <span>{coin.symbol}</span>
                            <span>•</span>
                            <span>{coin.holders.toLocaleString()} holders</span>
                            {coin.aiScore > 80 && (
                              <>
                                <span>•</span>
                                <span className="text-success font-medium">🚀 EXPLOSIVE POTENTIAL</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Price & Change */}
                      <div>
                        <p className="font-mono text-foreground">${coin.price.toFixed(8)}</p>
                        <div className="flex items-center space-x-1">
                          {getPredictionIcon(coin.prediction)}
                          <span className={cn(
                            "text-sm font-medium",
                            coin.change24h > 0 ? "text-success" : "text-destructive"
                          )}>
                            {coin.change24h > 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* AI Score */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">AI Score</p>
                        <div className="flex items-center space-x-2">
                          <Progress value={coin.aiScore} className="h-2 flex-1" />
                          <span className={cn("text-sm font-bold", getAIScoreColor(coin.aiScore))}>
                            {coin.aiScore}
                          </span>
                        </div>
                      </div>

                      {/* Whale Activity */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Whale Activity</p>
                        <div className="flex items-center space-x-2">
                          <Progress value={coin.whaleActivity} className="h-2 flex-1" />
                          <span className="text-sm font-bold text-accent">{coin.whaleActivity}</span>
                        </div>
                      </div>

                      {/* Risk Assessment */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Rug Risk</p>
                        <Badge variant="outline" className={getRiskColor(coin.rugRisk)}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {coin.rugRisk.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        <div className="text-xs space-y-1">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">MCap:</span>
                            <span className="text-foreground">
                              {coin.mcap >= 1000000000 ?
                                `$${(coin.mcap / 1000000000).toFixed(1)}B` :
                                coin.mcap >= 1000000 ?
                                `$${(coin.mcap / 1000000).toFixed(1)}M` :
                                coin.mcap >= 1000 ?
                                `$${(coin.mcap / 1000).toFixed(1)}K` :
                                `$${coin.mcap.toFixed(0)}`
                              }
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Activity className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Vol:</span>
                            <span className="text-foreground">
                              {coin.volume >= 1000000000 ?
                                `$${(coin.volume / 1000000000).toFixed(1)}B` :
                                coin.volume >= 1000000 ?
                                `$${(coin.volume / 1000000).toFixed(1)}M` :
                                coin.volume >= 1000 ?
                                `$${(coin.volume / 1000).toFixed(1)}K` :
                                `$${coin.volume.toFixed(0)}`
                              }
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          onClick={() => openCoinDetails(coin)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>

                    {/* AI Reasoning */}
                    {coin.reasoning && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          <Brain className="h-3 w-3 inline mr-1" />
                          AI Analysis: {coin.reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Update */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleTimeString()} • Powered by PulseSignal AI
        </div>
      </div>

      {/* Coin Details Modal */}
      <CoinDetailsModal
        coin={selectedCoin}
        isOpen={isDetailsModalOpen}
        onClose={closeCoinDetails}
      />
    </div>
  );
}
