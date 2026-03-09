import {
  Team,
  TeamPool,
  PoolMember,
  TeamSettings,
  ApiKey,
  TeamInvitation,
  TeamRole,
  PoolMemberStatus,
  PoolStatus,
  generatePoolId,
  generateTeamId,
  generateApiKeyId,
  TeamPoolSchema,
  TeamSchema,
  ApiKeySchema,
  TeamInvitationSchema,
  DEFAULT_TEAM_SETTINGS,
} from './team-types';
import { log } from '../../util/logger';

/**
 * Team data store - manages teams and pools in memory
 * This is the single source of truth for team data
 */
export class TeamStore {
  private teams: Map<string, Team> = new Map();
  private pools: Map<string, TeamPool> = new Map();
  private invitations: Map<string, TeamInvitation> = new Map();

  constructor() {
    log.info('TeamStore initialized');
  }

  /**
   * Create a new team
   */
  createTeam(name: string, ownerId: string, description?: string): Team {
    const now = new Date();
    const team: Team = {
      id: generateTeamId(),
      name,
      description,
      pools: [],
      createdAt: now,
      updatedAt: now,
      ownerId,
      settings: { ...DEFAULT_TEAM_SETTINGS },
      apiKeys: [],
    };

    this.teams.set(team.id, team);
    log.info(`Created team: ${team.name} (${team.id})`);
    return team;
  }

