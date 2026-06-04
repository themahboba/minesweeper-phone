const LEVELS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 10, mines: 20 },
  hard: { rows: 14, cols: 10, mines: 30 },
};

const numberIcons = ["", "1", "2", "3", "4", "5", "6", "7", "8"];
const mineIcon = "*";
const flagIcon = "⚑";

const boardEl = document.querySelector("#board");
const mineCountEl = document.querySelector("#mine-count");
const timerEl = document.querySelector("#timer");
const statusEl = document.querySelector("#status");
const bestTimeEl = document.querySelector("#best-time");
const faceButton = document.querySelector("#face");
const newGameButton = document.querySelector("#new-game");
const difficultySelect = document.querySelector("#difficulty");
const flagModeButton = document.querySelector("#flag-mode");
const playerNameInput = document.querySelector("#player-name");
const leaderboardListEl = document.querySelector("#leaderboard-list");
const clearLeaderboardButton = document.querySelector("#clear-leaderboard");
const scoreDialog = document.querySelector("#score-dialog");
const scoreForm = document.querySelector("#score-form");
const scoreNameInput = document.querySelector("#score-name");
const scoreTimeEl = document.querySelector("#score-time");
const settingsButton = document.querySelector("#settings-button");
const settingsDialog = document.querySelector("#settings-dialog");
const gamePanelEl = document.querySelector(".game-panel");
const backgroundSwatches = document.querySelector("#background-swatches");
const panelSwatches = document.querySelector("#panel-swatches");
const customColourInput = document.querySelector("#custom-colour");
const hexColourInput = document.querySelector("#hex-colour");
const panelCustomColourInput = document.querySelector("#panel-custom-colour");
const panelHexColourInput = document.querySelector("#panel-hex-colour");

const BACKGROUNDS = new Set(["night", "forest", "ocean", "berry", "sunrise", "mono", "custom"]);
const PANEL_COLOURS = new Set(["black", "white", "night", "forest", "ocean", "berry", "sunrise", "mono", "custom"]);
const DEFAULT_CUSTOM_COLOUR = "#2DD4BF";
const DEFAULT_PANEL_CUSTOM_COLOUR = "#151C2B";
const LEVEL_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Difficult",
};

let state = {};
let pendingScore = null;

function newState(levelName = difficultySelect.value) {
  const level = LEVELS[levelName];
  return {
    levelName,
    ...level,
    cells: [],
    started: false,
    over: false,
    won: false,
    flagMode: false,
    flags: 0,
    opened: 0,
    seconds: 0,
    timerId: null,
    pressTimer: null,
    longPressFired: false,
  };
}

function startGame(levelName = difficultySelect.value) {
  clearInterval(state.timerId);
  state = newState(levelName);
  boardEl.style.setProperty("--rows", state.rows);
  boardEl.style.setProperty("--cols", state.cols);
  buildEmptyBoard();
  render();
  updateBestTime();
  renderLeaderboard();
}

function buildEmptyBoard() {
  state.cells = Array.from({ length: state.rows * state.cols }, (_, index) => ({
    index,
    row: Math.floor(index / state.cols),
    col: index % state.cols,
    mine: false,
    flagged: false,
    open: false,
    adjacent: 0,
  }));
}

function placeMines(firstIndex) {
  const safe = new Set([firstIndex, ...neighborIndexes(firstIndex)]);
  const candidates = state.cells.map((cell) => cell.index).filter((index) => !safe.has(index));

  for (let placed = 0; placed < state.mines; placed += 1) {
    const pick = Math.floor(Math.random() * candidates.length);
    const [index] = candidates.splice(pick, 1);
    state.cells[index].mine = true;
  }

  for (const cell of state.cells) {
    if (!cell.mine) {
      cell.adjacent = neighborIndexes(cell.index).filter((index) => state.cells[index].mine).length;
    }
  }
}

function neighborIndexes(index) {
  const { row, col } = state.cells[index];
  const indexes = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < state.rows && nextCol >= 0 && nextCol < state.cols) {
        indexes.push(nextRow * state.cols + nextCol);
      }
    }
  }

  return indexes;
}

