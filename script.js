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

let state = {};

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
    recordScore();
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

function recordScore() {
  const scores = getScores();
  scores.push({
    name: getPlayerName(),
    seconds: state.seconds,
    date: new Date().toISOString(),
  });

  scores.sort((a, b) => a.seconds - b.seconds || new Date(a.date) - new Date(b.date));
  saveScores(scores.slice(0, 10));
  renderLeaderboard();
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
      const time = document.createElement("span");
      const date = document.createElement("small");

      rank.textContent = `#${index + 1}`;
      name.textContent = score.name;
      time.textContent = `${score.seconds}s`;
      date.textContent = formatScoreDate(score.date);

      item.append(rank, name, time, date);
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
startGame(safeInitialLevel);
