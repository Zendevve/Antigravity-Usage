import { MonteCarloResult, DEFAULT_FORECAST_CONFIG } from './forecast-types';
import { calculateMean, calculatePercentile } from './time-series';

/**
 * Monte Carlo Simulation Engine for probabilistic quota exhaustion estimation
 */
export class MonteCarloEngine {
  private iterations: number;

  /**
   * @param iterations - Number of simulations to run (default: 10000)
   */
  constructor(iterations: number = DEFAULT_FORECAST_CONFIG.monteCarloIterations) {
    this.iterations = iterations;
  }

  /**
   * Run Monte Carlo simulation to estimate quota exhaustion time
   */
  simulate(
    currentQuota: number,
    historicalUsage: number[],
    timeWindowHours: number = 720 // 30 days
  ): MonteCarloResult {
    if (historicalUsage.length === 0 || currentQuota <= 0) {
      return this.emptyResult();
    }

    // Generate usage scenarios
    const scenarios = this.generateScenarios(historicalUsage, this.iterations);

    // Run each scenario and track exhaustion times
    const exhaustionTimes: number[] = [];

    for (const scenario of scenarios) {
      const exhaustionTime = this.simulateScenario(currentQuota, scenario, timeWindowHours);
      exhaustionTimes.push(exhaustionTime);
    }

    // Sort exhaustion times for percentile calculations
    exhaustionTimes.sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = calculatePercentile(exhaustionTimes, 50);
    const p90 = calculatePercentile(exhaustionTimes, 90);
    const p99 = calculatePercentile(exhaustionTimes, 99);

    // Calculate probabilities of exhaustion within time windows
    const probabilityExhaustion24h = this.calculateExhaustionProbability(exhaustionTimes, 24);
    const probabilityExhaustion7d = this.calculateExhaustionProbability(exhaustionTimes, 168);
    const probabilityExhaustion30d = this.calculateExhaustionProbability(exhaustionTimes, 720);

    return {
      p50: p50 === Infinity ? null : p50,
      p90: p90 === Infinity ? null : p90,
      p99: p99 === Infinity ? null : p99,
      probabilityExhaustion24h,
      probabilityExhaustion7d,
      probabilityExhaustion30d,
      simulationCount: this.iterations,
    };
  }

