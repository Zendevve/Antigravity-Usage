import {
  TeamPool,
  PoolMember,
  PoolUsageSnapshot,
  PoolStatus,
  calculatePoolUsagePercentage,
  isPoolNearExhaustion,
  isPoolOverBudget,
  getAvailableQuota,
  sortMembersByUsage,
  filterActiveMembers,
  generatePoolId,
} from './team-types';
import { TeamStore } from './team-store';
import { log } from '../../util/logger';

/**
 * Pool alert type
 */
export type PoolAlertType = 'near_exhaustion' | 'over_budget' | 'member_inactive' | 'quota_exceeded';

/**
 * Pool alert
 */
export interface PoolAlert {
  id: string;
  poolId: string;
  type: PoolAlertType;
  severity: 'warning' | 'critical';
  message: string;
  createdAt: Date;
  acknowledged: boolean;
}

/**
 * Pool allocation visualization data
 */
export interface PoolVisualization {
  poolId: string;
  poolName: string;
  totalQuota: number;
  usedQuota: number;
  availableQuota: number;
  percentageUsed: number;
  status: PoolStatus;
  members: MemberVisualization[];
  alerts: PoolAlert[];
  lastUpdated: Date;
}

/**
 * Member visualization for charts
 */
export interface MemberVisualization {
  id: string;
  name: string;
  usage: number;
  percentageOfPool: number;
  status: 'active' | 'inactive' | 'pending';
  role: string;
}

/**
 * Historical pool data point
 */
export interface PoolHistoricalData {
  timestamp: Date;
  usedQuota: number;
  percentageUsed: number;
  activeMembers: number;
}

/**
 * Pool management service - handles advanced pool operations
 */
export class TeamPoolManager {
  private store: TeamStore;
  private usageHistory: Map<string, PoolUsageSnapshot[]> = new Map();
  private alerts: PoolAlert[] = [];

  constructor(store: TeamStore) {
    this.store = store;
    log.info('TeamPoolManager initialized');
  }

  /**
   * Get pool visualization data for dashboard
   */
  getPoolVisualization(poolId: string): PoolVisualization | undefined {
    const pool = this.store.getPool(poolId);
    if (!pool) {
      return undefined;
    }

    const alerts = this.getAlertsForPool(poolId);
    const members: MemberVisualization[] = pool.members.map(member => ({
      id: member.id,
      name: member.name,
      usage: member.usage,
      percentageOfPool: pool.usedQuota > 0 ? (member.usage / pool.usedQuota) * 100 : 0,
      status: member.status,
      role: member.role,
    }));

    return {
      poolId: pool.id,
      poolName: pool.name,
      totalQuota: pool.totalQuota,
      usedQuota: pool.usedQuota,
      availableQuota: getAvailableQuota(pool),
      percentageUsed: calculatePoolUsagePercentage(pool),
      status: pool.status,
      members,
      alerts,
      lastUpdated: pool.updatedAt,
    };
  }

  /**
   * Get visualization for all pools in a team
   */
  getTeamVisualization(teamId: string): PoolVisualization[] {
    const pools = this.store.getTeamPools(teamId);
    return pools
      .map(pool => this.getPoolVisualization(pool.id))
      .filter((v): v is PoolVisualization => v !== undefined);
  }

  /**
   * Get member breakdown sorted by usage
   */
  getMemberBreakdown(poolId: string): PoolMember[] {
    const pool = this.store.getPool(poolId);
    if (!pool) {
      return [];
    }

    return sortMembersByUsage(pool.members);
  }

  /**
   * Record usage snapshot for historical tracking
   */
  recordUsageSnapshot(poolId: string): void {
    const pool = this.store.getPool(poolId);
    if (!pool) {
      return;
    }

    const snapshot: PoolUsageSnapshot = {
      id: crypto.randomUUID(),
      poolId,
      timestamp: new Date(),
      totalUsed: pool.usedQuota,
      memberBreakdown: pool.members.map(m => ({
        memberId: m.id,
        usage: m.usage,
      })),
      percentageUsed: calculatePoolUsagePercentage(pool),
    };

    const history = this.usageHistory.get(poolId) || [];
    history.push(snapshot);

    // Keep last 1000 snapshots
    if (history.length > 1000) {
      history.shift();
    }

    this.usageHistory.set(poolId, history);
  }

