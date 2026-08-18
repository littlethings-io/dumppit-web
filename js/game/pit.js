const TAU = Math.PI * 2;
const RUN_TIME = 55;
const FEED_GOAL = 15;
const MAX_SOULS = 3;

const JUNK_TYPES = [
  { id: "can", label: "TIN CAN", radius: 21, mass: 0.9 },
  { id: "bottle", label: "BOTTLE", radius: 23, mass: 0.8 },
  { id: "clock", label: "DEAD CLOCK", radius: 24, mass: 1.1 },
  { id: "key", label: "LOST KEY", radius: 20, mass: 0.7 },
  { id: "boot", label: "OLD BOOT", radius: 25, mass: 1.3 },
  { id: "television", label: "BROKEN TV", radius: 28, mass: 1.7 },
  { id: "chair", label: "BAD CHAIR", radius: 27, mass: 1.5 },
  { id: "tire", label: "BALD TIRE", radius: 26, mass: 1.6 }
];

const WIN_VERDICTS = [
  "The pit is quiet. For now.",
  "Everything useful survived. Disappointing.",
  "It has eaten enough to dream.",
  "You fed the darkness without becoming part of it."
];

const LOSS_VERDICTS = [
  "The pit is still hungry.",
  "Some things should not have been dumped.",
  "It learned the taste of living things.",
  "The darkness expected better."
];

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const lerp = (start, end, progress) => start + (end - start) * progress;

const randomChoice = (values) => values[Math.floor(Math.random() * values.length)];

const distanceToSegment = (point, start, end) => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (!lengthSquared) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const progress = clamp(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared
  );
  const nearestX = start.x + segmentX * progress;
  const nearestY = start.y + segmentY * progress;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
};

export class PitGame {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.callbacks = callbacks;
    this.pixelRatio = 1;
    this.width = 1;
    this.height = 1;
    this.state = "idle";
    this.objects = [];
    this.currents = [];
    this.particles = [];
    this.dust = [];
    this.pointer = null;
    this.frameHandle = 0;
    this.previousTime = performance.now();
    this.nextObjectId = 1;
    this.score = 0;
    this.fed = 0;
    this.souls = MAX_SOULS;
    this.combo = 0;
    this.comboClock = 0;
    this.timeLeft = RUN_TIME;
    this.spawnClock = 0;
    this.pitPulse = 0;
    this.pitAnger = 0;
    this.shake = 0;
    this.flash = 0;
    this.finishClock = 0;
    this.finishSent = false;
    this.message = "";
    this.messageClock = 0;
    this.lastHudSignature = "";
    this.hasUsedControl = false;

