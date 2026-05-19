import { sections } from "./workflow.js";
import { setupInstallBanner } from "./install.js";
import { fitText } from "./fittext.js";
import { renderMarkdown, renderInlineMarkdown } from "./markdown.js";

let view = "home";
let currentSectionId = null;
let currentStep = 0;
let appVersion = "";
let inPopState = false;

const $ = (id) => document.getElementById(id);
const elFooter      = () => document.querySelector("footer");
const elWizardNav   = () => $("wizard-nav");
const elBtnChevron  = () => $("btn-chevron");

function tpl(id) {
  return $(id).content.cloneNode(true);
}

function renderHome() {
  document.body.classList.add("home");
  document.body.classList.remove("wizard", "credits");
  elBtnChevron().style.display = "none";
  elFooter().style.display = "none";
  $("home-header").style.display = "";

  const main = $("main-content");
  main.classList.add("home-view");

  const home = tpl("tpl-home");
  const grid = home.querySelector('[data-slot="grid"]');
  home.querySelector('[data-slot="version"]').textContent = appVersion ? "v" + appVersion : "";

  const creditsLink = home.querySelector(".btn-credits");
  if (creditsLink) {
    creditsLink.addEventListener("click", (e) => {
      e.preventDefault();
      goCredits();
    });
  }

  sections.forEach(s => {
    const node = tpl("tpl-section-card");
    const card = node.querySelector('[data-slot="card"]');
    card.id = `section-${s.id}`;
    const image = node.querySelector('[data-slot="image"]');
    image.style.setProperty("--c1", s.color[0]);
    image.style.setProperty("--c2", s.color[1]);
    const photo = node.querySelector('[data-slot="photo"]');
    if (s.cover) {
      photo.src = s.cover;
      photo.hidden = false;
    }
    node.querySelector('[data-slot="title"]').textContent = s.title;
    node.querySelector('[data-slot="steps"]').textContent =
      s.steps ? `${s.steps.length} steps` : "Coming soon";
    card.addEventListener("click", () => enterSection(s.id));
    grid.appendChild(node);
  });

  main.replaceChildren(home);
  main.appendChild($("install-banner"));
}

function renderSection() {
  document.body.classList.remove("home", "credits");
  document.body.classList.add("wizard");
  $("home-header").style.display = "none";
  elBtnChevron().style.display = "none";
  elFooter().style.display = "";

  const section = sections.find(s => s.id === currentSectionId);
  const main = $("main-content");
  main.classList.remove("home-view");

  if (!section.steps) {
    elWizardNav().style.display = "none";
    const wip = tpl("tpl-wip");
    wip.querySelector('[data-slot="title"]').textContent = section.title;
    main.replaceChildren(wip);
    return;
  }

  elWizardNav().style.display = "";

  const steps = section.steps;
  const total = steps.length;
  const stepIdx = Math.min(Math.max(currentStep, 0), total - 1);
  const step = steps[stepIdx];
  const isLast = stepIdx === total - 1;
  const gradient = `linear-gradient(90deg, ${section.color[0]}, ${section.color[1]})`;

  const node = tpl("tpl-wizard-step");
  node.querySelector('[data-slot="phase-title"]').textContent = section.title;
  node.querySelector('[data-slot="phase-subtitle"]').textContent = section.subtitle || "";

  // Step badge
  const badge = node.querySelector('[data-slot="step-badge"]');
  badge.style.background = gradient;
  badge.textContent = `Step ${stepIdx + 1} of ${total}`;

  // Step title + description
  node.querySelector('[data-slot="step-title"]').textContent = step.title;
  const desc = node.querySelector('[data-slot="step-description"]');
  if (step.description) {
    desc.innerHTML = renderMarkdown(step.description);
    desc.hidden = false;
  }

  // Extra block (optional)
  const extraSlot = node.querySelector('[data-slot="extra"]');
  if (step.extra) {
    const extra = tpl("tpl-wizard-extra");
    extra.querySelector('[data-slot="title"]').textContent = step.extra.title;
    const body = extra.querySelector('[data-slot="body"]');
    const extraDesc = step.extra.description;
    if (Array.isArray(extraDesc)) {
      const ul = document.createElement("ul");
      ul.className = "wizard-extra-list";
      extraDesc.forEach(d => {
        const li = document.createElement("li");
        li.innerHTML = renderInlineMarkdown(d);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    } else if (extraDesc) {
      const p = document.createElement("p");
      p.className = "wizard-extra-text";
      p.innerHTML = renderInlineMarkdown(extraDesc);
      body.appendChild(p);
    }
    extraSlot.replaceWith(extra);
  } else {
    extraSlot.remove();
  }

  main.replaceChildren(node);

  // Wire swipe gestures on the rendered card and seed the queue of peeks.
  const card = main.querySelector(".wizard-step-card");
  if (card) {
    const stack = card.closest(".wizard-stack");
    if (stack) renderStackPeeks(stack);
    attachSwipe(card);
  }

  // Bottom nav state
  $("btn-next-icon-heart").style.display = isLast ? "none" : "";
  $("btn-next-icon-check").style.display = isLast ? "" : "none";
}

async function renderCredits() {
  document.body.classList.remove("home", "wizard");
  document.body.classList.add("credits");
  $("home-header").style.display = "none";
  elBtnChevron().style.display = "";
  elFooter().style.display = "none";

  const main = $("main-content");
  main.classList.remove("home-view");

  const html = await fetch("html/credits.html").then(r => r.text());
  main.innerHTML = html;
}

function render() {
  if (view === "home") {
    renderHome();
  } else if (view === "credits") {
    renderCredits();
  } else {
    renderSection();
  }

  // After step→step swipes only: the previous peek-1 was lifted to <body>.
  // Fade it out to reveal the freshly rendered card behind.
  if (pendingLingeringPeek) {
    const peek = pendingLingeringPeek;
    pendingLingeringPeek = null;
    void peek.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        peek.style.opacity = "0";
      });
    });
    setTimeout(() => peek.remove(), FADE_DURATION + 100);
  }
}

