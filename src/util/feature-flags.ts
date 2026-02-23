export enum Phase {
  MVP = 1,
  STANDARD = 2,
  ADVANCED = 3,
  ECOSYSTEM = 4,
}

declare const K1_RELEASE_PHASE: number | undefined;

const activePhase = typeof K1_RELEASE_PHASE !== 'undefined' ? K1_RELEASE_PHASE : 1;

export function isEnabled(requiredPhase: Phase): boolean {
  return activePhase >= requiredPhase;
}