    this.frame = this.frame.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
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
    this.makeDust();
    if (this.state !== "idle") {
      this.draw();
    }
  }

  makeDust() {
    const count = Math.round(clamp(this.width * this.height / 7200, 55, 130));
    this.dust = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: 0.3 + Math.random() * 1.1,
      alpha: 0.04 + Math.random() * 0.12,
      phase: index * 0.71 + Math.random() * TAU
    }));
  }

  getWorld() {
    const pitX = this.width / 2;
    const floorY = this.height - clamp(this.height * 0.105, 76, 108);
    const pitWidth = clamp(this.width * 0.2, 68, 116);
    return {
      pitX,
      floorY,
      pitWidth,
      pitHeight: pitWidth * 0.28,
      currentRadius: clamp(this.width * 0.24, 86, 138)
    };
  }

  start() {
    this.state = "playing";
    this.objects = [];
    this.currents = [];
    this.particles = [];
    this.pointer = null;
    this.score = 0;
    this.fed = 0;
    this.souls = MAX_SOULS;
    this.combo = 0;
    this.comboClock = 0;
    this.timeLeft = RUN_TIME;
    this.spawnClock = 0.18;
    this.pitPulse = 0;
    this.pitAnger = 0;
    this.shake = 0;
    this.flash = 0;
    this.finishClock = 0;
    this.finishSent = false;
    this.hasUsedControl = false;
    this.setMessage("FEED IT JUNK. SAVE WHAT IS ALIVE.", 4.2);
    this.previousTime = performance.now();
    this.updateHud(true);
    this.callbacks.onPause?.(false);
    this.callbacks.onControl?.(false);
    this.callbacks.onStatus?.("Feed junk to the pit and guide living creatures to either side.");
    if (!this.frameHandle) {
      this.frameHandle = window.requestAnimationFrame(this.frame);
    }
  }

  stop() {
    this.state = "idle";
    this.pointer = null;
    if (this.frameHandle) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  togglePause(force) {
    if (this.state !== "playing" && this.state !== "paused") {
      return false;
    }
    const paused = typeof force === "boolean" ? force : this.state === "playing";
    this.state = paused ? "paused" : "playing";
    this.pointer = null;
    this.previousTime = performance.now();
    this.callbacks.onPause?.(paused);
    this.draw();
    return paused;
  }

  setMessage(message, duration = 1.5) {
    this.message = message;
    this.messageClock = duration;
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
    event.preventDefault();
    const point = this.pointerPosition(event);
    this.pointer = {
      id: event.pointerId,
      point,
      start: point,
      moved: 0,
      time: performance.now()
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId || this.state !== "playing") {
      return;
    }
    event.preventDefault();
    const point = this.pointerPosition(event);
    const previous = this.pointer.point;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance >= 2) {
      this.applyCurrent(previous, point);
      this.pointer.moved += distance;
      this.pointer.point = point;
      this.pointer.time = performance.now();
      if (!this.hasUsedControl) {
        this.hasUsedControl = true;
        this.callbacks.onControl?.(true);
      }
    }
  }

  onPointerUp(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const point = this.pointerPosition(event);
    if (this.pointer.moved < 10) {
      this.createPulse(point);
      if (!this.hasUsedControl) {
        this.hasUsedControl = true;
        this.callbacks.onControl?.(true);
      }
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.pointer = null;
  }

  applyCurrent(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) {
      return;
    }
    const world = this.getWorld();
    const strength = clamp(distance / 28, 0.22, 1.35);
    this.currents.push({
      start: { ...start },
      end: { ...end },
      age: 0,
      life: 0.52,
      strength,
      phase: Math.random() * TAU
    });

    for (const object of this.objects) {
      if (object.state !== "free") {
        continue;
      }
      const proximity = distanceToSegment(object, start, end);
      if (proximity >= world.currentRadius) {
        continue;
      }
      const influence = 1 - proximity / world.currentRadius;
      const force = 13.5 * strength * influence / object.mass;
      object.vx += dx * force;
      object.vy += dy * force - 26 * influence;
      object.angularVelocity += (dx / Math.max(1, object.radius)) * 0.09 * influence;
      object.grounded = false;
    }

    this.emitCurrentDust(end.x, end.y, dx, dy);
  }

  createPulse(point) {
    const radius = clamp(this.width * 0.19, 68, 108);
    this.currents.push({
      start: { x: point.x - 1, y: point.y },
      end: { x: point.x + 1, y: point.y },
      age: 0,
      life: 0.45,
      strength: 0.8,
      pulse: true,
      phase: Math.random() * TAU
    });
    for (const object of this.objects) {
      if (object.state !== "free") {
        continue;
      }
      const dx = object.x - point.x;
      const dy = object.y - point.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance >= radius) {
        continue;
      }
      const influence = 1 - distance / radius;
      object.vx += dx / distance * 185 * influence / object.mass;
      object.vy += dy / distance * 185 * influence / object.mass - 35 * influence;
      object.angularVelocity += (Math.random() - 0.5) * 2.8 * influence;
      object.grounded = false;
    }
    for (let index = 0; index < 14; index += 1) {
      const angle = index / 14 * TAU;
      this.addParticle(point.x, point.y, Math.cos(angle) * 95, Math.sin(angle) * 95, 0.42, 1.5);
    }
  }

  emitCurrentDust(x, y, dx, dy) {
    for (let index = 0; index < 2; index += 1) {
      this.addParticle(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        -dx * (2 + Math.random() * 2),
        -dy * (2 + Math.random() * 2),
        0.28 + Math.random() * 0.24,
        0.8 + Math.random() * 1.4
      );
    }
  }

  addParticle(x, y, vx, vy, life, radius, dark = false) {
    this.particles.push({
      x,
      y,
      vx,
      vy,
      age: 0,
      life,
      radius,
      dark
    });
  }

  spawnObject(category) {
    const isCreature = category
      ? category === "creature"
      : this.fed >= 1 && Math.random() < 0.2;
    const definition = isCreature
      ? { id: "creature", label: "LIVING THING", radius: 20, mass: 0.72 }
      : randomChoice(JUNK_TYPES);
    const margin = definition.radius + 16;
    const object = {
      id: this.nextObjectId++,
      category: isCreature ? "creature" : "junk",
      type: definition.id,
      label: definition.label,
      radius: definition.radius * clamp(this.width / 500, 0.82, 1.08),
      mass: definition.mass,
      x: margin + Math.random() * Math.max(1, this.width - margin * 2),
      y: -definition.radius - Math.random() * 25,
      vx: (Math.random() - 0.5) * 80,
      vy: 22 + Math.random() * 35,
      rotation: (Math.random() - 0.5) * 0.8,
      angularVelocity: (Math.random() - 0.5) * 1.8,
      grounded: false,
      escapeDirection: Math.random() < 0.5 ? -1 : 1,
      hopClock: 0.35 + Math.random() * 0.8,
      phase: Math.random() * TAU,
      state: "free",
      swallow: 0,
      remove: false
    };
    this.objects.push(object);
    return object;
  }

  previewWorld() {
    if (this.state !== "playing") {
      return;
    }
    this.objects = [];
    const samples = [
      ["junk", "can", 0.18, 0.34],
      ["junk", "clock", 0.48, 0.27],
      ["creature", "creature", 0.76, 0.4],
      ["junk", "television", 0.3, 0.58],
      ["junk", "key", 0.66, 0.62],
      ["creature", "creature", 0.12, 0.73],
      ["junk", "boot", 0.84, 0.76]
    ];
    for (const [category, type, x, y] of samples) {
      const object = this.spawnObject(category);
      object.type = type;
      object.x = this.width * x;
      object.y = this.height * y;
      object.vx = (0.5 - x) * 35;
      object.vy = 15;
    }
    this.fed = 6;
    this.score = 920;
    this.timeLeft = 38;
    this.combo = 3;
    this.pitPulse = 0.55;
    this.spawnClock = 1.2;
    this.updateHud(true);
    this.draw();
  }

  forceWin() {
    if (this.state !== "playing") {
      return;
    }
    this.fed = FEED_GOAL;
    this.score = 2860;
    this.beginWin();
  }

  forceLoss() {
    if (this.state !== "playing") {
      return;
    }
    this.souls = 0;
    this.beginLoss("SOULS");
    this.updateHud(true);
  }

  update(delta) {
    this.pitPulse = Math.max(0, this.pitPulse - delta * 2.4);
    this.pitAnger = Math.max(0, this.pitAnger - delta * 1.45);
    this.shake = Math.max(0, this.shake - delta * 4.2);
    this.flash = Math.max(0, this.flash - delta * 2.8);
    this.messageClock = Math.max(0, this.messageClock - delta);
    this.comboClock = Math.max(0, this.comboClock - delta);
    if (!this.comboClock && this.combo) {
      this.combo = 0;
    }

    for (const current of this.currents) {
      current.age += delta;
    }
    this.currents = this.currents.filter((current) => current.age < current.life);

    for (const particle of this.particles) {
      particle.age += delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.pow(0.08, delta);
      particle.vy *= Math.pow(0.08, delta);
    }
    this.particles = this.particles.filter((particle) => particle.age < particle.life);

    if (this.state === "playing") {
      this.timeLeft = Math.max(0, this.timeLeft - delta);
      this.spawnClock -= delta;
      const interval = Math.max(0.62, 1.02 - this.fed * 0.018);
      if (this.spawnClock <= 0 && this.objects.length < 18) {
        this.spawnObject();
        this.spawnClock = interval * (0.78 + Math.random() * 0.42);
      }
      this.updateObjects(delta);
      if (this.timeLeft <= 0 && this.state === "playing") {
        this.beginLoss("TIME");
      }
      this.updateHud();
      return;
    }

    if (this.state === "winning" || this.state === "losing") {
      this.updateObjects(delta);
      this.finishClock += delta;
      if (!this.finishSent && this.finishClock >= 1.15) {
        this.finishSent = true;
        const won = this.state === "winning";
        this.state = won ? "won" : "ended";
        this.callbacks.onFinish?.({
          won,
          score: this.score,
          verdict: randomChoice(won ? WIN_VERDICTS : LOSS_VERDICTS)
        });
      }
    }
  }

  updateObjects(delta) {
    const world = this.getWorld();

    for (const object of this.objects) {
      if (object.state === "swallowing") {
        object.swallow = Math.min(1, object.swallow + delta / 0.42);
        const pull = 1 - Math.pow(1 - object.swallow, 3);
        object.x = lerp(object.swallowX, world.pitX, pull);
        object.y = lerp(object.swallowY, world.floorY + world.pitHeight * 0.35, pull);
        object.rotation += delta * (5 + object.swallow * 13);
        if (object.swallow >= 1) {
          object.remove = true;
          this.finishSwallow(object);
        }
        continue;
      }

      object.grounded = false;
      object.vy += 285 * delta;
      object.x += object.vx * delta;
      object.y += object.vy * delta;
      object.rotation += object.angularVelocity * delta;
      object.angularVelocity *= Math.pow(0.38, delta);

      const distanceX = world.pitX - object.x;
      const heightAbovePit = world.floorY - object.y;
      if (
        heightAbovePit > -20 &&
        heightAbovePit < world.pitWidth * 1.75 &&
        Math.abs(distanceX) < world.pitWidth * 1.55
      ) {
        const proximity = 1 - clamp(
          Math.hypot(distanceX / 1.55, heightAbovePit) / (world.pitWidth * 1.75)
        );
        object.vx += distanceX * proximity * delta * 3.1;
        object.vy += (95 + 130 * proximity) * delta;
      }

      if (
        object.category === "creature" &&
        object.y > world.floorY - 90 &&
        (object.x < -object.radius || object.x > this.width + object.radius)
      ) {
        object.remove = true;
        this.saveCreature(object);
        continue;
      }

      if (object.category === "junk" || object.y < world.floorY - 90) {
        if (object.x < object.radius) {
          object.x = object.radius;
          object.vx = Math.abs(object.vx) * 0.62;
        } else if (object.x > this.width - object.radius) {
          object.x = this.width - object.radius;
          object.vx = -Math.abs(object.vx) * 0.62;
        }
      }

      if (object.y + object.radius >= world.floorY) {
        const overMouth = Math.abs(object.x - world.pitX) < world.pitWidth * 0.82;
        if (overMouth) {
          this.beginSwallow(object);
          continue;
        }

        object.y = world.floorY - object.radius;
        object.vy = -Math.abs(object.vy) * (object.category === "creature" ? 0.24 : 0.36);
        object.vx *= 0.94;
        object.grounded = true;

        if (object.category === "creature") {
          object.hopClock -= delta;
          const direction = object.x < world.pitX ? -1 : 1;
          object.escapeDirection = direction;
          object.vx += direction * 115 * delta;
          if (object.hopClock <= 0) {
            object.vy = -105 - Math.random() * 42;
            object.hopClock = 0.55 + Math.random() * 0.75;
            object.grounded = false;
          }
        }
      }

      if (object.y > this.height + 120) {
        object.remove = true;
      }
    }

    this.objects = this.objects.filter((object) => !object.remove);
  }

  beginSwallow(object) {
    if (object.state !== "free") {
      return;
    }
    object.state = "swallowing";
    object.swallow = 0;
    object.swallowX = object.x;
    object.swallowY = object.y;
    object.vx = 0;
    object.vy = 0;
    this.pitPulse = 1;
  }

  finishSwallow(object) {
    const world = this.getWorld();
    if (object.category === "junk") {
      const continuingCombo = this.comboClock > 0;
      this.combo = continuingCombo ? this.combo + 1 : 1;
      this.comboClock = 2.25;
      this.fed += 1;
      this.score += 80 * this.combo;
      this.pitPulse = 1;
      this.shake = clamp(0.35 + this.combo * 0.08, 0, 1);
      this.setMessage(
        this.combo >= 3 ? `IT LIKES THAT.  x${this.combo}` : randomChoice(["GOOD.", "MORE.", "AGAIN."]),
        1.15
      );
      this.callbacks.onStatus?.(`${object.label} fed to the pit. ${this.fed} of ${FEED_GOAL}.`);
      this.emitSwallowBurst(world.pitX, world.floorY, false);
      if (this.fed >= FEED_GOAL) {
        this.beginWin();
      }
    } else {
      this.souls -= 1;
      this.combo = 0;
      this.comboClock = 0;
      this.score = Math.max(0, this.score - 250);
      this.pitAnger = 1;
      this.shake = 1;
      this.flash = 1;
      this.setMessage("THAT WAS ALIVE.", 2.1);
      this.callbacks.onStatus?.(`A living creature was eaten. ${this.souls} remain.`);
      this.emitSwallowBurst(world.pitX, world.floorY, true);
      if (this.souls <= 0) {
        this.beginLoss("SOULS");
      }
    }
    this.updateHud(true);
  }

  emitSwallowBurst(x, y, bright) {
    for (let index = 0; index < 28; index += 1) {
      const angle = Math.PI + Math.random() * Math.PI;
      const speed = 45 + Math.random() * 175;
      this.addParticle(
        x + (Math.random() - 0.5) * 24,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.45 + Math.random() * 0.5,
        1 + Math.random() * 3.2,
        !bright
      );
    }
  }

  saveCreature(object) {
    this.score += 160;
    this.setMessage("SOMETHING ESCAPED.", 1.35);
    this.callbacks.onStatus?.("A living creature escaped the pit.");
    for (let index = 0; index < 12; index += 1) {
      this.addParticle(
        clamp(object.x, 0, this.width),
        object.y,
        -object.escapeDirection * (30 + Math.random() * 100),
        (Math.random() - 0.5) * 100,
        0.35 + Math.random() * 0.45,
        1 + Math.random() * 2
      );
    }
    this.updateHud(true);
  }

  beginWin() {
    if (this.state !== "playing") {
      return;
    }
    this.state = "winning";
    this.finishClock = 0;
    this.finishSent = false;
    this.pointer = null;
    this.score += Math.ceil(this.timeLeft) * 25 + this.souls * 200;
    this.pitPulse = 1;
    this.shake = 0.8;
    this.setMessage("THE PIT IS FULL.", 3);
    this.callbacks.onStatus?.("The pit is full.");
    this.updateHud(true);
  }

  beginLoss(reason) {
    if (this.state !== "playing") {
      return;
    }
    this.state = "losing";
    this.finishClock = 0;
    this.finishSent = false;
    this.pointer = null;
    this.pitAnger = 1;
    this.shake = 0.65;
    this.setMessage(reason === "TIME" ? "IT IS STILL HUNGRY." : "YOU FED IT LIFE.", 3);
    this.callbacks.onStatus?.(
      reason === "TIME" ? "Time expired before the pit was fed." : "The pit ate too many living creatures."
    );
  }

  updateHud(force = false) {
    const seconds = Math.max(0, Math.ceil(this.timeLeft));
    const signature = [this.score, this.fed, this.souls, seconds].join(":");
    if (!force && signature === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = signature;
    this.callbacks.onHud?.({
      score: this.score,
      fed: this.fed,
      goal: FEED_GOAL,
      souls: this.souls,
      time: seconds
    });
  }

  drawBackground(now) {
    const context = this.context;
    const gradient = context.createRadialGradient(
      this.width * 0.5,
      this.height * 0.48,
      20,
      this.width * 0.5,
      this.height * 0.52,
      Math.max(this.width, this.height) * 0.7
    );
    gradient.addColorStop(0, "#111111");
    gradient.addColorStop(0.55, "#080808");
    gradient.addColorStop(1, "#020202");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);

    for (const speck of this.dust) {
      const pulse = 0.55 + Math.sin(now * 0.0012 + speck.phase) * 0.45;
      context.globalAlpha = speck.alpha * pulse;
      context.fillStyle = "#f7f4e9";
      context.beginPath();
      context.arc(speck.x, speck.y, speck.radius, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;

    context.save();
    context.strokeStyle = "rgba(245, 242, 231, 0.055)";
    context.lineWidth = 1;
    for (let line = 0; line < 5; line += 1) {
      const baseY = this.height * (0.23 + line * 0.13);
      context.beginPath();
      for (let x = -20; x <= this.width + 20; x += 16) {
        const y = baseY +
          Math.sin(x * 0.013 + now * 0.00016 + line) * (14 + line * 5) +
          Math.sin(x * 0.041 - now * 0.00011) * 5;
        if (x === -20) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    }
    context.restore();
  }

  drawFloor(world, now) {
    const context = this.context;
    const floorGradient = context.createLinearGradient(0, world.floorY - 12, 0, this.height);
    floorGradient.addColorStop(0, "rgba(237, 234, 221, 0.055)");
    floorGradient.addColorStop(1, "rgba(255, 255, 255, 0.015)");
    context.fillStyle = floorGradient;
    context.fillRect(0, world.floorY, this.width, this.height - world.floorY);

    context.strokeStyle = "rgba(245, 242, 231, 0.24)";
    context.lineWidth = 1.2;
    context.beginPath();
    for (let x = 0; x <= this.width; x += 12) {
      const y = world.floorY + Math.sin(x * 0.09 + now * 0.0007) * 1.3;
      if (!x) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();

    this.drawExit(16, world.floorY, -1, now);
    this.drawExit(this.width - 16, world.floorY, 1, now);
  }

  drawExit(x, y, direction, now) {
    const context = this.context;
    const pulse = 0.55 + Math.sin(now * 0.004 + direction) * 0.25;
    context.save();
    context.translate(x, y - 20);
    context.scale(direction, 1);
    context.strokeStyle = `rgba(255, 255, 247, ${pulse})`;
    context.lineWidth = 2;
    for (let index = 0; index < 3; index += 1) {
      context.beginPath();
      context.moveTo(index * 8, -9);
      context.lineTo(index * 8 + 8, 0);
      context.lineTo(index * 8, 9);
      context.stroke();
    }
    context.restore();
  }

  drawPit(world, now) {
    const context = this.context;
    const mood = 1 + this.pitPulse * 0.12 + Math.sin(now * 0.0034) * 0.025;
    const width = world.pitWidth * mood;
    const height = world.pitHeight * (1 + this.pitPulse * 0.42);
    const anger = this.pitAnger;

    context.save();
    context.translate(world.pitX, world.floorY + 2);

    for (let ring = 3; ring >= 0; ring -= 1) {
      context.strokeStyle = `rgba(245, 242, 231, ${0.055 + ring * 0.035 + this.pitPulse * 0.08})`;
      context.lineWidth = ring === 0 ? 3 : 1.1;
      context.beginPath();
      context.ellipse(
        0,
        0,
        width + ring * 13 + Math.sin(now * 0.002 + ring) * 4,
        height + ring * 4,
        Math.sin(now * 0.001 + ring) * 0.025,
        0,
        TAU
      );
      context.stroke();
    }

    const mouthGradient = context.createRadialGradient(0, 0, 4, 0, 0, width);
    mouthGradient.addColorStop(0, "#000000");
    mouthGradient.addColorStop(0.68, "#010101");
    mouthGradient.addColorStop(1, anger ? "#2a2a2a" : "#090909");
    context.fillStyle = mouthGradient;
    context.beginPath();
    context.ellipse(0, 1, width, height, 0, 0, TAU);
    context.fill();

    context.strokeStyle = anger
      ? "rgba(255, 255, 255, 0.94)"
      : "rgba(248, 245, 233, 0.62)";
    context.lineWidth = 2.4 + this.pitPulse * 2;
    context.stroke();

    const teeth = 8 + Math.min(5, this.combo);
    context.fillStyle = "rgba(249, 246, 235, 0.88)";
    for (let index = 0; index < teeth; index += 1) {
      const progress = (index + 0.5) / teeth;
      const x = lerp(-width * 0.78, width * 0.78, progress);
      const curve = Math.sqrt(Math.max(0, 1 - Math.pow(x / width, 2)));
      const tooth = 5 + (index % 3) * 2 + this.pitPulse * 4;
      context.beginPath();
      context.moveTo(x - 4, -height * curve * 0.64);
      context.lineTo(x + 4, -height * curve * 0.64);
      context.lineTo(x, -height * curve * 0.64 + tooth);
      context.closePath();
      context.fill();
    }

    if (this.combo >= 4 || anger > 0.1) {
      const eyeOffset = width * 0.34;
      const eyeY = -height - 15 - Math.sin(now * 0.005) * 2;
      for (const eyeX of [-eyeOffset, eyeOffset]) {
        context.fillStyle = "rgba(248, 246, 236, 0.9)";
        context.beginPath();
        context.ellipse(eyeX, eyeY, 8, 5, 0, 0, TAU);
        context.fill();
        context.fillStyle = "#050505";
        context.beginPath();
        context.arc(eyeX + Math.sin(now * 0.002) * 2, eyeY, 2.5, 0, TAU);
        context.fill();
      }
    }

    context.restore();
  }

  drawCurrents() {
    const context = this.context;
    for (const current of this.currents) {
      const progress = current.age / current.life;
      context.save();
      context.globalAlpha = (1 - progress) * 0.78;
      context.strokeStyle = "#f7f4e9";
      context.lineCap = "round";

      if (current.pulse) {
        const radius = 8 + progress * clamp(this.width * 0.19, 68, 108);
        context.lineWidth = 2.2 * (1 - progress);
        context.beginPath();
        context.arc(current.start.x, current.start.y, radius, 0, TAU);
        context.stroke();
      } else {
        const dx = current.end.x - current.start.x;
        const dy = current.end.y - current.start.y;
        const normalX = -dy * 0.13;
        const normalY = dx * 0.13;
        for (let ribbon = -1; ribbon <= 1; ribbon += 1) {
          const offset = ribbon * 6;
          context.lineWidth = ribbon ? 1.1 : 2.3;
          context.beginPath();
          context.moveTo(
            current.start.x + normalX * 0.2 + offset,
            current.start.y + normalY * 0.2 + offset
          );
          context.quadraticCurveTo(
            (current.start.x + current.end.x) / 2 + normalX + offset,
            (current.start.y + current.end.y) / 2 + normalY + offset,
            current.end.x + offset,
            current.end.y + offset
          );
          context.stroke();
        }
      }
      context.restore();
    }
  }

  drawObject(object, now) {
    const context = this.context;
    const swallowScale = object.state === "swallowing"
      ? Math.max(0.03, 1 - Math.pow(object.swallow, 1.6))
      : 1;
    const wobble = object.category === "creature"
      ? 1 + Math.sin(now * 0.009 + object.phase) * 0.055
      : 1;

    context.save();
    context.translate(object.x, object.y);
    context.rotate(object.rotation);
    context.scale(swallowScale * wobble, swallowScale / wobble);
    context.lineCap = "round";
    context.lineJoin = "round";

    if (object.category === "creature") {
      this.drawCreature(object, now);
    } else {
      this.drawJunk(object);
    }
    context.restore();
  }

  prepareJunkStyle(radius) {
    const context = this.context;
    context.fillStyle = "rgba(246, 243, 232, 0.09)";
    context.strokeStyle = "rgba(249, 247, 238, 0.92)";
    context.lineWidth = clamp(radius * 0.085, 1.6, 2.8);
  }

  drawJunk(object) {
    const context = this.context;
    const radius = object.radius;
    this.prepareJunkStyle(radius);

    switch (object.type) {
      case "can": {
        context.beginPath();
        context.roundRect(-radius * 0.5, -radius * 0.75, radius, radius * 1.5, radius * 0.17);
        context.fill();
        context.stroke();
        for (const y of [-radius * 0.58, radius * 0.58]) {
          context.beginPath();
          context.ellipse(0, y, radius * 0.5, radius * 0.14, 0, 0, TAU);
          context.stroke();
        }
        context.beginPath();
        context.moveTo(-radius * 0.25, -radius * 0.2);
        context.lineTo(radius * 0.18, radius * 0.23);
        context.stroke();
        break;
      }
      case "bottle": {
        context.beginPath();
        context.moveTo(-radius * 0.18, -radius * 0.88);
        context.lineTo(radius * 0.18, -radius * 0.88);
        context.lineTo(radius * 0.22, -radius * 0.54);
        context.quadraticCurveTo(radius * 0.56, -radius * 0.38, radius * 0.48, radius * 0.72);
        context.quadraticCurveTo(0, radius * 0.9, -radius * 0.48, radius * 0.72);
        context.quadraticCurveTo(-radius * 0.56, -radius * 0.38, -radius * 0.22, -radius * 0.54);
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(-radius * 0.19, -radius * 0.69);
        context.lineTo(radius * 0.19, -radius * 0.69);
        context.stroke();
        break;
      }
      case "clock": {
        context.beginPath();
        context.arc(0, 0, radius * 0.78, 0, TAU);
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -radius * 0.45);
        context.moveTo(0, 0);
        context.lineTo(radius * 0.38, radius * 0.2);
        context.stroke();
        context.beginPath();
        context.moveTo(-radius * 0.43, -radius * 0.7);
        context.lineTo(-radius * 0.68, -radius * 0.93);
        context.moveTo(radius * 0.43, -radius * 0.7);
        context.lineTo(radius * 0.68, -radius * 0.93);
        context.stroke();
        break;
      }
      case "key": {
        context.beginPath();
        context.arc(-radius * 0.43, -radius * 0.16, radius * 0.32, 0, TAU);
        context.moveTo(-radius * 0.12, 0);
        context.lineTo(radius * 0.72, radius * 0.52);
        context.lineTo(radius * 0.54, radius * 0.8);
        context.moveTo(radius * 0.35, radius * 0.3);
        context.lineTo(radius * 0.17, radius * 0.58);
        context.stroke();
        break;
      }
      case "boot": {
        context.beginPath();
        context.moveTo(-radius * 0.46, -radius * 0.82);
        context.lineTo(radius * 0.18, -radius * 0.76);
        context.lineTo(radius * 0.12, radius * 0.18);
        context.quadraticCurveTo(radius * 0.32, radius * 0.38, radius * 0.83, radius * 0.45);
        context.lineTo(radius * 0.75, radius * 0.78);
        context.lineTo(-radius * 0.55, radius * 0.72);
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(-radius * 0.25, -radius * 0.4);
        context.lineTo(radius * 0.1, -radius * 0.36);
        context.moveTo(-radius * 0.25, -radius * 0.12);
        context.lineTo(radius * 0.08, -radius * 0.08);
        context.stroke();
        break;
      }
      case "television": {
        context.beginPath();
        context.roundRect(-radius * 0.82, -radius * 0.57, radius * 1.64, radius * 1.18, radius * 0.12);
        context.fill();
        context.stroke();
        context.beginPath();
        context.roundRect(-radius * 0.62, -radius * 0.4, radius * 1.04, radius * 0.72, radius * 0.08);
        context.stroke();
        context.beginPath();
        context.arc(radius * 0.61, -radius * 0.14, radius * 0.08, 0, TAU);
        context.arc(radius * 0.61, radius * 0.15, radius * 0.08, 0, TAU);
        context.moveTo(-radius * 0.28, -radius * 0.58);
        context.lineTo(-radius * 0.54, -radius * 0.98);
        context.moveTo(radius * 0.05, -radius * 0.58);
        context.lineTo(radius * 0.34, -radius * 0.98);
        context.stroke();
        break;
      }
      case "chair": {
        context.beginPath();
        context.roundRect(-radius * 0.54, -radius * 0.78, radius * 0.95, radius * 0.72, radius * 0.08);
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(-radius * 0.58, radius * 0.08);
        context.lineTo(radius * 0.58, radius * 0.08);
        context.lineTo(radius * 0.5, radius * 0.42);
        context.lineTo(-radius * 0.5, radius * 0.42);
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(-radius * 0.42, radius * 0.42);
        context.lineTo(-radius * 0.58, radius * 0.92);
        context.moveTo(radius * 0.4, radius * 0.42);
        context.lineTo(radius * 0.6, radius * 0.92);
        context.stroke();
        break;
      }
      case "tire":
      default: {
        context.beginPath();
        context.arc(0, 0, radius * 0.82, 0, TAU);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(0, 0, radius * 0.38, 0, TAU);
        context.stroke();
        for (let angle = 0; angle < TAU; angle += TAU / 8) {
          context.beginPath();
          context.moveTo(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62);
          context.lineTo(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82);
          context.stroke();
        }
      }
    }
  }

  drawCreature(object, now) {
    const context = this.context;
    const radius = object.radius;
    const blink = Math.sin(now * 0.0017 + object.phase) > 0.94 ? 0.15 : 1;
    const step = Math.sin(now * 0.012 + object.phase) * radius * 0.16;

    context.save();
    context.strokeStyle = "rgba(255, 255, 247, 0.2)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(0, 0, radius * 1.32, 0, TAU);
    context.stroke();
    context.restore();

    context.fillStyle = "rgba(246, 244, 235, 0.92)";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2.1;
    context.beginPath();
    context.moveTo(-radius * 0.72, radius * 0.28);
    context.quadraticCurveTo(-radius * 0.88, -radius * 0.52, -radius * 0.22, -radius * 0.76);
    context.quadraticCurveTo(radius * 0.5, -radius * 0.95, radius * 0.77, -radius * 0.12);
    context.quadraticCurveTo(radius * 0.94, radius * 0.56, radius * 0.25, radius * 0.7);
    context.quadraticCurveTo(-radius * 0.45, radius * 0.87, -radius * 0.72, radius * 0.28);
    context.closePath();
    context.fill();
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 247, 0.94)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius * 0.34, radius * 0.57);
    context.lineTo(-radius * 0.5 + step, radius * 1.03);
    context.moveTo(radius * 0.32, radius * 0.58);
    context.lineTo(radius * 0.5 - step, radius * 1.03);
    context.stroke();

    for (const x of [-radius * 0.28, radius * 0.3]) {
      context.fillStyle = "#060606";
      context.beginPath();
      context.ellipse(x, -radius * 0.15, radius * 0.105, radius * 0.18 * blink, 0, 0, TAU);
      context.fill();
    }

    context.strokeStyle = "#080808";
    context.lineWidth = 1.7;
    context.beginPath();
    context.arc(0, radius * 0.26, radius * 0.17, 0.1, Math.PI - 0.1);
    context.stroke();
  }

  drawParticles() {
    const context = this.context;
    for (const particle of this.particles) {
      const progress = particle.age / particle.life;
      context.save();
      context.globalAlpha = 1 - progress;
      context.fillStyle = particle.dark ? "#050505" : "#faf8ef";
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius * (1 - progress * 0.45), 0, TAU);
      context.fill();
      context.restore();
    }
  }

  drawMessage() {
    if (!this.messageClock || !this.message) {
      return;
    }
    const context = this.context;
    const alpha = clamp(this.messageClock * 2) * 0.92;
    context.save();
    context.globalAlpha = alpha;
    context.font = `900 ${clamp(this.width * 0.033, 12, 18)}px "Arial Narrow", "Trebuchet MS", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.letterSpacing = "0.14em";
    const metrics = context.measureText(this.message);
    const padding = 18;
    const y = clamp(this.height * 0.145, 105, 142);
    context.fillStyle = "rgba(0, 0, 0, 0.68)";
    context.beginPath();
    context.roundRect(
      this.width / 2 - metrics.width / 2 - padding,
      y - 17,
      metrics.width + padding * 2,
      34,
      17
    );
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.28)";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#f7f4e9";
    context.fillText(this.message, this.width / 2, y + 1);
    context.restore();
  }

  drawFinishWash() {
    if (this.state !== "winning" && this.state !== "losing") {
      return;
    }
    const context = this.context;
    const progress = clamp(this.finishClock / 0.8);
    context.save();
    context.globalAlpha = progress * (this.state === "winning" ? 0.2 : 0.34);
    context.fillStyle = this.state === "winning" ? "#ffffff" : "#000000";
    context.fillRect(0, 0, this.width, this.height);
    context.restore();
  }

  draw() {
    const now = performance.now();
    const world = this.getWorld();
    const shakeX = this.shake ? Math.sin(now * 0.09) * this.shake * 7 : 0;
    const shakeY = this.shake ? Math.cos(now * 0.12) * this.shake * 4 : 0;

    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.save();
    this.context.translate(shakeX, shakeY);
    this.drawBackground(now);
    this.drawFloor(world, now);
    this.drawPit(world, now);

    for (const object of this.objects) {
      this.drawObject(object, now);
    }

    this.drawCurrents();
    this.drawParticles();
    this.drawMessage();
    this.drawFinishWash();
    this.context.restore();

    if (this.flash > 0) {
      this.context.save();
      this.context.globalAlpha = this.flash * 0.22;
      this.context.fillStyle = "#ffffff";
      this.context.fillRect(0, 0, this.width, this.height);
      this.context.restore();
    }

    if (this.state === "paused") {
      this.context.fillStyle = "rgba(0, 0, 0, 0.32)";
      this.context.fillRect(0, 0, this.width, this.height);
    }
  }

  frame(now) {
    this.frameHandle = 0;
    const delta = Math.min(0.04, Math.max(0, (now - this.previousTime) / 1000));
    this.previousTime = now;
    if (this.state !== "paused") {
      this.update(delta);
    }
    if (this.state !== "idle") {
      this.draw();
      const continueDrawing =
        this.state === "playing" ||
        this.state === "paused" ||
        this.state === "winning" ||
        this.state === "losing" ||
        this.currents.length > 0 ||
        this.particles.length > 0;
      if (continueDrawing) {
        this.frameHandle = window.requestAnimationFrame(this.frame);
      }
    }
  }
}