// --- Hash routing ---
//
// Every navigable state (home, credits, each wizard step) is a real history
// entry. Forward navigation (Next, enter section, credits) pushes; backward
// navigation (X button, swipe-back, system back) calls history.back() and
// lets popstate sync state from the URL that comes back into view.
// applyHash seeds the full step ladder on cold-load so a deep link can be
// walked back step by step.

function hashForState() {
  if (view === "home") return "";
  if (view === "credits") return "credits";
  return `${currentSectionId}/${currentStep + 1}`;
}

function urlForState() {
  const h = hashForState();
  return h ? "#" + h : location.pathname + location.search;
}

function pushUrl() {
  history.pushState(
    { view, currentSectionId, currentStep },
    "",
    urlForState(),
  );
}

function replaceUrl() {
  history.replaceState(
    { view, currentSectionId, currentStep },
    "",
    urlForState(),
  );
}

function readHashIntoState() {
  const hash = location.hash.slice(1);
  if (!hash) {
    view = "home";
    currentSectionId = null;
    currentStep = 0;
    return;
  }
  if (hash === "credits") {
    view = "credits";
    currentSectionId = null;
    currentStep = 0;
    return;
  }
  const [sectionId, stepPart] = hash.split("/");
  const section = sections.find(s => s.id === sectionId);
  if (!section) {
    view = "home";
    currentSectionId = null;
    currentStep = 0;
    return;
  }
  view = "section";
  currentSectionId = sectionId;
  const n = parseInt(stepPart, 10);
  const max = section.steps ? section.steps.length - 1 : 0;
  currentStep = isNaN(n) ? 0 : Math.max(0, Math.min(n - 1, max));
}

// Initial route. After parsing the hash, seed a home anchor at the current
// cursor and then push every intermediate state entry up to the target.
// Result: browser back walks step → step → home naturally, even when the
// user landed via a bookmark or shared link.
function applyHash() {
  readHashIntoState();
  render();
  window.scrollTo(0, 0);

  if (view === "home") {
    replaceUrl();
    return;
  }

  const targetView = view;
  const targetSectionId = currentSectionId;
  const targetStep = currentStep;

  history.replaceState({ view: "home" }, "", location.pathname + location.search);

  if (targetView === "credits") {
    view = "credits"; currentSectionId = null; currentStep = 0;
    pushUrl();
    return;
  }

  for (let i = 0; i <= targetStep; i++) {
    view = "section";
    currentSectionId = targetSectionId;
    currentStep = i;
    pushUrl();
  }
}

