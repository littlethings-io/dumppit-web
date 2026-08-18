import { TRASH_SPRITES, drawImageCover } from "./assets.js";

const TAU = Math.PI * 2;
const BOARD_SIZE = 8;
const PIECES_PER_HAND = 3;
const LINE_GOAL = 8;
const TRASH_TYPES = ["banana", "can", "bottle", "pizza", "apple", "paper", "fish", "bricks", "barrel"];

const COLORS = {
  banana: "#f4c927",
  can: "#e74732",
  bottle: "#39a8de",
  pizza: "#d88937",
  apple: "#d94c36",
  paper: "#ded7bd",
  fish: "#9aa79c",
  bricks: "#bd5b32",
  barrel: "#658b8f"
};

const SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]]
];

const WIN_LINES = [
  "That load is packed tighter than my lunchbox.",
  "No wasted space. I almost respect that.",
  "The compactor is full and nothing exploded. Fine work.",
  "You packed it. Now try not to look so pleased with yourself."
];

const LOSS_LINES = [
  "You left me three pieces and nowhere to put them.",
  "A whole truck, and somehow you still ran out of room.",
  "I've seen raccoons pack a dumpster more efficiently.",
  "Route over. The garbage has defeated you."
];

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const randomChoice = (values) => values[Math.floor(Math.random() * values.length)];
const lerp = (start, end, progress) => start + (end - start) * progress;

const normalizeShape = (cells) => {
  const minimumX = Math.min(...cells.map(([x]) => x));
  const minimumY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minimumX, y - minimumY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};

const rotateShape = (cells) => normalizeShape(cells.map(([x, y]) => [-y, x]));

const shapeBounds = (cells) => ({
  width: Math.max(...cells.map(([x]) => x)) + 1,
  height: Math.max(...cells.map(([, y]) => y)) + 1
});

const makeBoard = () => Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

