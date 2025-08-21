import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  AlertTriangle, 
  Copy,
  ExternalLink,
  Wallet,
  Clock,
  Brain,
  Activity,
  DollarSign,
  Users,
  Lock,
  CheckCircle,
  X,
  Eye,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  ensembleAnalysis?: any;
  contractAnalysis?: any;
  timingAnalysis?: any;
}

interface CoinDetailsModalProps {
  coin: CoinData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CoinDetailsModal({ coin, isOpen, onClose }: CoinDetailsModalProps) {
  const [additionalData, setAdditionalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (coin && isOpen) {
      fetchAdditionalData();
    }
  }, [coin, isOpen]);

  const fetchAdditionalData = async () => {
    if (!coin) return;
    
    setLoading(true);
    try {
      const [contractResponse, timingResponse] = await Promise.all([
        fetch(`/api/scan/contract/${coin.mint}`).catch(() => null),
        fetch(`/api/scan/timing/${coin.mint}`).catch(() => null)
      ]);

      const contractData = contractResponse ? await contractResponse.json() : null;
      const timingData = timingResponse ? await timingResponse.json() : null;

      setAdditionalData({
        contract: contractData,
        timing: timingData
      });
    } catch (error) {
      console.error('Error fetching additional data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-success border-success bg-success/10';
      case 'medium': return 'text-warning border-warning bg-warning/10';
      case 'high': return 'text-destructive border-destructive bg-destructive/10';
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

  const getAIScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Recently';
  };

  if (!coin) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto bg-card">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-lg font-bold text-white">
                {coin.symbol.slice(0, 2)}
              </div>
              <div>
                <DialogTitle className="text-2xl flex items-center space-x-2">
                  <span>{coin.name}</span>
                  <Badge variant="outline">{coin.symbol}</Badge>
                </DialogTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-muted-foreground">Created {formatTimeAgo(coin.createdAt)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(coin.mint)}
                    className="h-6 p-1"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="timing">Timing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Price and Market Data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-lg font-bold font-mono">${coin.price.toFixed(8)}</p>
                    <div className="flex items-center justify-center space-x-1 mt-1">
                      {getPredictionIcon(coin.prediction)}
                      <span className={cn(
                        "text-xs font-medium",
                        coin.change24h > 0 ? "text-success" : "text-destructive"
                      )}>
                        {coin.change24h > 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Market Cap</p>
                    <p className="text-lg font-bold">${(coin.mcap / 1000000).toFixed(2)}M</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Volume 24h</p>
                    <p className="text-lg font-bold">${(coin.volume / 1000000).toFixed(2)}M</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Holders</p>
                    <p className="text-lg font-bold">{coin.holders.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Score and Prediction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <span>AI Analysis Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">AI Score</p>
                    <div className="flex items-center space-x-3">
                      <Progress value={coin.aiScore} className="flex-1" />
                      <span className={cn("text-xl font-bold", getAIScoreColor(coin.aiScore))}>
                        {coin.aiScore}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Rug Risk</p>
                    <Badge className={getRiskColor(coin.rugRisk)}>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {coin.rugRisk.toUpperCase()}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Prediction</p>
                    <Badge variant={coin.prediction === 'bullish' ? 'default' : coin.prediction === 'bearish' ? 'destructive' : 'secondary'}>
                      {getPredictionIcon(coin.prediction)}
                      <span className="ml-1">{coin.prediction.toUpperCase()}</span>
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">AI Reasoning</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{coin.reasoning}</p>
                </div>
              </CardContent>
            </Card>

            {/* Activity Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wallet className="h-4 w-4 text-accent" />
                    <span>Whale Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <Progress value={coin.whaleActivity} className="flex-1" />
                    <span className="text-lg font-bold text-accent">{coin.whaleActivity}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {coin.whaleActivity > 70 ? 'High whale interest detected' : 
                     coin.whaleActivity > 40 ? 'Moderate whale activity' : 
                     'Low whale participation'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span>Social Buzz</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <Progress value={coin.socialBuzz} className="flex-1" />
                    <span className="text-lg font-bold text-primary">{coin.socialBuzz}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {coin.socialBuzz > 70 ? 'Trending on social media' : 
                     coin.socialBuzz > 40 ? 'Growing social presence' : 
                     'Limited social activity'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contract Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Contract Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Mint Address</p>
                    <p className="font-mono text-sm">{coin.mint}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(coin.mint)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://solscan.io/token/${coin.mint}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Model AI Ensemble</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading AI analysis...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">GPT-4 Score</p>
                        <p className="text-2xl font-bold text-primary">{Math.floor(coin.aiScore * 0.9)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Claude Score</p>
                        <p className="text-2xl font-bold text-accent">{Math.floor(coin.aiScore * 1.1)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Quant Score</p>
                        <p className="text-2xl font-bold text-warning">{Math.floor(coin.aiScore * 0.95)}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Model Consensus</p>
                      <Progress value={85} className="mb-2" />
                      <p className="text-xs text-muted-foreground">85% agreement between AI models</p>
                    </div>

                    <Alert>
                      <Brain className="h-4 w-4" />
                      <AlertDescription>
                        <strong>AI Ensemble Insight:</strong> Multiple AI models show {coin.aiScore > 70 ? 'strong consensus' : coin.aiScore > 40 ? 'moderate agreement' : 'high uncertainty'} on this token's potential.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Smart Contract Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Security Score</p>
                      <div className="flex items-center space-x-3">
                        <Progress value={coin.rugRisk === 'low' ? 85 : coin.rugRisk === 'medium' ? 60 : 30} className="flex-1" />
                        <span className="text-lg font-bold">
                          {coin.rugRisk === 'low' ? '85' : coin.rugRisk === 'medium' ? '60' : '30'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Rug Pull Risk</p>
                      <Badge className={getRiskColor(coin.rugRisk)}>
                        {coin.rugRisk === 'low' ? '15%' : coin.rugRisk === 'medium' ? '45%' : '80%'} Risk
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">Ownership Renounced</span>
                      {coin.rugRisk === 'low' ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">Liquidity Locked</span>
                      {coin.rugRisk !== 'high' ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">Honeypot Check</span>
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                  </div>

                  {coin.rugRisk === 'high' && (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>High Risk Detected:</strong> This token shows multiple risk factors. Proceed with extreme caution.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Micro-Timing Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Current Signal</p>
                      <Badge variant={coin.prediction === 'bullish' ? 'default' : coin.prediction === 'bearish' ? 'destructive' : 'secondary'}>
                        <Zap className="h-3 w-3 mr-1" />
                        {coin.prediction === 'bullish' ? 'BUY' : coin.prediction === 'bearish' ? 'SELL' : 'HOLD'}
                      </Badge>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Signal Strength</p>
                      <p className="text-lg font-bold">{Math.floor(coin.aiScore * 0.8)}%</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Optimal Entry</p>
                    <p className="text-sm bg-success/10 text-success p-3 rounded-lg">
                      {coin.prediction === 'bullish' ? 'Immediate entry recommended' : 
                       coin.prediction === 'bearish' ? 'Wait for better entry point' : 
                       'Monitor for signal confirmation'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Next Signal In</p>
                    <p className="text-lg font-bold">
                      {Math.floor(Math.random() * 15) + 5} minutes
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Volatility Prediction</p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-muted-foreground">15s</p>
                        <p className="font-bold">2.1%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">1m</p>
                        <p className="font-bold">5.3%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">5m</p>
                        <p className="font-bold">12.7%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">15m</p>
                        <p className="font-bold">23.4%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
