import * as vscode from 'vscode';
import { BehaviorSubject, Observable } from 'rxjs';
import { Config } from '../../core/types/config';
import { readConfig } from './config-reader';
import { DisposableStore } from '../../util/disposable';

export class ConfigWatcher {
  private configSubject: BehaviorSubject<Config>;
  public readonly config$: Observable<Config>;

  constructor(context: vscode.ExtensionContext, private store: DisposableStore) {
    this.configSubject = new BehaviorSubject<Config>(readConfig());
    this.config$ = this.configSubject.asObservable();

    this.store.add(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('k1-antigravity')) {
          this.configSubject.next(readConfig());
        }
      })
    );
  }

  public getConfig(): Config {
    return this.configSubject.value;
  }
}
