/**
 * Accessibility tests for Translation App UI
 * 
 * These tests verify that the application UI meets accessibility standards,
 * including WCAG 2.1 compliance.
 */

const path = require('path');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');

describe('Accessibility Tests', () => {
    // These tests can take longer
    jest.setTimeout(20000);

    let browser;
    let page;

    beforeAll(async () => {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true, // Run headless for CI
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Create new page
        page = await browser.newPage();

        // Set viewport
        await page.setViewport({
            width: 1280,
            height: 800
        });
    });

    afterAll(async () => {
        // Close browser
        if (browser) {
            await browser.close();
        }
    });

    /**
     * Helper function to analyze page accessibility
     */
    async function analyzeAccessibility(page, options = {}) {
        const axe = new AxePuppeteer(page);

        if (options.rules) {
            axe.options({
                rules: options.rules
            });
        }

        const results = await axe.analyze();
        return results;
    }

    describe('Main Interface', () => {
        beforeEach(async () => {
            // Load application
            // For local testing, use the file:// protocol to load the app directly
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#app-container', { timeout: 5000 });
        });

        it('should have no critical accessibility violations', async () => {
            // Run accessibility analysis
            const results = await analyzeAccessibility(page);

            // Log violations for debugging
            if (results.violations.length > 0) {
                console.log('Accessibility violations:', JSON.stringify(results.violations, null, 2));
            }

            // Filter for critical violations only
            const criticalViolations = results.violations.filter(v => v.impact === 'critical');

            // Should have no critical violations
            expect(criticalViolations.length).toBe(0); // Critical accessibility violations found
        });

        it('should have appropriate ARIA attributes', async () => {
            // Run accessibility analysis focused on ARIA
            const results = await analyzeAccessibility(page, {
                rules: {
                    'aria-*': { enabled: true }
                }
            });

            // Check ARIA violations
            const ariaViolations = results.violations.filter(v => v.id.startsWith('aria-'));

            // Should have no ARIA violations
            expect(ariaViolations.length).toBe(0); // ARIA violations found
        });

        it('should have sufficient color contrast', async () => {
            // Run accessibility analysis focused on color contrast
            const results = await analyzeAccessibility(page, {
                rules: {
                    'color-contrast': { enabled: true }
                }
            });

            // Check color contrast violations
            const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');

            // Should have no contrast violations
            expect(contrastViolations.length).toBe(0); // Color contrast issues found
        });
    });

    describe('Translation Form', () => {
        beforeEach(async () => {
            // Load application
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#translation-form', { timeout: 5000 });
        });

        it('should have accessible form controls', async () => {
            // Find all form controls
            const formControls = await page.$$eval('input, select, textarea, button', elements => {
                return elements.map(el => ({
                    type: el.tagName.toLowerCase(),
                    id: el.id,
                    hasLabel: !!el.labels && el.labels.length > 0,
                    hasAriaLabel: !!el.getAttribute('aria-label'),
                    hasAriaLabelledBy: !!el.getAttribute('aria-labelledby')
                }));
            });

            // Check that all form controls have accessible labels
            for (const control of formControls) {
                const hasAccessibleLabel = control.hasLabel ||
                    control.hasAriaLabel ||
                    control.hasAriaLabelledBy;

                expect(hasAccessibleLabel).toBe(true); // Form control should have accessible label
            }
        });

        it('should be keyboard navigable', async () => {
            // Ensure focusable elements can be tabbed through
            await page.keyboard.press('Tab');

            // Get the active element
            let activeElementCount = 0;

            // Press tab multiple times and count unique focused elements
            const focusedElements = new Set();

            for (let i = 0; i < 10; i++) {
                const focusedElement = await page.evaluate(() => {
                    const active = document.activeElement;
                    return active ? active.tagName + (active.id ? '#' + active.id : '') : null;
                });

                if (focusedElement && focusedElement !== 'BODY') {
                    focusedElements.add(focusedElement);
                }

                await page.keyboard.press('Tab');
            }

            // Should have focused several elements
            expect(focusedElements.size).toBeGreaterThan(3); // Not enough focusable elements found
        });
    });

    describe('Results Display', () => {
        beforeEach(async () => {
            // Load application
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#translation-form', { timeout: 5000 });

            // Trigger a translation
            await page.type('#input-text', 'Hello world');
            await page.click('#translate-button');

            // Wait for results
            await page.waitForSelector('#translation-results', { timeout: 5000 });
        });

        it('should have screen reader accessible results', async () => {
            // Check for appropriate ARIA roles
            const hasAriaLive = await page.$eval('#translation-results', el => {
                return el.getAttribute('aria-live') === 'polite';
            });

            expect(hasAriaLive).toBe(true); // Translation results should have aria-live attribute

            // Check for appropriate heading structure
            const headingsStructure = await page.$$eval('h1, h2, h3, h4, h5, h6', headings => {
                return headings.map(h => ({
                    level: parseInt(h.tagName.substring(1)),
                    text: h.textContent
                }));
            });

            // Should have logical heading structure
            let previousLevel = 0;
            let headingLevelsValid = true;

            for (const heading of headingsStructure) {
                if (previousLevel > 0 && heading.level > previousLevel + 1) {
                    headingLevelsValid = false;
                    break;
                }
                previousLevel = heading.level;
            }

            expect(headingLevelsValid).toBe(true); // Heading structure should not skip levels
        });
    });

    describe('Responsive Design', () => {
        it('should be accessible on mobile viewport', async () => {
            // Set mobile viewport
            await page.setViewport({
                width: 375,
                height: 667,
                isMobile: true
            });

            // Load application
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#app-container', { timeout: 5000 });

            // Run accessibility analysis
            const results = await analyzeAccessibility(page);

            // Should have no critical violations
            const criticalViolations = results.violations.filter(v => v.impact === 'critical');
            expect(criticalViolations.length).toBe(0); // Critical accessibility violations found on mobile viewport
        });

        it('should maintain touch target sizes on mobile', async () => {
            // Set mobile viewport
            await page.setViewport({
                width: 375,
                height: 667,
                isMobile: true
            });

            // Load application
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#translation-form', { timeout: 5000 });

            // Measure size of touch targets
            const touchTargetSizes = await page.$$eval('button, a, input, select', elements => {
                return elements.map(el => {
                    const rect = el.getBoundingClientRect();
                    return {
                        tag: el.tagName.toLowerCase(),
                        id: el.id,
                        width: rect.width,
                        height: rect.height
                    };
                });
            });

            // WCAG 2.1 recommends touch targets of at least 44x44px
            const minWidth = 44;
            const minHeight = 44;

            // Filter for small touch targets
            const smallTouchTargets = touchTargetSizes.filter(
                target => target.width < minWidth || target.height < minHeight
            );

            // Allow some exemptions for specific types of controls
            const exemptTypes = ['hidden'];
            const nonExemptSmallTargets = smallTouchTargets.filter(
                target => !exemptTypes.includes(target.tag)
            );

            expect(nonExemptSmallTargets.length).toBe(0); // Touch targets too small for mobile
        });
    });
});

// Note: For real implementation, additional accessibility tests would include:
// 1. Screen reader navigation testing with specific reader tools
// 2. Keyboard-only navigation complete workflow tests
// 3. High contrast mode testing
// 4. Testing with real assistive technology like NVDA or VoiceOver
