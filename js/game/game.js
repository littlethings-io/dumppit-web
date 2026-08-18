import { TRASH_SPRITES, drawImageCover } from "./assets.js";

const TAU = Math.PI * 2;
const FINALE_DURATION = 7.2;
const REDUCED_FINALE_DURATION = 2.8;
const GOOD_ITEMS = Object.keys(TRASH_SPRITES).filter((key) => !TRASH_SPRITES[key].hazard);
const HAZARDS = Object.keys(TRASH_SPRITES).filter((key) => TRASH_SPRITES[key].hazard);

const WIN_VERDICTS = [
  "Not completely terrible. Don't let it go to your head.",
  "Fine. The street is clean. I suppose you helped.",
  "I've worked with worse. Not many, but worse.",
  "The truck's full and my back hurts. Successful route."
];

const LOSS_VERDICTS = [
  "I've seen raccoons sort garbage better than that.",
  "You let a banana peel outsmart you.",
  "The street was cleaner before you arrived.",
  "Three mistakes. That's practically management material."
];

const BAD_CATCH_LINES = [
  "That's a hazard, genius!",
  "A bowling ball? In my bin?!",
  "Do I look like a brick collector?",
  "My insurance does not cover this!"
];

const MISS_LINES = [
  "You missed the garbage!",
  "It was falling in a straight line!",
  "The bin has an opening. Use it.",
  "Great. Now I have to pick that up."
];

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const range = (value, start, end) => clamp((value - start) / (end - start));
const easeOut = (progress) => 1 - Math.pow(1 - clamp(progress), 3);
const easeBoth = (progress) => {
  const value = clamp(progress);
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
};
const randomChoice = (values) => values[Math.floor(Math.random() * values.length)];

export class LarryGame {
  constructor(canvas, assets, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.assets = assets;
    this.callbacks = callbacks;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.state = "idle";
    this.score = 0;
    this.caught = 0;
    this.goal = 12;
    this.lives = 3;
    this.items = [];
    this.effects = [];
    this.grumble = null;
    this.keys = { left: false, right: false };
    this.drag = null;
    this.larry = { x: 0, direction: 1, moving: false };
    this.spawnClock = 0;
    this.elapsed = 0;
    this.finaleClock = 0;
    this.previousTime = 0;
    this.frameHandle = 0;
    this.lastBackgroundIndex = -1;
    this.background = assets.backgrounds[0];
    this.hasUsedControls = false;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    if (!this.larry.x) {
      this.larry.x = this.width / 2;
    } else {
      this.larry.x = clamp(this.larry.x, this.getLarryWidth() * 0.45, this.width - this.getLarryWidth() * 0.45);
    }

    if (this.state !== "idle") {
      this.draw(performance.now());
    }
  }

  chooseBackground() {
    const choices = this.assets.backgrounds
      .map((_, index) => index)
      .filter((index) => index !== this.lastBackgroundIndex);
    this.lastBackgroundIndex = randomChoice(choices);
    this.background = this.assets.backgrounds[this.lastBackgroundIndex];
  }

  start() {
    this.chooseBackground();
    this.state = "playing";
    this.score = 0;
    this.caught = 0;
    this.lives = 3;
    this.items = [];
    this.effects = [];
    this.grumble = null;
    this.spawnClock = 0.42;
    this.elapsed = 0;
    this.finaleClock = 0;
    this.previousTime = performance.now();
    this.keys.left = false;
    this.keys.right = false;
    this.drag = null;
    this.larry.x = this.width / 2;
    this.larry.direction = 1;
    this.larry.moving = false;
    this.hasUsedControls = false;
    this.updateHud();
    this.callbacks.onPause?.(false);
    this.callbacks.onControl?.(false);
    this.callbacks.onStatus?.("Level started. Catch twelve pieces of trash and avoid hazards.");

    if (!this.frameHandle) {
      this.frameHandle = window.requestAnimationFrame(this.frame);
    }
  }

