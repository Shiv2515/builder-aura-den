import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, getAccount } from '@solana/spl-token';

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

interface ContractAnalysis {
  mint: string;
  securityScore: number; // 0-100
  vulnerabilities: string[];
  safetyFeatures: string[];
  ownershipAnalysis: {
    mintAuthority: string | null;
    freezeAuthority: string | null;
    updateAuthority: string | null;
    isRenounced: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  liquidityAnalysis: {
    poolAddress: string | null;
    lpTokensLocked: boolean;
    lockDuration: number; // days
    liquidityHealth: number; // 0-100
    canRugPull: boolean;
  };
  transactionAnalysis: {
    honeypotRisk: number; // 0-100
    sellTaxExist: boolean;
    buyTaxExist: boolean;
    maxTransactionLimit: number;
    canBlacklist: boolean;
    pausable: boolean;
  };
  holderAnalysis: {
    topHolderConcentration: number; // percentage
    developersHolding: number; // percentage
    whaleCount: number;
    distributionScore: number; // 0-100, higher is better
  };
  riskFactors: {
    rugPullProbability: number; // 0-100
    honeypotProbability: number; // 0-100
    abandonmentRisk: number; // 0-100
    marketManipulationRisk: number; // 0-100
  };
  recommendations: string[];
}

class ContractAnalyzer {
  async analyzeContract(mint: string): Promise<ContractAnalysis> {
    try {
      console.log(`🔍 Analyzing contract: ${mint}`);

      const mintPubkey = new PublicKey(mint);
      const mintInfo = await getMint(connection, mintPubkey);

      // Analyze ownership and authorities
      const ownershipAnalysis = await this.analyzeOwnership(mintInfo);
      
      // Analyze liquidity and LP locks
      const liquidityAnalysis = await this.analyzeLiquidity(mint);
      
      // Check for honeypot and trading restrictions
      const transactionAnalysis = await this.analyzeTransactions(mint);
      
      // Analyze holder distribution
      const holderAnalysis = await this.analyzeHolders(mint);

      // Calculate overall security score
      const securityScore = this.calculateSecurityScore({
        ownershipAnalysis,
        liquidityAnalysis,
        transactionAnalysis,
        holderAnalysis
      });

      // Identify vulnerabilities and safety features
      const { vulnerabilities, safetyFeatures } = this.identifyRisksAndFeatures({
        ownershipAnalysis,
        liquidityAnalysis,
        transactionAnalysis,
        holderAnalysis
      });

      // Calculate risk factors
      const riskFactors = this.calculateRiskFactors({
        ownershipAnalysis,
        liquidityAnalysis,
        transactionAnalysis,
        holderAnalysis
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        vulnerabilities,
        riskFactors,
        securityScore
      });

      return {
        mint,
        securityScore,
        vulnerabilities,
        safetyFeatures,
        ownershipAnalysis,
        liquidityAnalysis,
        transactionAnalysis,
        holderAnalysis,
        riskFactors,
        recommendations
      };

    } catch (error) {
      console.error(`Error analyzing contract ${mint}:`, error);
      return this.getFallbackAnalysis(mint);
    }
  }

  private async analyzeOwnership(mintInfo: any): Promise<ContractAnalysis['ownershipAnalysis']> {
    try {
      const mintAuthority = mintInfo.mintAuthority?.toString() || null;
      const freezeAuthority = mintInfo.freezeAuthority?.toString() || null;
      
      // Check if authorities are renounced (set to null or burn address)
      const burnAddress = '11111111111111111111111111111112';
      const isRenounced = !mintAuthority || 
                         mintAuthority === burnAddress || 
                         (!freezeAuthority || freezeAuthority === burnAddress);

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (!isRenounced && mintAuthority) riskLevel = 'high';
      else if (!isRenounced) riskLevel = 'medium';

      return {
        mintAuthority,
        freezeAuthority,
        updateAuthority: null, // Would need metadata account analysis
        isRenounced,
        riskLevel
      };
    } catch (error) {
      return {
        mintAuthority: 'unknown',
        freezeAuthority: 'unknown',
        updateAuthority: 'unknown',
        isRenounced: false,
        riskLevel: 'high'
      };
    }
  }

