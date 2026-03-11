import { filter, switchMap, tap, catchError, of, Subscription, Observable } from 'rxjs';
import { PollingScheduler, PollingState } from '../polling/polling-scheduler';
import { SourceRegistry } from '../acquisition/source-registry';
import { updateQuotaState } from './quota-state';
import { log } from '../../util/logger';
import { Config } from '../types/config';
import { SourceReading } from '../types/quota';

export class QuotaStreamTopology {
  private subscription?: Subscription;
  private readonly scheduler = new PollingScheduler();

  private config: Config;

  constructor(
    private readonly sources: SourceRegistry,
    initialConfig: Config
  ) {
    this.config = initialConfig;
    this.scheduler.setConfig(initialConfig);
  }

  public updateConfig(config: Config) {
    this.config = config;
    this.scheduler.setConfig(config);
  }

  public setPollingState(state: PollingState) {
    this.scheduler.setState(state);
  }

  public start(): void {
    if (this.subscription) return;

    this.subscription = this.scheduler.tick$
      .pipe(
        filter(() => this.scheduler.getCurrentState() !== PollingState.OFFLINE),
        switchMap(() => this.fetchAllSources()),
        tap(readings => {
          if (readings.length > 0) {
            updateQuotaState(readings);
            this.evaluateCriticalThreshold(readings);
          }
        }),
        catchError(err => {
          log.error('Pipeline error', err);
          return of([]);
        })
      )
      .subscribe();

    log.info('Quota stream topology started.');
  }

  public stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    log.info('Quota stream topology stopped.');
  }

  public async forceFetch(): Promise<void> {
    log.info('Force fetching all sources manually');
    const readings = await this.fetchAllSources();
    if (readings.length > 0) {
      updateQuotaState(readings);
      this.evaluateCriticalThreshold(readings);
    }
  }

  private async fetchAllSources(): Promise<SourceReading[]> {
    const activeSources = this.sources.getHealthySources();
    if (activeSources.length === 0) return [];

    const promises = activeSources.map(async src => {
      try {
        const result = await src.fetch();
        if (result) {
          this.sources.recordSuccess(src.id);
          return result;
        }
      } catch (e) {
        log.warn(`Source ${src.id} failed fetch:`, e);
      }
      this.sources.recordFailure(src.id);
      return null;
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is SourceReading => r !== null);
  }

  private evaluateCriticalThreshold(readings: SourceReading[]) {
    const isCritical = readings.some(r => r.remainingPercent <= this.config.thresholdCritical);
    if (isCritical && this.scheduler.getCurrentState() !== PollingState.CRITICAL) {
      this.scheduler.setState(PollingState.CRITICAL);
    } else if (!isCritical && this.scheduler.getCurrentState() === PollingState.CRITICAL) {
      this.scheduler.setState(PollingState.ACTIVE); // fallback to active
    }
  }
}