function startTimer() {
  if (state.timerId) return;
  state.timerId = setInterval(() => {
    state.seconds = Math.min(999, state.seconds + 1);
    timerEl.textContent = formatNumber(state.seconds);
  }, 1000);
}

function reveal(index) {
  if (state.over) return;

  const cell = state.cells[index];
  if (!cell || cell.open || cell.flagged) return;

  if (!state.started) {
    state.started = true;
    placeMines(index);
    startTimer();
    statusEl.textContent = "Playing";
  }

  if (cell.mine) {
    cell.open = true;
    endGame(false);
    return;
  }

  floodOpen(index);
  checkWin();
  render();
}

function floodOpen(startIndex) {
  const queue = [startIndex];
  const visited = new Set();

  while (queue.length > 0) {
    const index = queue.shift();
    if (visited.has(index)) continue;
    visited.add(index);

    const cell = state.cells[index];
    if (!cell || cell.open || cell.flagged || cell.mine) continue;

    cell.open = true;
    state.opened += 1;

    if (cell.adjacent === 0) {
      for (const neighbor of neighborIndexes(index)) {
        const next = state.cells[neighbor];
        if (!next.open && !next.flagged && !next.mine) queue.push(neighbor);
      }
    }
  }
}

function toggleFlag(index) {
  if (state.over) return;

  const cell = state.cells[index];
  if (!cell || cell.open) return;

  if (!state.started) {
    state.started = true;
    placeMines(index);
    startTimer();
    statusEl.textContent = "Playing";
  }

  cell.flagged = !cell.flagged;
  state.flags += cell.flagged ? 1 : -1;
  checkWin();
  render();
}

function openAround(index) {
  if (state.over) return;
  const cell = state.cells[index];
  if (!cell.open || cell.adjacent === 0) return;

  const neighbors = neighborIndexes(index);
  const flags = neighbors.filter((neighbor) => state.cells[neighbor].flagged).length;
  if (flags !== cell.adjacent) return;

  for (const neighbor of neighbors) {
    const next = state.cells[neighbor];
    if (!next.flagged && !next.open) reveal(neighbor);
  }
}

function checkWin() {
  const safeCells = state.rows * state.cols - state.mines;
  const minesFlagged = state.cells.filter((cell) => cell.mine && cell.flagged).length;

  if (state.opened === safeCells || (minesFlagged === state.mines && state.flags === state.mines)) {
    endGame(true);
  }
}

function endGame(won) {
  state.over = true;
  state.won = won;
  clearInterval(state.timerId);
  state.timerId = null;

  if (won) {
    statusEl.textContent = "Cleared";
    faceButton.querySelector("span").textContent = "B)";
    state.cells.forEach((cell) => {
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        state.flags += 1;
      }
    });
    saveBestTime();
    requestScoreName();
  } else {
    statusEl.textContent = "Boom";
    faceButton.querySelector("span").textContent = ":(";
  }

  render();
}

function saveBestTime() {
  const key = bestKey();
  const current = Number(localStorage.getItem(key));
  if (!current || state.seconds < current) {
    localStorage.setItem(key, String(state.seconds));
  }
  updateBestTime();
}

function updateBestTime() {
  const best = Number(localStorage.getItem(bestKey()));
  bestTimeEl.textContent = best ? `Best ${best}s` : "Best --";
}

function bestKey() {
  return `minesweeper-best-${state.levelName}`;
}

function leaderboardKey(levelName = state.levelName) {
  return `minesweeper-leaderboard-${levelName}`;
}

function getPlayerName() {
  const name = playerNameInput.value.trim();
  return name || "Player";
}

function getScores(levelName = state.levelName) {
  try {
    const scores = JSON.parse(localStorage.getItem(leaderboardKey(levelName))) || [];
    return Array.isArray(scores) ? scores : [];
  } catch {
    return [];
  }
}

function saveScores(scores, levelName = state.levelName) {
  localStorage.setItem(leaderboardKey(levelName), JSON.stringify(scores));
}

