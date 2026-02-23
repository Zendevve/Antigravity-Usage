import * as vscode from 'vscode';
import { log } from '../../util/logger';

export class CommandRegistry {
  private disposables: vscode.Disposable[] = [];

  public register(commandId: string, handler: (...args: any[]) => any) {
    log.info(`Registering command: ${commandId}`);
    const disposable = vscode.commands.registerCommand(commandId, async (...args) => {
      try {
        await handler(...args);
      } catch (err) {
        log.error(`Command ${commandId} threw an error`, err);
        vscode.window.showErrorMessage(`K1 Antigravity: Failed to execute ${commandId}`);
      }
    });
    this.disposables.push(disposable);
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    log.info('CommandRegistry disposed');
  }
}