  stop() {
    this.state = "idle";
    this.items = [];
    this.effects = [];
    this.grumble = null;
    this.keys.left = false;
    this.keys.right = false;
    this.drag = null;
    if (this.frameHandle) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  togglePause(force) {
    if (this.state !== "playing" && this.state !== "paused") {
      return false;
    }
    const shouldPause = typeof force === "boolean" ? force : this.state === "playing";
    this.state = shouldPause ? "paused" : "playing";
    this.previousTime = performance.now();
    this.keys.left = false;
    this.keys.right = false;
    this.drag = null;
    this.callbacks.onPause?.(shouldPause);
    return shouldPause;
  }

  forceWin() {
    if (this.state === "playing") {
      this.caught = this.goal;
      this.score += 120;
      this.beginWin();
    }
  }

  previewItems() {
    if (this.state !== "playing") {
      return;
    }
    const types = ["banana", "can", "bottle", "pizza", "bowling"];
    this.items = types.map((type, index) => ({
      type,
      x: this.width * (0.13 + index * 0.185),
      y: this.height * (0.27 + (index % 2) * 0.11),
      previousY: this.height * 0.27,
      size: clamp(this.width * 0.135, 50, 76),
      speed: this.height * 0.035,
      rotation: index * 0.6,
      spin: index % 2 ? 0.35 : -0.28,
      sway: 5,
      swayOffset: index,
      age: 0,
      dead: false
    }));
    this.draw(performance.now());
  }

  previewFinale(progress = 0.55) {
    if (this.state !== "finale") {
      return;
    }
    const duration = this.reduceMotion.matches ? REDUCED_FINALE_DURATION : FINALE_DURATION;
    this.finaleClock = duration * clamp(progress);
    this.draw(performance.now());
    if (this.frameHandle) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  onKeyDown(event) {
    if (this.state !== "playing") {
      return;
    }
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      this.keys.left = true;
      this.markControlsUsed();
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      this.keys.right = true;
      this.markControlsUsed();
    }
    if (event.key === "Escape") {
      this.togglePause(true);
    }
  }

  onKeyUp(event) {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      this.keys.left = false;
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      this.keys.right = false;
    }
  }

