/**
 * Dashboard module exports
 * WebView-based dashboard for quota visualization
 */

// Message Protocol
export * from './message-protocol';

// Message Handler
export { DashboardMessageHandler, createDashboardMessageHandler } from './message-handler';
export type { WebviewSender } from './message-handler';

// WebView Provider
export { DashboardWebviewProvider, createDashboardWebviewProvider } from './webview-provider';

// Export Service
export { ExportService, createExportService } from './export-service';
export type { ExportOptions, ReportData } from './export-service';
