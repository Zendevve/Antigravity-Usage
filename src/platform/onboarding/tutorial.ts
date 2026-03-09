/**
 * Interactive Tutorial Module
 *
 * Provides step-by-step tutorials to help users learn the K1 Antigravity Monitor features.
 */

import * as vscode from 'vscode';

/**
 * Tutorial definition
 */
export interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  category: TutorialCategory;
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  highlight?: TutorialHighlight;
  interactive?: boolean;
}

export interface TutorialHighlight {
  type: 'command' | 'view' | 'setting' | 'statusbar';
  id?: string;
}

export type TutorialCategory = 'getting-started' | 'monitoring' | 'forecasting' | 'alerts' | 'export';

/**
 * Available tutorials
 */
export const tutorials: Tutorial[] = [
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    description: 'Learn the basics of K1 Antigravity Monitor in 5 minutes.',
    category: 'getting-started',
    steps: [
      {
        id: 'status-bar',
        title: 'The Status Bar',
        content: 'The K1 Antigravity Monitor displays your quota in the VS Code status bar. Look for the icon showing your remaining quota percentage.',
        highlight: { type: 'statusbar' },
      },
      {
        id: 'refresh',
        title: 'Manual Refresh',
        content: 'Press Ctrl+Shift+P and type "K1: Refresh Quota" to manually refresh your quota data at any time.',
        highlight: { type: 'command' },
        interactive: true,
      },
      {
        id: 'dashboard',
        title: 'Open Dashboard',
        content: 'Click the K1 icon in the Activity Bar to open the dashboard with detailed visualizations.',
        highlight: { type: 'view', id: 'k1-dashboard' },
        interactive: true,
      },
    ],
  },
  {
    id: 'forecasting',
    title: 'Using Forecasts',
    description: 'Learn how to use AI-powered quota forecasting.',
    category: 'forecasting',
    steps: [
      {
        id: 'forecast-intro',
        title: 'What is Forecasting?',
        content: 'The forecast engine analyzes your historical usage patterns to predict when you\'ll run out of quota. It uses EMA, pattern matching, and Monte Carlo simulations.',
      },
      {
        id: 'forecast-view',
        title: 'View Forecasts',
        content: 'Open the dashboard and navigate to the Forecasts tab to see predicted exhaustion dates and confidence levels.',
        highlight: { type: 'view' },
      },
      {
        id: 'forecast-confidence',
        title: 'Understanding Confidence',
        content: 'Confidence scores show how reliable the forecast is. Higher confidence means more historical data is available for prediction.',
      },
    ],
  },
  {
    id: 'alerts',
    title: 'Configuring Alerts',
    description: 'Set up smart alerts to never run out of quota unexpectedly.',
    category: 'alerts',
    steps: [
      {
        id: 'alert-thresholds',
        title: 'Alert Thresholds',
        content: 'Configure warning (default 20%) and critical (default 10%) thresholds. You\'ll receive notifications when your quota drops below these levels.',
      },
      {
        id: 'alert-settings',
        title: 'Open Settings',
        content: 'Go to VS Code Settings > Extensions > K1 Antigravity Monitor to configure your alert preferences.',
        highlight: { type: 'setting' },
        interactive: true,
      },
      {
        id: 'quiet-hours',
        title: 'Quiet Hours',
        content: 'Set up quiet hours to suppress alerts during specific times, like nights or weekends.',
      },
    ],
  },
  {
    id: 'export',
    title: 'Exporting Data',
    description: 'Learn how to export your quota data for reporting.',
    category: 'export',
    steps: [
      {
        id: 'export-options',
        title: 'Export Formats',
        content: 'You can export your data as CSV, JSON, or PDF. Use the commands k1.exportCSV, k1.exportJSON, or k1.exportPDF.',
        highlight: { type: 'command' },
      },
      {
        id: 'export-usage',
        title: 'When to Export',
        content: 'Export your data for billing reports, usage analysis, or to share with your team.',
      },
    ],
  },
];

/**
 * Tutorial manager
 */
export class TutorialManager {
  private context: vscode.ExtensionContext;
  private currentTutorial: Tutorial | null = null;
  private currentStepIndex: number = 0;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Start a tutorial by ID
   */
  async startTutorial(tutorialId: string): Promise<Tutorial | null> {
    const tutorial = tutorials.find(t => t.id === tutorialId);
    if (!tutorial) {
      vscode.window.showErrorMessage(`Tutorial not found: ${tutorialId}`);
      return null;
    }

    this.currentTutorial = tutorial;
    this.currentStepIndex = 0;
    await this.showTutorialPanel();
    return tutorial;
  }

  /**
   * Get all available tutorials
   */
  getTutorials(): Tutorial[] {
    return tutorials;
  }

  /**
   * Get tutorials by category
   */
  getTutorialsByCategory(category: TutorialCategory): Tutorial[] {
    return tutorials.filter(t => t.category === category);
  }

  /**
   * Get current tutorial
   */
  getCurrentTutorial(): Tutorial | null {
    return this.currentTutorial;
  }

