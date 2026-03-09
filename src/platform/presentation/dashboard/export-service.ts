import { QuotaSnapshot } from '../../storage/history-store';
import { QueryApi } from '../../storage/query-api';
import { ForecastEngine } from '../../../core/forecast';
import { log } from '../../../util/logger';

/**
 * Export options interface
 */
export interface ExportOptions {
  dateRange: { start: Date; end: Date };
  models?: string[];
  includeCharts?: boolean;
  includeForecast?: boolean;
  includeStats?: boolean;
  filename?: string;
}

/**
 * Report data for PDF generation
 */
export interface ReportData {
  title: string;
  dateRange: { start: Date; end: Date };
  summary: {
    totalRecords: number;
    models: string[];
    averageQuota: number;
    minQuota: number;
    maxQuota: number;
  };
  history: QuotaSnapshot[];
  forecast?: {
    estimatedHoursRemaining: number;
    confidence: number;
    riskLevel: string;
  };
  stats?: {
    model: string;
    averageQuota: number;
    trend: string;
  }[];
}

/**
 * Export Service for quota data
 * Provides CSV, JSON, and PDF export functionality
 */
export class ExportService {
  constructor(
    private queryApi: QueryApi,
    private forecastEngine: ForecastEngine
  ) { }

  /**
   * Export data to CSV format
   */
  async exportToCSV(data: QuotaSnapshot[], options: ExportOptions): Promise<string> {
    log.info('Exporting to CSV', { recordCount: data.length, options });

    // Build CSV header
    const headers = ['Timestamp', 'Model', 'Quota (%)', 'Used (tokens)', 'Limit (tokens)', 'Source'];
    const rows: string[][] = [headers];

    // Sort by timestamp
    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Add data rows
    for (const snapshot of sorted) {
      rows.push([
        snapshot.timestamp.toISOString(),
        snapshot.model,
        snapshot.quota.toFixed(2),
        snapshot.used.toString(),
        snapshot.limit.toString(),
        snapshot.source,
      ]);
    }

    // Convert to CSV string
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    return csv;
  }

