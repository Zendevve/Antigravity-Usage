import { describe, it, expect, beforeEach } from 'vitest';
import { TeamStore, createTeamStore } from '../team-store';
import { DEFAULT_TEAM_SETTINGS } from '../team-types';
import {
  calculatePoolUsagePercentage,
  isPoolNearExhaustion,
  isPoolOverBudget,
  getAvailableQuota,
  canManageTeam,
  canViewTeam,
  hasWritePermission,
} from '../team-types';

describe('TeamStore', () => {
  let store: TeamStore;

  beforeEach(() => {
    store = createTeamStore();
  });

  describe('Team Operations', () => {
    it('should create a team', () => {
      const team = store.createTeam('Test Team', 'owner-123');

      expect(team).toBeDefined();
      expect(team.name).toBe('Test Team');
      expect(team.ownerId).toBe('owner-123');
      expect(team.pools).toHaveLength(0);
      expect(team.settings).toEqual(DEFAULT_TEAM_SETTINGS);
    });

    it('should get a team by ID', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const found = store.getTeam(team.id);

      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Team');
    });

    it('should return undefined for non-existent team', () => {
      const found = store.getTeam('non-existent-id');
      expect(found).toBeUndefined();
    });

    it('should update team', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const updated = store.updateTeam(team.id, { name: 'Updated Team' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Team');
    });

    it('should delete team', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const deleted = store.deleteTeam(team.id);

      expect(deleted).toBe(true);
      expect(store.getTeam(team.id)).toBeUndefined();
    });

    it('should get all teams', () => {
      store.createTeam('Team 1', 'owner-1');
      store.createTeam('Team 2', 'owner-2');

      const teams = store.getAllTeams();
      expect(teams).toHaveLength(2);
    });
  });

  describe('Pool Operations', () => {
    it('should create a pool', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);

      expect(pool).toBeDefined();
      expect(pool.name).toBe('Development Pool');
      expect(pool.totalQuota).toBe(10000);
      expect(pool.usedQuota).toBe(0);
      expect(pool.members).toHaveLength(0);
    });

    it('should get pool by ID', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);
      const found = store.getPool(pool.id);

      expect(found).toBeDefined();
      expect(found?.name).toBe('Development Pool');
    });

    it('should update pool', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);

      const updated = store.updatePool(pool.id, {
        name: 'Updated Pool',
        totalQuota: 20000
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Pool');
      expect(updated?.totalQuota).toBe(20000);
    });

    it('should delete pool', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);

      const deleted = store.deletePool(pool.id);

      expect(deleted).toBe(true);
      expect(store.getPool(pool.id)).toBeUndefined();
    });

    it('should get team pools', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      store.createPool(team.id, 'Pool 1', 10000);
      store.createPool(team.id, 'Pool 2', 20000);

      const pools = store.getTeamPools(team.id);
      expect(pools).toHaveLength(2);
    });
  });

  describe('Member Operations', () => {
    it('should add member to pool', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);

      const member = store.addPoolMember(pool.id, {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'member',
        status: 'active',
      });

      expect(member).toBeDefined();
      expect(member?.name).toBe('John Doe');
      expect(member?.usage).toBe(0);
    });

    it('should remove member from pool', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);
      const member = store.addPoolMember(pool.id, {
        name: 'John Doe',
        role: 'member',
        status: 'active',
      });

      const removed = store.removePoolMember(pool.id, member!.id);

      expect(removed).toBe(true);
    });

    it('should update member usage', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Development Pool', 10000);
      const member = store.addPoolMember(pool.id, {
        name: 'John Doe',
        role: 'member',
        status: 'active',
      });

      store.updateMemberUsage(pool.id, member!.id, 500);

      const updatedPool = store.getPool(pool.id);
      const updatedMember = updatedPool?.members.find(m => m.id === member!.id);

      expect(updatedMember?.usage).toBe(500);
      expect(updatedPool?.usedQuota).toBe(500);
    });
  });

  describe('Quota Transfer', () => {
    it('should transfer quota between pools', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool1 = store.createPool(team.id, 'Pool 1', 10000);
      const pool2 = store.createPool(team.id, 'Pool 2', 10000);

      const transferred = store.transferQuota(pool1.id, pool2.id, 3000);

      expect(transferred).toBe(true);

      const updatedPool1 = store.getPool(pool1.id);
      const updatedPool2 = store.getPool(pool2.id);

      expect(updatedPool1?.totalQuota).toBe(7000);
      expect(updatedPool2?.totalQuota).toBe(13000);
    });

    it('should not transfer more quota than available', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool1 = store.createPool(team.id, 'Pool 1', 10000);
      const pool2 = store.createPool(team.id, 'Pool 2', 10000);

      const transferred = store.transferQuota(pool1.id, pool2.id, 15000);

      expect(transferred).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      const team = store.createTeam('Test Team', 'owner-123');
      const pool = store.createPool(team.id, 'Pool 1', 10000);
      store.addPoolMember(pool.id, { name: 'Member 1', role: 'member', status: 'active' });
      store.addPoolMember(pool.id, { name: 'Member 2', role: 'viewer', status: 'inactive' });

      const stats = store.getStats();

      expect(stats.totalTeams).toBe(1);
      expect(stats.totalPools).toBe(1);
      expect(stats.totalMembers).toBe(2);
    });
  });
});

