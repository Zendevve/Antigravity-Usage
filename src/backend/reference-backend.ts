import { z } from 'zod';
import { TeamStore, createTeamStore } from '../core/teams/team-store';
import { TeamPoolManager, createPoolManager, PoolAlert } from '../core/teams/team-pool';
import {
  Team,
  TeamPool,
  PoolMember,
  TeamSettings,
  TeamInvitation,
  TeamRole,
  generatePoolId,
  generateTeamId,
  DEFAULT_TEAM_SETTINGS,
} from '../core/teams/team-types';
import { log } from '../util/logger';

/**
 * Reference Backend Configuration
 */
export interface ReferenceBackendConfig {
  baseUrl: string;
  apiKey: string;
  syncInterval: number; // minutes
  port: number;
}

export const DEFAULT_BACKEND_CONFIG: ReferenceBackendConfig = {
  baseUrl: 'http://localhost:3001',
  apiKey: '',
  syncInterval: 60,
  port: 3001,
};

/**
 * API Request/Response types
 */

export const CreateTeamRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  ownerId: z.string(),
  settings: z
    .object({
      defaultAlertThreshold: z.number().min(0).max(100).optional(),
      budgetAlertEnabled: z.boolean().optional(),
      autoSyncEnabled: z.boolean().optional(),
      syncIntervalMinutes: z.number().min(1).max(1440).optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
    })
    .optional(),
});

export const UpdateTeamRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z
    .object({
      defaultAlertThreshold: z.number().min(0).max(100).optional(),
      budgetAlertEnabled: z.boolean().optional(),
      autoSyncEnabled: z.boolean().optional(),
      syncIntervalMinutes: z.number().min(1).max(1440).optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
    })
    .optional(),
});

export const CreatePoolRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  totalQuota: z.number().min(0),
  projectId: z.string().optional(),
  department: z.string().optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
  budgetLimit: z.number().min(0).optional(),
});

export const UpdatePoolRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  totalQuota: z.number().min(0).optional(),
  status: z.enum(['active', 'archived', 'frozen']).optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
  budgetLimit: z.number().min(0).optional(),
});

export const AddMemberRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'member', 'viewer']),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
});

export const UpdateMemberRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  usage: z.number().min(0).optional(),
});

export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export const CreateInvitationRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export const SyncUsageRequestSchema = z.object({
  memberId: z.string(),
  usage: z.number().min(0),
  timestamp: z.date().optional(),
});

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequestSchema>;
export type CreatePoolRequest = z.infer<typeof CreatePoolRequestSchema>;
export type UpdatePoolRequest = z.infer<typeof UpdatePoolRequestSchema>;
export type AddMemberRequest = z.infer<typeof AddMemberRequestSchema>;
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;
export type SyncUsageRequest = z.infer<typeof SyncUsageRequestSchema>;

/**
 * API Response types
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(error: string): ApiResponse<never> {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reference Backend - Express.js reference implementation
 * This provides a reference API for team management
 */
