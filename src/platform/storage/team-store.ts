import { Memento } from 'vscode';
import { z } from 'zod';
import { log } from '../../util/logger';
import {
  Team,
  TeamPool,
  PoolMember,
  TeamSettings,
  TeamInvitation,
  ApiKey,
  DEFAULT_TEAM_SETTINGS,
} from '../../core/teams/team-types';

/**
 * Storage keys for Memento
 */
const STORAGE_KEYS = {
  TEAMS: 'k1-antigravity.teams.data',
  POOLS: 'k1-antigravity.teams.pools',
  INVITATIONS: 'k1-antigravity.teams.invitations',
  SYNC_STATE: 'k1-antigravity.teams.syncState',
  ACTIVE_TEAM: 'k1-antigravity.teams.activeTeam',
} as const;

/**
 * Sync state for tracking backend synchronization
 */
export interface SyncState {
  lastSyncTime: string | null;
  lastSuccessfulSync: string | null;
  syncError: string | null;
  pendingChanges: number;
  isOnline: boolean;
}

/**
 * Local team data storage with offline support
 * Provides caching and synchronization with reference backend
 */
export class LocalTeamStore {
  private storage: Memento;

  constructor(storage: Memento) {
    this.storage = storage;
    log.info('LocalTeamStore initialized');
  }

  // ==================== Team Operations ====================

  /**
   * Get all teams from local storage
   */
  getTeams(): Team[] {
    const data = this.storage.get<Team[]>(STORAGE_KEYS.TEAMS, []);
    return data.map(team => this.deserializeTeam(team));
  }

  /**
   * Get team by ID
   */
  getTeam(teamId: string): Team | undefined {
    const teams = this.getTeams();
    return teams.find(t => t.id === teamId);
  }

  /**
   * Get active team (currently selected)
   */
  getActiveTeam(): Team | undefined {
    const activeId = this.storage.get<string | null>(STORAGE_KEYS.ACTIVE_TEAM, null);
    if (!activeId) {
      return undefined;
    }
    return this.getTeam(activeId);
  }

  /**
   * Set active team
   */
  setActiveTeam(teamId: string): void {
    this.storage.update(STORAGE_KEYS.ACTIVE_TEAM, teamId);
    log.info(`Set active team: ${teamId}`);
  }

  /**
   * Save a team (create or update)
   */
  saveTeam(team: Team): void {
    const teams = this.getTeams();
    const index = teams.findIndex(t => t.id === team.id);

    if (index >= 0) {
      teams[index] = team;
    } else {
      teams.push(team);
    }

    this.storage.update(STORAGE_KEYS.TEAMS, teams);
    log.debug(`Saved team: ${team.name}`);
  }

  /**
   * Create a new team locally
   */
  createTeam(name: string, ownerId: string, description?: string): Team {
    const now = new Date();
    const team: Team = {
      id: crypto.randomUUID(),
      name,
      description,
      pools: [],
      createdAt: now,
      updatedAt: now,
      ownerId,
      settings: { ...DEFAULT_TEAM_SETTINGS },
      apiKeys: [],
    };

    this.saveTeam(team);
    log.info(`Created local team: ${team.name}`);
    return team;
  }

  /**
   * Delete a team
   */
  deleteTeam(teamId: string): boolean {
    const teams = this.getTeams();
    const index = teams.findIndex(t => t.id === teamId);

    if (index < 0) {
      return false;
    }

    const deleted = teams.splice(index, 1)[0];
    this.storage.update(STORAGE_KEYS.TEAMS, teams);

    // Also delete associated pools
    const pools = this.getPools();
    const filteredPools = pools.filter(p => p.members.length === 0); // Keep pools that are team-referenced
    this.storage.update(STORAGE_KEYS.POOLS, filteredPools);

    log.info(`Deleted team: ${deleted.name}`);
    return true;
  }

  // ==================== Pool Operations ====================

  /**
   * Get all pools from local storage
   */
  getPools(): TeamPool[] {
    const data = this.storage.get<TeamPool[]>(STORAGE_KEYS.POOLS, []);
    return data.map(pool => this.deserializePool(pool));
  }