  pointerPosition(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (this.width / bounds.width),
      y: (event.clientY - bounds.top) * (this.height / bounds.height)
    };
  }

  onPointerDown(event) {
    if (this.state !== "playing") {
      return;
    }
    const point = this.pointerPosition(event);
    const width = this.getLarryWidth();
    const height = this.getLarryHeight();
    const top = this.getLarryBottom() - height;
    if (
      point.x < this.larry.x - width * 0.58 ||
      point.x > this.larry.x + width * 0.58 ||
      point.y < top - 24 ||
      point.y > this.getLarryBottom() + 18
    ) {
      return;
    }

    this.drag = {
      pointerId: event.pointerId,
      offsetX: point.x - this.larry.x,
      previousX: point.x
    };
    this.canvas.setPointerCapture(event.pointerId);
    this.markControlsUsed();
  }

  onPointerMove(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId || this.state !== "playing") {
      return;
    }
    const point = this.pointerPosition(event);
    const delta = point.x - this.drag.previousX;
    if (Math.abs(delta) > 0.6) {
      this.larry.direction = delta > 0 ? 1 : -1;
    }
    this.drag.previousX = point.x;
    this.larry.x = this.clampLarryX(point.x - this.drag.offsetX);
    this.larry.moving = Math.abs(delta) > 0.3;
  }

  onPointerUp(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.drag = null;
    this.larry.moving = false;
  }

  markControlsUsed() {
    if (this.hasUsedControls) {
      return;
    }
    this.hasUsedControls = true;
    this.callbacks.onControl?.(true);
  }

  getLarryWidth() {
    return clamp(this.width * 0.43, 176, 270);
  }

  getLarryHeight() {
    return this.getLarryWidth() * 0.665;
  }

  getLarryBottom() {
    return this.height * 0.925;
  }

  clampLarryX(x) {
    const halfWidth = this.getLarryWidth() * 0.46;
    return clamp(x, halfWidth, this.width - halfWidth);
  }

  getCatchZone() {
    const width = this.getLarryWidth();
    const height = this.getLarryHeight();
    const centerX = this.larry.x + this.larry.direction * width * 0.285;
    const top = this.getLarryBottom() - height * 0.66;
    return {
      left: centerX - width * 0.17,
      right: centerX + width * 0.17,
      top,
      bottom: top + height * 0.24,
      centerX
    };
  }

  getFinaleLayout() {
    const duration = this.reduceMotion.matches ? REDUCED_FINALE_DURATION : FINALE_DURATION;
    const timeline = clamp(this.finaleClock / duration);
    const sourceWidth = this.assets.truck.naturalWidth || this.assets.truck.width;
    const sourceHeight = this.assets.truck.naturalHeight || this.assets.truck.height;
    const truckWidth = Math.min(this.width * 0.96, 570);
    const truckHeight = truckWidth * (sourceHeight / sourceWidth);
    const groundY = this.getLarryBottom() + 4;
    const stopX = -this.width * 0.02;
    const enter = easeBoth(range(timeline, 0.02, 0.28));
    const leave = easeOut(range(timeline, 0.78, 1));
    let x = lerp(-truckWidth - 30, stopX, enter);
    if (leave > 0) {
      x = lerp(stopX, this.width + truckWidth * 0.25, leave);
    }

    return {
      duration,
      timeline,
      truckWidth,
      truckHeight,
      groundY,
      x,
      y: groundY - truckHeight,
      throwProgress: easeBoth(range(timeline, 0.38, 0.66)),
      compactor: Math.sin(range(timeline, 0.62, 0.78) * Math.PI) ** 2
    };
  }

  spawnItem() {
    const progress = this.caught / this.goal;
    const hazardChance = this.caught < 2 ? 0.10 : 0.22 + progress * 0.08;
    const hazard = Math.random() < hazardChance;
    const type = randomChoice(hazard ? HAZARDS : GOOD_ITEMS);
    const baseSize = clamp(this.width * 0.14, 48, 78);
    const size = baseSize * (0.82 + Math.random() * 0.34);
    const margin = size * 0.65;

    this.items.push({
      type,
      x: lerp(margin, this.width - margin, Math.random()),
      y: -size,
      previousY: -size,
      size,
      speed: this.height * (0.145 + progress * 0.045 + Math.random() * 0.025),
      rotation: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 2.4,
      sway: 8 + Math.random() * 18,
      swayOffset: Math.random() * TAU,
      age: 0,
      dead: false
    });
  }

  update(delta, now) {
    this.elapsed += delta;
    this.spawnClock -= delta;

    const keyboardDirection = Number(this.keys.right) - Number(this.keys.left);
    if (!this.drag && keyboardDirection !== 0) {
      this.larry.direction = keyboardDirection;
      this.larry.moving = true;
      this.larry.x = this.clampLarryX(
        this.larry.x + keyboardDirection * this.width * 0.53 * delta
      );
    } else if (!this.drag) {
      this.larry.moving = false;
    }

    if (this.spawnClock <= 0) {
      this.spawnItem();
      const interval = Math.max(0.54, 0.92 - this.caught * 0.018);
      this.spawnClock = interval * (0.82 + Math.random() * 0.34);
    }

    const catchZone = this.getCatchZone();
    for (const item of this.items) {
      item.previousY = item.y;
      item.age += delta;
      item.y += item.speed * delta;
      item.rotation += item.spin * delta;
      const displayX = item.x + Math.sin(item.age * 2.4 + item.swayOffset) * item.sway;
      const radius = item.size * 0.34;

      const overlapsBin =
        displayX + radius >= catchZone.left &&
        displayX - radius <= catchZone.right &&
        item.y + radius >= catchZone.top &&
        item.previousY - radius <= catchZone.bottom;

      if (overlapsBin) {
        item.dead = true;
        this.catchItem(item, displayX, catchZone.top, now);
        if (this.state !== "playing") {
          break;
        }
        continue;
      }

      if (item.y - item.size > this.height) {
        item.dead = true;
        if (!TRASH_SPRITES[item.type].hazard) {
          this.damage("miss", displayX, this.height * 0.9, now);
          if (this.state !== "playing") {
            break;
          }
        }
      }
    }

    this.items = this.items.filter((item) => !item.dead);
    this.updateEffects(delta);
  }

  catchItem(item, x, y, now) {
    const definition = TRASH_SPRITES[item.type];
    if (definition.hazard) {
      this.damage("hazard", x, y, now, definition.label);
      return;
    }

    this.caught += 1;
    this.score += definition.points;
    this.createBurst(x, y, "#9eea32", `+${definition.points}`);
    this.callbacks.onStatus?.(`${definition.label} caught. ${this.caught} of ${this.goal}.`);
    this.updateHud();

    if (this.caught >= this.goal) {
      this.beginWin();
    }
  }

  damage(kind, x, y, now, label = "") {
    this.lives -= 1;
    this.score = Math.max(0, this.score - 10);
    this.createBurst(x, y, "#ff5b35", "−1 patience");
    const lines = kind === "hazard" ? BAD_CATCH_LINES : MISS_LINES;
    this.grumble = {
      text: kind === "hazard" && label ? `${randomChoice(lines)} (${label}!)` : randomChoice(lines),
      start: now,
      duration: 2100
    };
    this.updateHud();
    this.callbacks.onStatus?.(this.grumble.text);

    if (this.lives <= 0) {
      this.beginLoss();
    }
  }

  createBurst(x, y, color, text) {
    for (let index = 0; index < 13; index += 1) {
      const angle = Math.random() * TAU;
      const speed = 30 + Math.random() * 100;
      this.effects.push({
        kind: "particle",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 55,
        color,
        life: 0.75 + Math.random() * 0.35,
        age: 0,
        size: 2 + Math.random() * 5
      });
    }
    this.effects.push({ kind: "text", x, y, text, color, life: 1.05, age: 0 });
  }

  updateEffects(delta) {
    for (const effect of this.effects) {
      effect.age += delta;
      if (effect.kind === "particle") {
        effect.vy += 160 * delta;
        effect.x += effect.vx * delta;
        effect.y += effect.vy * delta;
      }
    }
    this.effects = this.effects.filter((effect) => effect.age < effect.life);
  }

  beginWin() {
    this.state = "finale";
    this.items = [];
    this.finaleClock = 0;
    this.larry.direction = -1;
    this.larry.x = this.clampLarryX(this.width * 0.77);
    this.score += this.lives * 25;
    this.updateHud();
    this.callbacks.onStatus?.("Route complete. The Dumppit truck is arriving.");
  }

  beginLoss() {
    this.state = "lost";
    this.items = [];
    this.larry.moving = false;
    this.updateHud();
    window.setTimeout(() => {
      if (this.state !== "lost") {
        return;
      }
      this.callbacks.onFinish?.({
        won: false,
        score: this.score,
        verdict: randomChoice(LOSS_VERDICTS)
      });
    }, this.reduceMotion.matches ? 100 : 700);
  }

  updateFinale(delta) {
    this.finaleClock += delta;
    this.updateEffects(delta);
    if (this.finaleClock < (this.reduceMotion.matches ? REDUCED_FINALE_DURATION : FINALE_DURATION)) {
      return;
    }

    this.state = "won";
    this.callbacks.onFinish?.({
      won: true,
      score: this.score,
      verdict: randomChoice(WIN_VERDICTS)
    });
  }

  updateHud() {
    this.callbacks.onHud?.({
      score: this.score,
      caught: this.caught,
      goal: this.goal,
      lives: this.lives
    });
  }

  drawBackground() {
    const parallax = (this.larry.x / this.width - 0.5) * this.background.naturalWidth * 0.035;
    drawImageCover(this.context, this.background, this.width, this.height, parallax);

    const shade = this.context.createLinearGradient(0, 0, 0, this.height);
    shade.addColorStop(0, "rgba(0, 49, 104, 0.12)");
    shade.addColorStop(0.45, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.25)");
    this.context.fillStyle = shade;
    this.context.fillRect(0, 0, this.width, this.height);
  }

  drawItem(item) {
    const context = this.context;
    const definition = TRASH_SPRITES[item.type];
    const x = item.x + Math.sin(item.age * 2.4 + item.swayOffset) * item.sway;
    const y = item.y;

    context.save();
    context.translate(x, y);
    context.rotate(item.rotation);
    context.shadowColor = "rgba(0, 0, 0, 0.48)";
    context.shadowBlur = 11;
    context.shadowOffsetY = 7;

    if (definition.procedural) {
      const radius = item.size * 0.43;
      const ball = context.createRadialGradient(-radius * 0.25, -radius * 0.32, 2, 0, 0, radius);
      ball.addColorStop(0, "#74599b");
      ball.addColorStop(0.58, "#36224e");
      ball.addColorStop(1, "#160e22");
      context.fillStyle = ball;
      context.beginPath();
      context.arc(0, 0, radius, 0, TAU);
      context.fill();
      context.fillStyle = "#0c0710";
      context.beginPath();
      context.arc(-radius * 0.18, -radius * 0.26, radius * 0.11, 0, TAU);
      context.arc(radius * 0.12, -radius * 0.32, radius * 0.11, 0, TAU);
      context.arc(radius * 0.25, -radius * 0.05, radius * 0.11, 0, TAU);
      context.fill();
    } else {
      const [rx, ry, rw, rh] = definition.rect;
      const sheet = this.assets.trashSheet;
      const sourceWidth = sheet.width * rw;
      const sourceHeight = sheet.height * rh;
      const ratio = sourceWidth / sourceHeight;
      const drawWidth = ratio >= 1 ? item.size : item.size * ratio;
      const drawHeight = ratio >= 1 ? item.size / ratio : item.size;
      context.drawImage(
        sheet,
        sheet.width * rx,
        sheet.height * ry,
        sourceWidth,
        sourceHeight,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
    }
    context.restore();
  }

  drawLarry(now) {
    const context = this.context;
    const sheet = this.assets.larrySheet;
    const frameWidth = sheet.width / 2;
    const frameHeight = sheet.height / 2;
    const moving = this.larry.moving && this.state === "playing";
    const frame = moving ? Math.floor(now / 115) % 4 : 0;
    const sourceX = (frame % 2) * frameWidth;
    const sourceY = Math.floor(frame / 2) * frameHeight;
    const drawWidth = this.getLarryWidth();
    const drawHeight = this.getLarryHeight();
    const bottom = this.getLarryBottom();
    const finale = this.state === "finale" ? this.getFinaleLayout() : null;
    const throwProgress = finale?.throwProgress ?? 0;
    const finaleBob = finale && throwProgress === 0 ? Math.sin(this.finaleClock * 8) * 1.5 : 0;
    let centerX = this.larry.x;
    let centerY = bottom - drawHeight / 2 + finaleBob;
    let rotation = 0;
    let spriteScale = 1;

    if (finale && throwProgress > 0) {
      const startX = this.larry.x;
      const startY = bottom - drawHeight / 2;
      const targetX = finale.x + finale.truckWidth * 0.10;
      const targetY = finale.y + finale.truckHeight * 0.46;
      const arcHeight = this.height * (this.reduceMotion.matches ? 0.13 : 0.34);
      const controlX = lerp(startX, targetX, 0.48);
      const controlY = Math.min(startY, targetY) - arcHeight;
      const inverse = 1 - throwProgress;

      centerX = inverse * inverse * startX + 2 * inverse * throwProgress * controlX + throwProgress * throwProgress * targetX;
      centerY = inverse * inverse * startY + 2 * inverse * throwProgress * controlY + throwProgress * throwProgress * targetY;
      rotation = this.reduceMotion.matches
        ? -throwProgress * 0.24
        : -throwProgress * TAU * 0.85;
      const shrink = easeBoth(range(throwProgress, 0.60, 1));
      spriteScale = lerp(1, 0.26, shrink);
    }

    context.save();
    if (throwProgress < 0.72) {
      context.globalAlpha = 1 - throwProgress * 0.72;
      context.fillStyle = "rgba(0, 0, 0, 0.32)";
      context.beginPath();
      context.ellipse(
        this.larry.x,
        bottom + 2,
        drawWidth * 0.43 * (1 - throwProgress * 0.7),
        drawHeight * 0.085 * (1 - throwProgress * 0.7),
        0,
        0,
        TAU
      );
      context.fill();
      context.globalAlpha = 1;
    }
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.scale(this.larry.direction * spriteScale, spriteScale);
    context.globalAlpha = 1 - range(throwProgress, 0.93, 1);
    context.shadowColor = "rgba(0, 0, 0, 0.42)";
    context.shadowBlur = 12;
    context.shadowOffsetY = 6;
    context.drawImage(
      sheet,
      sourceX,
      sourceY,
      frameWidth,
      frameHeight,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );
    context.restore();
  }

  drawEffects() {
    const context = this.context;
    for (const effect of this.effects) {
      const progress = effect.age / effect.life;
      const alpha = 1 - progress;
      context.save();
      context.globalAlpha = alpha;
      if (effect.kind === "particle") {
        context.fillStyle = effect.color;
        context.beginPath();
        context.arc(effect.x, effect.y, effect.size * (1 - progress * 0.5), 0, TAU);
        context.fill();
      } else {
        context.translate(effect.x, effect.y - progress * 55);
        context.font = `1000 ${clamp(this.width * 0.052, 20, 34)}px "Arial Rounded MT Bold", sans-serif`;
        context.textAlign = "center";
        context.lineWidth = 5;
        context.strokeStyle = "rgba(16, 34, 53, 0.78)";
        context.strokeText(effect.text, 0, 0);
        context.fillStyle = effect.color;
        context.fillText(effect.text, 0, 0);
      }
      context.restore();
    }
  }

  drawGrumble(now) {
    if (!this.grumble || now - this.grumble.start > this.grumble.duration) {
      return;
    }

    const context = this.context;
    const elapsed = now - this.grumble.start;
    const fade = Math.min(range(elapsed, 0, 180), 1 - range(elapsed, this.grumble.duration - 260, this.grumble.duration));
    const maxWidth = Math.min(this.width * 0.56, 290);
    const x = clamp(this.larry.x, maxWidth * 0.56, this.width - maxWidth * 0.56);
    const y = this.getLarryBottom() - this.getLarryHeight() - 68;

    context.save();
    context.globalAlpha = fade;
    context.font = `900 ${clamp(this.width * 0.029, 12, 17)}px "Arial Rounded MT Bold", sans-serif`;
    const words = this.grumble.text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth - 28 && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
    const bubbleHeight = lines.length * 20 + 26;

    context.fillStyle = "#fff8dc";
    context.strokeStyle = "#172438";
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(x - maxWidth / 2, y - bubbleHeight / 2, maxWidth, bubbleHeight, 14);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(x - 16, y + bubbleHeight / 2 - 2);
    context.lineTo(x - 3, y + bubbleHeight / 2 + 18);
    context.lineTo(x + 6, y + bubbleHeight / 2 - 2);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = "#172438";
    context.textAlign = "center";
    context.textBaseline = "middle";
    lines.forEach((text, index) => {
      context.fillText(text, x, y + (index - (lines.length - 1) / 2) * 20);
    });
    context.restore();
  }

  drawFinaleTruck() {
    const context = this.context;
    const { timeline, truckWidth, truckHeight, groundY, x, y, compactor } = this.getFinaleLayout();
    const engineRumble = Math.sin(this.finaleClock * 28) * 0.65;
    const shake = engineRumble + compactor * Math.sin(this.finaleClock * 55) * 3;

    context.save();
    context.translate(0, shake);
    context.fillStyle = "rgba(0, 0, 0, 0.35)";
    context.beginPath();
    context.ellipse(x + truckWidth * 0.5, groundY + 1, truckWidth * 0.48, truckHeight * 0.055, 0, 0, TAU);
    context.fill();
    context.drawImage(this.assets.truck, x, y, truckWidth, truckHeight);

    const beaconPulse = 0.45 + Math.sin(this.finaleClock * 12) * 0.25;
    context.fillStyle = `rgba(255, 175, 22, ${beaconPulse})`;
    context.shadowColor = "#ff9b13";
    context.shadowBlur = truckWidth * 0.045;
    context.beginPath();
    context.arc(x + truckWidth * 0.80, y + truckHeight * 0.14, truckWidth * 0.018, 0, TAU);
    context.fill();
    context.shadowBlur = 0;

    if (compactor > 0.1) {
      for (let index = 0; index < 10; index += 1) {
        const angle = -2.8 + index * 0.15;
        const distance = truckWidth * (0.04 + compactor * 0.13);
        context.strokeStyle = `rgba(255, 190, 42, ${compactor})`;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + truckWidth * 0.045, y + truckHeight * 0.49);
        context.lineTo(
          x + truckWidth * 0.045 + Math.cos(angle) * distance,
          y + truckHeight * 0.49 + Math.sin(angle) * distance
        );
        context.stroke();
      }

      context.save();
      context.translate(x + truckWidth * 0.23, y + truckHeight * 0.32);
      context.rotate(-0.16);
      context.globalAlpha = compactor;
      context.font = `1000 ${clamp(truckWidth * 0.07, 24, 40)}px "Arial Rounded MT Bold", sans-serif`;
      context.textAlign = "center";
      context.lineWidth = 7;
      context.strokeStyle = "#244217";
      context.strokeText("CRUNCH!", 0, 0);
      context.fillStyle = "#ffd339";
      context.fillText("CRUNCH!", 0, 0);
      context.restore();
    }
    context.restore();
  }

  draw(now) {
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawBackground();

    for (const item of this.items) {
      this.drawItem(item);
    }

    if (this.state === "finale") {
      const { throwProgress } = this.getFinaleLayout();
      if (throwProgress > 0.90) {
        this.drawLarry(now);
        this.drawFinaleTruck();
      } else {
        this.drawFinaleTruck();
        this.drawLarry(now);
      }
    } else {
      this.drawLarry(now);
    }
    this.drawEffects();
    this.drawGrumble(now);

    if (this.state === "paused") {
      this.context.fillStyle = "rgba(2, 15, 27, 0.18)";
      this.context.fillRect(0, 0, this.width, this.height);
    }
  }

  frame(now) {
    this.frameHandle = 0;
    const delta = Math.min(0.04, Math.max(0, (now - this.previousTime) / 1000));
    this.previousTime = now;

    if (this.state === "playing") {
      this.update(delta, now);
    } else if (this.state === "finale") {
      this.updateFinale(delta);
    } else if (this.state === "lost") {
      this.updateEffects(delta);
    }

    if (this.state !== "idle") {
      this.draw(now);
      const shouldContinue =
        this.state === "playing" ||
        this.state === "paused" ||
        this.state === "finale" ||
        (this.state === "lost" && this.effects.length > 0);
      if (shouldContinue) {
        this.frameHandle = window.requestAnimationFrame(this.frame);
      }
    }
  }
}
