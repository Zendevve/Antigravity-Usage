import { BehaviorSubject, Observable, combineLatest, map, distinctUntilChanged } from 'rxjs';
import { createAdaptiveTimer } from '../../util/timer';
import { Config } from '../types/config';

export enum PollingState {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  CRITICAL = 'CRITICAL',
  OFFLINE = 'OFFLINE',
}

export class PollingScheduler {
  private currentState$ = new BehaviorSubject<PollingState>(PollingState.IDLE);
  private config$ = new BehaviorSubject<Config | null>(null);

  public state$: Observable<PollingState> = this.currentState$.asObservable();

  public get interval$(): Observable<number> {
    return combineLatest([this.currentState$, this.config$]).pipe(
      map(([state, config]) => {
        if (!config) return 60000; // safe default

        switch (state) {
          case PollingState.ACTIVE:
            return config.pollingIntervalActive;
          case PollingState.CRITICAL:
            return Math.min(config.pollingIntervalActive, 2000); // hard floor for critical
          case PollingState.OFFLINE:
            return 60000; // slow poll when offline waiting for reconnect
          case PollingState.IDLE:
          default:
            return config.pollingIntervalIdle;
        }
      }),
      distinctUntilChanged()
    );
  }

  public get tick$(): Observable<number> {
    return createAdaptiveTimer(this.interval$);
  }

  public setConfig(config: Config) {
    this.config$.next(config);
  }

  public setState(state: PollingState) {
    if (this.currentState$.value !== state) {
      this.currentState$.next(state);
    }
  }

  public getCurrentState(): PollingState {
    return this.currentState$.value;
  }
}
