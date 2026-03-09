import * as vscode from 'vscode';
import { log } from '../../../util/logger';
import { DashboardMessageHandler } from './message-handler';
import { getQuotaState } from '../../../core/state/quota-state';
import type { HistoryStore } from '../../storage/history-store';
import type { QueryApi } from '../../storage/query-api';
import type { ForecastEngine } from '../../../core/forecast/forecast-engine';
import type { ExportService } from './export-service';

/**
 * WebView provider for the quota dashboard
 * Implements the VSCode WebviewViewProvider interface
 */
export class DashboardWebviewProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;
  private messageHandler: DashboardMessageHandler | undefined;
  private disposables: vscode.Disposable[] = [];
  private refreshInterval: NodeJS.Timeout | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private historyStore: HistoryStore,
    private queryApi: QueryApi,
    private forecastEngine: ForecastEngine,
    private exportService: ExportService
  ) { }

  /**
   * Resolve the webview view
   */
  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void {
    this.webviewView = webviewView;

    // Configure the webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Create message handler
    this.messageHandler = new DashboardMessageHandler(
      this.historyStore,
      this.queryApi,
      this.exportService,
      this.forecastEngine
    );

    // Set up the message sender
    this.messageHandler.setSender((message) => {
      if (this.webviewView) {
        this.webviewView.webview.postMessage(message);
      }
    });

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      await this.messageHandler?.handleMessage(message);
    });

    // Set up visibility change handler
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.onViewVisible();
      } else {
        this.onViewHidden();
      }
    });

    // Initial HTML content
    this.updateWebviewContent();

    // Send ready message
    this.messageHandler.sendReady();

    // Subscribe to quota state changes
    this.subscribeToQuotaState();

    // Get current theme
    const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
    this.messageHandler.notifyThemeChange(theme);

    log.info('Dashboard WebView resolved');
  }

  /**
   * Handle view visibility changes
   */
  private onViewVisible(): void {
    // Request initial data
    this.messageHandler?.handleMessage({ type: 'request-quota' });
    this.messageHandler?.handleMessage({ type: 'request-trends', windowHours: 24 });
    this.messageHandler?.handleMessage({ type: 'request-model-stats', days: 7 });

    // Start auto-refresh
    this.startAutoRefresh();
  }

  /**
   * Handle view becoming hidden
   */
  private onViewHidden(): void {
    this.stopAutoRefresh();
  }

  /**
   * Start auto-refresh interval
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => {
      this.messageHandler?.handleMessage({ type: 'request-quota' });
    }, 30000); // Refresh every 30 seconds
  }

  /**
   * Stop auto-refresh interval
   */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  /**
   * Subscribe to quota state changes
   */
  private subscribeToQuotaState(): void {
    // Import the quota state observable
    import('../../../core/state/quota-state').then(({ quotaState$ }) => {
      const sub = quotaState$.subscribe((_state: unknown) => {
        if (this.webviewView?.visible) {
          this.messageHandler?.handleMessage({ type: 'request-quota' });
        }
      });
      this.disposables.push({ dispose: () => sub.unsubscribe() });
    });
  }

  /**
   * Update the webview HTML content
   */
  private updateWebviewContent(): void {
    if (!this.webviewView) return;

    // Get the HTML from a bundled file or generate inline
    const html = this.getDashboardHtml();
    this.webviewView.webview.html = html;
  }

  /**
   * Generate the dashboard HTML
   */
  private getDashboardHtml(): string {
    const nonce = this.getNonce();
    const csp = this.getContentSecurityPolicy();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="${csp}" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K1 Antigravity Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      padding: 16px;
      min-height: 100vh;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-tertiary: #2d2d2d;
      --text-primary: #cccccc;
      --text-secondary: #858585;
      --accent-blue: #0078d4;
      --accent-green: #4ec9b0;
      --accent-yellow: #dcdcaa;
      --accent-red: #f14c4c;
      --accent-orange: #ce9178;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-editorIndentGuide-background);
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-green);
    }
    .status-dot.warning {
      background: var(--accent-yellow);
    }
    .status-dot.critical {
      background: var(--accent-red);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }
    .card {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid var(--vscode-editorIndentGuide-background);
    }
    .card h3 {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      color: var(--text-secondary);
    }
    .card .value {
      font-size: 28px;
      font-weight: 600;
    }
    .card .value.good {
      color: var(--accent-green);
    }
    .card .value.warning {
      color: var(--accent-yellow);
    }
    .card .value.critical {
      color: var(--accent-red);
    }
    .card .subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .chart-container {
      height: 200px;
      width: 100%;
    }
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .tab {
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      background: var(--bg-tertiary);
      border: none;
      color: var(--text-primary);
      transition: background 0.2s;
    }
    .tab:hover {
      background: var(--bg-primary);
    }
    .tab.active {
      background: var(--accent-blue);
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      border: 1px solid var(--vscode-editorIndentGuide-background);
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .btn:hover {
      background: var(--bg-primary);
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
      color: var(--text-secondary);
    }
    .error-message {
      padding: 16px;
      background: rgba(241, 76, 76, 0.1);
      border: 1px solid var(--accent-red);
      border-radius: 4px;
      color: var(--accent-red);
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>K1 Antigravity Monitor</h1>
    <div class="status-indicator">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">Connected</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Current Quota</h3>
      <div class="value" id="quotaValue">--</div>
      <div class="subtitle" id="quotaModel">Loading...</div>
    </div>
    <div class="card">
      <h3>Forecast</h3>
      <div class="value" id="forecastValue">--</div>
      <div class="subtitle" id="forecastConfidence">Confidence: --</div>
    </div>
  </div>

  <div class="card" style="margin-bottom: 16px;">
    <h3>Usage Trend (24h)</h3>
    <div id="trendChart" class="chart-container"></div>
  </div>

  <div class="tabs">
    <button class="tab active" data-range="24h">24 Hours</button>
    <button class="tab" data-range="7d">7 Days</button>
    <button class="tab" data-range="30d">30 Days</button>
  </div>

  <div class="actions">
    <button class="btn" id="exportCSV">Export CSV</button>
    <button class="btn" id="exportJSON">Export JSON</button>
    <button class="btn" id="exportPDF">Export PDF</button>
    <button class="btn" id="refreshBtn">Refresh</button>
  </div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      let trendChart = null;
      let currentRange = '24h';

      // Initialize charts
      function initCharts() {
        const chartDom = document.getElementById('trendChart');
        if (chartDom) {
          trendChart = echarts.init(chartDom);
        }
      }

      // Handle messages from extension
      window.addEventListener('message', function(event) {
        const message = event.data;
        console.log('Received message:', message.type);

        switch (message.type) {
          case 'ready':
            requestData();
            break;
          case 'quota-update':
            updateQuotaDisplay(message.data);
            break;
          case 'trend-update':
            updateTrendChart(message.data);
            break;
          case 'forecast-update':
            updateForecastDisplay(message.data);
            break;
          case 'error':
            showError(message.message);
            break;
          case 'export-response':
            handleExportResponse(message.data);
            break;
        }
      });

      // Request data from extension
      function requestData() {
        vscode.postMessage({ type: 'request-quota' });
        vscode.postMessage({ type: 'request-trends', windowHours: getHoursForRange(currentRange) });
        vscode.postMessage({ type: 'request-forecast' });
      }

      // Get hours for range
      function getHoursForRange(range) {
        switch (range) {
          case '24h': return 24;
          case '7d': return 168;
          case '30d': return 720;
          default: return 24;
        }
      }

      // Update quota display
      function updateQuotaDisplay(data) {
        if (!data || data.length === 0) {
          document.getElementById('quotaValue').textContent = '--';
          return;
        }

        const quota = data[0];
        const percent = quota.remainingPercent.toFixed(1);
        const valueEl = document.getElementById('quotaValue');

        valueEl.textContent = percent + '%';
        valueEl.className = 'value';

        if (percent < 10) {
          valueEl.classList.add('critical');
        } else if (percent < 20) {
          valueEl.classList.add('warning');
        } else {
          valueEl.classList.add('good');
        }

        document.getElementById('quotaModel').textContent = quota.model || 'Unknown Model';

        // Update status
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (percent < 10) {
          statusDot.className = 'status-dot critical';
          statusText.textContent = 'Critical';
        } else if (percent < 20) {
          statusDot.className = 'status-dot warning';
          statusText.textContent = 'Warning';
        } else {
          statusDot.className = 'status-dot';
          statusText.textContent = 'Normal';
        }
      }

      // Update forecast display
      function updateForecastDisplay(data) {
        if (!data) return;

        const hours = data.estimatedHoursRemaining?.toFixed(1) || '--';
        const confidence = (data.confidence * 100).toFixed(0) || '--';

        document.getElementById('forecastValue').textContent = hours + 'h';
        document.getElementById('forecastConfidence').textContent = 'Confidence: ' + confidence + '%';
      }

      // Update trend chart
      function updateTrendChart(data) {
        if (!trendChart || !data) return;

        const times = data.map(d => new Date(d.timestamp).toLocaleTimeString());
        const values = data.map(d => d.value);

        const option = {
          tooltip: {
            trigger: 'axis'
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: times,
            axisLabel: {
              color: '#858585',
              fontSize: 10
            }
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: {
              color: '#858585',
              formatter: '{value}%'
            }
          },
          series: [{
            name: 'Quota',
            type: 'line',
            smooth: true,
            data: values,
            areaStyle: {
              color: 'rgba(0, 120, 212, 0.2)'
            },
            lineStyle: {
              color: '#0078d4'
            },
            itemStyle: {
              color: '#0078d4'
            }
          }]
        };

        trendChart.setOption(option);
      }

      // Handle export response
      function handleExportResponse(data) {
        // Create a download link
        const blob = new Blob([data.content], { type: data.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Show error
      function showError(message) {
        console.error('Error:', message);
      }

      // Tab click handlers
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          currentRange = this.dataset.range;
          vscode.postMessage({ type: 'request-trends', windowHours: getHoursForRange(currentRange) });
        });
      });

      // Export button handlers
      document.getElementById('exportCSV')?.addEventListener('click', function() {
        const end = new Date();
        const start = new Date(end.getTime() - getHoursForRange(currentRange) * 60 * 60 * 1000);
        vscode.postMessage({
          type: 'export-data',
          format: 'csv',
          options: {
            dateRange: { start, end },
            includeForecast: true,
            includeStats: true
          }
        });
      });

      document.getElementById('exportJSON')?.addEventListener('click', function() {
        const end = new Date();
        const start = new Date(end.getTime() - getHoursForRange(currentRange) * 60 * 60 * 1000);
        vscode.postMessage({
          type: 'export-data',
          format: 'json',
          options: {
            dateRange: { start, end },
            includeForecast: true,
            includeStats: true
          }
        });
      });

      document.getElementById('exportPDF')?.addEventListener('click', function() {
        const end = new Date();
        const start = new Date(end.getTime() - getHoursForRange(currentRange) * 60 * 60 * 1000);
        vscode.postMessage({
          type: 'export-data',
          format: 'pdf',
          options: {
            dateRange: { start, end },
            includeForecast: true,
            includeStats: true
          }
        });
      });

      document.getElementById('refreshBtn')?.addEventListener('click', requestData);

      // Initialize
      initCharts();

      // Handle resize
      window.addEventListener('resize', function() {
        if (trendChart) {
          trendChart.resize();
        }
      });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Get a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Get Content Security Policy
   */
  private getContentSecurityPolicy(): string {
    return 'Content-Security-Policy';
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopAutoRefresh();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Create the dashboard webview provider
 */
export function createDashboardWebviewProvider(
  extensionUri: vscode.Uri,
  historyStore: HistoryStore,
  queryApi: QueryApi,
  forecastEngine: ForecastEngine,
  exportService: ExportService
): DashboardWebviewProvider {
  return new DashboardWebviewProvider(
    extensionUri,
    historyStore,
    queryApi,
    forecastEngine,
    exportService
  );
}
