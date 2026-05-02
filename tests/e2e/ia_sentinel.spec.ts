import { test, expect } from "@playwright/test";
import WebSocket from "ws";

test.describe("IA-Sentinel Ecosystem Watchdog", () => {
    
    test("Portal Health: /catalog should load and show properties", async ({ page }) => {
        await page.goto("/catalog");
        await expect(page).toHaveTitle(/IAmobil/);
        
        // Wait for properties to load from API
        const propertyCards = page.locator('.group.relative.flex.flex-col');
        await expect(propertyCards.first()).toBeVisible({ timeout: 10000 });
        
        const count = await propertyCards.count();
        console.log(`[Sentinel] Catalog OK. Found ${count} properties.`);
        expect(count).toBeGreaterThan(0);
    });

    test("API Health: /api/catalog returns JSON data", async ({ request }) => {
        const response = await request.get("/api/catalog");
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.properties).toBeDefined();
        expect(Array.isArray(data.properties)).toBeTruthy();
    });

    test("Agent Adapter Health: WebSocket 18789 is listening", async () => {
        const ws = new WebSocket("ws://127.0.0.1:18789");
        const connected = await new Promise((resolve) => {
            ws.on('open', () => { 
                ws.close();
                resolve(true); 
            });
            ws.on('error', () => resolve(false));
            setTimeout(() => resolve(false), 5000);
        });
        
        console.log(`[Sentinel] AI Adapter: ${connected ? "ONLINE" : "OFFLINE"}`);
        expect(connected).toBeTruthy();
    });

    test("Lead Management: /api/leads is operational", async ({ request }) => {
        const response = await request.get("/api/leads");
        expect(response.ok()).toBeTruthy();
    });

});
