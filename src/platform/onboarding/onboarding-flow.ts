/**
 * Onboarding Flow Module
 *
 * First-run wizard for new users to configure the K1 Antigravity Monitor.
 */

import * as vscode from 'vscode';

/**
 * Onboarding step definition
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: OnboardingComponent;
  validation?: () => Promise<boolean>;
  skippable?: boolean;
}

/**
 * Onboarding UI component types
 */
export type OnboardingComponent =
  | 'welcome'
  | 'connect'
  | 'configure'
  | 'alerts'
  | 'complete';

/**
 * Onboarding configuration data
 */
export interface OnboardingConfig {
  port: number;
  warningThreshold: number;
  criticalThreshold: number;
  enableAlerts: boolean;
  enableTelemetry: boolean;
  language: string;
}

/**
 * Default onboarding configuration
 */
export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfig = {
  port: 13337,
  warningThreshold: 20,
  criticalThreshold: 10,
  enableAlerts: true,
  enableTelemetry: false,
  language: 'auto',
};

/**
 * Onboarding steps in order
 */
export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to K1 Antigravity Monitor',
    description: 'Monitor your Antigravity quota in real-time with predictive alerts.',
    component: 'welcome',
    skippable: false,
  },
  {
    id: 'connect',
    title: 'Connect to Antigravity',
    description: 'Enter the port where your Antigravity instance is running.',
    component: 'connect',
    validation: async () => {
      const config = vscode.workspace.getConfiguration('k1-antigravity');
      const port = config.get<number>('antigravityPort', 13337);
      return port > 0 && port < 65536;
    },
    skippable: false,
  },
  {
    id: 'configure',
    title: 'Configure Monitoring',
    description: 'Set your preferred monitoring options.',
    component: 'configure',
    skippable: true,
  },
  {
    id: 'alerts',
    title: 'Set Alert Thresholds',
    description: 'Configure when you want to be notified about quota usage.',
    component: 'alerts',
    skippable: true,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start monitoring your Antigravity quota.',
    component: 'complete',
    skippable: false,
  },
];

/**
 * Onboarding flow manager
 */
export class OnboardingFlow {
  private globalState: vscode.Memento;
  private currentStepIndex: number = 0;

  constructor(globalState: vscode.Memento) {
    this.globalState = globalState;
  }

  /**
   * Check if onboarding has been completed
   */
  isCompleted(): boolean {
    return this.globalState.get<boolean>('onboardingCompleted', false);
  }

  /**
   * Mark onboarding as completed
   */
  async complete(): Promise<void> {
    await this.globalState.update('onboardingCompleted', true);
    await this.globalState.update('onboardingVersion', '1.1.0');
  }

  /**
   * Reset onboarding to start fresh
   */
  async reset(): Promise<void> {
    await this.globalState.update('onboardingCompleted', false);
    this.currentStepIndex = 0;
  }

  /**
   * Get current step
   */
  getCurrentStep(): OnboardingStep | null {
    if (this.currentStepIndex >= onboardingSteps.length) {
      return null;
    }
    return onboardingSteps[this.currentStepIndex];
  }

