(() => {
  "use strict";

  const form = document.querySelector("#dump-form");
  const textarea = document.querySelector("#dump-text");
  const button = document.querySelector("#dump-button");
  const buttonLabel = button.querySelector(".dump-button__label");
  const card = document.querySelector(".dump-card");
  const status = document.querySelector("#dump-status");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const collectionScene = window.DumppitTruck?.mount(document.querySelector("#street-canvas"));

  let isDumping = false;

  const updateComposer = () => {
    const hasText = textarea.value.length > 0;
    textarea.classList.toggle("is-empty", !hasText);
    button.disabled = isDumping || textarea.value.trim().length === 0;
  };

  const animateDump = async (text) => {
    textarea.value = "";
    textarea.disabled = true;
    updateComposer();
    card.classList.add("is-dumping");
    buttonLabel.textContent = "On the way";

    if (collectionScene) {
      await collectionScene.collect(text);
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, reduceMotion.matches ? 250 : 1200));
    }

    card.classList.remove("is-dumping");
    card.classList.add("is-returning");
    buttonLabel.textContent = "Call the truck";
    status.textContent = "Collected. It is gone and was not saved.";
    textarea.disabled = false;

    window.setTimeout(() => {
      card.classList.remove("is-returning");
      isDumping = false;
      updateComposer();
      textarea.focus({ preventScroll: true });
    }, reduceMotion.matches ? 20 : 700);
  };

  textarea.addEventListener("input", updateComposer);

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = textarea.value.trim();
    if (!text || isDumping) {
      return;
    }

    isDumping = true;
    updateComposer();
    void animateDump(text);
  });

  updateComposer();
  window.requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
})();
