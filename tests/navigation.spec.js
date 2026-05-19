import { test, expect } from "@playwright/test";

test.describe("Button navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#intro/1");
    await page.locator(".wizard-step-card:not(.peek)").waitFor();
  });

  test("next button is enabled on the first step", async ({ page }) => {
    await expect(page.locator("#btn-next")).toBeEnabled();
  });

  test("previous button is visible on the first step", async ({ page }) => {
    await expect(page.locator("#btn-prev")).toBeVisible();
  });

  test("previous button on first step returns to home", async ({ page }) => {
    await page.locator("#btn-prev").click();
    await page.locator(".section-grid").waitFor();
    await expect(page).toHaveURL(/\/#?$|\/$/);
  });

  test("clicking next goes to the next step", async ({ page }) => {
    await page.locator("#btn-next").click();
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 2");
  });

  test("previous goes back a step after first step", async ({ page }) => {
    await page.locator("#btn-next").click();
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 2");
    await page.locator("#btn-prev").click();
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 1");
  });

  test("restart button returns to home from any step", async ({ page }) => {
    await page.goto("/#intro/3");
    await page.locator(".wizard-step-card:not(.peek)").waitFor();
    await page.locator("#btn-restart").click();
    await page.locator(".section-grid").waitFor();
    await expect(page).toHaveURL(/\/#?$|\/$/);
  });

  test("last step next button returns to home", async ({ page }) => {
    // meeting has 8 steps; jump to last
    await page.goto("/#meeting/8");
    await page.locator(".wizard-step-card:not(.peek)").waitFor();
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 8 of 8");
    await page.locator("#btn-next").click();
    await page.locator(".section-grid").waitFor();
    await expect(page).toHaveURL(/\/#?$|\/$/);
  });
});

test.describe("Browser back gesture", () => {
  test("back from a wizard step goes to the previous step, not previous URL", async ({ page }) => {
    // Visit two unrelated phase steps so browser history has multiple entries.
    await page.goto("/#intro/1");
    await page.locator(".wizard-step-card:not(.peek)").waitFor();
    await page.goto("/#meeting/3");
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 3 of 8");
    // System back should step *within* the current wizard, not jump back to
    // the previously-visited URL (#intro/1).
    await page.goBack();
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 2 of 8");
    await page.goBack();
    await expect(page.locator(".wizard-step-badge")).toContainText("Step 1 of 8");
  });

  test("back from step 1 returns home", async ({ page }) => {
    await page.goto("/#meeting/1");
    await page.locator(".wizard-step-card:not(.peek)").waitFor();
    await page.goBack();
    await page.locator(".section-grid").waitFor();
    await expect(page).toHaveURL(/\/#?$|\/$/);
  });

  test("back from credits returns home", async ({ page }) => {
    await page.goto("/");
    await page.locator(".btn-credits").click();
    await page.locator(".credits-content, .credits, h2").first().waitFor().catch(() => {});
    await page.goBack();
    await page.locator(".section-grid").waitFor();
  });
});