  /**
   * Export data to JSON format
   */
  async exportToJSON(data: QuotaSnapshot[], options: ExportOptions): Promise<string> {
    log.info('Exporting to JSON', { recordCount: data.length, options });

    const exportData: Record<string, unknown> = {
      metadata: {
        exportDate: new Date().toISOString(),
        dateRange: {
          start: options.dateRange.start.toISOString(),
          end: options.dateRange.end.toISOString(),
        },
        models: options.models || [],
        recordCount: data.length,
      },
      data: data.map(s => ({
        timestamp: s.timestamp.toISOString(),
        model: s.model,
        quota: s.quota,
        used: s.used,
        limit: s.limit,
        source: s.source,
      })),
    };

    // Include forecast if requested
    if (options.includeForecast) {
      try {
        // Get current quota from latest data point
        const sortedData = [...data].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const currentQuota = sortedData.length > 0 ? sortedData[0].quota : 0;

        // Convert to TimeSeriesData format
        const history: { timestamp: Date; value: number }[] = sortedData.map(s => ({
          timestamp: s.timestamp,
          value: s.quota,
        }));

        const forecast = this.forecastEngine.generateForecast(currentQuota, history);
        if (forecast) {
          exportData.forecast = {
            estimatedHoursRemaining: forecast.estimatedHoursRemaining,
            confidence: forecast.confidence,
            riskLevel: forecast.riskLevel,
            generatedAt: forecast.timestamp.toISOString(),
          };
        }
      } catch (error) {
        log.warn('Failed to include forecast in export', error);
      }
    }

    // Include stats if requested
    if (options.includeStats) {
      try {
        const days = Math.ceil(
          (options.dateRange.end.getTime() - options.dateRange.start.getTime()) /
          (1000 * 60 * 60 * 24)
        );
        const stats = await this.queryApi.getModelStats(days);
        exportData.stats = stats.map(s => ({
          model: s.model,
          averageQuota: s.averageQuota,
          trend: s.trend,
          depletionRate: s.depletionRate,
        }));
      } catch (error) {
        log.warn('Failed to include stats in export', error);
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export data to PDF format
   * Note: This generates a simple text-based PDF representation
   * For complex PDF generation, consider using a library like pdfmake
   */
  async exportToPDF(data: QuotaSnapshot[], options: ExportOptions): Promise<string> {
    log.info('Exporting to PDF', { recordCount: data.length, options });

    // Generate report data
    const report = await this.generateReportData(data, options);

    // Build simple PDF-like text content
    const lines: string[] = [];

    // Title
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`                    ${report.title.toUpperCase()}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    // Date range
    lines.push(`Report Period: ${report.dateRange.start.toLocaleDateString()} - ${report.dateRange.end.toLocaleDateString()}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    // Summary section
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                         SUMMARY');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`Total Records: ${report.summary.totalRecords}`);
    lines.push(`Models: ${report.summary.models.join(', ')}`);
    lines.push(`Average Quota: ${report.summary.averageQuota.toFixed(2)}%`);
    lines.push(`Min Quota: ${report.summary.minQuota.toFixed(2)}%`);
    lines.push(`Max Quota: ${report.summary.maxQuota.toFixed(2)}%`);
    lines.push('');

    // Forecast section
    if (report.forecast) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('                       FORECAST');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push(`Estimated Hours Remaining: ${report.forecast.estimatedHoursRemaining.toFixed(1)} hours`);
      lines.push(`Confidence: ${(report.forecast.confidence * 100).toFixed(1)}%`);
      lines.push(`Risk Level: ${report.forecast.riskLevel.toUpperCase()}`);
      lines.push('');
    }

    // Stats section
    if (report.stats && report.stats.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('                     MODEL STATISTICS');
      lines.push('───────────────────────────────────────────────────────────────');
      for (const stat of report.stats) {
        lines.push(`${stat.model}:`);
        lines.push(`  Average: ${stat.averageQuota.toFixed(2)}%`);
        lines.push(`  Trend: ${stat.trend}`);
      }
      lines.push('');
    }

    // Recent data (last 20 records)
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                    RECENT DATA (Last 20)');
    lines.push('───────────────────────────────────────────────────────────────');
    const recent = report.history.slice(-20);
    for (const snapshot of recent) {
      const bar = '█'.repeat(Math.round(snapshot.quota / 5));
      lines.push(`${snapshot.timestamp.toLocaleString()} | ${bar.padEnd(20)} | ${snapshot.quota.toFixed(1)}% | ${snapshot.model}`);
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('              Generated by K1 Antigravity Monitor');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Generate report data for PDF
   */
  private async generateReportData(data: QuotaSnapshot[], options: ExportOptions): Promise<ReportData> {
    const models = [...new Set(data.map(d => d.model))];
    const quotas = data.map(d => d.quota);
    const sum = quotas.reduce((a, b) => a + b, 0);
    const avg = quotas.length > 0 ? sum / quotas.length : 0;

    const report: ReportData = {
      title: 'Quota Usage Report',
      dateRange: options.dateRange,
      summary: {
        totalRecords: data.length,
        models,
        averageQuota: avg,
        minQuota: Math.min(...quotas, 0),
        maxQuota: Math.max(...quotas, 100),
      },
      history: data,
    };

    // Include forecast if requested
    if (options.includeForecast) {
      try {
        // Get current quota from latest data point
        const sortedData = [...data].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const currentQuota = sortedData.length > 0 ? sortedData[0].quota : 0;

        // Convert to TimeSeriesData format
        const history: { timestamp: Date; value: number }[] = sortedData.map(s => ({
          timestamp: s.timestamp,
          value: s.quota,
        }));

        const forecast = this.forecastEngine.generateForecast(currentQuota, history);
        if (forecast) {
          report.forecast = {
            estimatedHoursRemaining: forecast.estimatedHoursRemaining,
            confidence: forecast.confidence,
            riskLevel: forecast.riskLevel,
          };
        }
      } catch (error) {
        log.warn('Failed to generate forecast for report', error);
      }
    }

    // Include stats if requested
    if (options.includeStats) {
      try {
        const days = Math.ceil(
          (options.dateRange.end.getTime() - options.dateRange.start.getTime()) /
          (1000 * 60 * 60 * 24)
        );
        const stats = await this.queryApi.getModelStats(days);
        report.stats = stats.map(s => ({
          model: s.model,
          averageQuota: s.averageQuota,
          trend: s.trend,
        }));
      } catch (error) {
        log.warn('Failed to generate stats for report', error);
      }
    }

    return report;
  }
}

/**
 * Create export service instance
 */
export function createExportService(
  queryApi: QueryApi,
  forecastEngine: ForecastEngine
): ExportService {
  return new ExportService(queryApi, forecastEngine);
}