describe('Team Types Utilities', () => {
  const mockPool = {
    id: 'pool-1',
    name: 'Test Pool',
    totalQuota: 10000,
    usedQuota: 7500,
    members: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active' as const,
    alertThreshold: 80,
  };

  describe('calculatePoolUsagePercentage', () => {
    it('should calculate correct percentage', () => {
      const percentage = calculatePoolUsagePercentage(mockPool);
      expect(percentage).toBe(75);
    });

    it('should handle zero quota', () => {
      const pool = { ...mockPool, totalQuota: 0 };
      const percentage = calculatePoolUsagePercentage(pool);
      expect(percentage).toBe(0);
    });
  });

  describe('isPoolNearExhaustion', () => {
    it('should return true when above threshold', () => {
      const pool = { ...mockPool, usedQuota: 8500, alertThreshold: 80 };
      expect(isPoolNearExhaustion(pool)).toBe(true);
    });

    it('should return false when below threshold', () => {
      const pool = { ...mockPool, usedQuota: 5000, alertThreshold: 80 };
      expect(isPoolNearExhaustion(pool)).toBe(false);
    });
  });

  describe('isPoolOverBudget', () => {
    it('should return true when over budget', () => {
      const pool = { ...mockPool, usedQuota: 12000, budgetLimit: 10000 };
      expect(isPoolOverBudget(pool)).toBe(true);
    });

    it('should return false when under budget', () => {
      const pool = { ...mockPool, usedQuota: 8000, budgetLimit: 10000 };
      expect(isPoolOverBudget(pool)).toBe(false);
    });

    it('should return false when no budget set', () => {
      const pool = { ...mockPool, budgetLimit: undefined };
      expect(isPoolOverBudget(pool)).toBe(false);
    });
  });

  describe('getAvailableQuota', () => {
    it('should calculate available quota', () => {
      expect(getAvailableQuota(mockPool)).toBe(2500);
    });

    it('should return 0 when over quota', () => {
      const pool = { ...mockPool, usedQuota: 15000 };
      expect(getAvailableQuota(pool)).toBe(0);
    });
  });

  describe('Role Permissions', () => {
    it('should allow admin to manage', () => {
      expect(canManageTeam('admin')).toBe(true);
      expect(canManageTeam('member')).toBe(false);
      expect(canManageTeam('viewer')).toBe(false);
    });

    it('should allow all roles to view', () => {
      expect(canViewTeam('admin')).toBe(true);
      expect(canViewTeam('member')).toBe(true);
      expect(canViewTeam('viewer')).toBe(true);
    });

    it('should allow admin and member to write', () => {
      expect(hasWritePermission('admin')).toBe(true);
      expect(hasWritePermission('member')).toBe(true);
      expect(hasWritePermission('viewer')).toBe(false);
    });
  });
});
