(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const GLYPHS = [
    "why?", "whatever", "I tried", "enough", "tomorrow", "too much",
    "not today", "let go", "maybe", "again", "...", "?", "!", "#",
    "@", "∞", "→", "○", "△", "×", "~", "*"
  ];

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const seeded = (seed) => {
    const value = Math.sin(seed * 91.733) * 43758.5453;
    return value - Math.floor(value);
  };

  class ProceduralVoid {
    constructor(canvas, context) {
      this.canvas = canvas;
      this.context = context;
      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.staticPreview = new URLSearchParams(window.location.search).has("static-preview");
      this.rings = this.createRings();
      this.specks = this.createSpecks();
      this.echoes = [];
      this.width = 0;
      this.height = 0;

      this.resize = this.resize.bind(this);
      this.render = this.render.bind(this);

      this.resize();

      if (this.staticPreview) {
        this.render(performance.now());
      } else {
        if ("ResizeObserver" in window) {
          this.resizeObserver = new ResizeObserver(this.resize);
          this.resizeObserver.observe(canvas);
        } else {
          window.addEventListener("resize", this.resize);
        }
        window.requestAnimationFrame(this.render);
      }
    }

    createRings() {
      const definitions = [
        { radius: 0.18, count: 8, font: 0.023, speed: 0.048, alpha: 0.30 },
        { radius: 0.235, count: 11, font: 0.021, speed: 0.040, alpha: 0.38 },
        { radius: 0.29, count: 14, font: 0.019, speed: 0.033, alpha: 0.44 },
        { radius: 0.345, count: 17, font: 0.017, speed: 0.027, alpha: 0.37 },
        { radius: 0.39, count: 20, font: 0.015, speed: 0.021, alpha: 0.28 }
      ];

      return definitions.map((definition, ringIndex) => ({
        ...definition,
        phase: seeded(ringIndex + 1) * TAU,
        tokens: Array.from({ length: definition.count }, (_, tokenIndex) => ({
          angle: (tokenIndex / definition.count) * TAU,
          text: GLYPHS[(tokenIndex * 3 + ringIndex * 5) % GLYPHS.length],
          scale: 0.82 + seeded(ringIndex * 100 + tokenIndex) * 0.36,
          alpha: 0.72 + seeded(ringIndex * 200 + tokenIndex) * 0.28
        }))
      }));
    }

    createSpecks() {
      return Array.from({ length: 110 }, (_, index) => ({
        angle: seeded(index + 500) * TAU,
        radius: 0.16 + seeded(index + 700) * 0.31,
        size: 0.45 + seeded(index + 900) * 1.2,
        alpha: 0.07 + seeded(index + 1100) * 0.16,
        speed: 0.012 + seeded(index + 1300) * 0.025
      }));
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);

      this.width = Math.max(1, bounds.width);
      this.height = Math.max(1, bounds.height);
      this.canvas.width = Math.round(this.width * pixelRatio);
      this.canvas.height = Math.round(this.height * pixelRatio);
      this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    absorb(text) {
      const echo = text.replace(/\s+/g, " ").trim().slice(0, 100);
      if (!echo) {
        return;
      }

      this.echoes.push({
        text: echo,
        born: performance.now(),
        life: this.reduceMotion.matches ? 900 : 2800,
        angle: seeded(performance.now()) * TAU
      });
    }

    drawBackground(size, centerX, centerY) {
      const gradient = this.context.createRadialGradient(
        centerX,
        centerY,
        size * 0.07,
        centerX,
        centerY,
        size * 0.5
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
      gradient.addColorStop(0.29, "rgba(1, 1, 1, 0.99)");
      gradient.addColorStop(0.62, "rgba(8, 8, 8, 0.52)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      this.context.fillStyle = gradient;
      this.context.fillRect(0, 0, this.width, this.height);
    }

    drawSpecks(size, centerX, centerY, elapsed) {
      this.context.save();

      for (const speck of this.specks) {
        const angle = speck.angle + elapsed * speck.speed;
        const radius = size * speck.radius;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        this.context.beginPath();
        this.context.arc(x, y, speck.size, 0, TAU);
        this.context.fillStyle = `rgba(218, 214, 207, ${speck.alpha})`;
        this.context.fill();
      }

      this.context.restore();
    }

    drawRings(size, centerX, centerY, elapsed) {
      const motion = this.reduceMotion.matches ? 0.12 : 1;

      for (const ring of this.rings) {
        const phase = ring.phase + elapsed * ring.speed * motion;
        const radius = size * ring.radius;

        this.context.save();
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius, 0, TAU);
        this.context.strokeStyle = `rgba(214, 209, 201, ${ring.alpha * 0.08})`;
        this.context.lineWidth = 0.7;
        this.context.stroke();
        this.context.restore();

        for (const token of ring.tokens) {
          const angle = phase + token.angle;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const shimmer = 0.82 + Math.sin(elapsed * 0.7 + token.angle * 2) * 0.18;
          const fontSize = Math.max(8, size * ring.font * token.scale);

          this.context.save();
          this.context.translate(x, y);
          this.context.rotate(angle + Math.PI / 2);
          this.context.font = `${fontSize}px "Segoe Print", "Bradley Hand", cursive`;
          this.context.textAlign = "center";
          this.context.textBaseline = "middle";
          this.context.fillStyle = `rgba(225, 221, 214, ${ring.alpha * token.alpha * shimmer})`;
          this.context.shadowColor = `rgba(255, 255, 255, ${ring.alpha * 0.12})`;
          this.context.shadowBlur = 4;
          this.context.fillText(token.text, 0, 0);
          this.context.restore();
        }
      }
    }

    drawEchoes(size, centerX, centerY, now) {
      this.echoes = this.echoes.filter((echo) => {
        const progress = (now - echo.born) / echo.life;
        if (progress >= 1) {
          return false;
        }

        const angle = echo.angle + progress * TAU * 0.36;
        const radius = size * (0.21 + progress * 0.07);
        const alpha = Math.sin(progress * Math.PI) * 0.5;
        const scale = 0.92 - progress * 0.34;

        this.context.save();
        this.context.translate(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius
        );
        this.context.rotate(angle + Math.PI / 2);
        this.context.font = `${Math.max(10, size * 0.019 * scale)}px "Segoe Print", "Bradley Hand", cursive`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";
        this.context.fillStyle = `rgba(238, 233, 224, ${alpha})`;
        this.context.shadowColor = `rgba(255, 255, 255, ${alpha * 0.3})`;
        this.context.shadowBlur = 7;
        this.context.fillText(echo.text, 0, 0, size * 0.32);
        this.context.restore();

        return true;
      });
    }

    drawCenter(size, centerX, centerY) {
      const center = this.context.createRadialGradient(
        centerX - size * 0.012,
        centerY - size * 0.015,
        0,
        centerX,
        centerY,
        size * 0.19
      );
      center.addColorStop(0, "rgba(0, 0, 0, 1)");
      center.addColorStop(0.62, "rgba(0, 0, 0, 1)");
      center.addColorStop(0.84, "rgba(0, 0, 0, 0.94)");
      center.addColorStop(1, "rgba(0, 0, 0, 0)");

      this.context.fillStyle = center;
      this.context.beginPath();
      this.context.arc(centerX, centerY, size * 0.2, 0, TAU);
      this.context.fill();
    }

    render(now) {
      const elapsed = now / 1000;
      const size = Math.min(this.width, this.height);
      const centerX = this.width / 2;
      const centerY = this.height / 2;

      this.context.clearRect(0, 0, this.width, this.height);
      this.drawBackground(size, centerX, centerY);
      this.drawSpecks(size, centerX, centerY, elapsed);
      this.drawRings(size, centerX, centerY, elapsed);
      this.drawCenter(size, centerX, centerY);
      this.drawEchoes(size, centerX, centerY, now);

      if (!this.staticPreview) {
        window.requestAnimationFrame(this.render);
      }
    }
  }

  window.DumppitVoid = {
    mount(canvas) {
      if (!canvas || !canvas.getContext) {
        return null;
      }

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) {
        return null;
      }

      return new ProceduralVoid(canvas, context);
    }
  };
})();
