import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhaleTracker } from '@/components/WhaleTracker';
import { RugPullAlerts } from '@/components/RugPullAlerts';

interface CoinData {
  id: string;
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
  isScanning: boolean;
}

const mockCoins: CoinData[] = [
  {
    id: '1',
    name: 'DogWifHat',
    symbol: 'WIF',
    price: 0.000234,
    change24h: 45.2,
    volume: 2340000,
    mcap: 45000000,
    aiScore: 87,
    rugRisk: 'low',
    whaleActivity: 73,
    socialBuzz: 91,
    prediction: 'bullish',
    isScanning: false
  },
  {
    id: '2',
    name: 'Bonk',
    symbol: 'BONK',
    price: 0.000012,
    change24h: -12.3,
    volume: 1890000,
    mcap: 123000000,
    aiScore: 34,
    rugRisk: 'medium',
    whaleActivity: 23,
    socialBuzz: 67,
    prediction: 'bearish',
    isScanning: false
  },
  {
    id: '3',
    name: 'SolanaSniper',
    symbol: 'SNIPE',
    price: 0.000789,
    change24h: 234.7,
    volume: 890000,
    mcap: 12000000,
    aiScore: 92,
    rugRisk: 'low',
    whaleActivity: 89,
    socialBuzz: 85,
    prediction: 'bullish',
    isScanning: true
  }
];

export default function Index() {
  const [coins, setCoins] = useState<CoinData[]>(mockCoins);
  const [isScanning, setIsScanning] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [totalScanned, setTotalScanned] = useState(2847);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanProgress((prev) => (prev >= 100 ? 0 : prev + 1));
      setTotalScanned((prev) => prev + Math.floor(Math.random() * 3));
      
      if (Math.random() > 0.8) {
        setCoins(prev => prev.map(coin => ({
          ...coin,
          aiScore: Math.max(0, Math.min(100, coin.aiScore + (Math.random() - 0.5) * 10)),
          whaleActivity: Math.max(0, Math.min(100, coin.whaleActivity + (Math.random() - 0.5) * 15)),
          socialBuzz: Math.max(0, Math.min(100, coin.socialBuzz + (Math.random() - 0.5) * 20)),
          isScanning: Math.random() > 0.7
        })));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getPredictionIcon = (prediction: string) => {
    switch (prediction) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'bearish': return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
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
                <p className="text-sm text-muted-foreground">Solana Meme Coin Intelligence</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isScanning ? "default" : "secondary"} className="pulse-glow">
                <Eye className="h-3 w-3 mr-1" />
                {isScanning ? 'Scanning' : 'Idle'}
              </Badge>
              <Button size="sm" className="bg-accent hover:bg-accent/80">
                <Zap className="h-4 w-4 mr-2" />
                Boost Scan
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Coins Scanned</p>
                  <p className="text-2xl font-bold text-foreground">{totalScanned.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-destructive">47</p>
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
                  <p className="text-2xl font-bold text-accent">128</p>
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
                  <p className="text-2xl font-bold text-success">12</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scanning Progress */}
        <Card className="mb-8 bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-primary" />
              <span>AI Scanning Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Scan Cycle</span>
                <span className="text-foreground">{scanProgress}% Complete</span>
              </div>
              <Progress value={scanProgress} className="h-2" />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Blockchain Analysis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Social Sentiment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-accent" />
                  <span className="text-muted-foreground">Whale Tracking</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-column layout for Whale Tracker and Rug Pull Alerts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <WhaleTracker />
          <RugPullAlerts />
        </div>

        {/* Coin Analysis Results */}
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Live Meme Coin Analysis</span>
              <Badge variant="outline" className="text-primary border-primary">
                Solana Network
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {coins.map((coin) => (
                <div
                  key={coin.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all duration-300",
                    coin.isScanning ? "border-primary bg-primary/5 pulse-glow" : "border-border bg-background/50"
                  )}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                    {/* Coin Info */}
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-sm font-bold text-white">
                        {coin.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{coin.name}</p>
                        <p className="text-sm text-muted-foreground">{coin.symbol}</p>
                      </div>
                    </div>

                    {/* Price & Change */}
                    <div>
                      <p className="font-mono text-foreground">${coin.price.toFixed(6)}</p>
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
                        <span className="text-sm font-bold text-primary">{coin.aiScore}</span>
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

                    {/* Market Data */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-sm">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Vol:</span>
                        <span className="text-foreground">${(coin.volume / 1000000).toFixed(1)}M</span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">MCap:</span>
                        <span className="text-foreground">${(coin.mcap / 1000000).toFixed(1)}M</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