// External hash change (address bar, in-page anchor that escaped our
// interceptors) that did NOT also fire popstate (rare on modern browsers,
// but kept as a fallback). popstate above handles the common case.
window.addEventListener("hashchange", () => {
  if (inPopState) return;
  if (location.hash.slice(1) === hashForState()) return;
  readHashIntoState();
  render();
  window.scrollTo(0, 0);
  if (view === "section" && currentStep > 0) seedStepLadder();
});

// Back gesture (Android system back, browser back, swipe-back) → step back
// in the wizard. Mirrors the X button: prev step, or home if on step 1.
// We only intercept when popstate landed on the home anchor (empty hash) —
// any other popstate means the URL was changed externally (address bar,
// test-driven navigation) and hashchange will handle it.
//
// After the pop, the cursor sits on the home-anchor entry. We must NOT
// replaceState here — that would overwrite the anchor and break the next
// back gesture. Instead, mutate state directly, render, then pushState the
// new wizard state on top so the trap is preserved.
// popstate fires for every back/forward. UI back-buttons also route here
// via history.back(). The URL is the source of truth — read it, sync state.
// If the entry lacks our state marker (external navigation via address bar
// or test framework) and lands mid-wizard, seed the missing step entries so
// the back gesture can still walk step by step.
window.addEventListener("popstate", (e) => {
  if (inPopState) return;
  inPopState = true;
  try {
    readHashIntoState();
    render();
    window.scrollTo(0, 0);
    const ours = e.state && typeof e.state.view === "string";
    if (!ours && view === "section" && currentStep > 0) {
      seedStepLadder();
    }
  } finally {
    inPopState = false;
  }
});

// Rewrite the current entry as section step 0, then push entries up to the
// current step. Called after detecting an external deep-link into a wizard.
function seedStepLadder() {
  const sectionId = currentSectionId;
  const targetStep = currentStep;
  currentStep = 0;
  replaceUrl();
  for (let i = 1; i <= targetStep; i++) {
    currentStep = i;
    pushUrl();
  }
  currentSectionId = sectionId;
}

// --- Navigation ---

function enterSection(id) {
  view = "section";
  currentSectionId = id;
  currentStep = 0;
  render();
  window.scrollTo(0, 0);
  pushUrl();
}

function goCredits() {
  view = "credits";
  currentSectionId = null;
  currentStep = 0;
  render();
  window.scrollTo(0, 0);
  pushUrl();
}

function goHome() {
  view = "home";
  currentSectionId = null;
  currentStep = 0;
  render();
  window.scrollTo(0, 0);
  pushUrl();
}

// Forward = push a new step entry. Backward = history.back(), which fires
// popstate and lets that handler sync state from the URL. This way X
// button, swipe-back, and system back all converge on the same code path.
export function navigate(dir) {
  const section = sections.find(s => s.id === currentSectionId);
  if (!section || !section.steps) return;

  if (dir < 0) {
    history.back();
    return;
  }

  if (currentStep >= section.steps.length - 1) {
    goHome();
    return;
  }
  currentStep += 1;
  render();
  window.scrollTo(0, 0);
  pushUrl();
}

// --- Swipe + animated transition ---
const SWIPE_THRESHOLD = 70;
const SWIPE_DURATION = 400;
const FADE_DURATION = 300;
let pendingLingeringPeek = null;

function isGoingHome(dir) {
  const section = sections.find(s => s.id === currentSectionId);
  if (!section || !section.steps) return false;
  if (dir > 0 && currentStep >= section.steps.length - 1) return true;
  if (dir < 0 && currentStep === 0) return true;
  return false;
}

function animateOutThenNavigate(card, dir) {
  if (!card || card.dataset.leaving) {
    navigate(dir);
    return;
  }
  card.dataset.leaving = "1";
  // dir > 0 (next) — card exits to the right; dir < 0 (back) — card exits to the left.
  const offset = dir > 0 ? window.innerWidth : -window.innerWidth;
  card.style.transform = `translateX(${offset}px)`;
  card.style.opacity = "0";

  // Advance the queue: peek-1 takes the active position, peek-2 takes peek-1's,
  // and peek-3 (if applicable) fills in at the back.
  const stack = card.closest(".wizard-stack");
  if (stack) {
    ensurePeek(stack, dir);
    ensurePeekDepth(stack, dir);
    setStackProgress(stack, 1);
  }

  // Cross-fade the peek onto the new card — but only when navigating between
  // steps. Skip for going-home transitions: the peek-check / peek-home can just
  // be wiped by the normal re-render.
  const goingHome = isGoingHome(dir);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (!goingHome) liftPeekToBody(stack);
    navigate(dir);
  };
  card.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, SWIPE_DURATION + 50);
}

