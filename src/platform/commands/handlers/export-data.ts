import * as vscode from 'vscode';
import { log } from '../../../util/logger';
import { createQueryApi, QueryApi } from '../../storage/query-api';
import { createHistoryStore, HistoryStore } from '../../storage/history-store';
import { createForecastEngine, ForecastEngine } from '../../../core/forecast';
import { ExportService, createExportService } from '../../presentation/dashboard/export-service';

/**
 * Export data command handler
 * Handles export requests from the command palette
 */
export class ExportDataHandler {
  private historyStore: HistoryStore;
  private queryApi: QueryApi;
  private forecastEngine: ForecastEngine;
  private exportService: ExportService;

  constructor(private context: vscode.ExtensionContext) {
    // Initialize services
    this.historyStore = createHistoryStore(context.globalState);
    this.queryApi = createQueryApi(this.historyStore);
    this.forecastEngine = createForecastEngine();
    this.exportService = createExportService(this.queryApi, this.forecastEngine);
  }

  /**
   * Execute export command
   */
  async execute(format: 'csv' | 'json' | 'pdf'): Promise<void> {
    try {
      // Show date range selection
      const dateRange = await this.selectDateRange();
      if (!dateRange) {
        return; // User cancelled
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Exporting to ${format.toUpperCase()}...`,
          cancellable: false,
        },
        async () => {
          // Get history data
          const history = await this.queryApi.getHistory(dateRange.start, dateRange.end);

          if (history.length === 0) {
            vscode.window.showWarningMessage('No data available for the selected date range.');
            return;
          }

          // Generate export
          let content: string;
          let filename: string;
          const options = {
            dateRange,
            includeForecast: true,
            includeStats: true,
          };

          switch (format) {
            case 'csv':
              content = await this.exportService.exportToCSV(history, options);
              filename = `quota-export-${this.formatDate(dateRange.start)}-${this.formatDate(dateRange.end)}.csv`;
              break;
            case 'json':
              content = await this.exportService.exportToJSON(history, options);
              filename = `quota-export-${this.formatDate(dateRange.start)}-${this.formatDate(dateRange.end)}.json`;
              break;
            case 'pdf':
              content = await this.exportService.exportToPDF(history, options);
              filename = `quota-report-${this.formatDate(dateRange.start)}-${this.formatDate(dateRange.end)}.txt`;
              break;
          }

          // Save to file
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(filename),
            filters: this.getFileFilters(format),
          });

          if (uri) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.createFile(uri, { ignoreIfExists: true });
            await vscode.workspace.applyEdit(workspaceEdit);
            await vscode.workspace.openTextDocument(uri).then(doc => {
              return vscode.window.showTextDocument(doc).then(editor => {
                return editor.edit(edit => {
                  edit.insert(new vscode.Position(0, 0), content);
                });
              });
            });

            vscode.window.showInformationMessage(`Export saved to ${uri.fsPath}`);
            log.info(`Exported data to ${uri.fsPath}`);
          }
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Export failed:', error);
      vscode.window.showErrorMessage(`Export failed: ${message}`);
    }
  }

  /**
   * Select date range
   */
  private async selectDateRange(): Promise<{ start: Date; end: Date } | undefined> {
    const choices = [
      { label: 'Last 24 Hours', value: 1 },
      { label: 'Last 7 Days', value: 7 },
      { label: 'Last 30 Days', value: 30 },
      { label: 'Custom Range...', value: -1 },
    ];

    const choice = await vscode.window.showQuickPick(choices, {
      placeHolder: 'Select date range',
    });

    if (!choice) {
      return undefined;
    }

    if (choice.value === -1) {
      // Custom range - show input box
      const result = await vscode.window.showInputBox({
        prompt: 'Enter date range (days)',
        validateInput: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 365) {
            return 'Please enter a number between 1 and 365';
          }
          return null;
        },
      });

      if (!result) {
        return undefined;
      }

      const days = parseInt(result, 10);
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      return { start, end };
    }

    const days = choice.value;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  /**
   * Get file filters for save dialog
   */
  private getFileFilters(format: string): Record<string, string[]> {
    switch (format) {
      case 'csv':
        return { 'CSV Files': ['csv'], 'All Files': ['*'] };
      case 'json':
        return { 'JSON Files': ['json'], 'All Files': ['*'] };
      case 'pdf':
        return { 'Text Files': ['txt'], 'All Files': ['*'] };
      default:
        return { 'All Files': ['*'] };
    }
  }

  /**
   * Format date for filename
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Create export data handler
 */
export function createExportDataHandler(context: vscode.ExtensionContext): ExportDataHandler {
  return new ExportDataHandler(context);
}
