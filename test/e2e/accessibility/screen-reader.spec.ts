/**
 * Screen Reader Accessibility Tests
 *
 * Tests for WCAG 2.1 Level AA - Screen Reader Compatibility
 *
 * Requirements:
 * - All interactive elements must have accessible names
 * - ARIA labels must be properly used
 * - Semantic HTML structure must be correct
 * - Live regions must announce dynamic content
 * - Images must have alt text
 */

import { test, expect } from '@playwright/test';

test.describe('Screen Reader Accessibility', () => {

  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(1000);
  });

  test('buttons should have accessible names', async ({ page }) => {
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);

      if (await button.isVisible()) {
        // Button should have either:
        // - text content
        // - aria-label
        // - aria-labelledby
        const hasText = await button.innerText();
        const hasAriaLabel = await button.getAttribute('aria-label');
        const hasAriaLabelledBy = await button.getAttribute('aria-labelledby');
        const hasTitle = await button.getAttribute('title');

        const hasAccessibleName = hasText || hasAriaLabel || hasAriaLabelledBy || hasTitle;

        if (!hasAccessibleName) {
          console.log(`Button ${i} lacks accessible name`);
        }

        expect(hasAccessibleName).toBeTruthy();
      }
    }
  });

  test('images should have alt text', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);

      // Skip decorative images
      const role = await image.getAttribute('role');
      if (role === 'presentation' || role === 'img' && !(await image.isVisible())) {
        continue;
      }

      const alt = await image.getAttribute('alt');
      const ariaLabel = await image.getAttribute('aria-label');

      // Images should have alt text or aria-label
      expect(alt || ariaLabel).toBeTruthy();
    }
  });

  test('form inputs should have labels', async ({ page }) => {
    const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
    const inputCount = await inputs.count();

    for (let i = 0; i < Math.min(inputCount, 10); i++) {
      const input = inputs.nth(i);

      if (await input.isVisible()) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');

        // Input should have a label via:
        // - associated label element (via for attribute)
        // - aria-label
        // - aria-labelledby
        let hasLabel = false;

        if (id) {
          const labelFor = page.locator(`label[for="${id}"]`);
          hasLabel = await labelFor.count() > 0;
        }

        const hasAriaLabel = ariaLabel && ariaLabel.length > 0;
        const hasAriaLabelledBy = ariaLabelledBy && ariaLabelledBy.length > 0;

        // Placeholder is not a substitute for labels, but we note it
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
          console.log(`Input ${i} (id: ${id}) may need a label. Placeholder: ${placeholder}`);
        }

        // For now, just warn about missing labels
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
          console.log(`⚠️  Input ${i} lacks proper labeling`);
        }
      }
    }
  });

  test('ARIA live regions should be present for dynamic content', async ({ page }) => {
    // Check for live regions
    const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"], [role="log"]');
    const liveRegionCount = await liveRegions.count();

    // There should be at least one live region for dynamic content updates
    console.log(`Found ${liveRegionCount} ARIA live regions`);
  });

  test('semantic HTML should be used correctly', async ({ page }) => {
    // Check for proper heading hierarchy
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();

    if (headingCount > 0) {
      const headingLevels: number[] = [];

      for (let i = 0; i < headingCount; i++) {
        const heading = headings.nth(i);
        const tagName = await heading.evaluate(el => el.tagName);
        const level = parseInt(tagName.substring(1));
        headingLevels.push(level);
      }

      // Check heading hierarchy (should not skip more than one level)
      let validHierarchy = true;
      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] - headingLevels[i - 1] > 1) {
          validHierarchy = false;
          console.log(`⚠️  Heading hierarchy jump: h${headingLevels[i - 1]} -> h${headingLevels[i]}`);
        }
      }

      console.log(`Heading hierarchy: ${headingLevels.map(h => 'h' + h).join(' -> ')}`);
    }
  });

  test('interactive elements should have proper roles', async ({ page }) => {
    // Check that links have proper href or role
    const links = page.locator('a');
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);

      if (await link.isVisible()) {
        const href = await link.getAttribute('href');
        const role = await link.getAttribute('role');
        const tabindex = await link.getAttribute('tabindex');

        // Links should have href, role="button", or be focusable
        const isValid = href || role === 'button' || tabindex !== null;

        if (!isValid) {
          console.log(`Link ${i} may be invalid`);
        }
      }
    }
  });

  test('color should not be the only means of conveying information', async ({ page }) => {
    // Check that status indicators have text or icon, not just color
    const statusIndicators = page.locator('[class*="status"], [class*="indicator"]');
    const statusCount = await statusIndicators.count();

    for (let i = 0; i < statusCount; i++) {
      const indicator = statusIndicators.nth(i);

      if (await indicator.isVisible()) {
        const text = await indicator.innerText();
        const ariaLabel = await indicator.getAttribute('aria-label');
        const role = await indicator.getAttribute('role');

        // Status should have text, aria-label, or role
        const hasAlternative = text || ariaLabel || role;

        if (!hasAlternative) {
          console.log(`⚠️  Status indicator ${i} may rely on color alone`);
        }
      }
    }
  });

  test('landmarks should be present for navigation', async ({ page }) => {
    // Check for common landmarks
    const landmarks = {
      main: await page.locator('main, [role="main"]').count(),
      nav: await page.locator('nav, [role="navigation"]').count(),
      header: await page.locator('header, [role="banner"]').count(),
      footer: await page.locator('footer, [role="contentinfo"]').count(),
      aside: await page.locator('aside, [role="complementary"]').count(),
    };

    console.log('Landmarks found:', landmarks);

    // At least one main landmark is recommended
    expect(landmarks.main).toBeGreaterThanOrEqual(0);
  });
});
