import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QuotaState } from '../../core/types/quota';
import { ForecastResult } from '../../core/forecast/forecast-types';
import { HistoryStore, QuotaSnapshot } from '../../platform/storage/history-store';
import { WebhookManager } from '../../core/webhooks/webhook-manager';
import { WebhookConfigSchema, getAvailableWebhookEvents } from '../../core/webhooks/webhook-config';
import { log } from '../../util/logger';

/**
 * REST API Configuration
 */
export interface RESTConfig {
  enabled: boolean;
  port: number;
  authEnabled: boolean;
  corsEnabled: boolean;
  apiKey?: string;
}

export const DEFAULT_REST_CONFIG: RESTConfig = {
  enabled: false,
  port: 13338,
  authEnabled: true,
  corsEnabled: false,
};

/**
 * Request validation schemas
 */
const DateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const WebhookConfigInputSchema = WebhookConfigSchema.extend({
  enabled: z.boolean().optional(),
});

const UpdateConfigSchema = z.record(z.union([z.string(), z.number(), z.boolean()]));

/**
 * API Routes factory
 */
export function createAPIRoutes(
  getQuotaState: () => QuotaState[],
  getForecast: () => ForecastResult | null,
  historyStore: HistoryStore,
  webhookManager: WebhookManager,
  refreshSources: () => Promise<void>,
  getConfig: () => RESTConfig
): Router {
  const router = Router();

  // Authentication middleware
  const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const config = getConfig();

    if (!config.authEnabled) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey || apiKey !== config.apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
      });
      return;
    }

    next();
  };

  // Apply authentication to all routes
  router.use(authMiddleware);

  // Health check endpoint (no auth required for testing)
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // GET /quota - Current quota status
  router.get('/quota', async (req: Request, res: Response) => {
    try {
      const quotas = getQuotaState();
      res.json({
        success: true,
        data: quotas,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error fetching quota:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch quota',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /quota/history - Historical data
  router.get('/quota/history', async (req: Request, res: Response) => {
    try {
      const { start, end, model } = req.query;

      if (!start || !end) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: start, end',
        });
        return;
      }

      const validated = DateRangeSchema.safeParse({
        start,
        end,
      });

      if (!validated.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format',
          details: validated.error.errors,
        });
        return;
      }

      const history = await historyStore.getHistory(
        new Date(validated.data.start),
        new Date(validated.data.end),
        model as string | undefined
      );

      res.json({
        success: true,
        data: history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error fetching history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch history',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /forecast - Current forecast
  router.get('/forecast', async (req: Request, res: Response) => {
    try {
      const forecast = getForecast();

      if (!forecast) {
        res.status(404).json({
          success: false,
          error: 'No forecast available',
          message: 'Insufficient data to generate forecast',
        });
        return;
      }

      res.json({
        success: true,
        data: forecast,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error fetching forecast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch forecast',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /quota/refresh - Refresh quota data
  router.post('/quota/refresh', async (req: Request, res: Response) => {
    try {
      await refreshSources();
      res.json({
        success: true,
        message: 'Quota data refreshed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error refreshing quota:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh quota',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /webhooks - List webhooks
  router.get('/webhooks', (req: Request, res: Response) => {
    try {
      const webhooks = webhookManager.getWebhooks();
      res.json({
        success: true,
        data: webhooks,
        count: webhooks.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error listing webhooks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list webhooks',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /webhooks - Register webhook
  router.post('/webhooks', async (req: Request, res: Response) => {
    try {
      const validated = WebhookConfigInputSchema.safeParse(req.body);

      if (!validated.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook configuration',
          details: validated.error.errors,
        });
        return;
      }

      if (!validated.data.url) {
        res.status(400).json({
          success: false,
          error: 'URL is required',
        });
        return;
      }

      await webhookManager.addWebhook({
        ...validated.data,
        url: validated.data.url,
        method: validated.data.method || 'POST',
        events: validated.data.events || [],
        enabled: validated.data.enabled ?? false,
        retryEnabled: validated.data.retryEnabled ?? true,
        retryMaxAttempts: validated.data.retryMaxAttempts ?? 3,
        retryDelayMs: validated.data.retryDelayMs ?? 1000,
        timeoutMs: validated.data.timeoutMs ?? 5000,
      });

      res.status(201).json({
        success: true,
        message: 'Webhook registered successfully',
        data: validated.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error registering webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register webhook',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // DELETE /webhooks/:url - Remove webhook
  router.delete('/webhooks/:url', async (req: Request, res: Response) => {
    try {
      const url = decodeURIComponent(req.params.url);
      const deleted = await webhookManager.removeWebhook(url);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Webhook removed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error removing webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove webhook',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /webhooks/test - Test webhook
  router.post('/webhooks/test', async (req: Request, res: Response) => {
    try {
      const validated = WebhookConfigInputSchema.safeParse(req.body);

      if (!validated.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook configuration',
          details: validated.error.errors,
        });
        return;
      }

      if (!validated.data.url) {
        res.status(400).json({
          success: false,
          error: 'URL is required for testing',
        });
        return;
      }

      const result = await webhookManager.testWebhook({
        ...validated.data,
        url: validated.data.url,
        method: validated.data.method || 'POST',
        events: validated.data.events || [],
        enabled: true,
        retryEnabled: validated.data.retryEnabled ?? true,
        retryMaxAttempts: validated.data.retryMaxAttempts ?? 3,
        retryDelayMs: validated.data.retryDelayMs ?? 1000,
        timeoutMs: validated.data.timeoutMs ?? 5000,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error testing webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test webhook',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /webhooks/events - Available webhook events
  router.get('/webhooks/events', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: getAvailableWebhookEvents(),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /config - Get configuration
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = getConfig();
      // Don't expose API key
      const safeConfig = { ...config, apiKey: config.apiKey ? '***' : undefined };
      res.json({
        success: true,
        data: safeConfig,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error fetching config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // PUT /config - Update configuration
  router.put('/config', async (req: Request, res: Response) => {
    try {
      // Note: Configuration updates would need to be handled by the extension
      // This is a placeholder for the API
      res.json({
        success: true,
        message: 'Configuration update requested',
        note: 'Use VSCode settings to update configuration',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error updating config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /history/metadata - Get history metadata
  router.get('/history/metadata', (req: Request, res: Response) => {
    try {
      const metadata = historyStore.getMetadata();
      res.json({
        success: true,
        data: metadata,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Error fetching metadata:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metadata',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
