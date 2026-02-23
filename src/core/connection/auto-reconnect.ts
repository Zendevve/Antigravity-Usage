import { Subscription, interval } from 'rxjs';
import { ConnectionStatus, connectionState$ } from '../../platform/connection/connection-state';
import { ExponentialBackoff } from '../polling/backoff';
import { log } from '../../util/logger';

export class AutoReconnect {
  private subscription?: Subscription;
  private attemptSubscription?: Subscription;
  private backoff: ExponentialBackoff;

  constructor(
    private readonly connectFn: () => Promise<boolean>,
    config: { initialMs: number; maxMs: number; multiplier: number } = { initialMs: 1000, maxMs: 60000, multiplier: 2 }
  ) {
    this.backoff = new ExponentialBackoff(config.initialMs, config.maxMs, config.multiplier);
  }

  public start() {
    if (this.subscription) return;
    this.subscription = connectionState$.subscribe((state) => {
      if (state.status === ConnectionStatus.DISCONNECTED) {
        this.startReconnectionLoop();
      } else if (state.status === ConnectionStatus.CONNECTED) {
        this.stopReconnectionLoop();
        this.backoff.reset();
      }
    });
    log.info('AutoReconnect started');
  }

  public stop() {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.stopReconnectionLoop();
    log.info('AutoReconnect stopped');
  }

  private startReconnectionLoop() {
    if (this.attemptSubscription) return; // already running

    const delay = this.backoff.nextDelay();
    log.info(`Scheduling auto-reconnect attempt in ${delay}ms`);

    this.attemptSubscription = interval(delay).subscribe(async () => {
      // Clean up current subscription immediately since backoff recalculates
      this.attemptSubscription?.unsubscribe();
      this.attemptSubscription = undefined;

      try {
        const success = await this.connectFn();
        if (success) {
          log.info('Auto-reconnect successful!');
          connectionState$.next({ status: ConnectionStatus.CONNECTED });
        } else {
          log.warn('Auto-reconnect failed. Will retry.');
          this.startReconnectionLoop(); // loop again with new backoff
        }
      } catch (err) {
        log.error('Auto-reconnect threw error:', err);
        this.startReconnectionLoop();
      }
    });
  }

  private stopReconnectionLoop() {
    this.attemptSubscription?.unsubscribe();
    this.attemptSubscription = undefined;
  }
}
