import { test, expect } from "@playwright/test";

// These tests inject a temporary section at runtime so they don't depend on the
// real workflow content, which can change. They verify the markdown subset that
// step.description supports: paragraphs, bullet lists, bold, italic.

async function loadWithFixture(page, description, tips = null) {
  await page.addInitScript((data) => {
    window.__fixtureDescription = data.description;
    window.__fixtureTips = data.tips;
  }, { description, tips });

  await page.goto("/");

  await page.evaluate(async () => {
    const mod = await import("/js/workflow.js");
    const step = {
      id: "only",
      title: "Markdown fixture",
      description: window.__fixtureDescription,
    };
    if (window.__fixtureTips) {
      step.extra = { title: "Tips", description: window.__fixtureTips };
    }
    mod.sections.unshift({
      id: "mdfix",
      title: "MDFix",
      subtitle: "",
      color: ["#000", "#000"],
      steps: [step],
    });
    location.hash = "mdfix/1";
  });

  await page.locator(".wizard-step-card:not(.peek)").waitFor();
}

test.describe("Markdown in step description", () => {
  test("renders a bullet list from lines starting with - ", async ({ page }) => {
    await loadWithFixture(page, `Intro line.
- First item
- Second item
- Third item`);

    const desc = page.locator('[data-slot="step-description"]');
    await expect(desc.locator("ul li")).toHaveCount(3);
    await expect(desc.locator("ul li").nth(0)).toHaveText("First item");
    await expect(desc.locator("ul li").nth(2)).toHaveText("Third item");
    await expect(desc.locator("p")).toHaveText("Intro line.");
  });

  test("renders **bold** as <strong>", async ({ page }) => {
    await loadWithFixture(page, "This is **important** stuff.");
    const desc = page.locator('[data-slot="step-description"]');
    await expect(desc.locator("strong")).toHaveText("important");
  });

  test("renders *italic* as <em>", async ({ page }) => {
    await loadWithFixture(page, "This is *subtle* stuff.");
    const desc = page.locator('[data-slot="step-description"]');
    await expect(desc.locator("em")).toHaveText("subtle");
  });

  test("supports inline markdown inside list items", async ({ page }) => {
    await loadWithFixture(page, `- A **bold** point
- An *italic* point`);
    const desc = page.locator('[data-slot="step-description"]');
    await expect(desc.locator("li strong")).toHaveText("bold");
    await expect(desc.locator("li em")).toHaveText("italic");
  });

  test("escapes raw HTML so tags in source do not render as elements", async ({ page }) => {
    await loadWithFixture(page, "Hello <script>alert(1)</script> world");
    const desc = page.locator('[data-slot="step-description"]');
    await expect(desc.locator("script")).toHaveCount(0);
    await expect(desc).toContainText("<script>");
  });

  test("plain string with no markdown still renders as a paragraph", async ({ page }) => {
    await loadWithFixture(page, "Just a plain sentence.");
    const desc = page.locator('[data-slot="step-description"]');
    await expect(desc.locator("p")).toHaveText("Just a plain sentence.");
    await expect(desc.locator("ul")).toHaveCount(0);
  });

  test("tips support **bold** and *italic*", async ({ page }) => {
    await loadWithFixture(page, "Header.", [
      "First tip with **bold** word.",
      "Second tip with *italic* word.",
    ]);
    const tips = page.locator(".wizard-extra-list");
    await expect(tips.locator("li strong")).toHaveText("bold");
    await expect(tips.locator("li em")).toHaveText("italic");
  });

  test("tips escape raw HTML", async ({ page }) => {
    await loadWithFixture(page, "Header.", ["<script>alert(1)</script> safe"]);
    const tips = page.locator(".wizard-extra-list");
    await expect(tips.locator("script")).toHaveCount(0);
    await expect(tips.locator("li")).toContainText("<script>");
  });
});
