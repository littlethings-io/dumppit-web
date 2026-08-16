(() => {
  "use strict";

  const form = document.querySelector("#dump-form");
  const textarea = document.querySelector("#dump-text");
  const button = document.querySelector("#dump-button");
  const buttonLabel = button.querySelector(".dump-button__label");
  const card = document.querySelector(".dump-card");
  const status = document.querySelector("#dump-status");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let isDumping = false;

  const updateComposer = () => {
    const hasText = textarea.value.length > 0;
    textarea.classList.toggle("is-empty", !hasText);
    button.disabled = isDumping || textarea.value.trim().length === 0;
  };

  const animateDump = async (text) => {
    const source = textarea.getBoundingClientRect();
    const startX = source.left + source.width / 2;
    const startY = source.top + source.height / 2;

    const flight = document.createElement("p");
    flight.className = "dump-flight";
    flight.textContent = text;
    flight.setAttribute("aria-hidden", "true");
    flight.style.left = `${startX}px`;
    flight.style.top = `${startY}px`;
    flight.style.width = `${source.width}px`;
    document.body.append(flight);

    textarea.value = "";
    textarea.disabled = true;
    updateComposer();
    card.classList.add("is-dumping");
    buttonLabel.textContent = "Dumping";

    const duration = reduceMotion.matches ? 350 : 1550;
    const keyframes = reduceMotion.matches
      ? [
          { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
          { opacity: 0, transform: "translate(-50%, -50%) scale(0.8)" }
        ]
      : [
          {
            opacity: 1,
            color: "#f4f0e8",
            filter: "blur(0)",
            transform: "translate(-50%, -50%) rotate(0deg) scale(1)"
          },
          {
            offset: 0.3,
            opacity: 0.94,
            color: "#f4f0e8",
            transform: "translate(-50%, -50%) rotate(90deg) scale(0.9)"
          },
          {
            offset: 0.7,
            opacity: 0.48,
            color: "#d9d5ce",
            filter: "blur(2px)",
            transform: "translate(-50%, -50%) rotate(270deg) scale(0.32)"
          },
          {
            opacity: 0,
            filter: "blur(8px)",
            transform: "translate(-50%, -50%) rotate(540deg) scale(0.015)"
          }
        ];

    const animation = flight.animate(keyframes, {
      duration,
      easing: "cubic-bezier(0.58, 0.04, 0.36, 1)",
      fill: "forwards"
    });

    await animation.finished.catch(() => undefined);
    flight.remove();

    if (!reduceMotion.matches) {
      await new Promise((resolve) => window.setTimeout(resolve, 640));
    }

    card.classList.remove("is-dumping");
    card.classList.add("is-returning");
    buttonLabel.textContent = "Dump";
    status.textContent = "Dumped. It is gone and was not saved.";
    textarea.disabled = false;

    window.setTimeout(() => {
      card.classList.remove("is-returning");
      isDumping = false;
      updateComposer();
      textarea.focus({ preventScroll: true });
    }, reduceMotion.matches ? 20 : 600);
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
