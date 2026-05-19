import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
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
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const toggle = page.locator("#btn-theme");
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Persists after reload
    await page.reload();
    await page.locator(".section-grid").waitFor();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Toggle back to light
    await page.locator("#btn-theme").click();
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