  /**
   * Get historical usage data
   */
  getHistoricalUsage(poolId: string, hours: number = 24): PoolHistoricalData[] {
    const history = this.usageHistory.get(poolId) || [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return history
      .filter(s => s.timestamp >= cutoff)
      .map(s => ({
        timestamp: s.timestamp,
        usedQuota: s.totalUsed,
        percentageUsed: s.percentageUsed,
        activeMembers: s.memberBreakdown.length,
      }));
  }

  /**
   * Get alerts for a specific pool
   */
  getAlertsForPool(poolId: string): PoolAlert[] {
    return this.alerts.filter(a => a.poolId === poolId && !a.acknowledged);
  }

  /**
   * Get all active alerts
   */
  getAllAlerts(): PoolAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    return true;
  }

  /**
   * Check pools and generate alerts
   */
  checkPoolsForAlerts(): PoolAlert[] {
    const pools = this.store.getAllPools();
    const newAlerts: PoolAlert[] = [];

    for (const pool of pools) {
      if (pool.status !== 'active') continue;

      // Check for near exhaustion
      if (isPoolNearExhaustion(pool)) {
        const existing = this.alerts.find(
          a => a.poolId === pool.id && a.type === 'near_exhaustion' && !a.acknowledged
        );

        if (!existing) {
          const percentage = calculatePoolUsagePercentage(pool);
          const alert: PoolAlert = {
            id: crypto.randomUUID(),
            poolId: pool.id,
            type: 'near_exhaustion',
            severity: percentage >= 95 ? 'critical' : 'warning',
            message: `Pool "${pool.name}" is at ${percentage.toFixed(1)}% capacity`,
            createdAt: new Date(),
            acknowledged: false,
          };
          this.alerts.push(alert);
          newAlerts.push(alert);
        }
      }

      // Check for over budget
      if (isPoolOverBudget(pool)) {
        const existing = this.alerts.find(
          a => a.poolId === pool.id && a.type === 'over_budget' && !a.acknowledged
        );

        if (!existing) {
          const alert: PoolAlert = {
            id: crypto.randomUUID(),
            poolId: pool.id,
            type: 'over_budget',
            severity: 'critical',
            message: `Pool "${pool.name}" has exceeded its budget limit`,
            createdAt: new Date(),
            acknowledged: false,
          };
          this.alerts.push(alert);
          newAlerts.push(alert);
        }
      }

      // Check for inactive members
      for (const member of pool.members) {
        if (member.status === 'inactive') continue;

        const daysInactive = (Date.now() - member.lastActive.getTime()) / (1000 * 60 * 60 * 24);
        if (daysInactive > 30) {
          const existing = this.alerts.find(
            a => a.poolId === pool.id && a.type === 'member_inactive' && a.message.includes(member.id)
          );

          if (!existing) {
            const alert: PoolAlert = {
              id: crypto.randomUUID(),
              poolId: pool.id,
              type: 'member_inactive',
              severity: 'warning',
              message: `Member "${member.name}" has been inactive for ${Math.floor(daysInactive)} days`,
              createdAt: new Date(),
              acknowledged: false,
            };
            this.alerts.push(alert);
            newAlerts.push(alert);
          }
        }
      }
    }

    return newAlerts;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(poolId: string): {
    totalQuota: number;
    usedQuota: number;
    availableQuota: number;
    percentageUsed: number;
    memberCount: number;
    activeMembers: number;
    topMember: PoolMember | null;
    alerts: number;
    isNearExhaustion: boolean;
    isOverBudget: boolean;
  } | null {
    const pool = this.store.getPool(poolId);
    if (!pool) {
      return null;
    }

    const sorted = sortMembersByUsage(pool.members);
    const active = filterActiveMembers(pool.members);

    return {
      totalQuota: pool.totalQuota,
      usedQuota: pool.usedQuota,
      availableQuota: getAvailableQuota(pool),
      percentageUsed: calculatePoolUsagePercentage(pool),
      memberCount: pool.members.length,
      activeMembers: active.length,
      topMember: sorted[0] || null,
      alerts: this.getAlertsForPool(poolId).length,
      isNearExhaustion: isPoolNearExhaustion(pool),
      isOverBudget: isPoolOverBudget(pool),
    };
  }

  /**
   * Calculate pool efficiency score (0-100)
   * Based on utilization and member activity
   */
  getPoolEfficiency(poolId: string): number {
    const pool = this.store.getPool(poolId);
    if (!pool || pool.status !== 'active') {
      return 0;
    }

    // Utilization score (50% weight)
    const utilizationScore = Math.min(100, calculatePoolUsagePercentage(pool) * 1.25);

    // Activity score (50% weight)
    const activeMembers = filterActiveMembers(pool.members);
    const activityScore = pool.members.length > 0
      ? (activeMembers.length / pool.members.length) * 100
      : 0;

    return Math.round((utilizationScore + activityScore) / 2);
  }

  /**
   * Get pool forecast - predict when pool will be exhausted
   */
  getPoolForecast(poolId: string): {
    estimatedDaysUntilExhaustion: number | null;
    averageDailyUsage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  } | null {
    const history = this.getHistoricalUsage(poolId, 168); // 7 days
    if (history.length < 2) {
      return null;
    }

    // Calculate average daily usage
    const dailyUsages: number[] = [];
    const now = new Date();

    for (let i = 24; i <= 168; i += 24) {
      const point = history.find(h => {
        const diff = now.getTime() - h.timestamp.getTime();
        return diff >= (i - 24) * 60 * 60 * 1000 && diff < i * 60 * 60 * 1000;
      });

      if (point) {
        dailyUsages.push(point.usedQuota);
      }
    }

    if (dailyUsages.length < 2) {
      return null;
    }

    const averageDailyUsage = dailyUsages.reduce((a, b) => a + b, 0) / dailyUsages.length;

    // Determine trend
    const recentAvg = dailyUsages.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, dailyUsages.length);
    const olderAvg = dailyUsages.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, dailyUsages.length);

