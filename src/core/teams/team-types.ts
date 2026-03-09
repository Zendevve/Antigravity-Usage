import { z } from 'zod';

/**
 * Default team settings
 */
export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  defaultAlertThreshold: 80,
  budgetAlertEnabled: true,
  autoSyncEnabled: true,
  syncIntervalMinutes: 60,
  timezone: 'UTC',
  locale: 'en',
};

/**
 * Team member roles within a team
 */
export type TeamRole = 'admin' | 'member' | 'viewer';

/**
 * Pool member status
 */
export type PoolMemberStatus = 'active' | 'inactive' | 'pending';

/**
 * Pool status for archive functionality
 */
export type PoolStatus = 'active' | 'archived' | 'frozen';

/**
 * Team pool member - tracks individual usage within a pool
 */
export interface PoolMember {
  id: string;
  name: string;
  email?: string;
  usage: number;
  lastActive: Date;
  status: PoolMemberStatus;
  role: TeamRole;
  joinedAt: Date;
}

/**
 * Quota pool - shared quota limit for a team
 */
export interface TeamPool {
  id: string;
  name: string;
  description?: string;
  totalQuota: number;
  usedQuota: number;
  members: PoolMember[];
  createdAt: Date;
  updatedAt: Date;
  status: PoolStatus;
  projectId?: string;
  department?: string;
  alertThreshold: number; // percentage (0-100)
  budgetLimit?: number; // in credits/cost
}

/**
 * Team - higher-level organization containing pools
 */
export interface Team {
  id: string;
  name: string;
  description?: string;
  pools: TeamPool[];
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  settings: TeamSettings;
  apiKeys: ApiKey[];
}

export interface TeamSettings {
  defaultAlertThreshold: number;
  budgetAlertEnabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  timezone: string;
  locale: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  permissions: TeamRole[];
}

/**
 * Team invitation
 */
export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired';
}

/**
 * Pool usage history entry
 */
export interface PoolUsageSnapshot {
  id: string;
  poolId: string;
  timestamp: Date;
  totalUsed: number;
  memberBreakdown: { memberId: string; usage: number }[];
  percentageUsed: number;
}

/**
 * Zod schemas for validation
 */

export const PoolMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  usage: z.number().min(0),
  lastActive: z.date(),
  status: z.enum(['active', 'inactive', 'pending']),
  role: z.enum(['admin', 'member', 'viewer']),
  joinedAt: z.date(),
});

export const TeamPoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  totalQuota: z.number().min(0),
  usedQuota: z.number().min(0),
  members: z.array(PoolMemberSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: z.enum(['active', 'archived', 'frozen']),
  projectId: z.string().optional(),
  department: z.string().optional(),
  alertThreshold: z.number().min(0).max(100).default(80),
  budgetLimit: z.number().min(0).optional(),
});

export const TeamSettingsSchema = z.object({
  defaultAlertThreshold: z.number().min(0).max(100).default(80),
  budgetAlertEnabled: z.boolean().default(true),
  autoSyncEnabled: z.boolean().default(true),
  syncIntervalMinutes: z.number().min(1).max(1440).default(60),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en'),
});

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  key: z.string().min(32),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
  permissions: z.array(z.enum(['admin', 'member', 'viewer'])),
});

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  pools: z.array(TeamPoolSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  ownerId: z.string(),
  settings: TeamSettingsSchema,
  apiKeys: z.array(ApiKeySchema),
});

export const TeamInvitationSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
  invitedBy: z.string(),
  invitedAt: z.date(),
  expiresAt: z.date(),
  status: z.enum(['pending', 'accepted', 'expired']),
});

export const PoolUsageSnapshotSchema = z.object({
  id: z.string().uuid(),
  poolId: z.string().uuid(),
  timestamp: z.date(),
  totalUsed: z.number().min(0),
  memberBreakdown: z.array(
    z.object({
      memberId: z.string(),
      usage: z.number().min(0),
    })
  ),
  percentageUsed: z.number().min(0).max(100),
});

/**
 * Type inference from schemas
 */
export type TeamPoolInput = z.infer<typeof TeamPoolSchema>;
export type TeamInput = z.infer<typeof TeamSchema>;
export type PoolMemberInput = z.infer<typeof PoolMemberSchema>;
export type TeamSettingsInput = z.infer<typeof TeamSettingsSchema>;
export type ApiKeyInput = z.infer<typeof ApiKeySchema>;
export type TeamInvitationInput = z.infer<typeof TeamInvitationSchema>;
export type PoolUsageSnapshotInput = z.infer<typeof PoolUsageSnapshotSchema>;

/**
 * Utility functions
 */

export function generatePoolId(): string {
  return crypto.randomUUID();
}

export function generateTeamId(): string {
  return crypto.randomUUID();
}

export function generateApiKeyId(): string {
  return crypto.randomUUID();
}

export function calculatePoolUsagePercentage(pool: TeamPool): number {
  if (pool.totalQuota === 0) return 0;
  return (pool.usedQuota / pool.totalQuota) * 100;
}

export function isPoolNearExhaustion(pool: TeamPool): boolean {
  return calculatePoolUsagePercentage(pool) >= pool.alertThreshold;
}

export function isPoolOverBudget(pool: TeamPool): boolean {
  if (!pool.budgetLimit) return false;
  return pool.usedQuota >= pool.budgetLimit;
}

export function getAvailableQuota(pool: TeamPool): number {
  return Math.max(0, pool.totalQuota - pool.usedQuota);
}

export function sortMembersByUsage(members: PoolMember[]): PoolMember[] {
  return [...members].sort((a, b) => b.usage - a.usage);
}

export function filterActiveMembers(members: PoolMember[]): PoolMember[] {
  return members.filter(m => m.status === 'active');
}

export function getMemberById(members: PoolMember[], id: string): PoolMember | undefined {
  return members.find(m => m.id === id);
}

export function canManageTeam(role: TeamRole): boolean {
  return role === 'admin';
}

export function canViewTeam(role: TeamRole): boolean {
  return role === 'admin' || role === 'member' || role === 'viewer';
}

export function hasWritePermission(role: TeamRole): boolean {
  return role === 'admin' || role === 'member';
}
