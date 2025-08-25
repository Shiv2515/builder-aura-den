import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Copy,
  ExternalLink,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhaleTrackingResponse } from '@shared/crypto-api';

export function WhaleTracker() {
  const [whaleData, setWhaleData] = useState<WhaleTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedWhale, setSelectedWhale] = useState<any>(null);
  const [isWhaleModalOpen, setIsWhaleModalOpen] = useState(false);

  const fetchWhaleData = async (retryCount = 0) => {
    try {
      // Increased timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/scan/whale-activity', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Whale activity response not ok:', response.status, response.statusText);
        throw new Error(`Failed to fetch whale activity: ${response.status}`);
      }
      const data = await response.json();
      setWhaleData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching whale data:', error);

      // Retry up to 2 times with exponential backoff
      if (retryCount < 2 && !error.name?.includes('Abort')) {
        console.log(`Retrying whale data fetch in ${(retryCount + 1) * 2} seconds...`);
        setTimeout(() => fetchWhaleData(retryCount + 1), (retryCount + 1) * 2000);
        return;
      }

      // NO FALLBACK - Quantum whale analysis provides 100% live data only
      console.log('Whale data will be available when quantum analysis completes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWhaleData();
    const interval = setInterval(fetchWhaleData, 60000); // Update every 60 seconds for better reliability
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openWhaleDetails = (whale: any) => {
    setSelectedWhale(whale);
    setIsWhaleModalOpen(true);
  };

  const closeWhaleDetails = () => {
    setSelectedWhale(null);
    setIsWhaleModalOpen(false);
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
              {whaleData.largestMovement ? formatAmount(whaleData.largestMovement.amount) : '$0'}
            </p>
            <p className="text-sm text-muted-foreground">Largest Move</p>
          </div>
        </div>

        {/* Largest Movement Highlight */}
        {whaleData.largestMovement ? (
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
        ) : (
          <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="text-center text-gray-400">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No significant whale movements detected</p>
              <p className="text-xs">Quantum analysis will update when patterns emerge</p>
            </div>
          </div>
        )}

        {/* Recent Movements */}
        <div>
          <h4 className="font-semibold text-foreground mb-3 flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Recent Movements</span>
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(whaleData.movements || []).slice(0, 8).map((movement, index) => (
              <div
                key={movement?.id || index}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => openWhaleDetails(movement)}
              >
                <div className="flex items-center space-x-3">
                  {movement?.direction === 'buy' ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-foreground font-mono">
                        {movement?.wallet || 'Unknown'}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(movement?.wallet || '');
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {movement?.timestamp ? formatTimeAgo(movement.timestamp) : 'Unknown time'} • Click for details
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold",
                    movement?.direction === 'buy' ? "text-success" : "text-destructive"
                  )}>
                    {movement?.amount ? formatAmount(movement.amount) : '$0'}
                  </p>
                  <div className="flex items-center space-x-1">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {movement?.confidence || 0}%
                    </span>
                    <Info className="h-3 w-3 text-primary" />
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

      {/* Whale Details Modal */}
      <Dialog open={isWhaleModalOpen} onOpenChange={closeWhaleDetails}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wallet className="h-5 w-5 text-accent" />
              <span>Whale Movement Details</span>
            </DialogTitle>
          </DialogHeader>

          {selectedWhale && (
            <div className="space-y-6">
              {/* Whale Address */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Wallet Address</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm break-all">{selectedWhale?.wallet || 'Unknown'}</p>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedWhale?.wallet || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://solscan.io/account/${selectedWhale?.wallet || ''}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className={cn(
                    "text-lg font-bold",
                    selectedWhale?.direction === 'buy' ? "text-success" : "text-destructive"
                  )}>
                    {selectedWhale?.amount ? formatAmount(selectedWhale.amount) : '$0'}
                  </p>
                  <Badge variant={selectedWhale?.direction === 'buy' ? 'default' : 'destructive'} className="mt-1 text-xs">
                    {selectedWhale?.direction === 'buy' ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                    )}
                    {selectedWhale?.direction?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-lg font-bold text-primary">{selectedWhale?.confidence || 0}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedWhale?.confidence || 0) > 80 ? 'Very High' :
                     (selectedWhale?.confidence || 0) > 60 ? 'High' :
                     (selectedWhale?.confidence || 0) > 40 ? 'Medium' : 'Low'}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="text-sm text-muted-foreground mb-3">Transaction Timeline</p>
                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {selectedWhale?.timestamp ? new Date(selectedWhale.timestamp).toLocaleString() : 'Unknown time'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({selectedWhale?.timestamp ? formatTimeAgo(selectedWhale.timestamp) : 'Unknown'})
                  </span>
                </div>
              </div>

              {/* Additional Analysis */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Quick Analysis</p>

                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between p-2 border rounded text-sm">
                    <span>Classification</span>
                    <Badge variant="outline" className="text-xs">
                      {(selectedWhale?.amount || 0) > 100000 ? 'Mega Whale' :
                       (selectedWhale?.amount || 0) > 50000 ? 'Large Whale' :
                       (selectedWhale?.amount || 0) > 20000 ? 'Medium Whale' : 'Small Whale'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded text-sm">
                    <span>Market Impact</span>
                    <span className="text-xs font-medium">
                      {selectedWhale?.direction === 'buy' ? 'Bullish Signal' : 'Bearish Signal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Coin Information */}
              {selectedWhale?.coinSymbol && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Related Coin</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {selectedWhale?.coinSymbol?.slice(0, 2) || 'UN'}
                    </div>
                    <div>
                      <p className="font-semibold">{selectedWhale?.coinName || 'Unknown Coin'}</p>
                      <p className="text-sm text-muted-foreground">{selectedWhale?.coinSymbol || 'UNKNOWN'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