function recordScore(score = pendingScore, name = getPlayerName()) {
  if (!score) return;

  const scores = getScores(score.levelName);
  scores.push({
    name,
    levelName: score.levelName,
    seconds: score.seconds,
    date: score.date,
  });

  scores.sort((a, b) => a.seconds - b.seconds || new Date(a.date) - new Date(b.date));
  saveScores(scores.slice(0, 10), score.levelName);
  renderLeaderboard();
}

function requestScoreName() {
  pendingScore = {
    levelName: state.levelName,
    seconds: state.seconds,
    date: new Date().toISOString(),
  };
  scoreTimeEl.textContent = `${state.seconds}s`;
  scoreNameInput.value = getPlayerName();
  scoreDialog.showModal();
  scoreNameInput.focus();
  scoreNameInput.select();
}

function savePendingScore() {
  if (!pendingScore) return;

  const name = scoreNameInput.value.trim() || "Player";
  playerNameInput.value = name;
  localStorage.setItem("minesweeper-player-name", name);
  recordScore(pendingScore, name);
  pendingScore = null;
  scoreDialog.close();
}

function renderLeaderboard() {
  const scores = getScores();
  const fragment = document.createDocumentFragment();

  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-score";
    empty.textContent = "No clears yet";
    fragment.appendChild(empty);
  } else {
    scores.forEach((score, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("span");
      const name = document.createElement("strong");
      const level = document.createElement("span");
      const time = document.createElement("span");
      const date = document.createElement("small");

      rank.textContent = `#${index + 1}`;
      name.textContent = score.name;
      level.className = "score-level";
      level.textContent = LEVEL_LABELS[score.levelName || state.levelName] || score.levelName || state.levelName;
      time.textContent = `${score.seconds}s`;
      date.textContent = formatScoreDate(score.date);

      item.append(rank, name, level, time, date);
      fragment.appendChild(item);
    });
  }

  leaderboardListEl.replaceChildren(fragment);
}

function formatScoreDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeHex(value) {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`.toUpperCase();
  return null;
}

function hexToRgb(hex) {
  const cleanHex = hex.slice(1);
  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const nextR = r / 255;
  const nextG = g / 255;
  const nextB = b / 255;
  const max = Math.max(nextR, nextG, nextB);
  const min = Math.min(nextR, nextG, nextB);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === nextR) {
      h = (nextG - nextB) / delta + (nextG < nextB ? 6 : 0);
    } else if (max === nextG) {
      h = (nextB - nextR) / delta + 2;
    } else {
      h = (nextR - nextG) / delta + 4;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function setGradientVars(target, prefix, hex, alpha = 0.24) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const saturation = Math.max(34, Math.min(76, s));
  const startLight = Math.max(5, Math.min(13, Math.round(l * 0.18)));
  const midLight = Math.max(14, Math.min(26, Math.round(l * 0.38)));
  const endLight = Math.max(18, Math.min(34, Math.round(l * 0.5)));

  target.style.setProperty(`--${prefix}-radial`, `hsla(${h}, ${saturation}%, 62%, ${alpha})`);
  target.style.setProperty(`--${prefix}-start`, `hsl(${h}, ${saturation}%, ${startLight}%)`);
  target.style.setProperty(`--${prefix}-mid`, `hsl(${(h + 12) % 360}, ${saturation}%, ${midLight}%)`);
  target.style.setProperty(`--${prefix}-end`, `hsl(${(h + 28) % 360}, ${saturation}%, ${endLight}%)`);
}

function clearGradientVars(target, prefix) {
  target.style.removeProperty(`--${prefix}-radial`);
  target.style.removeProperty(`--${prefix}-start`);
  target.style.removeProperty(`--${prefix}-mid`);
  target.style.removeProperty(`--${prefix}-end`);
}

function syncCustomColour(hex) {
  customColourInput.value = hex;
  hexColourInput.value = hex;
  localStorage.setItem("minesweeper-custom-colour", hex);
}

function syncPanelCustomColour(hex) {
  panelCustomColourInput.value = hex;
  panelHexColourInput.value = hex;
  localStorage.setItem("minesweeper-panel-custom-colour", hex);
}

function applyBackground(background, customHex = localStorage.getItem("minesweeper-custom-colour")) {
  const safeBackground = BACKGROUNDS.has(background) ? background : "night";
  document.body.dataset.background = safeBackground;
  localStorage.setItem("minesweeper-background", safeBackground);

  if (safeBackground === "custom") {
    const safeHex = normalizeHex(customHex || "") || DEFAULT_CUSTOM_COLOUR;
    syncCustomColour(safeHex);
    setGradientVars(document.documentElement, "bg", safeHex);
  } else {
    clearGradientVars(document.documentElement, "bg");
  }

  for (const swatch of backgroundSwatches.querySelectorAll("[data-bg-option]")) {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.bgOption === safeBackground));
  }
}

function handleCustomColour(value) {
  const hex = normalizeHex(value);
  if (!hex) return;
  applyBackground("custom", hex);
}

function applyPanelColour(panelColour, customHex = localStorage.getItem("minesweeper-panel-custom-colour")) {
  const safePanelColour = PANEL_COLOURS.has(panelColour) ? panelColour : "night";
  gamePanelEl.dataset.panel = safePanelColour;
  localStorage.setItem("minesweeper-panel-colour", safePanelColour);

  if (safePanelColour === "custom") {
    const safeHex = normalizeHex(customHex || "") || DEFAULT_PANEL_CUSTOM_COLOUR;
    syncPanelCustomColour(safeHex);
    setGradientVars(gamePanelEl, "panel", safeHex, 0.14);
  } else {
    clearGradientVars(gamePanelEl, "panel");
  }

  for (const swatch of panelSwatches.querySelectorAll("[data-panel-option]")) {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.panelOption === safePanelColour));
  }
}

function handlePanelCustomColour(value) {
  const hex = normalizeHex(value);
  if (!hex) return;
  applyPanelColour("custom", hex);
}

function render() {
  mineCountEl.textContent = formatNumber(Math.max(0, state.mines - state.flags));
  timerEl.textContent = formatNumber(state.seconds);
  flagModeButton.setAttribute("aria-pressed", String(state.flagMode));

  if (!state.over) {
    faceButton.querySelector("span").textContent = state.flagMode ? "F" : ":)";
  }

  const fragment = document.createDocumentFragment();
  for (const cell of state.cells) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = cellClass(cell);
    button.dataset.index = cell.index;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", ariaForCell(cell));

    if (cell.open) {
      button.textContent = cell.mine ? mineIcon : numberIcons[cell.adjacent];
    } else if (cell.flagged) {
      button.textContent = flagIcon;
    } else {
      button.textContent = "";
    }

    fragment.appendChild(button);
  }

  boardEl.replaceChildren(fragment);
}

function cellClass(cell) {
  const classes = ["cell"];
  if (cell.open) classes.push("open");
  if (cell.flagged) classes.push("flagged");
  if (cell.open && cell.adjacent > 0) classes.push(`n${cell.adjacent}`);
  if (state.over && cell.mine && cell.open && !state.won) classes.push("mine-hit");
  if (state.over && cell.mine && !cell.open) classes.push("mine-safe");
  return classes.join(" ");
}

function ariaForCell(cell) {
  if (cell.flagged) return `Flagged cell ${cell.row + 1}, ${cell.col + 1}`;
  if (!cell.open) return `Closed cell ${cell.row + 1}, ${cell.col + 1}`;
  if (cell.mine) return `Mine at ${cell.row + 1}, ${cell.col + 1}`;
  if (cell.adjacent === 0) return `Open empty cell ${cell.row + 1}, ${cell.col + 1}`;
  return `Open cell ${cell.row + 1}, ${cell.col + 1}, ${cell.adjacent}`;
}

function formatNumber(value) {
  return String(value).padStart(3, "0").slice(-3);
}

function handleCellPress(event) {
  const target = event.target.closest(".cell");
  if (!target) return;

  state.longPressFired = false;
  const index = Number(target.dataset.index);

  clearTimeout(state.pressTimer);
  state.pressTimer = setTimeout(() => {
    state.longPressFired = true;
    navigator.vibrate?.(18);
    toggleFlag(index);
  }, 430);
}

function clearCellPress() {
  clearTimeout(state.pressTimer);
}

function handleCellClick(event) {
  const target = event.target.closest(".cell");
  if (!target) return;

  const index = Number(target.dataset.index);
  if (state.longPressFired) {
    state.longPressFired = false;
    return;
  }

  if (state.flagMode) {
    toggleFlag(index);
    return;
  }

  if (state.cells[index].open) {
    openAround(index);
    return;
  }

  reveal(index);
}

boardEl.addEventListener("pointerdown", handleCellPress);
boardEl.addEventListener("pointerup", clearCellPress);
boardEl.addEventListener("pointercancel", clearCellPress);
boardEl.addEventListener("pointerleave", clearCellPress);
boardEl.addEventListener("click", handleCellClick);
boardEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const target = event.target.closest(".cell");
  if (target) toggleFlag(Number(target.dataset.index));
});

flagModeButton.addEventListener("click", () => {
  state.flagMode = !state.flagMode;
  render();
});

newGameButton.addEventListener("click", () => startGame());
faceButton.addEventListener("click", () => startGame());
difficultySelect.addEventListener("change", () => startGame(difficultySelect.value));
playerNameInput.addEventListener("input", () => {
  localStorage.setItem("minesweeper-player-name", getPlayerName());
});
clearLeaderboardButton.addEventListener("click", () => {
  localStorage.removeItem(leaderboardKey());
  renderLeaderboard();
});
scoreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  savePendingScore();
});
scoreDialog.addEventListener("cancel", (event) => {
  if (pendingScore) {
    event.preventDefault();
  }
});
settingsButton.addEventListener("click", () => {
  settingsDialog.showModal();
});
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) {
    settingsDialog.close();
  }
});
backgroundSwatches.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bg-option]");
  if (!button) return;
  applyBackground(button.dataset.bgOption);
});
panelSwatches.addEventListener("click", (event) => {
  const button = event.target.closest("[data-panel-option]");
  if (!button) return;
  applyPanelColour(button.dataset.panelOption);
});
customColourInput.addEventListener("input", () => {
  handleCustomColour(customColourInput.value);
});
hexColourInput.addEventListener("input", () => {
  handleCustomColour(hexColourInput.value);
});
hexColourInput.addEventListener("blur", () => {
  const hex = normalizeHex(hexColourInput.value) || localStorage.getItem("minesweeper-custom-colour") || DEFAULT_CUSTOM_COLOUR;
  syncCustomColour(hex);
});
panelCustomColourInput.addEventListener("input", () => {
  handlePanelCustomColour(panelCustomColourInput.value);
});
panelHexColourInput.addEventListener("input", () => {
  handlePanelCustomColour(panelHexColourInput.value);
});
panelHexColourInput.addEventListener("blur", () => {
  const hex =
    normalizeHex(panelHexColourInput.value) ||
    localStorage.getItem("minesweeper-panel-custom-colour") ||
    DEFAULT_PANEL_CUSTOM_COLOUR;
  syncPanelCustomColour(hex);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      statusEl.textContent = "Ready";
    });
  });
}

const initialLevel = new URLSearchParams(window.location.search).get("level");
const safeInitialLevel = LEVELS[initialLevel] ? initialLevel : "easy";
difficultySelect.value = safeInitialLevel;
playerNameInput.value = localStorage.getItem("minesweeper-player-name") || "Player";
scoreNameInput.value = playerNameInput.value;
syncCustomColour(normalizeHex(localStorage.getItem("minesweeper-custom-colour") || "") || DEFAULT_CUSTOM_COLOUR);
syncPanelCustomColour(
  normalizeHex(localStorage.getItem("minesweeper-panel-custom-colour") || "") || DEFAULT_PANEL_CUSTOM_COLOUR
);
applyBackground(localStorage.getItem("minesweeper-background") || "night");
applyPanelColour(localStorage.getItem("minesweeper-panel-colour") || "night");
startGame(safeInitialLevel);