  /**
   * Get pool by ID
   */
  getPool(poolId: string): TeamPool | undefined {
    const pools = this.getPools();
    return pools.find(p => p.id === poolId);
  }

  /**
   * Get pools for a team
   */
  getTeamPools(teamId: string): TeamPool[] {
    const team = this.getTeam(teamId);
    if (!team) {
      return [];
    }

    const allPools = this.getPools();
    return allPools.filter(p => team.pools.some(tp => tp.id === p.id));
  }

  /**
   * Save a pool
   */
  savePool(pool: TeamPool): void {
    const pools = this.getPools();
    const index = pools.findIndex(p => p.id === pool.id);

    if (index >= 0) {
      pools[index] = pool;
    } else {
      pools.push(pool);
    }

    this.storage.update(STORAGE_KEYS.POOLS, pools);
    log.debug(`Saved pool: ${pool.name}`);
  }

  /**
   * Delete a pool
   */
  deletePool(poolId: string): boolean {
    const pools = this.getPools();
    const index = pools.findIndex(p => p.id === poolId);

    if (index < 0) {
      return false;
    }

    const deleted = pools.splice(index, 1)[0];
    this.storage.update(STORAGE_KEYS.POOLS, pools);
    log.info(`Deleted pool: ${deleted.name}`);
    return true;
  }

  // ==================== Member Operations ====================

