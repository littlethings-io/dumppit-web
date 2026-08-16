(() => {
  "use strict";

  const form = document.querySelector("#dump-form");
  const textarea = document.querySelector("#dump-text");
  const button = document.querySelector("#dump-button");
  const buttonLabel = button.querySelector(".dump-button__label");
  const counter = document.querySelector("#character-count");
  const card = document.querySelector(".dump-card");
  const voidElement = document.querySelector(".void");
  const status = document.querySelector("#dump-status");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let isDumping = false;

  const updateComposer = () => {
    const length = textarea.value.length;
    if (counter) {
      counter.textContent = `${length} / ${textarea.maxLength}`;
    }
    button.disabled = isDumping || textarea.value.trim().length === 0;
  };

  const makeParticles = (startX, startY, targetX, targetY) => {
    if (reduceMotion.matches) {
      return [];
    }

    return Array.from({ length: 14 }, (_, index) => {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * index) / 14;
      const radius = 24 + Math.random() * 60;
      const bendX = Math.cos(angle) * radius;
      const bendY = Math.sin(angle) * radius;

      particle.className = "dump-particle";
      particle.style.left = `${startX}px`;
      particle.style.top = `${startY}px`;
      document.body.append(particle);

      const animation = particle.animate(
        [
          {
            opacity: 0,
            transform: "translate(-50%, -50%) scale(0.2)"
          },
          {
            offset: 0.18,
            opacity: 0.9,
            transform: `translate(calc(-50% + ${bendX}px), calc(-50% + ${bendY}px)) scale(1)`
          },
          {
            opacity: 0,
            transform: `translate(calc(-50% + ${targetX - startX}px), calc(-50% + ${targetY - startY}px)) scale(0.1)`
          }
        ],
        {
          duration: 1050 + Math.random() * 450,
          delay: 100 + index * 24,
          easing: "cubic-bezier(0.55, 0, 0.35, 1)",
          fill: "forwards"
        }
      );

      animation.finished.finally(() => particle.remove());
      return animation;
    });
  };

  const animateDump = async (text) => {
    const source = textarea.getBoundingClientRect();
    const target = voidElement.getBoundingClientRect();
    const startX = source.left + source.width / 2;
    const startY = source.top + Math.min(source.height / 2, 72);
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    const orbit = Math.min(130, Math.max(72, window.innerWidth * 0.12));

    const flight = document.createElement("p");
    flight.className = "dump-flight";
    flight.textContent = text;
    flight.setAttribute("aria-hidden", "true");
    flight.style.left = `${startX}px`;
    flight.style.top = `${startY}px`;
    flight.style.width = `${Math.min(source.width - 32, 410)}px`;
    document.body.append(flight);

    textarea.value = "";
    textarea.disabled = true;
    updateComposer();
    document.body.classList.add("is-dumping");
    card.classList.add("is-dumping");
    buttonLabel.textContent = "Dumping";

    makeParticles(startX, startY, targetX, targetY);

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
            offset: 0.2,
            opacity: 1,
            color: "#f4f0e8",
            transform: `translate(calc(-50% + ${deltaX * 0.16}px), calc(-50% + ${deltaY * 0.16 - 36}px)) rotate(-4deg) scale(0.94)`
          },
          {
            offset: 0.48,
            opacity: 0.82,
            color: "#ffc27e",
            transform: `translate(calc(-50% + ${deltaX * 0.52 + orbit}px), calc(-50% + ${deltaY * 0.52 - orbit * 0.4}px)) rotate(72deg) scale(0.58)`
          },
          {
            offset: 0.74,
            opacity: 0.56,
            filter: "blur(1px)",
            transform: `translate(calc(-50% + ${deltaX * 0.78 - orbit * 0.55}px), calc(-50% + ${deltaY * 0.78 + orbit * 0.26}px)) rotate(220deg) scale(0.24)`
          },
          {
            opacity: 0,
            filter: "blur(6px)",
            transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) rotate(520deg) scale(0.015)`
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

    document.body.classList.remove("is-dumping");
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
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
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
})();