export class TruckPackerGame {
  constructor(canvas, assets, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.assets = assets;
    this.callbacks = callbacks;
    this.pixelRatio = 1;
    this.width = 1;
    this.height = 1;
    this.state = "idle";
    this.board = makeBoard();
    this.pieces = [];
    this.drag = null;
    this.score = 0;
    this.cleared = 0;
    this.moves = 0;
    this.combo = 0;
    this.effects = [];
    this.shake = 0;
    this.compactorPulse = 0;
    this.finishClock = 0;
    this.finishSent = false;
    this.previousTime = 0;
    this.frameHandle = 0;
    this.lastBackgroundIndex = -1;
    this.background = assets.backgrounds[0];
    this.hasUsedControls = false;
    this.nextPieceId = 1;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.resizeObserver = new ResizeObserver(this.resize);
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
    if (this.state !== "idle") {
      this.draw();
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
    this.board = makeBoard();
    this.pieces = this.createHand();
    this.drag = null;
    this.score = 0;
    this.cleared = 0;
    this.moves = 0;
    this.combo = 0;
    this.effects = [];
    this.shake = 0;
    this.compactorPulse = 0;
    this.finishClock = 0;
    this.finishSent = false;
    this.hasUsedControls = false;
    this.previousTime = performance.now();
    this.updateHud();
    this.callbacks.onPause?.(false);
    this.callbacks.onControl?.(false);
    this.callbacks.onStatus?.("Drag a garbage cluster into the compactor bay.");
    if (!this.frameHandle) {
      this.frameHandle = window.requestAnimationFrame(this.frame);
    }
  }

  stop() {
    this.state = "idle";
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
    const paused = typeof force === "boolean" ? force : this.state === "playing";
    this.state = paused ? "paused" : "playing";
    this.drag = null;
    this.previousTime = performance.now();
    this.callbacks.onPause?.(paused);
    this.draw();
    return paused;
  }

  createPiece() {
    let cells = randomChoice(SHAPES).map(([x, y]) => [x, y]);
    const rotations = Math.floor(Math.random() * 4);
    for (let index = 0; index < rotations; index += 1) {
      cells = rotateShape(cells);
    }
    const primaryType = randomChoice(TRASH_TYPES);
    const types = cells.map((_, index) => index === 0 || Math.random() < 0.68
      ? primaryType
      : randomChoice(TRASH_TYPES));
    return {
      id: this.nextPieceId++,
      cells,
      types,
      wobble: Math.random() * TAU
    };
  }

  createHand() {
    return Array.from({ length: PIECES_PER_HAND }, () => this.createPiece());
  }

  getLayout() {
    const boardPixels = clamp(Math.min(this.width - 30, this.height * 0.49), 250, 500);
    const cell = boardPixels / BOARD_SIZE;
    const desiredTop = clamp(this.height * 0.155, 112, 154);
    const maximumTop = this.height - boardPixels - 205;
    const boardTop = Math.max(104, Math.min(desiredTop, maximumTop));
    const boardLeft = (this.width - boardPixels) / 2;
    const trayTop = boardTop + boardPixels + clamp(this.height * 0.045, 28, 42);
    const trayBottom = this.height - clamp(this.height * 0.035, 22, 34);
    const slotWidth = this.width / PIECES_PER_HAND;
    const trayCell = Math.min(cell * 0.68, (slotWidth - 20) / 4);
    return {
      boardPixels,
      boardLeft,
      boardTop,
      boardBottom: boardTop + boardPixels,
      cell,
      trayTop,
      trayBottom,
      slotWidth,
      trayCell
    };
  }

  getPieceDisplay(piece, index, layout = this.getLayout()) {
    const bounds = shapeBounds(piece.cells);
    const width = bounds.width * layout.trayCell;
    const height = bounds.height * layout.trayCell;
    const slotCenter = layout.slotWidth * (index + 0.5);
    const availableHeight = Math.max(70, layout.trayBottom - layout.trayTop);
    const top = layout.trayTop + (availableHeight - height) * 0.5;
    return {
      left: slotCenter - width / 2,
      top,
      width,
      height,
      cell: layout.trayCell
    };
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
    const layout = this.getLayout();
    for (let index = 0; index < this.pieces.length; index += 1) {
      const piece = this.pieces[index];
      if (!piece) {
        continue;
      }
      const display = this.getPieceDisplay(piece, index, layout);
      const padding = 18;
      if (
        point.x >= display.left - padding &&
        point.x <= display.left + display.width + padding &&
        point.y >= display.top - padding &&
        point.y <= display.top + display.height + padding
      ) {
        event.preventDefault();
        this.drag = { pointerId: event.pointerId, pieceIndex: index, point };
        this.canvas.setPointerCapture(event.pointerId);
        if (!this.hasUsedControls) {
          this.hasUsedControls = true;
          this.callbacks.onControl?.(true);
        }
        this.draw();
        return;
      }
    }
  }

  onPointerMove(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId || this.state !== "playing") {
      return;
    }
    event.preventDefault();
    this.drag.point = this.pointerPosition(event);
    this.draw();
  }

