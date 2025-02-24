CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  this.beginPath();
  this.moveTo(x + r, y);
  this.arcTo(x + w, y, x + w, y + h, r);
  this.arcTo(x + w, y + h, x, y + h, r);
  this.arcTo(x, y + h, x, y, r);
  this.arcTo(x, y, x + w, y, r);
  this.closePath();
  ctx.fill();
  return this;
};
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

// Game constants
const CELL_SIZE = 100;
const GRID_SIZE = 3;
const PADDING = 10;
const CANVAS_SIZE = CELL_SIZE * GRID_SIZE + PADDING * 2;

// Set canvas size
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// Game state
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];
let gameActive = true;
let winningLine = null;
let BOLD_CELL = -1;

const winningCombinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // Rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // Columns
  [0, 4, 8],
  [2, 4, 6], // Diagonals
];

function drawGrid() {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let i = 1; i < GRID_SIZE; i++) {
      // Vertical lines
      ctx.roundRect(
          PADDING + i * CELL_SIZE - ctx.lineWidth / 2,
          PADDING,
          ctx.lineWidth,
          CELL_SIZE * GRID_SIZE,
          10
      );
      ctx.stroke();

      // Horizontal lines
      ctx.roundRect(
          PADDING,
          PADDING + i * CELL_SIZE - ctx.lineWidth / 2,
          CELL_SIZE * GRID_SIZE,
          ctx.lineWidth,
          10
      );
      ctx.stroke();
      if(BOLD_CELL !== -1){
          const x = PADDING + (BOLD_CELL % GRID_SIZE) * CELL_SIZE;
          const y = PADDING + Math.floor(BOLD_CELL / GRID_SIZE) * CELL_SIZE;
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.roundRect(x+10, y+10, CELL_SIZE-20, CELL_SIZE-20, 10);
      }
  }
}

function drawX(cellX, cellY) {
  const x = PADDING + cellX * CELL_SIZE;
  const y = PADDING + cellY * CELL_SIZE;
  const padding = 20;

  ctx.strokeStyle = "#00bcd4";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x + padding, y + padding);
  ctx.lineTo(x + CELL_SIZE - padding, y + CELL_SIZE - padding);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + CELL_SIZE - padding, y + padding);
  ctx.lineTo(x + padding, y + CELL_SIZE - padding);
  ctx.stroke();
}

function drawO(cellX, cellY) {
  const x = PADDING + cellX * CELL_SIZE + CELL_SIZE / 2;
  const y = PADDING + cellY * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE / 2 - 20;

  ctx.strokeStyle = "#ff4081";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // Draw X's and O's
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const index = i + j * GRID_SIZE;
      if (gameState[index] === "X") {
        drawX(i, j);
      } else if (gameState[index] === "O") {
        drawO(i, j);
      }
    }
  }

  // Draw winning line if game is won
  if (winningLine) {
    const [start, end] = winningLine;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8 ;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.8;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

function getCellCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const cellX = Math.floor((x - PADDING) / CELL_SIZE);
  const cellY = Math.floor((y - PADDING) / CELL_SIZE);

  if (
    cellX >= 0 &&
    cellX < GRID_SIZE &&
    cellY >= 0 &&
    cellY < GRID_SIZE
  ) {
    return cellX + cellY * GRID_SIZE;
  }

  return -1;
}
function convertIndexToCoord(index) {
  return [index % GRID_SIZE, Math.floor(index / GRID_SIZE)];
}
function calculateWinningLine(combination) {
  const [a, b, c] = combination;
  const pointMods = {
    row: {
      start: { x: -CELL_SIZE / 2, y: 0 },
      end: { x: CELL_SIZE / 2, y: 0 },
    },
    column: {
      start: { x: 0, y: -CELL_SIZE / 2 },
      end: { x: 0, y: CELL_SIZE / 2 },
    },
    diagonalDown: {
      start: { x: -CELL_SIZE / 2, y: -CELL_SIZE / 2 },
      end: { x: CELL_SIZE / 2, y: CELL_SIZE / 2 },
    },
    diagonalUp: {
      start: { x: CELL_SIZE / 2, y: -CELL_SIZE / 2 },
      end: { x: -CELL_SIZE / 2, y: CELL_SIZE / 2 },
    },
    none: {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
    },
  };
  const possibleDirections = [
    "column",
    "row",
    "diagonalDown",
    "diagonalUp",
    "none",
  ];
  const aCoord = convertIndexToCoord(a);
  const bCoord = convertIndexToCoord(b);
  const cCoord = convertIndexToCoord(c);


  const getCenterPoint = (index, direction, start) => {
    const x = PADDING + (index % GRID_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const y =
      PADDING + Math.floor(index / GRID_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    return {
      x: x + pointMods[possibleDirections[direction]][start].x,
      y: y + pointMods[possibleDirections[direction]][start].y,
    };
  };
  let dir = 4;
  if(aCoord[0] === bCoord[0] && bCoord[0] === cCoord[0]){
    dir = 0;
  }
  if(aCoord[1] === bCoord[1] && bCoord[1] === cCoord[1]){
    dir = 1;
  }
  if(aCoord[0] === aCoord[1] && bCoord[0] === bCoord[1] && cCoord[0] === cCoord[1]){
    dir = 2;
  }
  if(aCoord[0] === 2 - aCoord[1] && bCoord[0] === 2 - bCoord[1] && cCoord[0] === 2 - cCoord[1]){
    dir = 3;
  }

  console.log(dir);
  return {
    start: getCenterPoint(a, dir, "start"),
    end: getCenterPoint(c, dir, "end"),
  };
}

function checkWin() {
  for (const combination of winningCombinations) {
    if (
      combination.every((index) => gameState[index] === currentPlayer)
    ) {
      const { start, end } = calculateWinningLine(combination);
      winningLine = [start, end];
      return true;
    }
  }
  return false;
}

function checkDraw() {
  return gameState.every((cell) => cell !== "");
}

function handleCanvasClick(e) {
  if (!gameActive) return;

  const index = BOLD_CELL;
  if (index === -1 || gameState[index] !== "") return;

  gameState[index] = currentPlayer;
  drawBoard();

  if (checkWin()) {
    gameActive = false;
    status.textContent = `${currentPlayer} wins!`;
    drawBoard();
    return;
  }

  if (checkDraw()) {
    gameActive = false;
    status.textContent = "It's a draw!";
    return;
  }

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  status.textContent = `${currentPlayer}'s turn`;
}

function resetGame() {
  gameState = ["", "", "", "", "", "", "", "", ""];
  gameActive = true;
  currentPlayer = "X";
  winningLine = null;
  status.textContent = `${currentPlayer}'s turn`;
  drawBoard();
}
function updateBoldCell(e){
  const index = getCellCoords(e.clientX, e.clientY);
  if (index === -1 || gameState[index] !== "") return;
  BOLD_CELL = index;
  drawBoard();
}
// Event listeners
canvas.addEventListener("click", handleCanvasClick);
resetBtn.addEventListener("click", resetGame);
canvas.addEventListener("mousemove",updateBoldCell);
canvas.addEventListener("mouseleave",()=>{
  BOLD_CELL = -1;
  drawBoard();
});

// Initial render
drawBoard();
