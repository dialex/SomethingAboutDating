function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function populateModalSteps() {
  const file = isIos() ? "html/install-ios.html" : "html/install-android.html";
  const html = await fetch(file).then(r => r.text());
  document.getElementById("modal-steps").innerHTML = html;
}

export function setupInstallBanner() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || navigator.standalone === true;

  if (isStandalone) return;

  const banner   = document.getElementById("install-banner");
  const dismiss  = document.getElementById("btn-dismiss-banner");
  const modal    = document.getElementById("install-modal");
  const modalClose = document.getElementById("btn-modal-close");

  banner.style.display = "flex";

  function dismissBanner() {
    banner.style.display = "none";
  }

  function openModal() {
    populateModalSteps();
    modal.classList.remove("hidden");
  }

  function closeModal(e) {
    if (!e || e.target === modal) {
      modal.classList.add("hidden");
    }
  }

  banner.addEventListener("click", (e) => {
    if (dismiss.contains(e.target)) return;
    openModal();
  });

  dismiss.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissBanner();
  });

  modal.addEventListener("click", closeModal);
  modalClose.addEventListener("click", () => modal.classList.add("hidden"));

  window.addEventListener("appinstalled", dismissBanner);
}