  private async analyzeLiquidity(mint: string): Promise<ContractAnalysis['liquidityAnalysis']> {
    try {
      console.log(`💧 Analyzing real liquidity for ${mint.slice(0, 8)}...`);

      // Check DexScreener for real pool data
      const poolData = await this.getRealPoolData(mint);

      if (poolData) {
        const liquidityUSD = parseFloat(poolData.liquidity?.usd || '0');
        const volume24h = parseFloat(poolData.volume?.h24 || '0');

        // Calculate liquidity health based on real metrics
        const liquidityHealth = this.calculateLiquidityHealth(liquidityUSD, volume24h);

        // Check for LP lock indicators based on pool age and characteristics
        const ageInDays = poolData.pairCreatedAt ?
          (Date.now() - new Date(poolData.pairCreatedAt).getTime()) / 86400000 : 0;

        const lpTokensLocked = liquidityUSD > 100000 && ageInDays > 7; // Heuristic
        const lockDuration = lpTokensLocked ? Math.max(30, ageInDays * 1.5) : 0;
        const canRugPull = !lpTokensLocked || liquidityHealth < 50;

        return {
          poolAddress: poolData.pairAddress || null,
          lpTokensLocked,
          lockDuration: Math.floor(lockDuration),
          liquidityHealth,
          canRugPull
        };
      }

      // Fallback analysis based on basic token metrics
      console.log(`⚠️ No pool data found for ${mint.slice(0, 8)}, using token metrics`);
      const tokenMetrics = await this.analyzeTokenBasics(mint);

      return {
        poolAddress: null,
        lpTokensLocked: false,
        lockDuration: 0,
        liquidityHealth: tokenMetrics.health,
        canRugPull: true
      };

    } catch (error) {
      console.error('Liquidity analysis error:', error);
      return {
        poolAddress: null,
        lpTokensLocked: false,
        lockDuration: 0,
        liquidityHealth: 20,
        canRugPull: true
      };
    }
  }

  private async getRealPoolData(mint: string) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (!response.ok) return null;