  onPointerUp(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    this.drag.point = this.pointerPosition(event);
    const pieceIndex = this.drag.pieceIndex;
    const piece = this.pieces[pieceIndex];
    const anchor = piece ? this.getDragAnchor(piece, this.drag.point) : null;
    if (piece && anchor && this.canPlace(piece, anchor.column, anchor.row)) {
      this.placePiece(pieceIndex, anchor.column, anchor.row);
    } else {
      this.callbacks.onStatus?.("That garbage does not fit there.");
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.drag = null;
    this.draw();
  }

  getDragAnchor(piece, point, layout = this.getLayout()) {
    const bounds = shapeBounds(piece.cells);
    const liftedY = point.y - Math.min(78, layout.cell * 1.25);
    return {
      column: Math.round((point.x - layout.boardLeft) / layout.cell - bounds.width / 2),
      row: Math.round((liftedY - layout.boardTop) / layout.cell - bounds.height / 2)
    };
  }

  canPlace(piece, column, row) {
    return piece.cells.every(([offsetX, offsetY]) => {
      const x = column + offsetX;
      const y = row + offsetY;
      return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && !this.board[y][x];
    });
  }

  hasPlacement(piece) {
    const bounds = shapeBounds(piece.cells);
    for (let row = 0; row <= BOARD_SIZE - bounds.height; row += 1) {
      for (let column = 0; column <= BOARD_SIZE - bounds.width; column += 1) {
        if (this.canPlace(piece, column, row)) {
          return true;
        }
      }
    }
    return false;
  }

  placePiece(pieceIndex, column, row) {
    const piece = this.pieces[pieceIndex];
    if (!piece) {
      return;
    }
    piece.cells.forEach(([offsetX, offsetY], index) => {
      this.board[row + offsetY][column + offsetX] = {
        type: piece.types[index],
        rotation: (Math.random() - 0.5) * 0.3,
        seed: Math.random()
      };
    });
    this.pieces[pieceIndex] = null;
    this.moves += 1;
    this.score += piece.cells.length * 5;
    const clearedLines = this.clearCompletedLines();
    this.combo = clearedLines > 0 ? this.combo + 1 : 0;

    if (this.cleared >= LINE_GOAL) {
      this.beginWin();
      return;
    }

    if (this.pieces.every((candidate) => !candidate)) {
      this.pieces = this.createHand();
    }

    this.updateHud();
    const available = this.pieces.filter(Boolean);
    if (!available.some((candidate) => this.hasPlacement(candidate))) {
      this.beginLoss();
      return;
    }
    this.callbacks.onStatus?.(
      clearedLines
        ? `${clearedLines} compactor line${clearedLines === 1 ? "" : "s"} crushed.`
        : "Garbage placed. Keep packing."
    );
  }

  clearCompletedLines() {
    const fullRows = [];
    const fullColumns = [];
    for (let index = 0; index < BOARD_SIZE; index += 1) {
      if (this.board[index].every(Boolean)) {
        fullRows.push(index);
      }
      if (this.board.every((row) => row[index])) {
        fullColumns.push(index);
      }
    }

    const keys = new Set();
    fullRows.forEach((row) => {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        keys.add(`${column},${row}`);
      }
    });
    fullColumns.forEach((column) => {
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        keys.add(`${column},${row}`);
      }
    });

    const lineCount = fullRows.length + fullColumns.length;
    if (!lineCount) {
      return 0;
    }

    const layout = this.getLayout();
    keys.forEach((key) => {
      const [column, row] = key.split(",").map(Number);
      const cell = this.board[row][column];
      if (cell) {
        this.createCrushBurst(
          layout.boardLeft + (column + 0.5) * layout.cell,
          layout.boardTop + (row + 0.5) * layout.cell,
          COLORS[cell.type]
        );
      }
      this.board[row][column] = null;
    });