export class ReferenceBackend {
  private store: TeamStore;
  private poolManager: TeamPoolManager;
  private config: ReferenceBackendConfig;
  private syncIntervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<ReferenceBackendConfig> = {}) {
    this.store = createTeamStore();
    this.poolManager = createPoolManager(this.store);
    this.config = { ...DEFAULT_BACKEND_CONFIG, ...config };
    log.info('ReferenceBackend initialized');
  }

  /**
   * Start the backend server
   */
  async start(): Promise<void> {
    log.info(`Starting Reference Backend on port ${this.config.port}`);
    // Note: In a real implementation, this would start an Express server
    // For this reference implementation, we provide the API methods directly
  }

  /**
   * Stop the backend server
   */
  async stop(): Promise<void> {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    log.info('Reference Backend stopped');
  }

  /**
   * Team Management Endpoints
   */

  /**
   * Create a new team
   * POST /teams
   */
  createTeam(request: CreateTeamRequest): ApiResponse<Team> {
    try {
      const validated = CreateTeamRequestSchema.parse(request);
      const team = this.store.createTeam(
        validated.name,
        validated.ownerId,
        validated.description
      );

      if (validated.settings) {
        this.store.updateTeam(team.id, {
          settings: { ...team.settings, ...validated.settings },
        });
      }

      return successResponse(this.store.getTeam(team.id)!);
    } catch (error) {
      log.error('Failed to create team', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Get team by ID
   * GET /teams/:id
   */
  getTeam(teamId: string): ApiResponse<Team> {
    const team = this.store.getTeam(teamId);
    if (!team) {
      return errorResponse('Team not found');
    }
    return successResponse(team);
  }

  /**
   * Update team
   * PUT /teams/:id
   */
  updateTeam(teamId: string, request: UpdateTeamRequest): ApiResponse<Team> {
    try {
      const validated = UpdateTeamRequestSchema.parse(request);

      // Get existing team first
      const team = this.store.getTeam(teamId);
      if (!team) {
        return errorResponse('Team not found');
      }

      // Build updates - handle settings separately
      const updates: Partial<Pick<Team, 'name' | 'description'>> & { settings?: TeamSettings } = {};
      if (validated.name) updates.name = validated.name;
      if (validated.description !== undefined) updates.description = validated.description;

      // Merge settings with current settings
      if (validated.settings) {
        updates.settings = { ...team.settings, ...validated.settings };
      }

      const updated = this.store.updateTeam(teamId, updates);
      if (!updated) {
        return errorResponse('Team not found');
      }
      return successResponse(updated);
    } catch (error) {
      log.error('Failed to update team', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Delete team
   * DELETE /teams/:id
   */
  deleteTeam(teamId: string): ApiResponse<{ deleted: boolean }> {
    const deleted = this.store.deleteTeam(teamId);
    if (!deleted) {
      return errorResponse('Team not found');
    }
    return successResponse({ deleted: true });
  }

  /**
   * Get all teams
   * GET /teams
   */
  getAllTeams(): ApiResponse<Team[]> {
    return successResponse(this.store.getAllTeams());
  }

  /**
   * Pool Management Endpoints
   */

  /**
   * Create a pool
   * POST /teams/:id/pools
   */
  createPool(teamId: string, request: CreatePoolRequest): ApiResponse<TeamPool> {
    try {
      const validated = CreatePoolRequestSchema.parse(request);
      const pool = this.store.createPool(teamId, validated.name, validated.totalQuota, {
        description: validated.description,
        projectId: validated.projectId,
        department: validated.department,
        alertThreshold: validated.alertThreshold,
        budgetLimit: validated.budgetLimit,
      });

      if (!pool) {
        return errorResponse('Team not found');
      }
      return successResponse(pool);
    } catch (error) {
      log.error('Failed to create pool', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Get pool by ID
   * GET /teams/:teamId/pools/:poolId
   */
  getPool(teamId: string, poolId: string): ApiResponse<TeamPool> {
    const pool = this.store.getPool(poolId);
    if (!pool || pool.members.length === 0) {
      // Check if pool belongs to team
      const team = this.store.getTeam(teamId);
      if (!team || !team.pools.find(p => p.id === poolId)) {
        return errorResponse('Pool not found');
      }
    }
    return successResponse(pool!);
  }

  /**
   * Update pool
   * PUT /teams/:teamId/pools/:poolId
   */
  updatePool(teamId: string, poolId: string, request: UpdatePoolRequest): ApiResponse<TeamPool> {
    try {
      const validated = UpdatePoolRequestSchema.parse(request);
      const updated = this.store.updatePool(poolId, validated);
      if (!updated) {
        return errorResponse('Pool not found');
      }
      return successResponse(updated);
    } catch (error) {
      log.error('Failed to update pool', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Delete pool
   * DELETE /teams/:teamId/pools/:poolId
   */
  deletePool(teamId: string, poolId: string): ApiResponse<{ deleted: boolean }> {
    const deleted = this.store.deletePool(poolId);
    if (!deleted) {
      return errorResponse('Pool not found');
    }
    return successResponse({ deleted: true });
  }

  /**
   * Get all pools for a team
   * GET /teams/:id/pools
   */
  getTeamPools(teamId: string): ApiResponse<TeamPool[]> {
    const pools = this.store.getTeamPools(teamId);
    return successResponse(pools);
  }

  /**
   * Member Management Endpoints
   */

  /**
   * Add member to pool
   * POST /teams/:teamId/pools/:poolId/members
   */
  addPoolMember(
    teamId: string,
    poolId: string,
    request: AddMemberRequest
  ): ApiResponse<PoolMember> {
    try {
      const validated = AddMemberRequestSchema.parse(request);
      const member = this.store.addPoolMember(poolId, {
        name: validated.name,
        email: validated.email,
        role: validated.role,
        status: validated.status,
      });

      if (!member) {
        return errorResponse('Pool not found');
      }
      return successResponse(member);
    } catch (error) {
      log.error('Failed to add member', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Remove member from pool
   * DELETE /teams/:teamId/pools/:poolId/members/:memberId
   */
  removePoolMember(
    teamId: string,
    poolId: string,
    memberId: string
  ): ApiResponse<{ removed: boolean }> {
    const removed = this.store.removePoolMember(poolId, memberId);
    if (!removed) {
      return errorResponse('Member not found');
    }
    return successResponse({ removed: true });
  }

  /**
   * Update member
   * PUT /teams/:teamId/pools/:poolId/members/:memberId
   */
  updatePoolMember(
    teamId: string,
    poolId: string,
    memberId: string,
    request: UpdateMemberRequest
  ): ApiResponse<PoolMember> {
    try {
      const validated = UpdateMemberRequestSchema.parse(request);
      const pool = this.store.getPool(poolId);

      if (!pool) {
        return errorResponse('Pool not found');
      }

      const member = pool.members.find(m => m.id === memberId);
      if (!member) {
        return errorResponse('Member not found');
      }

      // Update member fields
      if (validated.name) member.name = validated.name;
      if (validated.email) member.email = validated.email;
      if (validated.role) member.role = validated.role;
      if (validated.status) member.status = validated.status;
      if (validated.usage !== undefined) {
        member.usage = validated.usage;
        this.store.updateMemberUsage(poolId, memberId, 0); // Reset to exact value
      }

      pool.updatedAt = new Date();
      return successResponse(member);
    } catch (error) {
      log.error('Failed to update member', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Quota Sync Endpoints
   */

  /**
   * Sync member usage
   * POST /teams/:teamId/pools/:poolId/sync
   */
  syncUsage(
    teamId: string,
    poolId: string,
    request: SyncUsageRequest
  ): ApiResponse<{ updated: boolean }> {
    try {
      const validated = SyncUsageRequestSchema.parse(request);
      const pool = this.store.getPool(poolId);

      if (!pool) {
        return errorResponse('Pool not found');
      }

      const member = pool.members.find(m => m.id === validated.memberId);
      if (!member) {
        return errorResponse('Member not found');
      }

      // Set exact usage (delta would be calculated differently)
      member.usage = validated.usage;
      member.lastActive = validated.timestamp || new Date();

      // Update pool total
      pool.usedQuota = pool.members.reduce((sum, m) => sum + m.usage, 0);
      pool.updatedAt = new Date();

      return successResponse({ updated: true });
    } catch (error) {
      log.error('Failed to sync usage', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Get pool usage
   * GET /teams/:teamId/pools/:poolId/usage
   */
  getPoolUsage(
    teamId: string,
    poolId: string
  ): ApiResponse<{
    poolId: string;
    totalQuota: number;
    usedQuota: number;
    availableQuota: number;
    percentageUsed: number;
    members: { id: string; name: string; usage: number; percentage: number }[];
  }> {
    const pool = this.store.getPool(poolId);

    if (!pool) {
      return errorResponse('Pool not found');
    }

    const usedQuota = pool.usedQuota;
    const totalQuota = pool.totalQuota;
    const percentageUsed = totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 0;

    const members = pool.members.map(m => ({
      id: m.id,
      name: m.name,
      usage: m.usage,
      percentage: usedQuota > 0 ? (m.usage / usedQuota) * 100 : 0,
    }));

    return successResponse({
      poolId: pool.id,
      totalQuota,
      usedQuota,
      availableQuota: Math.max(0, totalQuota - usedQuota),
      percentageUsed,
      members,
    });
  }

  /**
   * API Key Management
   */

  /**
   * Create API key
   * POST /teams/:id/api-keys
   */
  createApiKey(
    teamId: string,
    request: CreateApiKeyRequest
  ): ApiResponse<{ key: string; apiKey: { id: string; name: string; createdAt: string } }> {
    try {
      const validated = CreateApiKeyRequestSchema.parse(request);
      const expiresAt = validated.expiresInDays
        ? new Date(Date.now() + validated.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const apiKey = this.store.createApiKey(teamId, validated.name, expiresAt);

      if (!apiKey) {
        return errorResponse('Team not found');
      }

      return successResponse({
        key: apiKey.key,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          createdAt: apiKey.createdAt.toISOString(),
        },
      });
    } catch (error) {
      log.error('Failed to create API key', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Revoke API key
   * DELETE /teams/:id/api-keys/:keyId
   */
  revokeApiKey(teamId: string, keyId: string): ApiResponse<{ revoked: boolean }> {
    const revoked = this.store.revokeApiKey(teamId, keyId);
    if (!revoked) {
      return errorResponse('API key not found');
    }
    return successResponse({ revoked: true });
  }

  /**
   * Invitation Management
   */

  /**
   * Create invitation
   * POST /teams/:id/invitations
   */
  createInvitation(
    teamId: string,
    request: CreateInvitationRequest
  ): ApiResponse<TeamInvitation> {
    try {
      const validated = CreateInvitationRequestSchema.parse(request);
      const invitation = this.store.createInvitation(
        teamId,
        validated.email,
        validated.role,
        'system' // In real implementation, would use authenticated user
      );

      if (!invitation) {
        return errorResponse('Team not found');
      }

      return successResponse(invitation);
    } catch (error) {
      log.error('Failed to create invitation', error);
      return errorResponse(String(error));
    }
  }

  /**
   * Accept invitation
   * POST /invitations/:id/accept
   */
  acceptInvitation(invitationId: string): ApiResponse<{ accepted: boolean }> {
    const accepted = this.store.acceptInvitation(invitationId);
    if (!accepted) {
      return errorResponse('Invitation not found or already accepted');
    }
    return successResponse({ accepted: true });
  }

  /**
   * Alert Endpoints
   */

  /**
   * Get all alerts
   * GET /alerts
   */
  getAlerts(): ApiResponse<{
    alerts: PoolAlert[];
    poolsNearExhaustion: number;
    poolsOverBudget: number;
  }> {
    this.poolManager.checkPoolsForAlerts();
    const allAlerts = this.poolManager.getAllAlerts();

    return successResponse({
      alerts: allAlerts,
      poolsNearExhaustion: this.store.getPoolsNearExhaustion().length,
      poolsOverBudget: this.store.getPoolsOverBudget().length,
    });
  }

  /**
   * Acknowledge alert
   * POST /alerts/:id/acknowledge
   */
  acknowledgeAlert(alertId: string): ApiResponse<{ acknowledged: boolean }> {
    const acknowledged = this.poolManager.acknowledgeAlert(alertId);
    if (!acknowledged) {
      return errorResponse('Alert not found');
    }
    return successResponse({ acknowledged: true });
  }

  /**
   * Dashboard/Stats Endpoints
   */

  /**
   * Get dashboard data
   * GET /dashboard
   */
  getDashboard(): ApiResponse<{
    stats: {
      totalTeams: number;
      totalPools: number;
      totalMembers: number;
      activePools: number;
      archivedPools: number;
      poolsNearExhaustion: number;
    };
    teamUsage: { teamId: string; teamName: string; totalQuota: number; usedQuota: number; percentageUsed: number }[];
    alerts: PoolAlert[];
  }> {
    const stats = this.store.getStats();
    const teams = this.store.getAllTeams();
    const alerts = this.poolManager.getAllAlerts();

    const teamUsage = teams.map(team => {
      const pools = this.store.getTeamPools(team.id);
      const totalQuota = pools.reduce((sum, p) => sum + p.totalQuota, 0);
      const usedQuota = pools.reduce((sum, p) => sum + p.usedQuota, 0);

      return {
        teamId: team.id,
        teamName: team.name,
        totalQuota,
        usedQuota,
        percentageUsed: totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 0,
      };
    });

    return successResponse({
      stats,
      teamUsage,
      alerts,
    });
  }

  /**
   * Get pool visualization
   * GET /teams/:teamId/pools/:poolId/visualization
   */
  getPoolVisualization(
    teamId: string,
    poolId: string
  ): ApiResponse<ReturnType<typeof this.poolManager.getPoolVisualization>> {
    const viz = this.poolManager.getPoolVisualization(poolId);
    if (!viz) {
      return errorResponse('Pool not found');
    }
    return successResponse(viz);
  }

  /**
   * Get pool forecast
   * GET /teams/:teamId/pools/:poolId/forecast
   */
  getPoolForecast(
    teamId: string,
    poolId: string
  ): ApiResponse<ReturnType<typeof this.poolManager.getPoolForecast>> {
    const forecast = this.poolManager.getPoolForecast(poolId);
    if (!forecast) {
      return errorResponse('Insufficient data for forecast');
    }
    return successResponse(forecast);
  }

  /**
   * Get store instance (for testing)
   */
  getStore(): TeamStore {
    return this.store;
  }

  /**
   * Get pool manager instance (for testing)
   */
  getPoolManager(): TeamPoolManager {
    return this.poolManager;
  }
}

/**
 * Create a reference backend instance
 */
export function createReferenceBackend(
  config?: Partial<ReferenceBackendConfig>
): ReferenceBackend {
  return new ReferenceBackend(config);
}
