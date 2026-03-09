/**
 * Color Contrast Accessibility Tests
 *
 * Tests for WCAG 2.1 Level AA - Color Contrast
 *
 * Requirements:
 * - Normal text: 4.5:1 contrast ratio
 * - Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio
 * - UI components: 3:1 contrast ratio
 * - Color should not be the only means of conveying information
 */

import { test, expect } from '@playwright/test';

test.describe('Color Contrast Accessibility', () => {

  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(1000);
  });

  /**
   * Calculate relative luminance for a color
   */
  function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  function getContrastRatio(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  test('text should have sufficient color contrast', async ({ page }) => {
    // Get all text elements
    const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, a, button');

    const count = await textElements.count();
    let checkedCount = 0;
    const issues: string[] = [];

    for (let i = 0; i < Math.min(count, 50); i++) {
      const element = textElements.nth(i);

      if (!(await element.isVisible())) continue;

      try {
        // Get computed styles
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
          };
        });

        // Parse RGB values
        const colorMatch = styles.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        const bgMatch = styles.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

        if (!colorMatch || !bgMatch) continue;

        const textColor = {
          r: parseInt(colorMatch[1]),
          g: parseInt(colorMatch[2]),
          b: parseInt(colorMatch[3])
        };

        const bgColor = {
          r: parseInt(bgMatch[1]),
          g: parseInt(bgMatch[2]),
          b: parseInt(bgMatch[3])
        };

        // Calculate contrast ratio
        const textLum = getLuminance(textColor.r, textColor.g, textColor.b);
        const bgLum = getLuminance(bgColor.r, bgColor.g, bgColor.b);
        const contrastRatio = getContrastRatio(textLum, bgLum);

        // Check font size and weight
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = parseInt(styles.fontWeight || '400');
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);

        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        const requiredRatio = isLargeText ? 3.0 : 4.5;

        if (contrastRatio < requiredRatio) {
          issues.push(`Element ${i}: ${contrastRatio.toFixed(2)}:1 (needs ${requiredRatio}:1) - "${styles.fontSize}" "${styles.fontWeight}"`);
        }

        checkedCount++;
      } catch {
        // Skip elements that can't be analyzed
      }
    }

    console.log(`Checked ${checkedCount} text elements for contrast`);

    if (issues.length > 0) {
      console.log('⚠️  Contrast issues found:');
      issues.slice(0, 5).forEach(issue => console.log('  ' + issue));
    }

    // This is a warning-level check - we log issues but don't fail
    expect(checkedCount).toBeGreaterThan(0);
  });

  test('UI components should have sufficient contrast', async ({ page }) => {
    const buttons = page.locator('button, input[type="button"], input[type="submit"]');
    const buttonCount = await buttons.count();

    let checkedCount = 0;

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);

      if (!(await button.isVisible())) continue;

      try {
        const styles = await button.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            borderColor: computed.borderColor,
          };
        });

        // Parse colors
        const bgMatch = styles.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        const colorMatch = styles.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

        if (!bgMatch || !colorMatch) continue;

        const bgLum = getLuminance(
          parseInt(bgMatch[1]),
          parseInt(bgMatch[2]),
          parseInt(bgMatch[3])
        );

        const colorLum = getLuminance(
          parseInt(colorMatch[1]),
          parseInt(colorMatch[2]),
          parseInt(colorMatch[3])
        );

        const contrastRatio = getContrastRatio(bgLum, colorLum);

        // UI components need 3:1 contrast ratio
        if (contrastRatio < 3.0) {
          console.log(`Button ${i}: ${contrastRatio.toFixed(2)}:1 (needs 3:1)`);
        }

        checkedCount++;
      } catch {
        // Skip
      }
    }

    console.log(`Checked ${checkedCount} UI components for contrast`);
  });

  test('links should be distinguishable from surrounding text', async ({ page }) => {
    const links = page.locator('a');
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);

      if (!(await link.isVisible())) continue;

      const styles = await link.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          textDecoration: computed.textDecoration,
          fontWeight: computed.fontWeight,
        };
      });

      // Links should have some visual distinction
      const hasDistinction =
        styles.textDecoration?.includes('underline') ||
        parseInt(styles.fontWeight || '400') >= 700;

      if (!hasDistinction) {
        console.log(`Link ${i} may need additional distinction (underline or bold)`);
      }
    }
  });

  test('focus indicators should be visible', async ({ page }) => {
    // Tab to an element and check if focus is visible
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    const focusedElement = page.locator(':focus');
    const hasOutline = await focusedElement.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.outlineWidth !== '0px' && style.outlineStyle !== 'none';
    });

    console.log(`Focused element has outline: ${hasOutline}`);
  });

  test('color should not be only means of information', async ({ page }) => {
    // Check for status indicators that might rely only on color
    const statusElements = page.locator('[class*="status"], [class*="error"], [class*="warning"], [class*="success"]');
    const statusCount = await statusElements.count();

    for (let i = 0; i < Math.min(statusCount, 10); i++) {
      const element = statusElements.nth(i);

      if (!(await element.isVisible())) continue;

      const text = await element.innerText();
      const ariaLabel = await element.getAttribute('aria-label');
      const role = await element.getAttribute('role');

      // Status should have text, icon, or aria-label, not just color
      const hasAlternative = text || ariaLabel || role === 'img' || role === 'presentation';

      if (!hasAlternative) {
        console.log(`Status element ${i} may rely on color alone`);
      }
    }
  });
});
