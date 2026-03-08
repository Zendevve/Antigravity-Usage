import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QuotaState } from '../../core/types/quota';
import { ForecastResult } from '../../core/forecast/forecast-types';
import { HistoryStore, QuotaSnapshot } from '../../platform/storage/history-store';
import { WebhookManager } from '../../core/webhooks/webhook-manager';
import { WebhookConfigSchema, getAvailableWebhookEvents } from '../../core/webhooks/webhook-config';
import { log } from '../../util/logger';
import { timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

// SR-010: Regularly update dependencies to patch known vulnerabilities
// Use tools like npm audit, dependabot, or similar to monitor and update dependencies
// Example: Run `npm audit` regularly and `npm update` to keep dependencies current

// SSRF protection: validate webhook URLs to prevent internal network access
const isValidWebhookUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and loopback addresses
    if (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1') {
      return false;
    }

    // Block private IP ranges (RFC 1918)
    const ipv4PrivateRegex = /^((10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3}))$/;
    if (ipv4PrivateRegex.test(hostname)) {
      return false;
    }

    // Block link-local addresses (RFC 3927)
    if (hostname.startsWith('169.254.')) {
      return false;
    }

    // Block reserved IPs (RFC 5737)
    const reservedIps = ['0.0.0.0', '192.0.2.0', '198.51.100.0', '203.0.113.0', '240.0.0.0'];
    if (reservedIps.some(ip => hostname.startsWith(ip))) {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid URL
    return false;
  }
};

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

const UpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  authEnabled: z.boolean().optional(),
  corsEnabled: z.boolean().optional(),
  apiKey: z.string().optional(),
});

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

    if (!apiKey || !config.apiKey || !timingSafeEqual(Buffer.from(apiKey), Buffer.from(config.apiKey))) {
      // Log security-relevant event: failed authentication
      log.warn('Failed authentication attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

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

  // Rate limiting to prevent abuse and brute-force attacks
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      success: false,
      error: 'Too many requests',
      message: 'Please try again later.',
    },
  });

  // Apply rate limiting to all routes
  router.use(limiter);

  // Security headers
  router.use(helmet());

  // SR-008: Implement CORS policies correctly (if corsEnabled is true, configure appropriately)
  const config = getConfig();
  if (config.corsEnabled) {
    const corsOptions = {
      origin: true, // Reflect the request origin, as per cors package default
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    };
    router.use(cors(corsOptions));
  }

  // SR-007: Use HTTPS in production (ensure the server is behind a TLS terminator)
  // To enforce HTTPS, ensure your deployment uses a TLS terminator (e.g., load balancer, reverse proxy).
  // Additionally, you can add the following middleware to redirect HTTP to HTTPS (uncomment if needed):
  //   // Enable trust proxy in your Express app (outside this file): app.enable('trust proxy');
  //   // router.use((req, res, next) => {
  //   //   if (req.headers['x-forwarded-proto'] !== 'https') {
  //   //     return res.redirect(`https://${req.headers.host}${req.url}`);
  //   //   }
  //   //   next();
  //   // });

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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
      });
    }
  });

  // GET /quota/history - Historical data
  router.get('/quota/history', async (req: Request, res: Response) => {
    try {
      const HistoryQuerySchema = z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
        model: z.string().optional(),
      });

      const validated = HistoryQuerySchema.safeParse(req.query);

      if (!validated.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validated.error.errors,
        });
        return;
      }

      const { start, end, model } = validated.data;

      const history = await historyStore.getHistory(
        new Date(start),
        new Date(end),
        model
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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

      // SSRF protection: validate webhook URL
      if (!isValidWebhookUrl(validated.data.url)) {
        // Log security-relevant event: SSRF attempt
        log.warn('SSRF attempt blocked in webhook registration', {
          url: validated.data.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          success: false,
          error: 'Invalid webhook URL',
          message: 'URL must be a valid HTTP or HTTPS URL and cannot point to internal or reserved IP addresses',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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

      // SSRF protection: validate webhook URL
      if (!isValidWebhookUrl(validated.data.url)) {
        // Log security-relevant event: SSRF attempt
        log.warn('SSRF attempt blocked in webhook test', {
          url: validated.data.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

        res.status(400).json({
          success: false,
          error: 'Invalid webhook URL',
          message: 'URL must be a valid HTTP or HTTPS URL and cannot point to internal or reserved IP addresses',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
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
        // In production, avoid exposing internal error details
        message: 'An internal error occurred',
      });
    }
  });

  return router;
}