// Move peek-1 out of the stack into <body> with fixed positioning so it
// survives the re-render and can cross-fade onto the new card.
function liftPeekToBody(stack) {
  if (!stack) return;
  const peek = stack.querySelector(".peek-1");
  if (!peek) return;
  const rect = peek.getBoundingClientRect();
  peek.style.position = "fixed";
  peek.style.left = rect.left + "px";
  peek.style.top = rect.top + "px";
  peek.style.width = rect.width + "px";
  peek.style.height = rect.height + "px";
  peek.style.transform = "none";
  peek.style.opacity = "1";
  peek.style.zIndex = "50";
  peek.style.pointerEvents = "none";
  peek.style.transition = `opacity ${FADE_DURATION}ms ease`;
  document.body.appendChild(peek);
  pendingLingeringPeek = peek;
}

function navigateAnimated(dir) {
  const card = document.querySelector(".wizard-step-card");
  if (!card) {
    navigate(dir);
    return;
  }
  animateOutThenNavigate(card, dir);
}

function clearActiveButtons() {
  $("btn-prev").classList.remove("is-active");
  $("btn-next").classList.remove("is-active");
}

function highlightForDelta(dx) {
  // Swipe right (dx > 0) = next; swipe left (dx < 0) = back.
  clearActiveButtons();
  if (dx > 0) $("btn-next").classList.add("is-active");
  else if (dx < 0) $("btn-prev").classList.add("is-active");
}

// --- Stack of peek cards behind the active card (queue effect) ---

function appendPeek(stack, tplId, layerClass) {
  const node = tpl(tplId);
  const peek = node.querySelector(".peek");
  peek.classList.add(layerClass);
  peek.dataset.tpl = tplId;
  stack.appendChild(node);
  return peek;
}

function renderStackPeeks(stack) {
  // Queue depth follows how many steps remain ahead. Capped at 2 peeks behind
  // the active card so the stack tops out at 3 visible cards.
  const section = sections.find(s => s.id === currentSectionId);
  if (!section || !section.steps) return;
  const remainingForward = section.steps.length - currentStep - 1;
  if (remainingForward >= 1) appendPeek(stack, "tpl-peek-skeleton", "peek-1");
  if (remainingForward >= 2) appendPeek(stack, "tpl-peek-skeleton", "peek-2");
}

// Swap peek-1's template when direction triggers a boundary case (going home).
function ensurePeek(stack, dir) {
  const section = sections.find(s => s.id === currentSectionId);
  const isLast = currentStep >= section.steps.length - 1;
  const isFirst = currentStep === 0;

  let tplId;
  if (dir > 0 && isLast) tplId = "tpl-peek-check";
  else if (dir < 0 && isFirst) tplId = "tpl-peek-home";
  else tplId = "tpl-peek-skeleton";

  const peek1 = stack.querySelector(".peek-1");
  if (peek1 && peek1.dataset.tpl === tplId) return peek1;
  if (peek1) peek1.remove();
  return appendPeek(stack, tplId, "peek-1");
}

// Decide whether a third peek should join the back of the queue during this drag.
// True when the destination step would itself still have a 2-peek queue (so the
// visible card count stays at 3 throughout the transition).
function shouldExtendQueue(dir) {
  const section = sections.find(s => s.id === currentSectionId);
  if (!section || !section.steps) return false;
  const total = section.steps.length;
  // Going-home cases land on the home view, no queue.
  if (dir > 0 && currentStep >= total - 1) return false;
  if (dir < 0 && currentStep === 0) return false;
  const newStep = currentStep + dir;
  const newRemainingForward = total - newStep - 1;
  return newRemainingForward >= 2;
}

function ensurePeekDepth(stack, dir) {
  const peek3 = stack.querySelector(".peek-3");
  if (shouldExtendQueue(dir)) {
    if (!peek3) appendPeek(stack, "tpl-peek-skeleton", "peek-3");
  } else if (peek3) {
    peek3.remove();
  }
}

