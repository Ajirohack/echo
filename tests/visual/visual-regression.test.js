/**
 * Visual regression tests for Translation App UI
 * 
 * These tests verify that the application UI appears correctly and 
 * remains consistent across changes.
 */

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;

describe('Visual Regression Tests', function () {
    // These tests can take longer
    this.timeout(30000);

    let browser;
    let page;

    const screenshotDir = path.join(__dirname, '../fixtures/screenshots');
    const baselineDir = path.join(screenshotDir, 'baseline');
    const currentDir = path.join(screenshotDir, 'current');
    const diffDir = path.join(screenshotDir, 'diff');

    // Ensure screenshot directories exist
    [screenshotDir, baselineDir, currentDir, diffDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    before(async () => {
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

    after(async () => {
        // Close browser
        if (browser) {
            await browser.close();
        }
    });

    /**
     * Helper function to compare screenshots
     */
    async function compareScreenshots(testName) {
        const baselinePath = path.join(baselineDir, `${testName}.png`);
        const currentPath = path.join(currentDir, `${testName}.png`);
        const diffPath = path.join(diffDir, `${testName}.png`);

        // Check if baseline exists
        const baselineExists = fs.existsSync(baselinePath);

        // If baseline doesn't exist, create it
        if (!baselineExists) {
            fs.copyFileSync(currentPath, baselinePath);
            console.log(`Created baseline for ${testName}`);
            return true;
        }

        // Read images
        const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
        const current = PNG.sync.read(fs.readFileSync(currentPath));

        // Create output image
        const { width, height } = baseline;
        const diff = new PNG({ width, height });

        // Compare images
        const mismatchedPixels = pixelmatch(
            baseline.data,
            current.data,
            diff.data,
            width,
            height,
            { threshold: 0.1 } // Allow slight differences
        );

        // Save diff if there are differences
        if (mismatchedPixels > 0) {
            fs.writeFileSync(diffPath, PNG.sync.write(diff));
        }

        // Calculate percentage difference
        const totalPixels = width * height;
        const percentDiff = (mismatchedPixels / totalPixels) * 100;

        return percentDiff < 0.5; // Allow 0.5% difference
    }

    /**
     * Helper function to take screenshot
     */
    async function takeScreenshot(testName, selector = 'body') {
        const screenshotPath = path.join(currentDir, `${testName}.png`);

        // Take screenshot of selector
        const element = await page.$(selector);
        await element.screenshot({
            path: screenshotPath,
            omitBackground: true
        });

        return screenshotPath;
    }

    describe('Main Interface', () => {
        beforeEach(async () => {
            // Load application
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#app-container', { timeout: 5000 });
        });

        it('should match baseline for initial UI', async () => {
            // Take screenshot
            await takeScreenshot('main-ui', '#app-container');

            // Compare with baseline
            const match = await compareScreenshots('main-ui');
            expect(match).to.be.true('UI does not match baseline');
        });

        it('should match baseline for language selection dropdown', async () => {
            // Open language dropdown
            await page.click('#language-select');

            // Wait for dropdown to open
            await page.waitForSelector('.language-dropdown-open', { timeout: 2000 });

            // Take screenshot
            await takeScreenshot('language-dropdown', '#language-select-container');

            // Compare with baseline
            const match = await compareScreenshots('language-dropdown');
            expect(match).to.be.true('Language dropdown does not match baseline');
        });
    });

    describe('Translation Process', () => {
        beforeEach(async () => {
            // Load application
            const appPath = path.join(__dirname, '../../index.html');
            await page.goto(`file://${appPath}`);

            // Wait for app to initialize
            await page.waitForSelector('#translation-form', { timeout: 5000 });
        });

        it('should match baseline for translation in progress', async () => {
            // Enter text
            await page.type('#input-text', 'Hello world');

            // Start translation
            await page.click('#translate-button');

            // Capture loading state
            await page.waitForSelector('.loading-indicator', { timeout: 2000 });
            await takeScreenshot('translation-loading', '#translation-container');

            // Compare with baseline
            const match = await compareScreenshots('translation-loading');
            expect(match).to.be.true('Translation loading state does not match baseline');
        });

        it('should match baseline for translation results', async () => {
            // Enter text
            await page.type('#input-text', 'Hello world');

            // Start translation
            await page.click('#translate-button');

            // Wait for results
            await page.waitForSelector('#translation-results:not(.loading)', { timeout: 5000 });

            // Let animations complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Take screenshot
            await takeScreenshot('translation-results', '#translation-container');

            // Compare with baseline
            const match = await compareScreenshots('translation-results');
            expect(match).to.be.true('Translation results do not match baseline');
        });

        it('should match baseline for error state', async () => {
            // Force error state
            await page.evaluate(() => {
                // Mock error in the app
                window.showTranslationError('Translation service unavailable');
            });

            // Wait for error display
            await page.waitForSelector('.error-message', { timeout: 2000 });

            // Take screenshot
            await takeScreenshot('translation-error', '#translation-container');

            // Compare with baseline
            const match = await compareScreenshots('translation-error');
            expect(match).to.be.true('Error state does not match baseline');
        });
    });

    describe('Responsive Design', () => {
        const viewports = [
            { name: 'mobile', width: 375, height: 667 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'desktop', width: 1280, height: 800 }
        ];

        for (const viewport of viewports) {
            it(`should match baseline on ${viewport.name} viewport`, async () => {
                // Set viewport
                await page.setViewport({
                    width: viewport.width,
                    height: viewport.height
                });

                // Load application
                const appPath = path.join(__dirname, '../../index.html');
                await page.goto(`file://${appPath}`);

                // Wait for app to initialize
                await page.waitForSelector('#app-container', { timeout: 5000 });

                // Take screenshot
                await takeScreenshot(`responsive-${viewport.name}`, '#app-container');

                // Compare with baseline
                const match = await compareScreenshots(`responsive-${viewport.name}`);
                expect(match).to.be.true(`UI on ${viewport.name} does not match baseline`);
            });
        }
    });

    describe('Themes', () => {
        const themes = ['light', 'dark', 'high-contrast'];

        for (const theme of themes) {
            it(`should match baseline with ${theme} theme`, async () => {
                // Load application
                const appPath = path.join(__dirname, '../../index.html');
                await page.goto(`file://${appPath}`);

                // Wait for app to initialize
                await page.waitForSelector('#app-container', { timeout: 5000 });

                // Set theme
                await page.evaluate((themeName) => {
                    document.body.setAttribute('data-theme', themeName);
                }, theme);

                // Let theme change settle
                await new Promise(resolve => setTimeout(resolve, 500));

                // Take screenshot
                await takeScreenshot(`theme-${theme}`, '#app-container');

                // Compare with baseline
                const match = await compareScreenshots(`theme-${theme}`);
                expect(match).to.be.true(`${theme} theme does not match baseline`);
            });
        }
    });
});

// Note: For real implementation, additional visual tests would include:
// 1. User interaction animations testing
// 2. Dynamic UI elements like tooltips, alerts
// 3. Specific component states (e.g., buttons pressed, inputs focused)
// 4. Cross-browser testing (Chrome, Firefox, Safari, Edge)
