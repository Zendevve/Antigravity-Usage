import { Observable, timer } from 'rxjs';

/**
 * Generates an exponential backoff sequence with jitter.
 * @param initialDelayMs The starting delay
 * @param maxDelayMs The maximum delay
 * @param jitterFactor Randomizer multiplier (0.0 - 1.0)
 */
export function createBackoffTimer(
  initialDelayMs: number = 1000,
  maxDelayMs: number = 60000,
  jitterFactor: number = 0.2
): Observable<number> {
  return new Observable<number>((subscriber) => {
    let currentDelay = initialDelayMs;
    let isActive = true;

    const scheduleNext = () => {
      if (!isActive) return;

      const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor; // 0.8 to 1.2 for factor 0.2
      const actualDelay = Math.floor(currentDelay * jitter);

      subscriber.next(actualDelay);

      currentDelay = Math.min(currentDelay * 2, maxDelayMs);

      setTimeout(scheduleNext, actualDelay);
    };

    scheduleNext();

    return () => {
      isActive = false;
    };
  });
}

export class ExponentialBackoff {
  private currentDelay: number;

  constructor(
    private readonly initialDelayMs: number = 1000,
    private readonly maxDelayMs: number = 60000,
    private readonly multiplier: number = 2
  ) {
    this.currentDelay = initialDelayMs;
  }

  public nextDelay(): number {
    const delay = this.currentDelay;
    this.currentDelay = Math.min(this.currentDelay * this.multiplier, this.maxDelayMs);
    return delay;
  }

  public reset(): void {
    this.currentDelay = this.initialDelayMs;
  }
}

