import * as vscode from 'vscode';

export class DisposableStore implements vscode.Disposable {
  private _toDispose = new Set<vscode.Disposable>();
  private _isDisposed = false;

  public add<T extends vscode.Disposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this._toDispose.add(disposable);
    return disposable;
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    for (const d of this._toDispose) {
      d.dispose();
    }
    this._toDispose.clear();
  }
}
