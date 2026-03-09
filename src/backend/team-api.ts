/**
 * Team API - Express.js route handlers
 * Provides REST API endpoints for team management
 */

import { Request, Response, Router, NextFunction } from 'express';
import {
  ReferenceBackend,
  CreateTeamRequest,
  UpdateTeamRequest,
  CreatePoolRequest,
  UpdatePoolRequest,
  AddMemberRequest,
  UpdateMemberRequest,
  CreateApiKeyRequest,
  CreateInvitationRequest,
  SyncUsageRequest,
  ApiResponse,
} from './reference-backend';
import { log } from '../util/logger';

/**
 * Create Express router with team management endpoints
 */
export function createTeamRouter(backend: ReferenceBackend): Router {
  const router = Router();

  // ==================== Team Endpoints ====================

  /**
   * POST /teams - Create a new team
   */
  router.post('/teams', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.createTeam(req.body as CreateTeamRequest);
      res.json(result);
    } catch (error) {
      log.error('Error creating team', error);
      next(error);
    }
  });

  /**
   * GET /teams - Get all teams
   */
  router.get('/teams', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getAllTeams();
      res.json(result);
    } catch (error) {
      log.error('Error getting teams', error);
      next(error);
    }
  });

  /**
   * GET /teams/:id - Get team by ID
   */
  router.get('/teams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getTeam(req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error getting team', error);
      next(error);
    }
  });

  /**
   * PUT /teams/:id - Update team
   */
  router.put('/teams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.updateTeam(req.params.id, req.body as UpdateTeamRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error updating team', error);
      next(error);
    }
  });

  /**
   * DELETE /teams/:id - Delete team
   */
  router.delete('/teams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.deleteTeam(req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error deleting team', error);
      next(error);
    }
  });

  // ==================== Pool Endpoints ====================

  /**
   * POST /teams/:teamId/pools - Create a pool
   */
  router.post('/teams/:teamId/pools', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.createPool(req.params.teamId, req.body as CreatePoolRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.status(201).json(result);
    } catch (error) {
      log.error('Error creating pool', error);
      next(error);
    }
  });

  /**
   * GET /teams/:teamId/pools - Get all pools for a team
   */
  router.get('/teams/:teamId/pools', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getTeamPools(req.params.teamId);
      res.json(result);
    } catch (error) {
      log.error('Error getting pools', error);
      next(error);
    }
  });

  /**
   * GET /teams/:teamId/pools/:poolId - Get pool by ID
   */
  router.get('/teams/:teamId/pools/:poolId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getPool(req.params.teamId, req.params.poolId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error getting pool', error);
      next(error);
    }
  });

  /**
   * PUT /teams/:teamId/pools/:poolId - Update pool
   */
  router.put('/teams/:teamId/pools/:poolId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.updatePool(req.params.teamId, req.params.poolId, req.body as UpdatePoolRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error updating pool', error);
      next(error);
    }
  });

  /**
   * DELETE /teams/:teamId/pools/:poolId - Delete pool
   */
  router.delete('/teams/:teamId/pools/:poolId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.deletePool(req.params.teamId, req.params.poolId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error deleting pool', error);
      next(error);
    }
  });

  /**
   * GET /teams/:teamId/pools/:poolId/usage - Get pool usage
   */
  router.get('/teams/:teamId/pools/:poolId/usage', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getPoolUsage(req.params.teamId, req.params.poolId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error getting pool usage', error);
      next(error);
    }
  });

  /**
   * GET /teams/:teamId/pools/:poolId/visualization - Get pool visualization
   */
  router.get('/teams/:teamId/pools/:poolId/visualization', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getPoolVisualization(req.params.teamId, req.params.poolId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error getting pool visualization', error);
      next(error);
    }
  });

  /**
   * GET /teams/:teamId/pools/:poolId/forecast - Get pool forecast
   */
  router.get('/teams/:teamId/pools/:poolId/forecast', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getPoolForecast(req.params.teamId, req.params.poolId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error getting pool forecast', error);
      next(error);
    }
  });

  // ==================== Member Endpoints ====================

  /**
   * POST /teams/:teamId/pools/:poolId/members - Add member
   */
  router.post('/teams/:teamId/pools/:poolId/members', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.addPoolMember(req.params.teamId, req.params.poolId, req.body as AddMemberRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.status(201).json(result);
    } catch (error) {
      log.error('Error adding member', error);
      next(error);
    }
  });

  /**
   * DELETE /teams/:teamId/pools/:poolId/members/:memberId - Remove member
   */
  router.delete('/teams/:teamId/pools/:poolId/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.removePoolMember(req.params.teamId, req.params.poolId, req.params.memberId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error removing member', error);
      next(error);
    }
  });

  /**
   * PUT /teams/:teamId/pools/:poolId/members/:memberId - Update member
   */
  router.put('/teams/:teamId/pools/:poolId/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.updatePoolMember(req.params.teamId, req.params.poolId, req.params.memberId, req.body as UpdateMemberRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error updating member', error);
      next(error);
    }
  });

  // ==================== Sync Endpoints ====================

  /**
   * POST /teams/:teamId/pools/:poolId/sync - Sync usage
   */
  router.post('/teams/:teamId/pools/:poolId/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.syncUsage(req.params.teamId, req.params.poolId, req.body as SyncUsageRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error syncing usage', error);
      next(error);
    }
  });

  // ==================== API Key Endpoints ====================

  /**
   * POST /teams/:id/api-keys - Create API key
   */
  router.post('/teams/:id/api-keys', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.createApiKey(req.params.id, req.body as CreateApiKeyRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.status(201).json(result);
    } catch (error) {
      log.error('Error creating API key', error);
      next(error);
    }
  });

  /**
   * DELETE /teams/:id/api-keys/:keyId - Revoke API key
   */
  router.delete('/teams/:id/api-keys/:keyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.revokeApiKey(req.params.id, req.params.keyId);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error revoking API key', error);
      next(error);
    }
  });

  // ==================== Invitation Endpoints ====================

  /**
   * POST /teams/:id/invitations - Create invitation
   */
  router.post('/teams/:id/invitations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.createInvitation(req.params.id, req.body as CreateInvitationRequest);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.status(201).json(result);
    } catch (error) {
      log.error('Error creating invitation', error);
      next(error);
    }
  });

  /**
   * POST /invitations/:id/accept - Accept invitation
   */
  router.post('/invitations/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.acceptInvitation(req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error accepting invitation', error);
      next(error);
    }
  });

  // ==================== Alert Endpoints ====================

  /**
   * GET /alerts - Get all alerts
   */
  router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getAlerts();
      res.json(result);
    } catch (error) {
      log.error('Error getting alerts', error);
      next(error);
    }
  });

  /**
   * POST /alerts/:id/acknowledge - Acknowledge alert
   */
  router.post('/alerts/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.acknowledgeAlert(req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      log.error('Error acknowledging alert', error);
      next(error);
    }
  });

  // ==================== Dashboard Endpoints ====================

  /**
   * GET /dashboard - Get dashboard data
   */
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = backend.getDashboard();
      res.json(result);
    } catch (error) {
      log.error('Error getting dashboard', error);
      next(error);
    }
  });

  return router;
}

/**
 * Create and configure the Express application
 */
export function createTeamApp(backend: ReferenceBackend): Router {
  return createTeamRouter(backend);
}