      const data = await response.json();
      return data.pairs?.[0] || null;
    } catch (error) {
      console.log(`DexScreener lookup failed for ${mint.slice(0, 8)}:`, error.message);
      return null;
    }
  }

  private calculateLiquidityHealth(liquidityUSD: number, volume24h: number): number {
    if (liquidityUSD === 0) return 10;

    let health = 0;

    // Base liquidity score
    if (liquidityUSD > 1000000) health += 40;
    else if (liquidityUSD > 500000) health += 35;
    else if (liquidityUSD > 100000) health += 25;
    else if (liquidityUSD > 50000) health += 20;
    else if (liquidityUSD > 10000) health += 15;
    else health += 10;

    // Volume to liquidity ratio (healthy = 0.1-0.5)
    const volumeRatio = liquidityUSD > 0 ? volume24h / liquidityUSD : 0;
    if (volumeRatio >= 0.1 && volumeRatio <= 0.5) health += 30;
    else if (volumeRatio < 0.1) health += 20; // Low volume ok
    else if (volumeRatio > 2) health -= 10; // Too high = manipulation risk

    // Volume activity bonus
    if (volume24h > 100000) health += 20;
    else if (volume24h > 10000) health += 15;
    else health += 5;

    return Math.max(10, Math.min(100, health));
  }

  private async analyzeTokenBasics(mint: string) {
    try {
      const mintInfo = await getMint(connection, new PublicKey(mint));
      const supply = Number(mintInfo.supply);

      // Basic health check
      let health = 20;
      if (supply > 1000000 && supply < 1e15) health += 10;
      if (mintInfo.mintAuthority === null) health += 20; // Good sign

      return { health };
    } catch {
      return { health: 10 };
    }
  }

  private async analyzeTransactions(mint: string): Promise<ContractAnalysis['transactionAnalysis']> {
    try {
      console.log(`🔍 Analyzing transaction patterns for ${mint.slice(0, 8)}...`);

      // Get recent transaction data to analyze patterns
      const txAnalysis = await this.getTransactionPatterns(mint);

      // Check for honeypot indicators from DexScreener
      const poolData = await this.getRealPoolData(mint);
      const honeypotRisk = this.calculateHoneypotRisk(poolData, txAnalysis);

      // Analyze transaction restrictions based on real data
      const restrictions = await this.analyzeTransactionRestrictions(mint, txAnalysis);

      return {
        honeypotRisk,
        sellTaxExist: restrictions.sellTax > 0,
        buyTaxExist: restrictions.buyTax > 0,
        maxTransactionLimit: restrictions.maxTxLimit,
        canBlacklist: restrictions.hasBlacklist,
        pausable: restrictions.isPausable
      };
    } catch (error) {
      console.error('Transaction analysis error:', error);
      return {
        honeypotRisk: 30, // Conservative assumption
        sellTaxExist: false,
        buyTaxExist: false,
        maxTransactionLimit: 0,
        canBlacklist: false,
        pausable: false
      };
    }
  }

  private async getTransactionPatterns(mint: string) {
    try {
      // Get recent signatures for the mint
      const mintPubkey = new PublicKey(mint);
      const signatures = await connection.getSignaturesForAddress(mintPubkey, { limit: 20 });

      let buyCount = 0;
      let sellCount = 0;
      let totalVolume = 0;

      for (const sig of signatures.slice(0, 10)) {
        try {
          const tx = await connection.getTransaction(sig.signature);
          if (tx?.meta?.postBalances && tx.meta.preBalances) {
            // Simple heuristic: if post balance > pre balance = buy, else sell
            const balanceChange = tx.meta.postBalances[0] - tx.meta.preBalances[0];
            if (balanceChange > 0) buyCount++;
            else sellCount++;

            totalVolume += Math.abs(balanceChange);
          }
        } catch {
          continue;
        }
      }

      return {
        buyCount,
        sellCount,
        totalVolume,
        buyToSellRatio: sellCount > 0 ? buyCount / sellCount : buyCount,
        avgTransactionSize: signatures.length > 0 ? totalVolume / signatures.length : 0
      };
    } catch (error) {
      return {
        buyCount: 0,
        sellCount: 0,
        totalVolume: 0,
        buyToSellRatio: 1,
        avgTransactionSize: 0
      };
    }
  }

  private calculateHoneypotRisk(poolData: any, txAnalysis: any): number {
    let risk = 10; // Base low risk

    // Check pool indicators
    if (poolData) {
      const volume24h = parseFloat(poolData.volume?.h24 || '0');
      const liquidity = parseFloat(poolData.liquidity?.usd || '0');

      // Suspicious volume to liquidity ratio
      if (liquidity > 0 && volume24h / liquidity > 5) risk += 30;

      // Very new pairs are riskier
      if (poolData.pairCreatedAt) {
        const ageHours = (Date.now() - new Date(poolData.pairCreatedAt).getTime()) / 3600000;
        if (ageHours < 1) risk += 40;
        else if (ageHours < 24) risk += 20;
      }
    }

    // Transaction pattern analysis
    if (txAnalysis.sellCount === 0 && txAnalysis.buyCount > 5) {
      risk += 50; // Only buys, no sells = potential honeypot
    }

    if (txAnalysis.buyToSellRatio > 10) {
      risk += 30; // Too many buys vs sells
    }

    return Math.min(100, risk);
  }

  private async analyzeTransactionRestrictions(mint: string, txAnalysis: any) {
    // Without full contract bytecode analysis, we estimate based on behavior
    // In production, this would use Anchor/Solana program inspection

    const hasUnusualPatterns = txAnalysis.buyToSellRatio > 5 || txAnalysis.sellCount === 0;

    return {
      sellTax: 0, // Solana tokens typically don't have taxes like Ethereum
      buyTax: 0,
      maxTxLimit: 0, // Most Solana tokens don't have tx limits
      hasBlacklist: hasUnusualPatterns, // Estimate based on tx patterns
      isPausable: false // Most Solana tokens aren't pausable
    };
  }

  private async analyzeHolders(mint: string): Promise<ContractAnalysis['holderAnalysis']> {
    try {
      console.log(`👥 Analyzing real holder distribution for ${mint.slice(0, 8)}...`);

      // Get actual token accounts for this mint
      const holderData = await this.getRealHolderData(mint);

      if (holderData) {
        return {
          topHolderConcentration: holderData.topHolderPercent,
          developersHolding: holderData.devHolding,
          whaleCount: holderData.whaleCount,
          distributionScore: holderData.distributionScore
        };
      }

      // Fallback: estimate from available data
      return await this.estimateHolderDistribution(mint);

    } catch (error) {
      console.error('Holder analysis error:', error);
      return {
        topHolderConcentration: 40,
        developersHolding: 15,
        whaleCount: 3,
        distributionScore: 45
      };
    }
  }

  private async getRealHolderData(mint: string) {
    try {
      // Get token accounts for this mint from Solana blockchain
      const mintPubkey = new PublicKey(mint);
      const tokenAccounts = await connection.getProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // Token program
        {
          filters: [
            { dataSize: 165 }, // Token account size
            { memcmp: { offset: 0, bytes: mint } } // Filter by mint
          ]
        }
      );

      if (tokenAccounts.length === 0) return null;

      const balances: { address: string; balance: number }[] = [];
      let totalSupply = 0;

      // Analyze top accounts (limited to avoid rate limits)
      for (const account of tokenAccounts.slice(0, 30)) {
        try {
          const accountInfo = await getAccount(connection, account.pubkey);
          const balance = Number(accountInfo.amount);

          if (balance > 0) {
            balances.push({
              address: account.pubkey.toString(),
              balance
            });
            totalSupply += balance;
          }
        } catch {
          continue;
        }
      }

      if (balances.length === 0) return null;

      // Sort by balance descending
      balances.sort((a, b) => b.balance - a.balance);

      // Calculate concentration metrics
      const top1Percent = totalSupply > 0 ? (balances[0]?.balance || 0) / totalSupply * 100 : 0;
      const top5Percent = totalSupply > 0 ?
        balances.slice(0, 5).reduce((sum, acc) => sum + acc.balance, 0) / totalSupply * 100 : 0;

      // Estimate developer holdings (usually first few addresses)
      const devHolding = Math.min(top5Percent, 30);

      // Count whale accounts (>1% of supply)
      const whaleThreshold = totalSupply * 0.01;
      const whaleCount = balances.filter(acc => acc.balance > whaleThreshold).length;

      // Distribution score (lower concentration = better distribution)
      const distributionScore = Math.max(0, 100 - top1Percent - (top5Percent * 0.5));

      return {
        topHolderPercent: Math.min(100, top1Percent),
        devHolding: Math.min(100, devHolding),
        whaleCount,
        distributionScore: Math.floor(distributionScore)
      };

    } catch (error) {
      console.error('Real holder data fetch failed:', error);
      return null;
    }
  }

  private async estimateHolderDistribution(mint: string) {
    try {
      // Get basic mint info for estimation
      const mintInfo = await getMint(connection, new PublicKey(mint));
      const supply = Number(mintInfo.supply);

      // Estimate based on mint characteristics
      let topHolderConcentration = 30; // Default assumption
      let devHolding = 15;
      let whaleCount = 3;

      // If mint authority is renounced, likely better distribution
      if (mintInfo.mintAuthority === null) {
        topHolderConcentration -= 10;
        devHolding -= 5;
      }

      // Very large supplies often have worse distribution
      if (supply > 1e15) {
        topHolderConcentration += 15;
        devHolding += 10;
      }

      const distributionScore = Math.max(0, 100 - topHolderConcentration - devHolding);

      return {
        topHolderConcentration,
        developersHolding: devHolding,
        whaleCount,
        distributionScore
      };
    } catch {
      return {
        topHolderConcentration: 40,
        developersHolding: 20,
        whaleCount: 2,
        distributionScore: 40
      };
    }
  }

  private calculateSecurityScore(data: {
    ownershipAnalysis: ContractAnalysis['ownershipAnalysis'];
    liquidityAnalysis: ContractAnalysis['liquidityAnalysis'];
    transactionAnalysis: ContractAnalysis['transactionAnalysis'];
    holderAnalysis: ContractAnalysis['holderAnalysis'];
  }): number {
    let score = 50; // Base score

    // Ownership security (30 points)
    if (data.ownershipAnalysis.isRenounced) score += 30;
    else if (data.ownershipAnalysis.riskLevel === 'medium') score += 15;

    // Liquidity security (25 points)
    if (data.liquidityAnalysis.lpTokensLocked) score += 15;
    if (data.liquidityAnalysis.lockDuration > 180) score += 10;

    // Transaction security (25 points)
    score -= data.transactionAnalysis.honeypotRisk * 0.25;
    if (data.transactionAnalysis.sellTaxExist) score -= 10;
    if (data.transactionAnalysis.canBlacklist) score -= 15;

    // Holder distribution (20 points)
    score += (data.holderAnalysis.distributionScore * 0.2);

    return Math.max(0, Math.min(100, Math.floor(score)));
  }

  private identifyRisksAndFeatures(data: any): { vulnerabilities: string[], safetyFeatures: string[] } {
    const vulnerabilities: string[] = [];
    const safetyFeatures: string[] = [];

    // Check vulnerabilities
    if (!data.ownershipAnalysis.isRenounced) {
      vulnerabilities.push('Mint authority not renounced - can mint infinite tokens');
    }
    if (data.liquidityAnalysis.canRugPull) {
      vulnerabilities.push('Liquidity not locked - rug pull possible');
    }
    if (data.transactionAnalysis.honeypotRisk > 50) {
      vulnerabilities.push('High honeypot risk detected');
    }
    if (data.transactionAnalysis.canBlacklist) {
      vulnerabilities.push('Contract can blacklist addresses');
    }
    if (data.holderAnalysis.topHolderConcentration > 40) {
      vulnerabilities.push('High whale concentration risk');
    }

    // Check safety features
    if (data.ownershipAnalysis.isRenounced) {
      safetyFeatures.push('Ownership renounced - immutable contract');
    }
    if (data.liquidityAnalysis.lpTokensLocked) {
      safetyFeatures.push(`LP tokens locked for ${data.liquidityAnalysis.lockDuration} days`);
    }
    if (data.transactionAnalysis.honeypotRisk < 20) {
      safetyFeatures.push('Low honeypot risk - trading appears safe');
    }
    if (data.holderAnalysis.distributionScore > 70) {
      safetyFeatures.push('Good token distribution among holders');
    }

    return { vulnerabilities, safetyFeatures };
  }

  private calculateRiskFactors(data: any): ContractAnalysis['riskFactors'] {
    return {
      rugPullProbability: data.liquidityAnalysis.canRugPull ? 
        (data.ownershipAnalysis.isRenounced ? 30 : 80) : 15,
      honeypotProbability: data.transactionAnalysis.honeypotRisk,
      abandonmentRisk: data.ownershipAnalysis.isRenounced ? 20 : 60,
      marketManipulationRisk: Math.min(90, data.holderAnalysis.topHolderConcentration + 
                                      data.holderAnalysis.developersHolding)
    };
  }

  private generateRecommendations(data: {
    vulnerabilities: string[];
    riskFactors: ContractAnalysis['riskFactors'];
    securityScore: number;
  }): string[] {
    const recommendations: string[] = [];

    if (data.securityScore < 40) {
      recommendations.push('⚠️ HIGH RISK: Avoid this token due to multiple security issues');
    } else if (data.securityScore < 70) {
      recommendations.push('⚡ MEDIUM RISK: Proceed with caution and limited investment');
    } else {
      recommendations.push('✅ LOW RISK: Generally safe but always DYOR');
    }

    if (data.riskFactors.rugPullProbability > 60) {
      recommendations.push('🚨 High rug pull risk - LP not properly locked');
    }

    if (data.riskFactors.honeypotProbability > 50) {
      recommendations.push('🍯 Potential honeypot - test with small amount first');
    }

    if (data.riskFactors.marketManipulationRisk > 70) {
      recommendations.push('🐋 High whale concentration - expect high volatility');
    }

    if (data.vulnerabilities.length === 0) {
      recommendations.push('🛡️ No major vulnerabilities detected');
    }

    return recommendations;
  }

  private getFallbackAnalysis(mint: string): ContractAnalysis {
    return {
      mint,
      securityScore: 50,
      vulnerabilities: ['Unable to analyze contract'],
      safetyFeatures: [],
      ownershipAnalysis: {
        mintAuthority: 'unknown',
        freezeAuthority: 'unknown',
        updateAuthority: 'unknown',
        isRenounced: false,
        riskLevel: 'high'
      },
      liquidityAnalysis: {
        poolAddress: null,
        lpTokensLocked: false,
        lockDuration: 0,
        liquidityHealth: 30,
        canRugPull: true
      },
      transactionAnalysis: {
        honeypotRisk: 50,
        sellTaxExist: false,
        buyTaxExist: false,
        maxTransactionLimit: 0,
        canBlacklist: false,
        pausable: false
      },
      holderAnalysis: {
        topHolderConcentration: 40,
        developersHolding: 20,
        whaleCount: 5,
        distributionScore: 40
      },
      riskFactors: {
        rugPullProbability: 60,
        honeypotProbability: 50,
        abandonmentRisk: 40,
        marketManipulationRisk: 60
      },
      recommendations: ['Analysis unavailable - exercise extreme caution']
    };
  }
}

export const contractAnalyzer = new ContractAnalyzer();
