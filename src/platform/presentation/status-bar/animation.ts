import * as vscode from 'vscode';
import { Config } from '../../../core/types/config';

export class StatusBarAnimation {
  private timer: NodeJS.Timeout | null = null;
  private isVisible = true;

  constructor(
    private readonly statusBarItem: vscode.StatusBarItem,
    private readonly baseText: string,
    private readonly baseIcon: string
  ) { }

  public start(config: Config) {
    this.stop();

    if (!config.animationEnabled) {
      this.statusBarItem.text = `${this.baseIcon} ${this.baseText}`;
      return;
    }

    // Respect OS accessibility settings implicitly via VS Code
    const reduceMotion = vscode.workspace.getConfiguration('window').get('enableExperimentalReduceMotion');
    if (reduceMotion) {
      this.statusBarItem.text = `${this.baseIcon} ${this.baseText}`;
      return;
    }

    this.timer = setInterval(() => {
      this.isVisible = !this.isVisible;
      this.statusBarItem.text = this.isVisible
        ? `${this.baseIcon} ${this.baseText}`
        : `$(blank) ${this.baseText}`;
    }, 1000); // 1Hz pulse
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.statusBarItem.text = `${this.baseIcon} ${this.baseText}`;
    this.isVisible = true;
  }
}
