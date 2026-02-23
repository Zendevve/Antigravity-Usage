import { Observable, timer as rxjsTimer, switchMap } from 'rxjs';

export function createAdaptiveTimer(intervalMs$: Observable<number>): Observable<number> {
  return intervalMs$.pipe(
    switchMap(interval => rxjsTimer(0, interval))
  );
}
