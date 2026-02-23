import { BehaviorSubject } from 'rxjs';
import { QuotaState } from '../types/quota';

export const quotaState$ = new BehaviorSubject<QuotaState[]>([]);

export function updateQuotaState(newState: QuotaState[]) {
  quotaState$.next(newState);
}

export function getQuotaState(): QuotaState[] {
  return quotaState$.value;
}
