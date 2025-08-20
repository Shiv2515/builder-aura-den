import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet,
  TrendingUp,
  TrendingDown,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhaleTrackingResponse } from '@shared/crypto-api';

export function WhaleTracker() {
  const [whaleData, setWhaleData] = useState<WhaleTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchWhaleData = async () => {
    try {
      const response = await fetch('/api/scan/whale-activity');
      const data = await response.json();
      setWhaleData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching whale data:', error);
      // Fallback to original endpoint
      try {
        const fallbackResponse = await fetch('/api/whale-tracking');
        const fallbackData = await fallbackResponse.json();
        setWhaleData(fallbackData);
        setLastUpdate(new Date());
      } catch (fallbackError) {
        console.error('Fallback whale data error:', fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWhaleData();
    const interval = setInterval(fetchWhaleData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount}`;
  };

  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-accent animate-pulse" />
            <span>Whale Movement Tracker</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!whaleData) return null;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-accent" />
            <span>Whale Movement Tracker</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-accent border-accent">
              {whaleData.activeWhales24h} Active
            </Badge>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={fetchWhaleData}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-accent">{whaleData.totalWhales}</p>
            <p className="text-sm text-muted-foreground">Total Whales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{whaleData.activeWhales24h}</p>
            <p className="text-sm text-muted-foreground">Active 24h</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {formatAmount(whaleData.largestMovement.amount)}
            </p>
            <p className="text-sm text-muted-foreground">Largest Move</p>
          </div>
        </div>

        {/* Largest Movement Highlight */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {whaleData.largestMovement.direction === 'buy' ? (
                <ArrowUpRight className="h-5 w-5 text-success" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {formatAmount(whaleData.largestMovement.amount)} {whaleData.largestMovement.direction.toUpperCase()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {whaleData.largestMovement.wallet} • {formatTimeAgo(whaleData.largestMovement.timestamp)}
                </p>
              </div>
            </div>
            <Badge 
              variant={whaleData.largestMovement.direction === 'buy' ? 'default' : 'destructive'}
              className={whaleData.largestMovement.direction === 'buy' ? 'bg-success' : ''}
            >
              {whaleData.largestMovement.direction === 'buy' ? 'BULLISH' : 'BEARISH'}
            </Badge>
          </div>
        </div>

        {/* Recent Movements */}
        <div>
          <h4 className="font-semibold text-foreground mb-3 flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Recent Movements</span>
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {whaleData.movements.slice(0, 8).map((movement) => (
              <div
                key={movement.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {movement.direction === 'buy' ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {movement.wallet}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(movement.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold",
                    movement.direction === 'buy' ? "text-success" : "text-destructive"
                  )}>
                    {formatAmount(movement.amount)}
                  </p>
                  <div className="flex items-center space-x-1">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {movement.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last Update */}
        <div className="flex items-center justify-center pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
