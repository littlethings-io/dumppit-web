import { PitGame } from "./game/pit.js?v=20260818-1";

const titleScreen = document.querySelector("#title-screen");
const gameScreen = document.querySelector("#game-screen");
const gameShell = document.querySelector("#game-shell");
const canvas = document.querySelector("#game-canvas");
const playButton = document.querySelector("#play-button");
const pauseButton = document.querySelector("#pause-button");
const pausePanel = document.querySelector("#pause-panel");
const resumeButton = document.querySelector("#resume-button");
const resultPanel = document.querySelector("#result-panel");
const resultEyebrow = document.querySelector("#result-eyebrow");
const resultTitle = document.querySelector("#result-title");
const pitVerdict = document.querySelector("#pit-verdict");
const finalScore = document.querySelector("#final-score");
const againButton = document.querySelector("#again-button");
const scoreValue = document.querySelector("#score-value");
const fedValue = document.querySelector("#fed-value");
const soulsValue = document.querySelector("#souls-value");
const timeValue = document.querySelector("#time-value");
const pitProgressFill = document.querySelector("#pit-progress-fill");
const controlHint = document.querySelector("#control-hint");
const gameStatus = document.querySelector("#game-status");

let game = null;

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
};

const setHud = ({ score, fed, goal, souls, time }) => {
  scoreValue.textContent = String(score);
  fedValue.textContent = `${Math.min(fed, goal)} / ${goal}`;
  soulsValue.textContent = `${"●".repeat(souls)}${"○".repeat(Math.max(0, 3 - souls))}`;
  timeValue.textContent = formatTime(time);
  pitProgressFill.style.width = `${Math.min(100, (fed / goal) * 100)}%`;
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
  resultEyebrow.textContent = won ? "SATISFIED" : "UNFINISHED";
  resultTitle.textContent = won ? "The pit is sleeping." : "It remains hungry.";
  pitVerdict.textContent = verdict;
  finalScore.textContent = String(score);
  resultPanel.hidden = false;
  againButton.focus({ preventScroll: true });
  gameStatus.textContent = won ? "The pit has been fed." : "The run has ended.";
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

const initialise = () => {
  game = new PitGame(canvas, {
    onHud: setHud,
    onPause: setPaused,
    onFinish: showResult,
    onControl: (used) => controlHint.classList.toggle("is-hidden", used),
    onStatus: (message) => {
      gameStatus.textContent = message;
    }
  });

  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview === "game" || preview === "win" || preview === "loss") {
    startRound();
    if (preview === "game") {
      game.previewWorld();
    } else if (preview === "win") {
      game.forceWin();
    } else {
      game.forceLoss();
    }
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

initialise();
