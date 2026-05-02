const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

/**
 * Screenshot Service
 * Uses Playwright to render URLs or local HTML files and save them as PNG.
 */
async function takeScreenshot(urlOrPath, outputFilename) {
    console.log(`[ScreenshotService] Starting capture for: ${urlOrPath}`);
    
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        page.on('console', msg => console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[Browser Error] ${err.message}`));
        
        // Configurar viewport para dashboard (1280x800 ou similar)
        await page.setViewportSize({ width: 1280, height: 900 });

        // Se for um caminho de arquivo local ou uma URL do localhost apontando para assets, forçar FILE protocol
        let target = urlOrPath;
        
        // Normalizar caminhos locais
        const isLocalHost = typeof urlOrPath === 'string' && urlOrPath.includes('localhost:3000');
        if (isLocalHost) {
            const rel = urlOrPath.split('localhost:3000/')[1].replace(/^public\//, '');
            const localPath = path.resolve(process.cwd(), 'public', rel);
            if (fs.existsSync(localPath)) target = localPath;
        }

        if (!target.startsWith('http') && fs.existsSync(target)) {
            // Formato Windows compatível: file:///C:/path/to/file
            const absolutePath = path.resolve(target).replace(/\\/g, '/');
            target = `file:///${absolutePath}`;
        }

        console.log(`[ScreenshotService] Final Target: ${target}`);
        const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
        
        if (response && response.status() === 404) {
            console.warn(`[ScreenshotService] ⚠️ 404 DETECTED for target: ${target}`);
            const content = await page.content();
            console.log(`[ScreenshotService] Page Content Preview: ${content.slice(0, 500)}`);
        }
        
        // Esperar um pouco mais para garantir que charts (Chart.js/Recharts) renderizem as animações
        await page.waitForTimeout(5000);

        const debugDir = path.join(process.cwd(), "public", "debug");
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }

        const outputPath = path.join(debugDir, outputFilename);
        await page.screenshot({ path: outputPath, fullPage: false });
        
        console.log(`[ScreenshotService] Screenshot saved to: ${outputPath}`);
        return outputPath;
    } catch (err) {
        console.error(`[ScreenshotService] Error:`, err.message);
        throw err;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { takeScreenshot };
