(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const VARIANTS = ["worker", "arm", "toss", "vacuum"];

  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const range = (value, start, end) => clamp((value - start) / (end - start));
  const ease = (progress) => 1 - Math.pow(1 - clamp(progress), 3);
  const easeBoth = (progress) => {
    const value = clamp(progress);
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  };
  const pulse = (progress, start, peak, end) => {
    if (progress <= start || progress >= end) {
      return 0;
    }
    return progress < peak
      ? range(progress, start, peak)
      : 1 - range(progress, peak, end);
  };
  const seeded = (seed) => {
    const value = Math.sin(seed * 91.733) * 43758.5453;
    return value - Math.floor(value);
  };

  class GarbageTruckScene {
    constructor(canvas, context) {
      this.canvas = canvas;
      this.context = context;
      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.parameters = new URLSearchParams(window.location.search);
      this.staticPreview = this.parameters.has("static-preview");
      this.sequence = null;
      this.lastVariant = "";
      this.width = 0;
      this.height = 0;
      this.stars = Array.from({ length: 76 }, (_, index) => ({
        x: seeded(index + 20),
        y: seeded(index + 120) * 0.55,
        radius: 0.35 + seeded(index + 220) * 1.1,
        alpha: 0.08 + seeded(index + 320) * 0.28
      }));
      this.houses = Array.from({ length: 14 }, (_, index) => ({
        width: 0.075 + seeded(index + 520) * 0.045,
        height: 0.13 + seeded(index + 620) * 0.12,
        roof: seeded(index + 720) > 0.38,
        light: seeded(index + 820) > 0.66
      }));

      this.resize = this.resize.bind(this);
      this.render = this.render.bind(this);
      this.resize();

      if (this.staticPreview) {
        const requested = this.parameters.get("static-preview");
        const variant = VARIANTS.includes(requested) ? requested : "worker";
        this.sequence = {
          text: "leave it here",
          variant,
          start: performance.now() - 5200,
          duration: 10000,
          resolve: null,
          preview: true
        };
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

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
      this.width = Math.max(1, bounds.width);
      this.height = Math.max(1, bounds.height);
      this.canvas.width = Math.round(this.width * pixelRatio);
      this.canvas.height = Math.round(this.height * pixelRatio);
      this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      if (this.staticPreview) {
        this.render(performance.now());
      }
    }

    collect(text) {
      if (this.sequence) {
        return Promise.resolve();
      }

      const choices = VARIANTS.filter((variant) => variant !== this.lastVariant);
      const variant = choices[Math.floor(Math.random() * choices.length)];
      this.lastVariant = variant;

      return new Promise((resolve) => {
        this.sequence = {
          text: text.replace(/\s+/g, " ").trim().slice(0, 140),
          variant,
          start: performance.now(),
          duration: this.reduceMotion.matches ? 3600 : 10000,
          resolve,
          preview: false
        };
      });
    }

    getLayout() {
      const narrow = this.width < 650;
      const groundY = this.height * (narrow ? 0.79 : 0.76);
      const truckWidth = clamp(this.width * (narrow ? 0.74 : 0.34), 260, 460);
      const binWidth = clamp(this.width * (narrow ? 0.105 : 0.05), 38, 68);
      const binX = this.width * (narrow ? 0.80 : 0.79);
      const stopX = binX - truckWidth * 0.92;

      return {
        narrow,
        groundY,
        truckWidth,
        truckHeight: truckWidth * 0.43,
        binWidth,
        binX,
        stopX,
        incomingX: this.width / 2,
        incomingY: this.height * (narrow ? 0.36 : 0.40)
      };
    }

    drawSky(now) {
      const context = this.context;
      const gradient = context.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#000000");
      gradient.addColorStop(0.14, "#000000");
      gradient.addColorStop(0.55, "#101615");
      gradient.addColorStop(1, "#171914");
      context.fillStyle = gradient;
      context.fillRect(0, 0, this.width, this.height);

      const moonX = this.width * 0.13;
      const moonY = this.height * 0.18;
      const moonRadius = clamp(Math.min(this.width, this.height) * 0.04, 19, 44);
      const glow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 3.8);
      glow.addColorStop(0, "rgba(228, 220, 191, 0.18)");
      glow.addColorStop(0.3, "rgba(206, 198, 171, 0.07)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(moonX - moonRadius * 4, moonY - moonRadius * 4, moonRadius * 8, moonRadius * 8);
      context.beginPath();
      context.arc(moonX, moonY, moonRadius, 0, TAU);
      context.fillStyle = "rgba(215, 209, 184, 0.34)";
      context.fill();
      context.beginPath();
      context.arc(moonX + moonRadius * 0.34, moonY - moonRadius * 0.12, moonRadius * 0.9, 0, TAU);
      context.fillStyle = "#080c0d";
      context.fill();

      for (let index = 0; index < this.stars.length; index += 1) {
        const star = this.stars[index];
        if (star.y < 0.14 && star.x > 0.34 && star.x < 0.66) {
          continue;
        }
        const shimmer = 0.78 + Math.sin(now * 0.0007 + index * 2.1) * 0.22;
        context.beginPath();
        context.arc(star.x * this.width, star.y * this.height, star.radius, 0, TAU);
        context.fillStyle = `rgba(228, 223, 205, ${star.alpha * shimmer})`;
        context.fill();
      }
    }

    drawNeighbourhood(layout) {
      const context = this.context;
      const baseY = layout.groundY - this.height * 0.09;
      let x = -this.width * 0.02;

      for (let index = 0; x < this.width * 1.03; index += 1) {
        const house = this.houses[index % this.houses.length];
        const width = house.width * this.width;
        const height = house.height * this.height;
        const top = baseY - height;

        context.fillStyle = index % 2 ? "#111715" : "#0d1312";
        context.fillRect(x, top, width, height);

        if (house.roof) {
          context.beginPath();
          context.moveTo(x - width * 0.08, top);
          context.lineTo(x + width * 0.5, top - height * 0.22);
          context.lineTo(x + width * 1.08, top);
          context.closePath();
          context.fillStyle = "#0b100f";
          context.fill();
        }

        const windowSize = clamp(width * 0.12, 4, 10);
        for (let row = 0; row < 2; row += 1) {
          for (let column = 0; column < 2; column += 1) {
            const lit = house.light && (row + column + index) % 3 === 0;
            context.fillStyle = lit ? "rgba(220, 166, 82, 0.22)" : "rgba(1, 5, 5, 0.52)";
            context.fillRect(
              x + width * (0.22 + column * 0.42),
              top + height * (0.27 + row * 0.34),
              windowSize,
              windowSize * 1.35
            );
          }
        }

        x += width * 0.94;
      }
    }

    drawStreet(layout) {
      const context = this.context;
      const sidewalkTop = layout.groundY - this.height * 0.075;
      const roadGradient = context.createLinearGradient(0, sidewalkTop, 0, this.height);
      roadGradient.addColorStop(0, "#252620");
      roadGradient.addColorStop(0.18, "#121512");
      roadGradient.addColorStop(1, "#080a09");
      context.fillStyle = roadGradient;
      context.fillRect(0, sidewalkTop, this.width, this.height - sidewalkTop);

      context.fillStyle = "#313129";
      context.fillRect(0, sidewalkTop, this.width, this.height * 0.04);
      context.fillStyle = "#1d1f1b";
      context.fillRect(0, sidewalkTop + this.height * 0.04, this.width, this.height * 0.018);
      context.fillStyle = "rgba(231, 201, 133, 0.11)";
      context.fillRect(0, sidewalkTop + this.height * 0.058, this.width, 1);

      const roadLineY = this.height * 0.91;
      context.fillStyle = "rgba(218, 195, 132, 0.13)";
      const segmentWidth = clamp(this.width * 0.075, 48, 118);
      const gap = segmentWidth * 0.75;
      for (let x = -segmentWidth; x < this.width + segmentWidth; x += segmentWidth + gap) {
        context.fillRect(x, roadLineY, segmentWidth, clamp(this.height * 0.006, 3, 7));
      }

      const lampX = this.width * 0.21;
      const lampTop = layout.groundY - clamp(this.height * 0.34, 150, 300);
      context.strokeStyle = "#202621";
      context.lineWidth = clamp(this.width * 0.004, 4, 9);
      context.beginPath();
      context.moveTo(lampX, layout.groundY);
      context.lineTo(lampX, lampTop);
      context.quadraticCurveTo(lampX, lampTop - 20, lampX + 22, lampTop - 20);
      context.lineTo(lampX + 45, lampTop - 20);
      context.stroke();
      context.fillStyle = "rgba(230, 179, 93, 0.25)";
      context.beginPath();
      context.ellipse(lampX + 46, lampTop - 14, 16, 9, 0, 0, TAU);
      context.fill();

      const lampGlow = context.createRadialGradient(lampX + 46, lampTop, 0, lampX + 46, lampTop, this.height * 0.24);
      lampGlow.addColorStop(0, "rgba(221, 160, 65, 0.10)");
      lampGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = lampGlow;
      context.fillRect(lampX - this.height * 0.22, lampTop - 20, this.height * 0.48, this.height * 0.48);
    }

    drawTextBlock(text, maxWidth, lineHeight) {
      const context = this.context;
      const words = text.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth || !currentLine) {
          currentLine = candidate;
          continue;
        }

        lines.push(currentLine);
        currentLine = word;
        if (lines.length === 3) {
          break;
        }
      }

      if (lines.length < 3 && currentLine) {
        lines.push(currentLine);
      } else if (lines.length === 3 && words.join(" ") !== lines.join(" ")) {
        lines[2] = `${lines[2].replace(/[.\s]+$/, "")}…`;
      }

      lines.forEach((line, index) => {
        const y = (index - (lines.length - 1) / 2) * lineHeight;
        context.fillText(line, 0, y, maxWidth);
      });
    }

    drawIncomingDump(layout, sequence, progress) {
      if (progress >= 1) {
        return;
      }

      const context = this.context;
      const eased = easeBoth(progress);
      const x = lerp(layout.incomingX, layout.binX, eased);
      const y = lerp(layout.incomingY, layout.groundY - layout.binWidth * 1.05, eased) + Math.sin(progress * Math.PI) * -this.height * 0.035;
      const scale = lerp(1, 0.18, eased);
      const opacity = 1 - range(progress, 0.55, 1);

      context.save();
      context.translate(x, y);
      context.rotate(eased * 5.6);
      context.scale(scale, scale);
      context.font = `${clamp(this.width * 0.018, 16, 24)}px Georgia, serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = `rgba(240, 233, 218, ${opacity})`;
      context.shadowColor = "rgba(0, 0, 0, 0.9)";
      context.shadowBlur = 14;
      this.drawTextBlock(
        sequence.text,
        Math.min(this.width * 0.55, 560),
        clamp(this.width * 0.026, 22, 34)
      );
      context.restore();

      if (progress > 0.48) {
        context.save();
        context.translate(x, y);
        context.rotate(eased * 4.4);
        context.beginPath();
        context.moveTo(-10, -8);
        context.quadraticCurveTo(0, -15, 11, -7);
        context.lineTo(15, 12);
        context.quadraticCurveTo(0, 21, -14, 11);
        context.closePath();
        context.fillStyle = `rgba(207, 201, 185, ${range(progress, 0.48, 0.74) * (1 - progress)})`;
        context.fill();
        context.restore();
      }
    }

    getTruckX(layout, timeline) {
      const startX = -layout.truckWidth - 80;
      const exitX = this.width + 90;

      if (timeline < 0.08) {
        return startX;
      }
      if (timeline < 0.32) {
        return lerp(startX, layout.stopX, easeBoth(range(timeline, 0.08, 0.32)));
      }
      if (timeline < 0.77) {
        return layout.stopX;
      }
      return lerp(layout.stopX, exitX, ease(range(timeline, 0.77, 1)));
    }

    drawWheel(x, y, radius, rotation) {
      const context = this.context;
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.beginPath();
      context.arc(0, 0, radius, 0, TAU);
      context.fillStyle = "#080909";
      context.fill();
      context.strokeStyle = "#30322d";
      context.lineWidth = radius * 0.16;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, radius * 0.35, 0, TAU);
      context.fillStyle = "#77776d";
      context.fill();
      context.strokeStyle = "#20231f";
      context.lineWidth = 2;
      for (let index = 0; index < 5; index += 1) {
        context.rotate(TAU / 5);
        context.beginPath();
        context.moveTo(radius * 0.12, 0);
        context.lineTo(radius * 0.55, 0);
        context.stroke();
      }
      context.restore();
    }

    drawTruck(layout, x, timeline, now) {
      const context = this.context;
      const width = layout.truckWidth;
      const height = layout.truckHeight;
      const top = layout.groundY - height;
      const moving = timeline < 0.32 || timeline > 0.77;
      const compacting = pulse(timeline, 0.68, 0.715, 0.76);
      const shake = compacting * Math.sin(now * 0.045) * width * 0.007;
      const idle = moving ? 0 : Math.sin(now * 0.018) * 0.7;
      const truckY = top + shake + idle;
      const wheelRadius = width * 0.075;
      const wheelY = layout.groundY - wheelRadius * 0.84;
      const wheelRotation = now * (moving ? 0.013 : 0.0014);

      context.save();
      context.globalAlpha = clamp(range(timeline, 0.04, 0.09) * (1 - range(timeline, 0.97, 1)));

      if (moving) {
        for (let index = 0; index < 4; index += 1) {
          const drift = ((now * 0.035 + index * 19) % 42);
          context.beginPath();
          context.arc(x - 12 - drift, layout.groundY - 8 - index * 3, 2 + index, 0, TAU);
          context.fillStyle = `rgba(128, 132, 119, ${0.13 - index * 0.02})`;
          context.fill();
        }
      }

      context.fillStyle = "rgba(0, 0, 0, 0.55)";
      context.beginPath();
      context.ellipse(x + width * 0.5, layout.groundY + 4, width * 0.52, height * 0.08, 0, 0, TAU);
      context.fill();

      context.save();
      context.translate(0, truckY - top);

      const bodyGradient = context.createLinearGradient(x, top, x, top + height);
      bodyGradient.addColorStop(0, "#65744b");
      bodyGradient.addColorStop(0.55, "#46543a");
      bodyGradient.addColorStop(1, "#293328");
      context.fillStyle = bodyGradient;
      context.beginPath();
      context.moveTo(x + width * 0.04, top + height * 0.18);
      context.lineTo(x + width * 0.58, top + height * 0.06);
      context.lineTo(x + width * 0.70, top + height * 0.20);
      context.lineTo(x + width * 0.69, top + height * 0.79);
      context.lineTo(x + width * 0.05, top + height * 0.79);
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(190, 199, 159, 0.22)";
      context.lineWidth = 2;
      context.stroke();

      context.fillStyle = "#202920";
      context.fillRect(x, top + height * 0.25, width * 0.07, height * 0.48);
      context.fillStyle = "#0d120f";
      context.fillRect(x + width * 0.015, top + height * 0.31, width * 0.038, height * 0.28);
      context.strokeStyle = "rgba(229, 178, 84, 0.46)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + width * 0.07, top + height * 0.28);
      context.lineTo(x + width * 0.63, top + height * 0.16);
      context.stroke();

      context.fillStyle = "rgba(235, 229, 200, 0.62)";
      context.font = `700 ${width * 0.055}px "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("DUMPPIT", x + width * 0.36, top + height * 0.45);
      context.font = `600 ${width * 0.021}px "Segoe UI", sans-serif`;
      context.fillStyle = "rgba(235, 229, 200, 0.34)";
      context.fillText("WE TAKE IT FROM HERE", x + width * 0.36, top + height * 0.56);

      context.fillStyle = "#4c5b40";
      context.beginPath();
      context.moveTo(x + width * 0.68, top + height * 0.27);
      context.lineTo(x + width * 0.78, top + height * 0.11);
      context.lineTo(x + width * 0.95, top + height * 0.13);
      context.lineTo(x + width, top + height * 0.34);
      context.lineTo(x + width, top + height * 0.78);
      context.lineTo(x + width * 0.68, top + height * 0.78);
      context.closePath();
      context.fill();

      context.fillStyle = "rgba(113, 143, 139, 0.38)";
      context.beginPath();
      context.moveTo(x + width * 0.79, top + height * 0.17);
      context.lineTo(x + width * 0.93, top + height * 0.19);
      context.lineTo(x + width * 0.97, top + height * 0.37);
      context.lineTo(x + width * 0.76, top + height * 0.37);
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(198, 210, 195, 0.18)";
      context.stroke();

      context.fillStyle = "#252d26";
      context.fillRect(x + width * 0.76, top + height * 0.44, width * 0.20, height * 0.31);
      context.strokeStyle = "rgba(210, 211, 188, 0.16)";
      context.strokeRect(x + width * 0.76, top + height * 0.44, width * 0.20, height * 0.31);
      context.fillStyle = "rgba(212, 164, 73, 0.55)";
      context.fillRect(x + width * 0.78, top + height * 0.68, width * 0.025, height * 0.025);

      const blink = Math.sin(now * 0.009) > 0.36 || moving;
      context.fillStyle = blink ? "rgba(242, 159, 51, 0.88)" : "rgba(130, 84, 26, 0.45)";
      context.beginPath();
      context.arc(x + width * 0.63, top + height * 0.11, width * 0.018, 0, TAU);
      context.fill();
      context.beginPath();
      context.arc(x + width * 0.90, top + height * 0.09, width * 0.018, 0, TAU);
      context.fill();

      const headlightGlow = context.createRadialGradient(
        x + width,
        top + height * 0.57,
        0,
        x + width,
        top + height * 0.57,
        width * 0.22
      );
      headlightGlow.addColorStop(0, "rgba(255, 213, 126, 0.20)");
      headlightGlow.addColorStop(1, "rgba(255, 213, 126, 0)");
      context.fillStyle = headlightGlow;
      context.fillRect(x + width * 0.94, top + height * 0.38, width * 0.30, height * 0.38);
      context.fillStyle = "rgba(255, 222, 153, 0.78)";
      context.fillRect(x + width * 0.975, top + height * 0.50, width * 0.025, height * 0.12);

      context.restore();

      this.drawWheel(x + width * 0.21, wheelY, wheelRadius, wheelRotation);
      this.drawWheel(x + width * 0.79, wheelY, wheelRadius, wheelRotation);

      if (compacting > 0.16) {
        const sparkCount = 8;
        for (let index = 0; index < sparkCount; index += 1) {
          const angle = -2.7 + seeded(index + 1900) * 1.35;
          const distance = compacting * width * (0.04 + seeded(index + 2000) * 0.14);
          context.strokeStyle = `rgba(244, 173, 70, ${compacting * 0.7})`;
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(x + width * 0.08, top + height * 0.48);
          context.lineTo(
            x + width * 0.08 + Math.cos(angle) * distance,
            top + height * 0.48 + Math.sin(angle) * distance
          );
          context.stroke();
        }
      }

      context.restore();
    }

    drawBin(layout, state = {}) {
      const context = this.context;
      const width = layout.binWidth;
      const x = state.x ?? layout.binX;
      const groundY = state.groundY ?? layout.groundY;
      const angle = state.angle ?? 0;
      const shake = state.shake ?? 0;
      const lid = state.lid ?? 0;

      context.save();
      context.translate(x + shake, groundY);
      context.rotate(angle);

      context.fillStyle = "rgba(0, 0, 0, 0.46)";
      context.beginPath();
      context.ellipse(0, 3, width * 0.72, width * 0.13, 0, 0, TAU);
      context.fill();

      context.fillStyle = "#263b31";
      context.beginPath();
      context.moveTo(-width * 0.45, -width * 1.23);
      context.lineTo(width * 0.45, -width * 1.23);
      context.lineTo(width * 0.35, -width * 0.16);
      context.lineTo(-width * 0.31, -width * 0.16);
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(164, 184, 158, 0.28)";
      context.lineWidth = 1.5;
      context.stroke();

      context.strokeStyle = "rgba(148, 171, 146, 0.20)";
      context.beginPath();
      context.moveTo(-width * 0.2, -width * 1.05);
      context.lineTo(-width * 0.14, -width * 0.26);
      context.moveTo(width * 0.2, -width * 1.05);
      context.lineTo(width * 0.14, -width * 0.26);
      context.stroke();

      context.save();
      context.translate(-width * 0.48, -width * 1.23);
      context.rotate(-lid);
      context.fillStyle = "#344b3d";
      context.fillRect(0, -width * 0.13, width * 1.02, width * 0.16);
      context.restore();

      context.fillStyle = "rgba(230, 223, 194, 0.45)";
      context.font = `700 ${Math.max(7, width * 0.14)}px "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.fillText("DUMP", 0, -width * 0.63);

      context.fillStyle = "#0a0c0a";
      context.beginPath();
      context.arc(-width * 0.29, -width * 0.08, width * 0.11, 0, TAU);
      context.arc(width * 0.29, -width * 0.08, width * 0.11, 0, TAU);
      context.fill();
      context.restore();
    }

    drawWorker(x, groundY, scale, walk, action = 0) {
      const context = this.context;
      const bob = Math.abs(Math.sin(walk * Math.PI * 4)) * scale * 1.7;
      const stride = Math.sin(walk * Math.PI * 4) * scale * 4;
      context.save();
      context.translate(x, groundY - bob);
      context.lineCap = "round";
      context.strokeStyle = "#18211d";
      context.lineWidth = scale * 5;
      context.beginPath();
      context.moveTo(0, -scale * 32);
      context.lineTo(-stride, -scale * 7);
      context.moveTo(0, -scale * 31);
      context.lineTo(stride, -scale * 7);
      context.stroke();

      context.strokeStyle = "#9b783d";
      context.lineWidth = scale * 4;
      context.beginPath();
      context.moveTo(0, -scale * 49);
      context.lineTo(-scale * (12 + action * 8), -scale * (31 + action * 6));
      context.moveTo(0, -scale * 49);
      context.lineTo(scale * (12 + action * 8), -scale * (31 + action * 6));
      context.stroke();

      context.fillStyle = "#d59c43";
      context.beginPath();
      context.roundRect(-scale * 11, -scale * 66, scale * 22, scale * 37, scale * 5);
      context.fill();
      context.fillStyle = "rgba(233, 224, 179, 0.65)";
      context.fillRect(-scale * 11, -scale * 49, scale * 22, scale * 5);

      context.fillStyle = "#7f6748";
      context.beginPath();
      context.arc(0, -scale * 75, scale * 8, 0, TAU);
      context.fill();
      context.fillStyle = "#d29b41";
      context.beginPath();
      context.arc(0, -scale * 79, scale * 10, Math.PI, TAU);
      context.fill();
      context.fillRect(-scale * 12, -scale * 80, scale * 24, scale * 3);
      context.restore();
    }

    drawFragments(sequence, startX, startY, endX, endY, progress, arcHeight = 70) {
      const context = this.context;
      const characters = Array.from(sequence.text.replace(/\s/g, "")).slice(0, 18);
      characters.forEach((character, index) => {
        const local = clamp(progress * 1.55 - index / Math.max(characters.length, 1) * 0.55);
        if (local <= 0 || local >= 1) {
          return;
        }
        const x = lerp(startX, endX, local);
        const y = lerp(startY, endY, local) - Math.sin(local * Math.PI) * arcHeight;
        context.save();
        context.translate(x, y);
        context.rotate(local * 5 + index);
        context.font = `${clamp(this.width * 0.012, 8, 16)}px Georgia, serif`;
        context.fillStyle = `rgba(237, 226, 205, ${Math.sin(local * Math.PI) * 0.8})`;
        context.fillText(character, 0, 0);
        context.restore();
      });
    }

    getWorkerState(layout, truckX, progress) {
      const width = layout.truckWidth;
      const doorX = truckX + width * 0.84;
      const rearX = truckX + width * 0.09;
      let workerX = doorX;
      let binX = layout.binX;
      let binAngle = 0;
      let action = 0;

      if (progress < 0.18) {
        workerX = lerp(doorX, layout.binX - layout.binWidth * 0.55, easeBoth(range(progress, 0, 0.18)));
      } else if (progress < 0.48) {
        const move = easeBoth(range(progress, 0.18, 0.48));
        binX = lerp(layout.binX, rearX, move);
        workerX = binX + layout.binWidth * 0.52;
        action = 0.6;
      } else if (progress < 0.68) {
        const tip = pulse(progress, 0.48, 0.58, 0.68);
        binX = rearX;
        binAngle = -tip * 2.45;
        workerX = rearX + layout.binWidth * 0.55;
        action = 1;
      } else if (progress < 0.9) {
        const move = easeBoth(range(progress, 0.68, 0.9));
        binX = lerp(rearX, layout.binX, move);
        workerX = binX + layout.binWidth * 0.52;
        action = 0.6;
      } else {
        workerX = lerp(layout.binX, doorX, easeBoth(range(progress, 0.9, 1)));
      }

      return { workerX, binX, binAngle, action, doorX, rearX };
    }

    drawArmCollection(layout, truckX, sequence, progress) {
      const context = this.context;
      const width = layout.truckWidth;
      const anchorX = truckX + width * 0.56;
      const anchorY = layout.groundY - width * 0.18;
      const extension = easeBoth(range(progress, 0, 0.22));
      const lift = pulse(progress, 0.22, 0.52, 0.84);
      const returnProgress = range(progress, 0.76, 1);
      const targetX = lerp(anchorX, layout.binX, returnProgress);
      const elbowX = lerp(anchorX, layout.binX - layout.binWidth * 1.7, extension);
      const elbowY = anchorY - lift * width * 0.14;
      const binX = progress < 0.22
        ? layout.binX
        : lerp(layout.binX, anchorX + width * 0.06, lift);
      const binGround = layout.groundY - lift * width * 0.30;
      const binAngle = -lift * 2.65;

      context.save();
      context.lineCap = "round";
      context.strokeStyle = "#8d7c45";
      context.lineWidth = clamp(width * 0.024, 7, 13);
      context.beginPath();
      context.moveTo(anchorX, anchorY);
      context.lineTo(elbowX, elbowY);
      context.lineTo(progress > 0.76 ? targetX : binX, binGround - layout.binWidth * 0.58);
      context.stroke();
      context.strokeStyle = "#30372c";
      context.lineWidth *= 0.38;
      context.stroke();
      context.restore();

      this.drawBin(layout, {
        x: progress > 0.84 ? lerp(anchorX, layout.binX, returnProgress) : binX,
        groundY: progress > 0.84 ? lerp(binGround, layout.groundY, returnProgress) : binGround,
        angle: progress > 0.84 ? lerp(binAngle, 0, returnProgress) : binAngle,
        lid: lift * 1.45
      });

      if (progress > 0.38 && progress < 0.73) {
        this.drawFragments(
          sequence,
          binX,
          binGround - layout.binWidth * 0.75,
          truckX + width * 0.10,
          layout.groundY - width * 0.22,
          range(progress, 0.38, 0.73),
          width * 0.08
        );
      }
    }

    drawWorkerCollection(layout, truckX, sequence, progress) {
      const state = this.getWorkerState(layout, truckX, progress);
      this.drawBin(layout, {
        x: state.binX,
        angle: state.binAngle,
        lid: Math.abs(state.binAngle) * 0.45
      });
      this.drawWorker(
        state.workerX,
        layout.groundY,
        clamp(layout.truckWidth / 390, 0.72, 1.12),
        progress * 5,
        state.action
      );

      if (progress > 0.48 && progress < 0.7) {
        this.drawFragments(
          sequence,
          state.rearX,
          layout.groundY - layout.binWidth * 1.1,
          truckX + layout.truckWidth * 0.06,
          layout.groundY - layout.truckWidth * 0.22,
          range(progress, 0.48, 0.7),
          layout.truckWidth * 0.06
        );
      }
    }

    drawTossCollection(layout, truckX, sequence, progress) {
      const width = layout.truckWidth;
      const doorX = truckX + width * 0.84;
      const workerAtBin = lerp(doorX, layout.binX - layout.binWidth * 0.55, easeBoth(range(progress, 0, 0.24)));
      const workerX = progress < 0.72
        ? workerAtBin
        : lerp(layout.binX, doorX, easeBoth(range(progress, 0.72, 1)));
      const toss = range(progress, 0.26, 0.65);
      const bagStartX = layout.binX;
      const bagStartY = layout.groundY - layout.binWidth * 1.2;
      const bagEndX = truckX + width * 0.07;
      const bagEndY = layout.groundY - width * 0.20;

      this.drawBin(layout, { lid: pulse(progress, 0.18, 0.30, 0.68) * 1.4 });
      this.drawWorker(
        workerX,
        layout.groundY,
        clamp(width / 390, 0.72, 1.12),
        progress * 4,
        pulse(progress, 0.2, 0.45, 0.72)
      );

      if (toss > 0 && toss < 1) {
        const x = lerp(bagStartX, bagEndX, easeBoth(toss));
        const y = lerp(bagStartY, bagEndY, toss) - Math.sin(toss * Math.PI) * width * 0.34;
        const context = this.context;
        context.save();
        context.translate(x, y);
        context.rotate(toss * 7);
        context.beginPath();
        context.moveTo(-12, -10);
        context.quadraticCurveTo(0, -19, 13, -9);
        context.lineTo(17, 15);
        context.quadraticCurveTo(0, 24, -17, 14);
        context.closePath();
        context.fillStyle = "rgba(210, 203, 185, 0.9)";
        context.fill();
        context.font = "700 8px sans-serif";
        context.textAlign = "center";
        context.fillStyle = "rgba(40, 43, 37, 0.65)";
        context.fillText("DUMP", 0, 8);
        context.restore();
      }

      if (progress > 0.48 && progress < 0.72) {
        this.drawFragments(sequence, bagStartX, bagStartY, bagEndX, bagEndY, range(progress, 0.48, 0.72), width * 0.27);
      }
    }

    drawVacuumCollection(layout, truckX, sequence, progress, now) {
      const context = this.context;
      const width = layout.truckWidth;
      const startX = truckX + width * 0.05;
      const startY = layout.groundY - width * 0.21;
      const endX = layout.binX;
      const endY = layout.groundY - layout.binWidth * 1.08;
      const extension = easeBoth(range(progress, 0, 0.24));
      const retract = range(progress, 0.78, 1);
      const hoseEndX = lerp(startX, endX, extension * (1 - retract));
      const hoseEndY = lerp(startY, endY, extension * (1 - retract));
      const shake = progress > 0.22 && progress < 0.8 ? Math.sin(now * 0.06) * 3 : 0;

      this.drawBin(layout, {
        shake,
        lid: pulse(progress, 0.16, 0.32, 0.86) * 1.4
      });

      context.save();
      context.lineCap = "round";
      context.strokeStyle = "#151a17";
      context.lineWidth = clamp(width * 0.035, 10, 17);
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(
        lerp(startX, hoseEndX, 0.25), startY + width * 0.12,
        lerp(startX, hoseEndX, 0.72), hoseEndY - width * 0.16,
        hoseEndX, hoseEndY
      );
      context.stroke();
      context.strokeStyle = "rgba(134, 141, 116, 0.48)";
      context.lineWidth *= 0.27;
      context.stroke();
      context.restore();

      if (progress > 0.22 && progress < 0.82) {
        const characters = Array.from(sequence.text.replace(/\s/g, "")).slice(0, 24);
        characters.forEach((character, index) => {
          const local = (range(progress, 0.22, 0.82) * 1.8 + index / characters.length) % 1;
          const reverse = 1 - local;
          const x = lerp(startX, endX, reverse);
          const y = lerp(startY, endY, reverse) - Math.sin(reverse * Math.PI) * width * 0.12;
          context.save();
          context.translate(x, y);
          context.rotate(-local * 8 + index);
          context.font = `${clamp(this.width * 0.011, 8, 15)}px Georgia, serif`;
          context.fillStyle = `rgba(237, 226, 205, ${Math.sin(local * Math.PI) * 0.8})`;
          context.fillText(character, 0, 0);
          context.restore();
        });
      }
    }

    drawSequence(layout, sequence, timeline, now) {
      this.drawIncomingDump(layout, sequence, range(timeline, 0, 0.105));

      if (timeline < 0.05) {
        this.drawBin(layout);
        return;
      }

      const truckX = this.getTruckX(layout, timeline);
      this.drawTruck(layout, truckX, timeline, now);

      if (timeline < 0.35 || timeline > 0.68) {
        this.drawBin(layout);
        return;
      }

      const collectionProgress = range(timeline, 0.35, 0.68);
      if (sequence.variant === "arm") {
        this.drawArmCollection(layout, truckX, sequence, collectionProgress);
      } else if (sequence.variant === "toss") {
        this.drawTossCollection(layout, truckX, sequence, collectionProgress);
      } else if (sequence.variant === "vacuum") {
        this.drawVacuumCollection(layout, truckX, sequence, collectionProgress, now);
      } else {
        this.drawWorkerCollection(layout, truckX, sequence, collectionProgress);
      }
    }

    render(now) {
      const layout = this.getLayout();
      this.context.clearRect(0, 0, this.width, this.height);
      this.drawSky(now);
      this.drawNeighbourhood(layout);
      this.drawStreet(layout);

      if (this.sequence) {
        const timeline = (now - this.sequence.start) / this.sequence.duration;
        if (timeline >= 1 && !this.sequence.preview) {
          const resolve = this.sequence.resolve;
          this.sequence = null;
          this.drawBin(layout);
          resolve?.();
        } else {
          this.drawSequence(layout, this.sequence, clamp(timeline), now);
        }
      } else {
        this.drawBin(layout);
      }

      if (!this.staticPreview) {
        window.requestAnimationFrame(this.render);
      }
    }
  }

  window.DumppitTruck = {
    mount(canvas) {
      if (!canvas || !canvas.getContext) {
        return null;
      }

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        return null;
      }

      return new GarbageTruckScene(canvas, context);
    }
  };
})();
