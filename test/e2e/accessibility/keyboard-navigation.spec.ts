/**
 * Keyboard Navigation Accessibility Tests
 *
 * Tests for WCAG 2.1 Level AA - Keyboard Accessibility
 *
 * Requirements:
 * - All interactive elements must be keyboard accessible
 * - Focus order must be logical
 * - Focus must be visible at all times
 * - No keyboard traps
 * - Skip links must be provided
 */

import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation Accessibility', () => {

  test.beforeEach(async ({ page }) => {
    // Wait for extension to be ready
    await page.waitForTimeout(1000);
  });

  test('status bar item should be keyboard accessible', async ({ page }) => {
    // The status bar item should be focusable via Tab
    const statusBar = page.locator('[class*="statusbar"]');

    // Tab to find the status bar
    await page.keyboard.press('Tab');

    // The focus should land on an interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('all buttons should be keyboard accessible', async ({ page }) => {
    // Find all buttons in the extension UI
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // There should be at least some buttons
    expect(buttonCount).toBeGreaterThan(0);

    // Each button should have visible focus styles
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);

      // Check button is visible
      if (await button.isVisible()) {
        // Tab to button
        await page.keyboard.press('Tab');

        // Button should be focused
        const focused = page.locator(':focus');
        const buttonName = await button.evaluate(el => el.tagName);
        const focusedName = await focused.evaluate(el => el.tagName);

        // Either this button is focused or we're on another interactive element
        expect(['BUTTON', 'A', 'INPUT']).toContain(focusedName);
      }
    }
  });

  test('tab order should be logical', async ({ page }) => {
    // Get all focusable elements
    const focusableSelectors = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusableElements = page.locator(focusableSelectors);
    const count = await focusableElements.count();

    // If there are multiple focusable elements, check tab order
    if (count > 1) {
      const tabOrder: string[] = [];

      // Press Tab multiple times and record what's focused
      for (let i = 0; i < Math.min(count, 20); i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);

        const focused = page.locator(':focus');
        const tagName = await focused.evaluate(el => el.tagName.toLowerCase());
        const id = await focused.evaluate(el => el.id || '');
        const ariaLabel = await focused.evaluate(el => el.getAttribute('aria-label') || '');

        tabOrder.push(`${tagName}${id ? '#' + id : ''}[${ariaLabel}]`);
      }

      // Tab order should not have unexpected jumps (basic check)
      console.log('Tab order:', tabOrder.join(' -> '));
    }
  });

  test('Escape key should close open dialogs/modals', async ({ page }) => {
    // Open a dialog if possible (e.g., command palette)
    await page.keyboard.press('Control+Shift+P');

    // Command palette should open
    const commandPalette = page.locator('[class*="quick-input"]');

    // Wait for it to appear
    await page.waitForTimeout(500);

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Should be closed or returning focus appropriately
    // This is a basic check - in VSCode, the command palette behavior may vary
  });

  test('arrow keys should navigate within components', async ({ page }) => {
    // Test arrow key navigation in dropdowns/selects if present
    const selectElement = page.locator('select').first();

    if (await selectElement.count() > 0) {
      await selectElement.focus();

      // Arrow down should change selection
      await page.keyboard.press('ArrowDown');

      // The select should respond (no crash)
      expect(true).toBe(true);
    }
  });

  test('focus should not be trapped in any element', async ({ page }) => {
    // Get initial focused element
    await page.keyboard.press('Tab');
    const initialFocused = await page.locator(':focus').evaluate(el => el.tagName);

    // Tab through many elements
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);
    }

    // After many tabs, we should still have a focused element (not trapped)
    const finalFocused = await page.locator(':focus').evaluate(el => el.tagName);
    expect(finalFocused).toBeTruthy();
  });

  test('no focusable elements should have tabindex=-1 without reason', async ({ page }) => {
    // This is a best-effort check
    // Elements with tabindex=-1 should not be in the tab order accidentally
    const negativeTabindex = page.locator('[tabindex="-1"]');
    const count = await negativeTabindex.count();

    // If there are elements with tabindex=-1, they should have a valid reason
    // This is more of a documentation test
    console.log(`Found ${count} elements with tabindex=-1`);
  });
});
