import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  TrendingDown,
  Users,
  DollarSign,
  ExternalLink,
  Copy,
  Eye,
  Info,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RugPullAlert {
  id: string;
  coinName: string;
  coinSymbol: string;
  riskLevel: 'high' | 'critical';
  reasons: string[];
  timestamp: number;
  dismissed: boolean;
  liquidityChange: number;
  holderChange: number;
  confidence: number;
}

const mockAlerts: RugPullAlert[] = [
  {
    id: '1',
    coinName: 'ShadyCoin',
    coinSymbol: 'SHADY',
    riskLevel: 'critical',
    reasons: [
      'Liquidity dropped 85% in 10 minutes',
      'Top wallet holds 90% of supply',
      'Contract ownership not renounced',
      'No social media presence'
    ],
    timestamp: Date.now() - 300000, // 5 minutes ago
    dismissed: false,
    liquidityChange: -85,
    holderChange: -67,
    confidence: 94
  },
  {
    id: '2',
    coinName: 'MoonRocket',
    coinSymbol: 'MOON',
    riskLevel: 'high',
    reasons: [
      'Unusual whale selling pattern',
      'Liquidity provider removed 40%',
      'Social mentions suddenly stopped'
    ],
    timestamp: Date.now() - 900000, // 15 minutes ago
    dismissed: false,
    liquidityChange: -40,
    holderChange: -12,
    confidence: 78
  }
];

export function RugPullAlerts() {
  const [alerts, setAlerts] = useState<RugPullAlert[]>(mockAlerts);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');
  const [selectedAlert, setSelectedAlert] = useState<RugPullAlert | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, dismissed: true } : alert
    ));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openAlertDetails = (alert: RugPullAlert) => {
    setSelectedAlert(alert);
    setIsAlertModalOpen(true);
  };

  const closeAlertDetails = () => {
    setSelectedAlert(null);
    setIsAlertModalOpen(false);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (alert.dismissed) return false;
    if (filter === 'all') return true;
    return alert.riskLevel === filter;
  });

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-destructive bg-destructive/5';
      case 'high': return 'border-warning bg-warning/5';
      default: return 'border-border';
    }
  };

  const getRiskBadgeVariant = (level: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'outline';
      default: return 'secondary';
    }
  };

  // Simulate new alerts coming in
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.9) { // 10% chance every 30 seconds
        const newAlert: RugPullAlert = {
          id: Date.now().toString(),
          coinName: `Coin${Math.floor(Math.random() * 1000)}`,
          coinSymbol: `C${Math.floor(Math.random() * 1000)}`,
          riskLevel: Math.random() > 0.7 ? 'critical' : 'high',
          reasons: [
            'Sudden liquidity decrease detected',
            'Whale wallet activity suspicious',
            'Contract modification detected'
          ],
          timestamp: Date.now(),
          dismissed: false,
          liquidityChange: -Math.floor(Math.random() * 80) - 20,
          holderChange: -Math.floor(Math.random() * 50) - 10,
          confidence: Math.floor(Math.random() * 30) + 70
        };
        
        setAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep only 10 most recent
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-destructive" />
            <span>Rug Pull Detection</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'ghost'}
              onClick={() => setFilter('all')}
            >
              All ({alerts.filter(a => !a.dismissed).length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'critical' ? 'destructive' : 'ghost'}
              onClick={() => setFilter('critical')}
            >
              Critical ({alerts.filter(a => !a.dismissed && a.riskLevel === 'critical').length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'high' ? 'outline' : 'ghost'}
              onClick={() => setFilter('high')}
            >
              High ({alerts.filter(a => !a.dismissed && a.riskLevel === 'high').length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">All Clear!</p>
            <p className="text-muted-foreground">No active rug pull threats detected</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {filteredAlerts.map((alert) => (
              <Alert key={alert.id} className={cn("relative", getRiskColor(alert.riskLevel))}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-foreground">
                          {alert.coinName} ({alert.coinSymbol})
                        </span>
                        <Badge variant={getRiskBadgeVariant(alert.riskLevel)}>
                          {alert.riskLevel.toUpperCase()} RISK
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {alert.confidence}% Confidence
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center space-x-1 text-sm">
                          <DollarSign className="h-3 w-3 text-destructive" />
                          <span className="text-muted-foreground">Liquidity:</span>
                          <span className="font-medium text-destructive">
                            {alert.liquidityChange}%
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-sm">
                          <Users className="h-3 w-3 text-warning" />
                          <span className="text-muted-foreground">Holders:</span>
                          <span className="font-medium text-warning">
                            {alert.holderChange}%
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 mb-3">
                        {alert.reasons.map((reason, index) => (
                          <div key={index} className="flex items-start space-x-2 text-sm">
                            <div className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0" />
                            <span className="text-muted-foreground">{reason}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Detected {formatTimeAgo(alert.timestamp)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" className="h-6 text-xs">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissAlert(alert.id)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