// Animate the queue forward as the active card is swiped.
// progress 0 = idle, 1 = each peek slides up one slot.
function setStackProgress(stack, progress) {
  const p = Math.min(Math.max(progress, 0), 1);
  const peek1 = stack.querySelector(".peek-1");
  const peek2 = stack.querySelector(".peek-2");
  const peek3 = stack.querySelector(".peek-3");
  if (peek1) {
    const scale = 0.96 + 0.04 * p;
    const ty = -10 + 10 * p;
    const op = 0.7 + 0.3 * p;
    peek1.style.transform = `scale(${scale}) translateY(${ty}px)`;
    peek1.style.opacity = op.toFixed(3);
  }
  if (peek2) {
    const scale = 0.92 + 0.04 * p;
    const ty = -22 + 12 * p;
    const op = 0.4 + 0.3 * p;
    peek2.style.transform = `scale(${scale}) translateY(${ty}px)`;
    peek2.style.opacity = op.toFixed(3);
  }
  if (peek3) {
    const scale = 0.88 + 0.04 * p;
    const ty = -34 + 12 * p;
    const op = 0 + 0.4 * p;
    peek3.style.transform = `scale(${scale}) translateY(${ty}px)`;
    peek3.style.opacity = op.toFixed(3);
  }
}

function resetStackProgress(stack) {
  for (const sel of [".peek-1", ".peek-2", ".peek-3"]) {
    const peek = stack.querySelector(sel);
    if (peek) {
      peek.style.transform = "";
      peek.style.opacity = "";
    }
  }
}

function attachSwipe(card) {
  const stack = card.closest(".wizard-stack");
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let axisLocked = null; // "x" once we commit to horizontal

  card.addEventListener("pointerdown", (e) => {
    if (card.dataset.leaving) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dragging = true;
    axisLocked = null;
  });

  card.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const ax = e.clientX - startX;
    const ay = e.clientY - startY;
    if (axisLocked === null) {
      if (Math.abs(ax) < 6 && Math.abs(ay) < 6) return;
      axisLocked = Math.abs(ax) > Math.abs(ay) ? "x" : "y";
      if (axisLocked === "x") {
        card.classList.add("is-swiping");
        card.setPointerCapture(e.pointerId);
      } else {
        dragging = false;
        return;
      }
    }
    dx = ax;
    card.style.transform = `translateX(${dx}px)`;
    highlightForDelta(dx);

    if (stack && dx !== 0) {
      const dir = dx > 0 ? 1 : -1;
      ensurePeek(stack, dir);
      ensurePeekDepth(stack, dir);
      setStackProgress(stack, Math.abs(dx) / SWIPE_THRESHOLD);
    }
  });

  const release = () => {
    if (!dragging && !card.classList.contains("is-swiping")) return;
    dragging = false;
    card.classList.remove("is-swiping");
    clearActiveButtons();
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      const dir = dx > 0 ? 1 : -1;
      animateOutThenNavigate(card, dir);
    } else {
      card.style.transform = "";
      if (stack) resetStackProgress(stack);
    }
    dx = 0;
  };

  card.addEventListener("pointerup", release);
  card.addEventListener("pointercancel", release);
}

$("btn-prev").addEventListener("click", () => navigateAnimated(-1));
$("btn-next").addEventListener("click", () => navigateAnimated(1));
$("btn-restart").addEventListener("click", goHome);
$("btn-chevron").addEventListener("click", goHome);

setupInstallBanner();

fetch("manifest.json")
  .then(r => r.json())
  .then(m => {
    if (m.version) {
      appVersion = m.version;
      const el = $("app-version");
      if (el) el.textContent = "v" + appVersion;
    }
  })
  .catch(() => {});

if ("serviceWorker" in navigator) {
  // Only reload if a controller was already active before this page load.
  // That means a NEW service worker took over an existing client — i.e. a
  // version upgrade. The first-ever install also fires controllerchange,
  // but with no prior controller, so we skip the reload there.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  if (hadController) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  });
}

applyHash();

// Fit the home title to its container so it never overflows on narrow viewports.
// Wait for fonts to load first — measuring with the fallback font gives wrong widths.
function fitTitles() {
  const titleLine = document.querySelector(".title-line-top");
  const titleWord = document.querySelector(".title-word-dating");
  if (titleLine) fitText(titleLine, { maxFontSize: 137 });
  if (titleWord) fitText(titleWord, { maxFontSize: 280 });
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitTitles);
} else {
  fitTitles();
}