    this.cleared += lineCount;
    const multiplier = Math.max(1, this.combo + 1);
    this.score += lineCount * 100 * multiplier;
    this.compactorPulse = 1;
    this.shake = 1;
    this.effects.push({
      kind: "label",
      text: lineCount > 1 ? `DOUBLE CRUSH ×${multiplier}` : `CRUSH ×${multiplier}`,
      x: this.width / 2,
      y: layout.boardTop + layout.boardPixels * 0.48,
      age: 0,
      life: 0.85,
      color: "#ffe13c"
    });
    return lineCount;
  }

  createCrushBurst(x, y, color) {
    for (let index = 0; index < 5; index += 1) {
      const angle = Math.random() * TAU;
      const speed = 38 + Math.random() * 92;
      this.effects.push({
        kind: "particle",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: 2 + Math.random() * 5,
        color,
        age: 0,
        life: 0.45 + Math.random() * 0.35
      });
    }
  }

  beginWin() {
    this.state = "winning";
    this.finishClock = 0;
    this.finishSent = false;
    this.drag = null;
    this.score += 250;
    this.compactorPulse = 1;
    this.shake = 1;
    this.updateHud();
    this.callbacks.onStatus?.("Truck packed. Route complete.");
  }

  beginLoss() {
    this.state = "lost";
    this.finishClock = 0;
    this.finishSent = false;
    this.drag = null;
    this.callbacks.onStatus?.("No remaining garbage cluster will fit.");
  }

  forceWin() {
    if (this.state !== "playing") {
      return;
    }
    this.cleared = LINE_GOAL;
    this.score = 1240;
    this.beginWin();
  }

  previewBoard() {
    if (this.state !== "playing") {
      return;
    }
    const pattern = [
      [0, 6], [1, 6], [3, 6], [4, 6], [5, 6], [7, 6],
      [0, 7], [1, 7], [2, 7], [4, 7], [6, 7], [7, 7],
      [0, 5], [3, 5], [6, 5]
    ];
    pattern.forEach(([column, row], index) => {
      this.board[row][column] = {
        type: TRASH_TYPES[index % TRASH_TYPES.length],
        rotation: (index % 3 - 1) * 0.12,
        seed: index / pattern.length
      };
    });
    this.score = 185;
    this.cleared = 2;
    this.updateHud();
    this.draw();
  }

  updateHud() {
    this.callbacks.onHud?.({
      score: this.score,
      cleared: this.cleared,
      goal: LINE_GOAL,
      remaining: this.pieces.filter(Boolean).length,
      moves: this.moves
    });
  }

  update(delta) {
    this.compactorPulse = Math.max(0, this.compactorPulse - delta * 2.8);
    this.shake = Math.max(0, this.shake - delta * 4.5);
    for (const effect of this.effects) {
      effect.age += delta;
      if (effect.kind === "particle") {
        effect.vy += 180 * delta;
        effect.x += effect.vx * delta;
        effect.y += effect.vy * delta;
      }
    }
    this.effects = this.effects.filter((effect) => effect.age < effect.life);

    if (this.state !== "winning" && this.state !== "lost") {
      return;
    }
    this.finishClock += delta;
    if (this.finishSent || this.finishClock < (this.state === "winning" ? 1.25 : 0.65)) {
      return;
    }
    this.finishSent = true;
    const won = this.state === "winning";
    this.state = won ? "won" : "ended";
    this.callbacks.onFinish?.({
      won,
      score: this.score,
      verdict: randomChoice(won ? WIN_LINES : LOSS_LINES)
    });
  }

  drawBackground() {
    drawImageCover(this.context, this.background, this.width, this.height);
    const shade = this.context.createLinearGradient(0, 0, 0, this.height);
    shade.addColorStop(0, "rgba(3, 19, 31, 0.36)");
    shade.addColorStop(0.3, "rgba(2, 14, 22, 0.12)");
    shade.addColorStop(1, "rgba(2, 10, 14, 0.72)");
    this.context.fillStyle = shade;
    this.context.fillRect(0, 0, this.width, this.height);
  }

  drawBoard(layout) {
    const context = this.context;
    const frame = 13;
    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.58)";
    context.shadowBlur = 22;
    context.shadowOffsetY = 12;
    const metal = context.createLinearGradient(0, layout.boardTop - 38, 0, layout.boardBottom + frame);
    metal.addColorStop(0, "#8fbc2f");
    metal.addColorStop(0.25, "#4d8a1f");
    metal.addColorStop(1, "#234f18");
    context.fillStyle = metal;
    context.strokeStyle = "#173b17";
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(
      layout.boardLeft - frame,
      layout.boardTop - 38,
      layout.boardPixels + frame * 2,
      layout.boardPixels + 51,
      18
    );
    context.fill();
    context.stroke();
    context.shadowBlur = 0;

    context.fillStyle = "rgba(21, 43, 25, 0.82)";
    context.beginPath();
    context.roundRect(layout.boardLeft - 2, layout.boardTop - 29, layout.boardPixels + 4, 25, 7);
    context.fill();
    context.fillStyle = "#e3f36d";
    context.font = `1000 ${clamp(layout.cell * 0.31, 12, 19)}px "Arial Rounded MT Bold", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("DUMPPIT COMPACTOR BAY", this.width / 2, layout.boardTop - 16);

    context.fillStyle = "#0c1b18";
    context.beginPath();
    context.roundRect(layout.boardLeft - 2, layout.boardTop - 2, layout.boardPixels + 4, layout.boardPixels + 4, 8);
    context.fill();

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        const x = layout.boardLeft + column * layout.cell;
        const y = layout.boardTop + row * layout.cell;
        context.fillStyle = (row + column) % 2 ? "#172823" : "#1b3028";
        context.strokeStyle = "rgba(151, 190, 111, 0.14)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(x + 2, y + 2, layout.cell - 4, layout.cell - 4, layout.cell * 0.13);
        context.fill();
        context.stroke();
        const cell = this.board[row][column];
        if (cell) {
          this.drawGarbageCell(cell, x, y, layout.cell, 1);
        }
      }
    }

    const piston = this.compactorPulse > 0
      ? Math.sin((1 - this.compactorPulse) * Math.PI) * layout.cell * 0.42
      : 0;
    context.fillStyle = "rgba(223, 188, 45, 0.88)";
    context.fillRect(layout.boardLeft, layout.boardBottom - 5 - piston, layout.boardPixels, 6);
    context.fillStyle = "rgba(26, 44, 25, 0.85)";
    for (let column = 0; column < BOARD_SIZE; column += 2) {
      context.fillRect(
        layout.boardLeft + column * layout.cell,
        layout.boardBottom + 5,
        layout.cell,
        7
      );
    }

    const rivetRadius = clamp(layout.cell * 0.085, 3, 6);
    context.fillStyle = "#d0ba62";
    for (const [x, y] of [
      [layout.boardLeft - 7, layout.boardTop - 28],
      [layout.boardLeft + layout.boardPixels + 7, layout.boardTop - 28],
      [layout.boardLeft - 7, layout.boardBottom + 7],
      [layout.boardLeft + layout.boardPixels + 7, layout.boardBottom + 7]
    ]) {
      context.beginPath();
      context.arc(x, y, rivetRadius, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  drawGarbageCell(cellData, x, y, size, alpha = 1, ghostColor = null) {
    const context = this.context;
    const color = ghostColor || COLORS[cellData.type] || "#9dbb3b";
    context.save();
    context.globalAlpha *= alpha;
    context.fillStyle = color;
    context.strokeStyle = "rgba(24, 31, 20, 0.78)";
    context.lineWidth = Math.max(1.5, size * 0.055);
    context.beginPath();
    context.roundRect(x + size * 0.07, y + size * 0.07, size * 0.86, size * 0.86, size * 0.18);
    context.fill();
    context.stroke();

    const definition = TRASH_SPRITES[cellData.type];
    if (definition?.rect) {
      const [rx, ry, rw, rh] = definition.rect;
      const sheet = this.assets.trashSheet;
      const sourceWidth = sheet.width * rw;
      const sourceHeight = sheet.height * rh;
      const iconSize = size * 0.78;
      context.translate(x + size / 2, y + size / 2);
      context.rotate(cellData.rotation || 0);
      context.drawImage(
        sheet,
        sheet.width * rx,
        sheet.height * ry,
        sourceWidth,
        sourceHeight,
        -iconSize / 2,
        -iconSize / 2,
        iconSize,
        iconSize
      );
    }
    context.restore();
  }

  drawPiece(piece, left, top, cellSize, alpha = 1, ghostColor = null) {
    piece.cells.forEach(([column, row], index) => {
      this.drawGarbageCell(
        {
          type: piece.types[index],
          rotation: (index % 2 ? 1 : -1) * 0.08 + Math.sin(piece.wobble + index) * 0.04
        },
        left + column * cellSize,
        top + row * cellSize,
        cellSize,
        alpha,
        ghostColor
      );
    });
  }

  drawTray(layout) {
    const context = this.context;
    const trayHeight = Math.max(68, layout.trayBottom - layout.trayTop);
    context.save();
    context.fillStyle = "rgba(4, 20, 25, 0.79)";
    context.strokeStyle = "rgba(154, 197, 70, 0.44)";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(10, layout.trayTop - 20, this.width - 20, trayHeight + 28, 20);
    context.fill();
    context.stroke();
    context.fillStyle = "rgba(255, 255, 255, 0.68)";
    context.font = `900 ${clamp(this.width * 0.025, 10, 14)}px "Arial Rounded MT Bold", sans-serif`;
    context.textAlign = "center";
    context.fillText("NEXT LOAD — DRAG ONE INTO THE TRUCK", this.width / 2, layout.trayTop - 6);

    for (let index = 1; index < PIECES_PER_HAND; index += 1) {
      context.strokeStyle = "rgba(255, 255, 255, 0.08)";
      context.beginPath();
      context.moveTo(layout.slotWidth * index, layout.trayTop + 8);
      context.lineTo(layout.slotWidth * index, layout.trayBottom - 4);
      context.stroke();
    }

    this.pieces.forEach((piece, index) => {
      if (!piece || this.drag?.pieceIndex === index) {
        return;
      }
      const display = this.getPieceDisplay(piece, index, layout);
      this.drawPiece(piece, display.left, display.top, display.cell, 1);
    });
    context.restore();
  }

  drawDraggedPiece(layout) {
    if (!this.drag) {
      return;
    }
    const piece = this.pieces[this.drag.pieceIndex];
    if (!piece) {
      return;
    }
    const anchor = this.getDragAnchor(piece, this.drag.point, layout);
    const valid = this.canPlace(piece, anchor.column, anchor.row);
    const nearBoard =
      this.drag.point.y < layout.boardBottom + layout.cell * 1.7 &&
      this.drag.point.y > layout.boardTop - layout.cell;

    if (nearBoard) {
      this.drawPiece(
        piece,
        layout.boardLeft + anchor.column * layout.cell,
        layout.boardTop + anchor.row * layout.cell,
        layout.cell,
        valid ? 0.82 : 0.64,
        valid ? "#9cdd35" : "#f05a3e"
      );
      return;
    }

    const bounds = shapeBounds(piece.cells);
    const cell = layout.trayCell * 1.12;
    this.drawPiece(
      piece,
      this.drag.point.x - bounds.width * cell / 2,
      this.drag.point.y - bounds.height * cell / 2 - 46,
      cell,
      0.92
    );
  }

  drawEffects() {
    const context = this.context;
    for (const effect of this.effects) {
      const progress = effect.age / effect.life;
      context.save();
      context.globalAlpha = 1 - progress;
      if (effect.kind === "particle") {
        context.fillStyle = effect.color;
        context.beginPath();
        context.arc(effect.x, effect.y, effect.size * (1 - progress * 0.45), 0, TAU);
        context.fill();
      } else {
        context.translate(effect.x, effect.y - progress * 45);
        context.font = `1000 ${clamp(this.width * 0.072, 25, 42)}px "Arial Rounded MT Bold", sans-serif`;
        context.textAlign = "center";
        context.lineWidth = 7;
        context.strokeStyle = "#173716";
        context.strokeText(effect.text, 0, 0);
        context.fillStyle = effect.color;
        context.fillText(effect.text, 0, 0);
      }
      context.restore();
    }
  }

  drawFinishOverlay(layout) {
    if (this.state !== "winning" && this.state !== "lost") {
      return;
    }
    const context = this.context;
    const progress = clamp(this.finishClock / 0.7);
    context.save();
    context.globalAlpha = progress * 0.75;
    context.fillStyle = this.state === "winning" ? "rgba(137, 215, 37, 0.34)" : "rgba(90, 20, 13, 0.42)";
    context.fillRect(layout.boardLeft, layout.boardTop, layout.boardPixels, layout.boardPixels);
    context.restore();
  }

  draw() {
    const layout = this.getLayout();
    const shakeX = this.shake ? Math.sin(performance.now() * 0.11) * this.shake * 5 : 0;
    const shakeY = this.shake ? Math.cos(performance.now() * 0.13) * this.shake * 3 : 0;
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.save();
    this.context.translate(shakeX, shakeY);
    this.drawBackground();
    this.drawBoard(layout);
    this.drawTray(layout);
    this.drawDraggedPiece(layout);
    this.drawEffects();
    this.drawFinishOverlay(layout);
    this.context.restore();

    if (this.state === "paused") {
      this.context.fillStyle = "rgba(2, 13, 19, 0.22)";
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
      const shouldContinue =
        this.state === "playing" ||
        this.state === "paused" ||
        this.state === "winning" ||
        this.state === "lost" ||
        this.effects.length > 0;
      if (shouldContinue) {
        this.frameHandle = window.requestAnimationFrame(this.frame);
      }
    }
  }
}