  /**
   * Get next step
   */
  getNextStep(): OnboardingStep | null {
    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex >= onboardingSteps.length) {
      return null;
    }
    return onboardingSteps[nextIndex];
  }

  /**
   * Move to next step
   */
  async nextStep(): Promise<OnboardingStep | null> {
    const currentStep = this.getCurrentStep();

    // Validate current step if it has validation
    if (currentStep?.validation) {
      const isValid = await currentStep.validation();
      if (!isValid) {
        vscode.window.showErrorMessage('Please complete the current step before proceeding.');
        return currentStep;
      }
    }

    // Move to next step
    this.currentStepIndex++;

    // Check if we've completed onboarding
    if (this.currentStepIndex >= onboardingSteps.length) {
      await this.complete();
      return null;
    }

    return this.getCurrentStep();
  }

  /**
   * Move to previous step
   */
  previousStep(): OnboardingStep | null {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    }
    return this.getCurrentStep();
  }

  /**
   * Skip current step (if allowed)
   */
  skipStep(): OnboardingStep | null {
    const currentStep = this.getCurrentStep();
    if (currentStep?.skippable) {
      this.currentStepIndex++;
      return this.getCurrentStep();
    }
    return currentStep;
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    return Math.round((this.currentStepIndex / onboardingSteps.length) * 100);
  }

  /**
   * Show the onboarding webview
   */
  async showOnboardingPanel(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'k1-onboarding',
      'K1 Antigravity Monitor - Setup',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.generateOnboardingHtml();
  }

  /**
   * Generate onboarding HTML
   */
  private generateOnboardingHtml(): string {
    const step = this.getCurrentStep();
    const progress = this.getProgress();

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K1 Antigravity Monitor - Setup</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    .container {
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      margin-bottom: 40px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      transition: width 0.3s ease;
      width: ${progress}%;
    }
    .step-title {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 16px;
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .step-description {
      font-size: 16px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    .feature {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      text-align: left;
    }
    .feature-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .feature-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
    }
    .form-group {
      margin-bottom: 20px;
      text-align: left;
    }
    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: rgba(255,255,255,0.9);
    }
    .form-input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      border-color: #00d4ff;
    }
    .form-input::placeholder {
      color: rgba(255,255,255,0.4);
    }
    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 32px;
    }
    .btn {
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
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
      box-shadow: 0 4px 20px rgba(0,212,255,0.3);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .btn-secondary:hover {
      background: rgba(255,255,255,0.2);
    }
    .success-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>

    ${step?.component === 'welcome' ? `
    <h1 class="step-title">${step.title}</h1>
    <p class="step-description">${step.description}</p>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">📊</div>
        <div class="feature-title">Real-Time Monitoring</div>
        <div class="feature-desc">Track your quota usage in the status bar</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🔮</div>
        <div class="feature-title">AI Forecasting</div>
        <div class="feature-desc">Predict when you'll run out of quota</div>
      </div>
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <div class="feature-title">Smart Alerts</div>
        <div class="feature-desc">Get notified before you run out</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🌍</div>
        <div class="feature-title">Multi-Language</div>
        <div class="feature-desc">Available in 16+ languages</div>
      </div>
    </div>
    ` : ''}

    ${step?.component === 'connect' ? `
    <h1 class="step-title">${step.title}</h1>
    <p class="step-description">${step.description}</p>

    <div class="form-group">
      <label class="form-label">Antigravity Port</label>
      <input type="number" class="form-input" id="port" value="13337" placeholder="Enter port number">
    </div>
    ` : ''}

    ${step?.component === 'configure' ? `
    <h1 class="step-title">${step.title}</h1>
    <p class="step-description">${step.description}</p>

    <div class="form-group">
      <label class="form-label">Model Display</label>
      <select class="form-input" id="modelDisplay">
        <option value="autoLowest">Auto (Show Lowest)</option>
        <option value="pinned">Pinned Model</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" id="sparkline" checked> Show sparkline trend
      </label>
    </div>
    ` : ''}

    ${step?.component === 'alerts' ? `
    <h1 class="step-title">${step.title}</h1>
    <p class="step-description">${step.description}</p>

    <div class="form-group">
      <label class="form-label">Warning Threshold (%)</label>
      <input type="number" class="form-input" id="warningThreshold" value="20" min="1" max="50">
    </div>

    <div class="form-group">
      <label class="form-label">Critical Threshold (%)</label>
      <input type="number" class="form-input" id="criticalThreshold" value="10" min="1" max="50">
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" id="enableAlerts" checked> Enable alerts
      </label>
    </div>
    ` : ''}

    ${step?.component === 'complete' ? `
    <div class="success-icon">🎉</div>
    <h1 class="step-title">${step.title}</h1>
    <p class="step-description">${step.description}</p>

    <p style="color: rgba(255,255,255,0.7); margin-top: 20px;">
      You can always change these settings in VS Code preferences.
    </p>
    ` : ''}

    <div class="buttons">
      ${step?.component !== 'complete' ? `
      <button class="btn btn-secondary" onclick="skip()">Skip</button>
      <button class="btn btn-primary" onclick="next()">Next</button>
      ` : `
      <button class="btn btn-primary" onclick="finish()">Get Started</button>
      `}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function next() {
      vscode.postMessage({ command: 'next' });
    }

    function skip() {
      vscode.postMessage({ command: 'skip' });
    }

    function finish() {
      vscode.postMessage({ command: 'finish' });
    }
  </script>
</body>
</html>`;
  }
}

/**
 * Check if onboarding should be shown
 */
export async function shouldShowOnboarding(globalState: vscode.Memento): Promise<boolean> {
  const completed = globalState.get<boolean>('onboardingCompleted', false);
  const version = globalState.get<string>('onboardingVersion', '0.0.0');

  // Show onboarding if not completed or upgrading from older version
  if (!completed) return true;

  // Show onboarding for major version upgrades
  const currentVersion = '1.1.0';
  if (version !== currentVersion) return true;

  return false;
}

/**
 * Start onboarding flow
 */
export async function startOnboarding(
  context: vscode.ExtensionContext
): Promise<void> {
  const flow = new OnboardingFlow(context.globalState);

  if (await shouldShowOnboarding(context.globalState)) {
    await flow.showOnboardingPanel();
  }
}