  /**
   * Generate random usage scenarios based on historical data distribution
   * Uses bootstrap sampling with noise
   */
  private generateScenarios(usage: number[], count: number): number[][] {
    const scenarios: number[][] = [];
    const mean = calculateMean(usage);
    const stdDev = this.calculateStdDev(usage);

    for (let i = 0; i < count; i++) {
      const scenario: number[] = [];

      for (let j = 0; j < 168; j++) { // 1 week of hourly data
        // Bootstrap sampling: 70% chance to use actual historical value
        // 30% chance to use random value from normal distribution
        if (Math.random() < 0.7 && usage.length > 0) {
          const randomIndex = Math.floor(Math.random() * usage.length);
          scenario.push(Math.max(0, usage[randomIndex]));
        } else {
          // Generate from normal distribution
          const randomValue = this.randomNormal(mean, stdDev);
          scenario.push(Math.max(0, randomValue));
        }
      }

      scenarios.push(scenario);
    }

    return scenarios;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(data: number[]): number {
    if (data.length < 2) return 0;

    const mean = calculateMean(data);
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;

    return Math.sqrt(variance);
  }

  /**
   * Generate random number from normal distribution using Box-Muller transform
   */
  private randomNormal(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();

    // Box-Muller transform
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    return mean + z * stdDev;
  }

  /**
   * Simulate a single scenario and return hours until exhaustion
   */
  private simulateScenario(
    currentQuota: number,
    usageScenario: number[],
    maxHours: number
  ): number {
    let remainingQuota = currentQuota;
    let hours = 0;

    // Determine step size based on scenario length
    const stepSize = Math.ceil(maxHours / usageScenario.length);

    for (let i = 0; i < usageScenario.length && hours < maxHours; i++) {
      const hourlyUsage = usageScenario[i];

      remainingQuota -= hourlyUsage;
      hours += 1;

      if (remainingQuota <= 0) {
        return hours;
      }
    }

    // If we haven't exhausted yet, return infinity (or max hours)
    return maxHours + (remainingQuota / calculateMean(usageScenario));
  }

  /**
   * Calculate probability of exhaustion within a given time window
   */
  private calculateExhaustionProbability(
    exhaustionTimes: number[],
    timeWindowHours: number
  ): number {
    if (exhaustionTimes.length === 0) return 0;

    const exhaustedWithinWindow = exhaustionTimes.filter(t => t <= timeWindowHours).length;

    return exhaustedWithinWindow / exhaustionTimes.length;
  }

  /**
   * Return empty result for edge cases
   */
  private emptyResult(): MonteCarloResult {
    return {
      p50: null,
      p90: null,
      p99: null,
      probabilityExhaustion24h: 0,
      probabilityExhaustion7d: 0,
      probabilityExhaustion30d: 0,
      simulationCount: 0,
    };
  }

  /**
   * Run quick simulation with fewer iterations for faster results
   */
  quickSimulate(
    currentQuota: number,
    historicalUsage: number[],
    timeWindowHours: number = 168
  ): MonteCarloResult {
    // Use fewer iterations for quick mode
    const originalIterations = this.iterations;
    this.iterations = Math.min(1000, this.iterations);

    const result = this.simulate(currentQuota, historicalUsage, timeWindowHours);

    // Restore original iteration count
    this.iterations = originalIterations;

    return result;
  }

  /**
   * Simulate with bootstrap resampling only (no normal distribution)
   */
  simulateWithBootstrap(
    currentQuota: number,
    historicalUsage: number[],
    timeWindowHours: number = 720
  ): MonteCarloResult {
    if (historicalUsage.length === 0 || currentQuota <= 0) {
      return this.emptyResult();
    }

    // Pure bootstrap: always use historical values
    const scenarios: number[][] = [];

    for (let i = 0; i < this.iterations; i++) {
      const scenario: number[] = [];

      for (let j = 0; j < 168; j++) {
        const randomIndex = Math.floor(Math.random() * historicalUsage.length);
        scenario.push(Math.max(0, historicalUsage[randomIndex]));
      }

      scenarios.push(scenario);
    }

    const exhaustionTimes: number[] = [];

    for (const scenario of scenarios) {
      const exhaustionTime = this.simulateScenario(currentQuota, scenario, timeWindowHours);
      exhaustionTimes.push(exhaustionTime);
    }

    exhaustionTimes.sort((a, b) => a - b);

    const p50 = calculatePercentile(exhaustionTimes, 50);
    const p90 = calculatePercentile(exhaustionTimes, 90);
    const p99 = calculatePercentile(exhaustionTimes, 99);

    const probabilityExhaustion24h = this.calculateExhaustionProbability(exhaustionTimes, 24);
    const probabilityExhaustion7d = this.calculateExhaustionProbability(exhaustionTimes, 168);
    const probabilityExhaustion30d = this.calculateExhaustionProbability(exhaustionTimes, 720);

    return {
      p50: p50 === Infinity ? null : p50,
      p90: p90 === Infinity ? null : p90,
      p99: p99 === Infinity ? null : p99,
      probabilityExhaustion24h,
      probabilityExhaustion7d,
      probabilityExhaustion30d,
      simulationCount: this.iterations,
    };
  }

  /**
   * Get number of iterations
   */
  getIterations(): number {
    return this.iterations;
  }

  /**
   * Set number of iterations
   */
  setIterations(iterations: number): void {
    this.iterations = Math.max(100, Math.min(100000, iterations));
  }

  /**
   * Calculate risk score based on Monte Carlo results
   * Returns 0-100 risk score
   */
  calculateRiskScore(result: MonteCarloResult): number {
    if (!result.p50) return 0;

    let score = 0;

    // Factor 1: How soon is P50 exhaustion?
    if (result.p50 <= 24) {
      score += 50;
    } else if (result.p50 <= 168) {
      score += 30;
    } else if (result.p50 <= 720) {
      score += 15;
    }

    // Factor 2: P90 vs P50 gap (uncertainty)
    if (result.p90 && result.p50) {
      const uncertainty = (result.p90 - result.p50) / result.p50;
      if (uncertainty > 1) {
        score += 25; // High uncertainty
      } else if (uncertainty > 0.5) {
        score += 15;
      } else {
        score += 5;
      }
    }

    // Factor 3: Probability of exhaustion in 24h
    score += result.probabilityExhaustion24h * 25;

    return Math.min(100, score);
  }
}