  /**
   * Add member to pool
   */
  addPoolMember(poolId: string, member: Omit<PoolMember, 'id' | 'joinedAt' | 'lastActive' | 'usage'>): PoolMember | undefined {
    const pool = this.getPool(poolId);
    if (!pool) {
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
    this.savePool(pool);

    log.info(`Added member ${newMember.name} to pool ${pool.name}`);
    return newMember;
  }

  /**
   * Remove member from pool
   */
  removePoolMember(poolId: string, memberId: string): boolean {
    const pool = this.getPool(poolId);
    if (!pool) {
      return false;
    }

    const index = pool.members.findIndex(m => m.id === memberId);
    if (index < 0) {
      return false;
    }

    pool.members.splice(index, 1);
    pool.updatedAt = new Date();
    this.savePool(pool);

    log.info(`Removed member from pool ${pool.name}`);
    return true;
  }

  /**
   * Update member usage
   */
  updateMemberUsage(poolId: string, memberId: string, usage: number): boolean {
    const pool = this.getPool(poolId);
    if (!pool) {
      return false;
    }

    const member = pool.members.find(m => m.id === memberId);
    if (!member) {
      return false;
    }

    member.usage = Math.max(0, usage);
    member.lastActive = new Date();
    pool.usedQuota = pool.members.reduce((sum, m) => sum + m.usage, 0);
    pool.updatedAt = new Date();
    this.savePool(pool);

    return true;
  }

  // ==================== Invitation Operations ====================

  /**
   * Get all invitations
   */
  getInvitations(): TeamInvitation[] {
    const data = this.storage.get<TeamInvitation[]>(STORAGE_KEYS.INVITATIONS, []);
    return data.map(inv => this.deserializeInvitation(inv));
  }

  /**
   * Save invitation
   */
  saveInvitation(invitation: TeamInvitation): void {
    const invitations = this.getInvitations();
    const index = invitations.findIndex(i => i.id === invitation.id);

    if (index >= 0) {
      invitations[index] = invitation;
    } else {
      invitations.push(invitation);
    }

    this.storage.update(STORAGE_KEYS.INVITATIONS, invitations);
  }

  /**
   * Delete invitation
   */
  deleteInvitation(invitationId: string): boolean {
    const invitations = this.getInvitations();
    const index = invitations.findIndex(i => i.id === invitationId);

    if (index < 0) {
      return false;
    }

    invitations.splice(index, 1);
    this.storage.update(STORAGE_KEYS.INVITATIONS, invitations);
    return true;
  }

  // ==================== Sync Operations ====================

  /**
   * Get sync state
   */
  getSyncState(): SyncState {
    return this.storage.get<SyncState>(STORAGE_KEYS.SYNC_STATE, {
      lastSyncTime: null,
      lastSuccessfulSync: null,
      syncError: null,
      pendingChanges: 0,
      isOnline: true,
    });
  }

  /**
   * Update sync state
   */
  updateSyncState(state: Partial<SyncState>): void {
    const current = this.getSyncState();
    const updated: SyncState = {
      ...current,
      ...state,
      lastSyncTime: new Date().toISOString(),
    };

    if (state.syncError === null) {
      updated.lastSuccessfulSync = new Date().toISOString();
      updated.pendingChanges = 0;
    }

    this.storage.update(STORAGE_KEYS.SYNC_STATE, updated);
    log.debug('Updated sync state');
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    const state = this.getSyncState();
    return state.pendingChanges > 0;
  }

  /**
   * Increment pending changes count
   */
  incrementPendingChanges(): void {
    const state = this.getSyncState();
    this.updateSyncState({ pendingChanges: state.pendingChanges + 1 });
  }

  // ==================== Bulk Operations ====================

  /**
   * Replace all data from backend (for sync)
   */
  replaceAllData(teams: Team[], pools: TeamPool[]): void {
    this.storage.update(STORAGE_KEYS.TEAMS, teams);
    this.storage.update(STORAGE_KEYS.POOLS, pools);
    this.updateSyncState({
      lastSuccessfulSync: new Date().toISOString(),
      syncError: null,
      pendingChanges: 0,
    });
    log.info('Replaced all team data from sync');
  }

  /**
   * Clear all local data
   */
  clearAll(): void {
    this.storage.update(STORAGE_KEYS.TEAMS, []);
    this.storage.update(STORAGE_KEYS.POOLS, []);
    this.storage.update(STORAGE_KEYS.INVITATIONS, []);
    this.storage.update(STORAGE_KEYS.SYNC_STATE, {
      lastSyncTime: null,
      lastSuccessfulSync: null,
      syncError: null,
      pendingChanges: 0,
      isOnline: true,
    });
    this.storage.update(STORAGE_KEYS.ACTIVE_TEAM, null);
    log.info('Cleared all team data');
  }

  // ==================== Statistics ====================

  /**
   * Get storage statistics
   */
  getStats(): {
    teamCount: number;
    poolCount: number;
    memberCount: number;
    invitationCount: number;
    lastSync: string | null;
    pendingChanges: number;
  } {
    const teams = this.getTeams();
    const pools = this.getPools();
    const invitations = this.getInvitations();
    const syncState = this.getSyncState();

    const memberCount = pools.reduce((sum, pool) => sum + pool.members.length, 0);

    return {
      teamCount: teams.length,
      poolCount: pools.length,
      memberCount,
      invitationCount: invitations.length,
      lastSync: syncState.lastSuccessfulSync,
      pendingChanges: syncState.pendingChanges,
    };
  }

  // ==================== Serialization Helpers ====================

  /**
   * Deserialize team (convert date strings to Date objects)
   */
  private deserializeTeam(team: Team): Team {
    return {
      ...team,
      createdAt: new Date(team.createdAt),
      updatedAt: new Date(team.updatedAt),
      pools: team.pools.map(p => this.deserializePool(p)),
    };
  }

  /**
   * Deserialize pool
   */
  private deserializePool(pool: TeamPool): TeamPool {
    return {
      ...pool,
      createdAt: new Date(pool.createdAt),
      updatedAt: new Date(pool.updatedAt),
      members: pool.members.map(m => ({
        ...m,
        lastActive: new Date(m.lastActive),
        joinedAt: new Date(m.joinedAt),
      })),
    };
  }

  /**
   * Deserialize invitation
   */
  private deserializeInvitation(invitation: TeamInvitation): TeamInvitation {
    return {
      ...invitation,
      invitedAt: new Date(invitation.invitedAt),
      expiresAt: new Date(invitation.expiresAt),
    };
  }
}

/**
 * Create a local team store from extension context
 */
export function createLocalTeamStore(storage: Memento): LocalTeamStore {
  return new LocalTeamStore(storage);
}