    let trend: 'increasing' | 'stable' | 'decreasing';
    if (recentAvg > olderAvg * 1.1) {
      trend = 'increasing';
    } else if (recentAvg < olderAvg * 0.9) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    // Calculate days until exhaustion
    const pool = this.store.getPool(poolId);
    const available = pool ? getAvailableQuota(pool) : 0;

    let estimatedDaysUntilExhaustion: number | null = null;
    if (averageDailyUsage > 0 && available > 0) {
      estimatedDaysUntilExhaustion = Math.round(available / averageDailyUsage);
    }

    return {
      estimatedDaysUntilExhaustion,
      averageDailyUsage: Math.round(averageDailyUsage),
      trend,
    };
  }

  /**
   * Compare pool usage across teams
   */
  compareTeamPools(teamId: string): {
    poolId: string;
    poolName: string;
    percentageUsed: number;
    rank: number;
  }[] {
    const pools = this.store.getTeamPools(teamId);

    const compared = pools
      .filter(p => p.status === 'active')
      .map(p => ({
        poolId: p.id,
        poolName: p.name,
        percentageUsed: calculatePoolUsagePercentage(p),
        rank: 0,
      }))
      .sort((a, b) => b.percentageUsed - a.percentageUsed);

    // Assign ranks
    for (let i = 0; i < compared.length; i++) {
      compared[i].rank = i + 1;
    }

    return compared;
  }

  /**
   * Get total team usage across all pools
   */
  getTeamTotalUsage(teamId: string): {
    totalQuota: number;
    usedQuota: number;
    availableQuota: number;
    percentageUsed: number;
    poolCount: number;
    memberCount: number;
  } {
    const pools = this.store.getTeamPools(teamId);

    const totalQuota = pools.reduce((sum, p) => sum + p.totalQuota, 0);
    const usedQuota = pools.reduce((sum, p) => sum + p.usedQuota, 0);
    const memberCount = pools.reduce((sum, p) => sum + p.members.length, 0);

    return {
      totalQuota,
      usedQuota,
      availableQuota: Math.max(0, totalQuota - usedQuota),
      percentageUsed: totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 0,
      poolCount: pools.length,
      memberCount,
    };
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(daysOld: number = 30): number {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const before = this.alerts.length;

    this.alerts = this.alerts.filter(a => a.createdAt >= cutoff || !a.acknowledged);

    return before - this.alerts.length;
  }

  /**
   * Export pool data
   */
  exportPoolData(poolId: string): object | null {
    const pool = this.store.getPool(poolId);
    if (!pool) {
      return null;
    }

    const history = this.getHistoricalUsage(poolId, 720); // 30 days
    const stats = this.getPoolStats(poolId);
    const forecast = this.getPoolForecast(poolId);

    return {
      pool,
      historicalUsage: history,
      stats,
      forecast,
      exportedAt: new Date().toISOString(),
    };
  }
}

/**
 * Create a team pool manager
 */
export function createPoolManager(store: TeamStore): TeamPoolManager {
  return new TeamPoolManager(store);
}
