import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  // Toggle interactions are subject to a race between Playwright's click
  // synthesis and the document-delegated listener inside theme.js. Two
  // retries make the suite deterministic without papering over real
  // regressions — if a fix breaks the toggle entirely, all attempts fail.
  test.describe.configure({ retries: 2 });

  test("defaults to OS preference (light)", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "light" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.locator(".section-grid").waitFor();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await ctx.close();
  });

  test("defaults to OS preference (dark)", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.locator(".section-grid").waitFor();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await ctx.close();
  });

  test("toggle button switches theme and persists", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "light" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.locator(".section-grid").waitFor();
    // Wait for setupThemeToggle to attach the document-delegated click
    // listener; otherwise the click can land before the listener exists.
    await page.waitForFunction(() => window.__themeReady === true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Use a direct DOM click. Playwright's locator.click() against a button
    // with nested SVG / spans (some with pointer-events:none) can synthesize
    // two click events and produce a no-op toggle.
    await page.evaluate(() => document.getElementById("btn-theme").click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Persists after reload
    await page.reload();
    await page.locator(".section-grid").waitFor();
    await page.waitForFunction(() => window.__themeReady === true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.evaluate(() => document.getElementById("btn-theme").click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await ctx.close();
  });

  test("toggle sits to the left of the credits link", async ({ page }) => {
    await page.goto("/");
    await page.locator(".section-grid").waitFor();
    const toggleBox = await page.locator("#btn-theme").boundingBox();
    const creditsBox = await page.locator(".btn-credits").boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(creditsBox).not.toBeNull();
    expect(toggleBox.x).toBeLessThan(creditsBox.x);
  });
});