  /**
   * Get team by ID
   */
  getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get all teams
   */
  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  /**
   * Update team
   */
  updateTeam(teamId: string, updates: Partial<Pick<Team, 'name' | 'description' | 'settings'>> & { settings?: Partial<TeamSettings> }): Team | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      log.warn(`Team not found: ${teamId}`);
      return undefined;
    }

    const updatedTeam: Team = {
      ...team,
      name: updates.name ?? team.name,
      description: updates.description ?? team.description,
      settings: updates.settings
        ? { ...team.settings, ...updates.settings }
        : team.settings,
      updatedAt: new Date(),
    };

    this.teams.set(teamId, updatedTeam);
    log.info(`Updated team: ${team.name} (${team.id})`);
    return updatedTeam;
  }

  /**
   * Delete team
   */
  deleteTeam(teamId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }

    // Delete all pools in the team
    for (const pool of team.pools) {
      this.pools.delete(pool.id);
    }

    this.teams.delete(teamId);
    log.info(`Deleted team: ${team.name} (${team.id})`);
    return true;
  }

  /**
   * Create a new pool in a team
   */
  createPool(
    teamId: string,
    name: string,
    totalQuota: number,
    options?: {
      description?: string;
      projectId?: string;
      department?: string;
      alertThreshold?: number;
      budgetLimit?: number;
    }
  ): TeamPool | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      log.warn(`Team not found: ${teamId}`);
      return undefined;
    }

    const now = new Date();
    const pool: TeamPool = {
      id: generatePoolId(),
      name,
      description: options?.description,
      totalQuota,
      usedQuota: 0,
      members: [],
      createdAt: now,
      updatedAt: now,
      status: 'active',
      projectId: options?.projectId,
      department: options?.department,
      alertThreshold: options?.alertThreshold ?? team.settings.defaultAlertThreshold,
      budgetLimit: options?.budgetLimit,
    };

    const validated = TeamPoolSchema.parse(pool);
    this.pools.set(validated.id, validated);
    team.pools.push(validated);
    team.updatedAt = now;

    log.info(`Created pool: ${pool.name} (${pool.id}) in team ${team.name}`);
    return validated;
  }

  /**
   * Get pool by ID
   */
  getPool(poolId: string): TeamPool | undefined {
    return this.pools.get(poolId);
  }

  /**
   * Get all pools
   */
  getAllPools(): TeamPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Get pools for a team
   */
  getTeamPools(teamId: string): TeamPool[] {
    const team = this.teams.get(teamId);
    return team?.pools ?? [];
  }

  /**
   * Update pool
   */
  updatePool(
    poolId: string,
    updates: Partial<Pick<TeamPool, 'name' | 'description' | 'totalQuota' | 'status' | 'alertThreshold' | 'budgetLimit'>>
  ): TeamPool | undefined {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return undefined;
    }

    const updatedPool: TeamPool = {
      ...pool,
      ...updates,
      updatedAt: new Date(),
    };

    const validated = TeamPoolSchema.parse(updatedPool);
    this.pools.set(poolId, validated);

    // Update in team
    const team = this.teams.values().next().value;
    if (team) {
      const poolIndex = team.pools.findIndex(p => p.id === poolId);
      if (poolIndex >= 0) {
        team.pools[poolIndex] = validated;
        team.updatedAt = new Date();
      }
    }

    log.info(`Updated pool: ${validated.name} (${validated.id})`);
    return validated;
  }

  /**
   * Delete pool
   */
  deletePool(poolId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    this.pools.delete(poolId);

    // Remove from team
    for (const team of this.teams.values()) {
      const poolIndex = team.pools.findIndex(p => p.id === poolId);
      if (poolIndex >= 0) {
        team.pools.splice(poolIndex, 1);
        team.updatedAt = new Date();
        break;
      }
    }

    log.info(`Deleted pool: ${pool.name} (${pool.id})`);
    return true;
  }

  /**
   * Add member to pool
   */
  addPoolMember(
    poolId: string,
    member: Omit<PoolMember, 'id' | 'joinedAt' | 'lastActive' | 'usage'>
  ): PoolMember | undefined {
    const pool = this.pools.get(poolId);
    if (!pool) {
      log.warn(`Pool not found: ${poolId}`);
      return undefined;
    }

    const newMember: PoolMember = {
      id: crypto.randomUUID(),
      name: member.name,
      email: member.email,
      usage: 0,
      lastActive: new Date(),
      joinedAt: new Date(),
      status: member.status,
      role: member.role,
    };

    pool.members.push(newMember);
    pool.updatedAt = new Date();

    log.info(`Added member ${newMember.name} to pool ${pool.name}`);
    return newMember;
  }

  /**
   * Remove member from pool
   */
  removePoolMember(poolId: string, memberId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    const memberIndex = pool.members.findIndex(m => m.id === memberId);
    if (memberIndex < 0) {
      return false;
    }

    const removed = pool.members.splice(memberIndex, 1)[0];
    pool.updatedAt = new Date();

    log.info(`Removed member ${removed.name} from pool ${pool.name}`);
    return true;
  }

  /**
   * Update member usage
   */
  updateMemberUsage(poolId: string, memberId: string, usageDelta: number): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    const member = pool.members.find(m => m.id === memberId);
    if (!member) {
      return false;
    }

    member.usage = Math.max(0, member.usage + usageDelta);
    member.lastActive = new Date();

    // Update pool total
    pool.usedQuota = pool.members.reduce((sum, m) => sum + m.usage, 0);
    pool.updatedAt = new Date();

    return true;
  }

  /**
   * Set member status
   */
  setMemberStatus(poolId: string, memberId: string, status: PoolMemberStatus): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    const member = pool.members.find(m => m.id === memberId);
    if (!member) {
      return false;
    }

    member.status = status;
    pool.updatedAt = new Date();

    return true;
  }

  /**
   * Set member role
   */
  setMemberRole(poolId: string, memberId: string, role: TeamRole): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    const member = pool.members.find(m => m.id === memberId);
    if (!member) {
      return false;
    }

    member.role = role;
    pool.updatedAt = new Date();

    return true;
  }

  /**
   * Archive pool
   */
  archivePool(poolId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    pool.status = 'archived';
    pool.updatedAt = new Date();
    log.info(`Archived pool: ${pool.name} (${pool.id})`);
    return true;
  }

  /**
   * Freeze pool
   */
  freezePool(poolId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    pool.status = 'frozen';
    pool.updatedAt = new Date();
    log.info(`Frozen pool: ${pool.name} (${pool.id})`);
    return true;
  }

  /**
   * Transfer quota between pools
   */
  transferQuota(fromPoolId: string, toPoolId: string, amount: number): boolean {
    const fromPool = this.pools.get(fromPoolId);
    const toPool = this.pools.get(toPoolId);

    if (!fromPool || !toPool) {
      return false;
    }

    if (fromPool.usedQuota + amount > fromPool.totalQuota) {
      log.warn(`Insufficient quota in pool ${fromPool.name}`);
      return false;
    }

    fromPool.totalQuota -= amount;
    fromPool.updatedAt = new Date();

    toPool.totalQuota += amount;
    toPool.updatedAt = new Date();

    log.info(`Transferred ${amount} quota from ${fromPool.name} to ${toPool.name}`);
    return true;
  }

  /**
   * Create API key for team
   */
  createApiKey(teamId: string, name: string, expiresAt?: Date): ApiKey | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    const apiKey: ApiKey = {
      id: generateApiKeyId(),
      name,
      key: `ak_${crypto.randomUUID().replace(/-/g, '')}`,
      createdAt: new Date(),
      expiresAt,
      permissions: ['admin', 'member', 'viewer'],
    };

    const validated = ApiKeySchema.parse(apiKey);
    team.apiKeys.push(validated);
    team.updatedAt = new Date();

    log.info(`Created API key: ${name} for team ${team.name}`);
    return validated;
  }

  /**
   * Revoke API key
   */
  revokeApiKey(teamId: string, apiKeyId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }

    const keyIndex = team.apiKeys.findIndex(k => k.id === apiKeyId);
    if (keyIndex < 0) {
      return false;
    }

    team.apiKeys.splice(keyIndex, 1);
    team.updatedAt = new Date();

    log.info(`Revoked API key ${apiKeyId} for team ${team.name}`);
    return true;
  }

  /**
   * Create team invitation
   */
  createInvitation(teamId: string, email: string, role: TeamRole, invitedBy: string): TeamInvitation | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    const invitation: TeamInvitation = {
      id: crypto.randomUUID(),
      teamId,
      email,
      role,
      invitedBy,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending',
    };

    const validated = TeamInvitationSchema.parse(invitation);
    this.invitations.set(validated.id, validated);

    log.info(`Created invitation for ${email} to team ${team.name}`);
    return validated;
  }

  /**
   * Get invitation
   */
  getInvitation(invitationId: string): TeamInvitation | undefined {
    return this.invitations.get(invitationId);
  }

  /**
   * Accept invitation
   */
  acceptInvitation(invitationId: string): boolean {
    const invitation = this.invitations.get(invitationId);
    if (!invitation || invitation.status !== 'pending') {
      return false;
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      return false;
    }

    invitation.status = 'accepted';
    log.info(`Accepted invitation ${invitationId}`);
    return true;
  }

  /**
   * Get pools near exhaustion (above alert threshold)
   */
  getPoolsNearExhaustion(): TeamPool[] {
    const pools: TeamPool[] = [];

    for (const pool of this.pools.values()) {
      if (pool.status !== 'active') continue;

      const percentage = (pool.usedQuota / pool.totalQuota) * 100;
      if (percentage >= pool.alertThreshold) {
        pools.push(pool);
      }
    }

    return pools;
  }

  /**
   * Get pools over budget
   */
  getPoolsOverBudget(): TeamPool[] {
    const pools: TeamPool[] = [];

    for (const pool of this.pools.values()) {
      if (pool.status !== 'active' || !pool.budgetLimit) continue;

      if (pool.usedQuota >= pool.budgetLimit) {
        pools.push(pool);
      }
    }

    return pools;
  }

  /**
   * Get team by name
   */
  getTeamByName(name: string): Team | undefined {
    for (const team of this.teams.values()) {
      if (team.name.toLowerCase() === name.toLowerCase()) {
        return team;
      }
    }
    return undefined;
  }

  /**
   * Get pool by name within a team
   */
  getPoolByName(teamId: string, poolName: string): TeamPool | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    return team.pools.find(p => p.name.toLowerCase() === poolName.toLowerCase());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.teams.clear();
    this.pools.clear();
    this.invitations.clear();
    log.info('TeamStore cleared');
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTeams: number;
    totalPools: number;
    totalMembers: number;
    activePools: number;
    archivedPools: number;
    poolsNearExhaustion: number;
  } {
    let totalMembers = 0;
    let activePools = 0;
    let archivedPools = 0;
    const nearExhaustion = this.getPoolsNearExhaustion();

    for (const pool of this.pools.values()) {
      totalMembers += pool.members.length;
      if (pool.status === 'active') activePools++;
      if (pool.status === 'archived') archivedPools++;
    }

    return {
      totalTeams: this.teams.size,
      totalPools: this.pools.size,
      totalMembers,
      activePools,
      archivedPools,
      poolsNearExhaustion: nearExhaustion.length,
    };
  }
}

/**
 * Create a new team store instance
 */
export function createTeamStore(): TeamStore {
  return new TeamStore();
}
