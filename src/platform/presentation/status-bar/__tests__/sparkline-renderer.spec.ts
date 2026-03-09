import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SparklineRenderer,
  TrendDirection,
  DEFAULT_SPARKLINE_CONFIG,
} from '../sparkline-renderer';

describe('SparklineRenderer', () => {
  let renderer: SparklineRenderer;

  beforeEach(() => {
    renderer = new SparklineRenderer();
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const r = new SparklineRenderer();
      expect(r).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const r = new SparklineRenderer({ windowHours: 48 });
      expect(r).toBeDefined();
    });
  });

  describe('addDataPoint', () => {
    it('should add a data point', () => {
      renderer.addDataPoint(50);
      const points = renderer.getDataPoints();
      expect(points).toHaveLength(1);
      expect(points[0].value).toBe(50);
    });

    it('should trim data points outside window', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48);

      renderer.addDataPoint(80, oldDate);
      renderer.addDataPoint(50);

      const points = renderer.getDataPoints();
      expect(points).toHaveLength(1);
      expect(points[0].value).toBe(50);
    });
  });

  describe('calculateTrend', () => {
    it('should detect increasing trend', () => {
      renderer.addDataPoint(30);
      renderer.addDataPoint(40);
      renderer.addDataPoint(50);
      renderer.addDataPoint(60);

      const result = renderer.render();
      expect(result.trend).toBe(TrendDirection.UP);
    });

    it('should detect decreasing trend', () => {
      renderer.addDataPoint(80);
      renderer.addDataPoint(70);
      renderer.addDataPoint(60);
      renderer.addDataPoint(50);

      const result = renderer.render();
      expect(result.trend).toBe(TrendDirection.DOWN);
    });

    it('should detect stable trend', () => {
      renderer.addDataPoint(50);
      renderer.addDataPoint(51);
      renderer.addDataPoint(49);
      renderer.addDataPoint(50);

      const result = renderer.render();
      expect(result.trend).toBe(TrendDirection.STABLE);
    });
  });

  describe('render', () => {
    it('should return fallback when insufficient data', () => {
      renderer.addDataPoint(50);

      const result = renderer.render();
      expect(result.tooltip).toContain('Collecting data');
    });

    it('should include trend in text output', () => {
      renderer.addDataPoint(30);
      renderer.addDataPoint(40);
      renderer.addDataPoint(50);
      renderer.addDataPoint(60);

      const result = renderer.render();
      expect(result.text).toContain('↑');
    });
  });

  describe('color selection', () => {
    it('should return red for critical low values', () => {
      renderer.addDataPoint(5);
      renderer.addDataPoint(5);
      renderer.addDataPoint(5);
      renderer.addDataPoint(5);

      const result = renderer.render();
      expect(result.color).toBe(DEFAULT_SPARKLINE_CONFIG.colors.red);
    });

    it('should return yellow for warning values', () => {
      renderer.addDataPoint(25);
      renderer.addDataPoint(25);
      renderer.addDataPoint(25);
      renderer.addDataPoint(25);

      const result = renderer.render();
      expect(result.color).toBe(DEFAULT_SPARKLINE_CONFIG.colors.yellow);
    });

    it('should return green for healthy values', () => {
      renderer.addDataPoint(70);
      renderer.addDataPoint(70);
      renderer.addDataPoint(70);
      renderer.addDataPoint(70);

      const result = renderer.render();
      expect(result.color).toBe(DEFAULT_SPARKLINE_CONFIG.colors.green);
    });
  });

  describe('SVG rendering', () => {
    it('should return null when insufficient data', () => {
      renderer.addDataPoint(50);
      const svg = renderer.renderToSvg();
      expect(svg).toBeNull();
    });

    it('should return SVG when enough data', () => {
      renderer.addDataPoint(30);
      renderer.addDataPoint(40);
      renderer.addDataPoint(50);
      renderer.addDataPoint(60);

      const svg = renderer.renderToSvg();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  });

  describe('clear', () => {
    it('should clear all data points', () => {
      renderer.addDataPoint(50);
      renderer.addDataPoint(60);
      renderer.clear();

      const points = renderer.getDataPoints();
      expect(points).toHaveLength(0);
    });
  });

  describe('hasEnoughData', () => {
    it('should return false with less than 2 points', () => {
      renderer.addDataPoint(50);
      expect(renderer.hasEnoughData()).toBe(false);
    });

    it('should return true with 2 or more points', () => {
      renderer.addDataPoint(50);
      renderer.addDataPoint(60);
      expect(renderer.hasEnoughData()).toBe(true);
    });
  });
});
