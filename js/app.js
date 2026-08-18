import { loadGameAssets } from "./game/assets.js?v=20260818-5";
import { LarryGame } from "./game/game.js?v=20260818-5";

const titleScreen = document.querySelector("#title-screen");
const gameScreen = document.querySelector("#game-screen");
const gameShell = document.querySelector("#game-shell");
const canvas = document.querySelector("#game-canvas");
const playButton = document.querySelector("#play-button");
const loadingLabel = document.querySelector("#loading-label");
const pauseButton = document.querySelector("#pause-button");
const pausePanel = document.querySelector("#pause-panel");
const resumeButton = document.querySelector("#resume-button");
const resultPanel = document.querySelector("#result-panel");
const resultEyebrow = document.querySelector("#result-eyebrow");
const resultTitle = document.querySelector("#result-title");
const larryVerdict = document.querySelector("#larry-verdict");
const finalScore = document.querySelector("#final-score");
const againButton = document.querySelector("#again-button");
const scoreValue = document.querySelector("#score-value");
const livesValue = document.querySelector("#lives-value");
const routeProgressFill = document.querySelector("#route-progress-fill");
const controlHint = document.querySelector("#control-hint");
const gameStatus = document.querySelector("#game-status");
const coarsePointer = window.matchMedia("(pointer: coarse)");

let game = null;

const setHud = ({ score, caught, goal, lives }) => {
  scoreValue.textContent = String(score);
  livesValue.textContent = `${"● ".repeat(Math.max(0, lives))}${"○ ".repeat(Math.max(0, 3 - lives))}`.trim();
  routeProgressFill.style.width = `${Math.min(100, (caught / goal) * 100)}%`;
};

const setPaused = (paused) => {
  pausePanel.hidden = !paused;
  pauseButton.textContent = paused ? "▶" : "Ⅱ";
  pauseButton.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  gameShell.classList.toggle("is-paused", paused);
  if (paused) {
    resumeButton.focus({ preventScroll: true });
  } else {
    canvas.focus({ preventScroll: true });
  }
};

const showResult = ({ won, score, verdict }) => {
  pauseButton.disabled = true;
  resultEyebrow.textContent = won ? "ROUTE COMPLETE" : "ROUTE FAILED";
  resultTitle.textContent = won ? "Street cleaned!" : "Larry is not impressed.";
  larryVerdict.textContent = `“${verdict}”`;
  finalScore.textContent = String(score);
  resultPanel.hidden = false;
  againButton.focus({ preventScroll: true });
  gameStatus.textContent = won ? "You cleaned the street." : "Larry lost his patience.";
};

const updateControlHint = () => {
  controlHint.textContent = coarsePointer.matches ? "DRAG LARRY WITH YOUR FINGER" : "← → MOVE LARRY";
};

const startRound = () => {
  if (!game) {
    return;
  }
  titleScreen.hidden = true;
  gameScreen.hidden = false;
  resultPanel.hidden = true;
  pausePanel.hidden = true;
  pauseButton.disabled = false;
  controlHint.classList.remove("is-hidden");
  updateControlHint();

  game.resize();
  game.start();
  canvas.focus({ preventScroll: true });
};

const returnToMenu = () => {
  game?.stop();
  resultPanel.hidden = true;
  pausePanel.hidden = true;
  gameScreen.hidden = true;
  titleScreen.hidden = false;
  playButton.focus({ preventScroll: true });
};

const initialise = async () => {
  updateControlHint();

  try {
    const assets = await loadGameAssets();
    game = new LarryGame(canvas, assets, {
      onHud: setHud,
      onPause: setPaused,
      onFinish: showResult,
      onControl: (used) => controlHint.classList.toggle("is-hidden", used),
      onStatus: (message) => {
        gameStatus.textContent = message;
      }
    });

    playButton.disabled = false;
    loadingLabel.hidden = true;

    const preview = new URLSearchParams(window.location.search).get("preview");
    if (preview === "game" || preview === "win") {
      startRound();
      if (preview === "game") {
        game.previewItems();
      } else {
        game.forceWin();
        const requestedProgress = Number.parseFloat(new URLSearchParams(window.location.search).get("progress"));
        game.previewFinale(Number.isFinite(requestedProgress) ? requestedProgress : undefined);
      }
    }
  } catch (error) {
    loadingLabel.textContent = "Larry lost the art files";
    gameStatus.textContent = error instanceof Error ? error.message : "The game could not load.";
  }
};

playButton.addEventListener("click", startRound);
againButton.addEventListener("click", startRound);
pauseButton.addEventListener("click", () => game?.togglePause());
resumeButton.addEventListener("click", () => game?.togglePause(false));
document.querySelectorAll("[data-menu]").forEach((button) => {
  button.addEventListener("click", returnToMenu);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game?.togglePause(true);
  }
});

coarsePointer.addEventListener("change", updateControlHint);
void initialise();
