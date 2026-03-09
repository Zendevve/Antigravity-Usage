import express, { Express, Request, Response, NextFunction } from 'express';
import * as vscode from 'vscode';
import { Server } from 'http';
import { QuotaState } from '../../core/types/quota';
import { ForecastResult } from '../../core/forecast/forecast-types';
import { HistoryStore } from '../../platform/storage/history-store';
import { WebhookManager } from '../../core/webhooks/webhook-manager';
import { createAPIRoutes, RESTConfig, DEFAULT_REST_CONFIG } from './routes';
import { log } from '../../util/logger';

/**
 * REST API Server for local queries
 */
export class RESTServer {
  private app: Express | null = null;
  private server: Server | null = null;
  private config: RESTConfig;
  private isRunning = false;
  private disposables: vscode.Disposable[] = [];

  // Callbacks
  private getQuotaState: () => QuotaState[];
  private getForecast: () => ForecastResult | null;
  private historyStore: HistoryStore;
  private webhookManager: WebhookManager;
  private refreshSources: () => Promise<void>;

  constructor(
    getQuotaState: () => QuotaState[],
    getForecast: () => ForecastResult | null,
    historyStore: HistoryStore,
    webhookManager: WebhookManager,
    refreshSources: () => Promise<void>,
    config: Partial<RESTConfig> = {}
  ) {
    this.getQuotaState = getQuotaState;
    this.getForecast = getForecast;
    this.historyStore = historyStore;
    this.webhookManager = webhookManager;
    this.refreshSources = refreshSources;
    this.config = { ...DEFAULT_REST_CONFIG, ...config };
  }

  /**
   * Start the REST server
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('REST server already running');
      return;
    }

    if (!this.config.enabled) {
      log.info('REST server disabled in configuration');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.app = express();

        // Middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // CORS middleware
        if (this.config.corsEnabled) {
          this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

            if (req.method === 'OPTIONS') {
              res.sendStatus(200);
              return;
            }

            next();
          });
        }

        // Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
          log.debug(`REST API: ${req.method} ${req.path}`);
          next();
        });

        // API Routes
        const apiRouter = createAPIRoutes(
          this.getQuotaState,
          this.getForecast,
          this.historyStore,
          this.webhookManager,
          this.refreshSources,
          () => this.config
        );
        this.app.use('/api', apiRouter);

        // Error handling middleware
        this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
          log.error('REST API error:', err);
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: err.message,
          });
        });

        // Start server on localhost only
        const host = '127.0.0.1';
        this.server = this.app.listen(this.config.port, host, () => {
          this.isRunning = true;
          log.info(`REST API server started on http://${host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          this.isRunning = false;
          if (error.code === 'EADDRINUSE') {
            log.error(`Port ${this.config.port} is already in use`);
            reject(new Error(`Port ${this.config.port} is already in use`));
          } else {
            log.error('REST server error:', error);
            reject(error);
          }
        });
      } catch (error) {
        log.error('Failed to start REST server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the REST server
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      log.info('REST server not running');
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        this.app = null;
        log.info('REST server stopped');
        resolve();
      });
    });
  }

  /**
   * Restart the server with new configuration
   */
  public async restart(config?: Partial<RESTConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    await this.stop();
    await this.start();
  }

  /**
   * Check if server is running
   */
  public isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  public getConfig(): RESTConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public async updateConfig(config: Partial<RESTConfig>): Promise<void> {
    const needsRestart =
      (config.port && config.port !== this.config.port) ||
      (config.enabled !== undefined && config.enabled !== this.config.enabled);

    this.config = { ...this.config, ...config };

    if (needsRestart) {
      await this.restart();
    }
  }

  /**
   * Get server URL
   */
  public getServerUrl(): string | null {
    if (!this.isRunning) {
      return null;
    }
    return `http://127.0.0.1:${this.config.port}`;
  }

  /**
   * Get API documentation URL
   */
  public getDocsUrl(): string | null {
    if (!this.isRunning) {
      return null;
    }
    return `http://127.0.0.1:${this.config.port}/api`;
  }

  /**
   * Dispose the server
   */
  public async dispose(): Promise<void> {
    await this.stop();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}

/**
 * Create REST server instance
 */
export function createRESTServer(
  getQuotaState: () => QuotaState[],
  getForecast: () => ForecastResult | null,
  historyStore: HistoryStore,
  webhookManager: WebhookManager,
  refreshSources: () => Promise<void>,
  config?: Partial<RESTConfig>
): RESTServer {
  return new RESTServer(
    getQuotaState,
    getForecast,
    historyStore,
    webhookManager,
    refreshSources,
    config
  );
}

/**
 * OpenAPI Specification (simplified)
 */
export function getOpenAPISpec(): object {
  return {
    openapi: '3.0.0',
    info: {
      title: 'K1 Antigravity Monitor API',
      version: '1.0.0',
      description: 'Local REST API for K1 Antigravity Monitor',
    },
    servers: [
      {
        url: 'http://127.0.0.1:13338',
        description: 'Local development server',
      },
    ],
    paths: {
      '/api/health': {
        get: {
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      timestamp: { type: 'string' },
                      version: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/quota': {
        get: {
          summary: 'Get current quota status',
          responses: {
            '200': {
              description: 'Current quota data',
            },
          },
        },
      },
      '/api/forecast': {
        get: {
          summary: 'Get current forecast',
          responses: {
            '200': {
              description: 'Forecast data',
            },
          },
        },
      },
      '/api/quota/history': {
        get: {
          summary: 'Get quota history',
          parameters: [
            {
              name: 'start',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'end',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Historical quota data',
            },
          },
        },
      },
    },
  };
}