  /**
   * Get current step
   */
  getCurrentStep(): TutorialStep | null {
    if (!this.currentTutorial) return null;
    if (this.currentStepIndex >= this.currentTutorial.steps.length) return null;
    return this.currentTutorial.steps[this.currentStepIndex];
  }

  /**
   * Move to next step
   */
  async nextStep(): Promise<TutorialStep | null> {
    if (!this.currentTutorial) return null;

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.currentTutorial.steps.length) {
      // Tutorial complete
      await this.completeTutorial();
      return null;
    }

    await this.updateTutorialPanel();
    return this.getCurrentStep();
  }

  /**
   * Move to previous step
   */
  async previousStep(): Promise<TutorialStep | null> {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      await this.updateTutorialPanel();
    }
    return this.getCurrentStep();
  }

  /**
   * Complete the current tutorial
   */
  async completeTutorial(): Promise<void> {
    if (this.currentTutorial) {
      await this.context.globalState.update(
        `tutorialCompleted.${this.currentTutorial.id}`,
        true
      );
    }
    vscode.window.showInformationMessage('Tutorial completed! 🎉');
  }

  /**
   * Check if a tutorial was completed
   */
  isTutorialCompleted(tutorialId: string): boolean {
    return this.context.globalState.get<boolean>(
      `tutorialCompleted.${tutorialId}`,
      false
    );
  }

  /**
   * Show the tutorial panel
   */
  private async showTutorialPanel(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'k1-tutorial',
      'K1 Antigravity - Tutorial',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.generateTutorialHtml();
  }

  /**
   * Update the tutorial panel
   */
  private async updateTutorialPanel(): Promise<void> {
    // This would update the existing panel if we had a reference to it
    // For simplicity, we'll regenerate the HTML
  }

  /**
   * Generate tutorial HTML
   */
  private generateTutorialHtml(): string {
    const tutorial = this.currentTutorial;
    const step = this.getCurrentStep();

    if (!tutorial || !step) {
      return '<html><body>No tutorial selected</body></html>';
    }

    const progress = Math.round(
      ((this.currentStepIndex + 1) / tutorial.steps.length) * 100
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K1 Antigravity - Tutorial</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #fff;
      min-height: 100vh;
      padding: 24px;
    }
    .header {
      margin-bottom: 24px;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
    }
    .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      margin: 16px 0;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      transition: width 0.3s ease;
      width: ${progress}%;
    }
    .progress-text {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      text-align: right;
    }
    .step {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      margin-top: 24px;
    }
    .step-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #00d4ff;
    }
    .step-content {
      font-size: 14px;
      line-height: 1.6;
      color: rgba(255,255,255,0.9);
    }
    .highlight {
      background: rgba(0,212,255,0.1);
      border: 1px solid rgba(0,212,255,0.3);
      border-radius: 8px;
      padding: 12px;
      margin: 12px 0;
    }
    .highlight-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #00d4ff;
      margin-bottom: 4px;
    }
    .buttons {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      color: #1a1a2e;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    .nav-buttons {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }
    .skip-link {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      text-decoration: underline;
      cursor: pointer;
      margin-top: 16px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${tutorial.title}</h1>
    <p class="description">${tutorial.description}</p>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
    <p class="progress-text">Step ${this.currentStepIndex + 1} of ${tutorial.steps.length}</p>
  </div>

  <div class="step">
    <h2 class="step-title">${step.title}</h2>
    <p class="step-content">${step.content}</p>

    ${step.highlight ? `
    <div class="highlight">
      <div class="highlight-label">${step.highlight.type === 'command' ? 'Command' :
          step.highlight.type === 'view' ? 'View' :
            step.highlight.type === 'setting' ? 'Setting' : 'Status Bar'}</div>
      <p>${step.interactive ? 'Click the button below to try it!' : 'Look for this in the VS Code UI.'}</p>
    </div>
    ` : ''}

    <div class="nav-buttons">
      ${this.currentStepIndex > 0 ? `
      <button class="btn btn-secondary" onclick="prev()">Previous</button>
      ` : '<div></div>'}

      <button class="btn btn-primary" onclick="next()">
        ${this.currentStepIndex >= tutorial.steps.length - 1 ? 'Finish' : 'Next'}
      </button>
    </div>

    <span class="skip-link" onclick="skip()">Skip tutorial</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function next() {
      vscode.postMessage({ command: 'next' });
    }

    function prev() {
      vscode.postMessage({ command: 'prev' });
    }

    function skip() {
      vscode.postMessage({ command: 'skip' });
    }
  </script>
</body>
</html>`;
  }
}

/**
 * Show tutorial picker
 */
export async function showTutorialPicker(
  context: vscode.ExtensionContext
): Promise<void> {
  const manager = new TutorialManager(context);

  const items = tutorials.map(t => ({
    label: t.title,
    description: t.description,
    tutorial: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a tutorial',
  });

  if (selected) {
    await manager.startTutorial(selected.tutorial.id);
  }
}
