// --- CONFIGURATION ---
const gridHeight = 10;
const gridWidth = 10;
let score = 0;
let phase = 1;
let grid = [];
let selectedUnit = null;
let suppressionQueue = [];
let stagedActions = Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => []));
let firebreakPenalty = 0;


let water = 15;
let unitCosts = { truck: 1, helicopter: 5, plane: 9 };
const unitConfig = {
  truck: { total: 5, cooldown: 1 },
  helicopter: { total: 3, cooldown: 2 },
  plane: { total: 1, cooldown: 3 }
};

let availableUnits = {
  truck: 5,
  helicopter: 3,
  plane: 1
};

let cooldowns = {
  truck: [],
  helicopter: [],
  plane: []
};


const windArrows = { N: '⬇️', NE: '↙️', E: '⬅️', SE: '↖️', S: '⬆️', SW: '↗️', W: '➡️', NW: '↘️' };
const windDirections = Object.keys(windArrows);

const mapGrid = document.getElementById("mapGrid");
mapGrid.style.setProperty('--grid-columns', gridWidth);
mapGrid.style.setProperty('--grid-rows', gridHeight);
const scoreDisplay = document.getElementById("score");

const waterDisplay = document.createElement('div');
waterDisplay.className = 'info-line';
waterDisplay.innerHTML = `
  <strong>💧 Water:</strong>
  <div class="water-bar-container">
    <div id="waterBar" class="water-bar-fill"></div>
  </div>
  <span id="waterAmount">15</span>/15
`;
document.querySelector('.info-panel').appendChild(waterDisplay);


// === TIMER FUNCTIONS ===
let turnTimer = null;
let turnTimeLimit = 30;
let timeRemaining = turnTimeLimit;

function startTurnTimer() {
  clearTurnTimer();
  timeRemaining = turnTimeLimit;
  updateTurnTimerDisplay();

  turnTimer = setInterval(() => {
    timeRemaining -= 0.1;
    updateTurnTimerDisplay();

    if (timeRemaining <= 0) {
      clearTurnTimer();
      endTurn();
    }
  }, 100);
}


function clearTurnTimer() {
  if (turnTimer) {
    clearInterval(turnTimer);
    turnTimer = null;
  }
}

function updateTurnTimerDisplay() {
  const timerEl = document.getElementById('timer-countdown');
  if (timerEl) {
    timerEl.textContent = timeRemaining;
  }
}

function updateTurnTimerDisplay() {
  const timerEl = document.getElementById('timer-countdown');
  const barEl = document.getElementById('timer-bar');

  if (timerEl) {
    timerEl.textContent = Math.ceil(timeRemaining); // Only show full seconds
  }

  if (barEl) {
    const percent = (timeRemaining / turnTimeLimit) * 100;
    barEl.style.width = percent + '%';

    if (timeRemaining > 20) {
      barEl.style.background = 'green';
    } else if (timeRemaining > 10) {
      barEl.style.background = 'orange';
    } else {
      barEl.style.background = 'crimson';
    }
  }
}






// === WATER BAR FUNCTIONS ===
function updateWaterDisplay() {
  const el = document.getElementById("waterAmount");
  const bar = document.getElementById("waterBar");
  if (el) el.textContent = water;
  if (bar) bar.style.width = `${(water / 15) * 100}%`;
}

  function startGame() {
    document.getElementById('introScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    setBackgroundForPhase(1);
  }

  function showPage(pageNumber) {
  const totalPages = 7;
  for (let i = 1; i <= totalPages; i++) {
    document.getElementById(`page${i}`).style.display = (i === pageNumber) ? 'block' : 'none';
  }
}


// === UNIT COOLDOWN FUNCTIONS ===
function updateUnitButtons() {
  const unitLabels = {
    truck: '🚒 Truck',
    helicopter: '🚁 Helicopter',
    plane: '✈️ Plane'
  };

  document.querySelectorAll('.unit-button').forEach(btn => {
    const type = Object.keys(unitLabels).find(key => btn.textContent.includes(unitLabels[key]));
    if (type) {
      const current = availableUnits[type];
      const total = unitConfig[type].total;
      btn.textContent = `${unitLabels[type]} (${current}/${total})`;
    }
  });
}

function useUnit(type) {
  if (availableUnits[type] <= 0) {
    alert(`${type} units unavailable – on cooldown.`);
    return false;
  }
  availableUnits[type]--;
  cooldowns[type].push(unitConfig[type].cooldown +1);
  return true;
}

function processCooldowns() {
  for (let type in cooldowns) {
    // Step 1: Decrease cooldown timers
    cooldowns[type] = cooldowns[type].map(cd => cd - 1).filter(cd => cd > 0);

    // Step 2: Update availability based on remaining cooldowns
    const unavailable = cooldowns[type].length;
    availableUnits[type] = unitConfig[type].total - unavailable;
  }
  updateUnitButtons();
}

function resetCooldowns() {
  availableUnits = {
    truck: unitConfig.truck.total,
    helicopter: unitConfig.helicopter.total,
    plane: unitConfig.plane.total
  };
  cooldowns = { truck: [], helicopter: [], plane: [] };
  updateUnitButtons();
}

// === SCORING FUNCTION ===
function calculateScore() {
  let total = firebreakPenalty; // Start from firebreak cost

  grid.forEach(row => {
    row.forEach(cell => {
      if (cell.firebreak) return;
      const stage = cell.max_stage;
      if (stage >= 1 && stage <= 5) {
        let penalty = stage * 0.5;
        if (cell.type === 'city') penalty *= 4;
        total -= penalty;
      }
    });
  });

  score = total;  // No rounding
  scoreDisplay.textContent = score.toFixed(1); // Optional: Format nicely with 1 decimal
}



function createCell(type, x, y) {
  return {
    x, y,
    type,
    fire_stage: 0,
    max_stage: 0,
    firebreak: false,
    evacuated: false,
    score_value: type === 'city' ? -5 : -2.5,
    icon: type === 'city' ? '🏠' : '🌲'
  };
}

function selectUnit(unit) {
  selectedUnit = unit;
  document.querySelectorAll('.unit-button').forEach(btn => btn.classList.remove('selected'));
  const buttonMap = { truck: '🚒 Truck', helicopter: '🚁 Helicopter', plane: '✈️ Plane' };
  document.querySelectorAll('.unit-button').forEach(btn => {
    if (btn.textContent.trim().includes(buttonMap[unit])) btn.classList.add('selected');
  });
}

function getUnitAOE(unit) {
  if (!unit) return [[0, 0]];
  if (unit === 'truck') return [[0, 0]];
  if (unit === 'helicopter') return [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
  if (unit === 'plane') return [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  return [[0, 0]];
}

function highlightAOE(ci, cj, offsets) {
  clearHighlights();
  offsets.forEach(([dx, dy]) => {
    const i = ci + dx;
    const j = cj + dy;
    if (i >= 0 && j >= 0 && i < gridHeight && j < gridWidth) {
      const index = i * gridWidth + j;
      const cellDiv = mapGrid.children[index];
      cellDiv.classList.add('highlight');
    }
  });
}

function clearHighlights() {
  document.querySelectorAll('.cell.highlight').forEach(div => div.classList.remove('highlight'));
}

function updateStagedActionsMap() {
  stagedActions = Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => []));
  suppressionQueue.forEach(({ x, y, unit }) => {
    const aoe = getUnitAOE(unit);
    aoe.forEach(([dx, dy]) => {
      const ni = x + dx;
      const nj = y + dy;
      if (ni >= 0 && nj >= 0 && ni < gridHeight && nj < gridWidth) {
        stagedActions[ni][nj].push(unit);
      }
    });
  });
}

// === GRID RENDER FUNCTION ===
function renderGrid() {
  mapGrid.innerHTML = '';
  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      const div = document.createElement('div');
      div.className = 'cell';
      div.style.position = 'relative';

      if (cell.firebreak) div.classList.add('firebreak');
      else if (cell.max_stage === 5) div.classList.add('burning-stage-5');
      else if (cell.max_stage >= 1) div.classList.add(`burning-stage-${cell.max_stage}`);
      else div.classList.add(cell.type);

      div.textContent = cell.icon;

      if (cell.fire_stage >= 1 && cell.fire_stage <= 4 && cell.max_stage < 5) {
        for (let k = 0; k < cell.fire_stage; k++) {
          const flame = document.createElement('div');
          flame.textContent = '🔥';
          flame.style.position = 'absolute';
          flame.style.top = '5%';
          flame.style.left = `${k * 12}%`;
          flame.style.fontSize = '0.5em';
          flame.style.pointerEvents = 'none';
          div.appendChild(flame);
        }
      }

      if (cell.fire_stage === 5 || cell.max_stage === 5) {
        const skull = document.createElement('div');
        skull.textContent = '💀';
        skull.style.position = 'absolute';
        skull.style.top = '5%';
        skull.style.left = '5%';
        skull.style.fontSize = '0.5em';
        skull.style.pointerEvents = 'none';
        div.appendChild(skull);
      }

      if (phase === 2 && stagedActions[i][j].length > 0) {
        div.classList.add('scheduled');
        div.title = 'Staged: ' + stagedActions[i][j].join(', ');
        const count = Math.min(4, stagedActions[i][j].length);
        for (let k = 0; k < count; k++) {
          const drop = document.createElement('div');
          drop.textContent = '💧';
          drop.style.position = 'absolute';
          drop.style.bottom = '5%';
          drop.style.left = `${k * 12}%`;
          drop.style.fontSize = '0.5em';
          drop.style.pointerEvents = 'none';
          div.appendChild(drop);
        }
      }

      if (phase === 1) {
        div.onclick = () => placeFirebreak(cell);
      } else if (phase === 2) {
        div.onclick = () => {
          if (!selectedUnit) return;
          if (availableUnits[selectedUnit] <= 0) {
            alert(`${selectedUnit} units unavailable – on cooldown.`);
            return;
          }

          const cost = unitCosts[selectedUnit];
          if (water < cost) {
            alert("Not enough water for this unit.");
            return;
          }

          if (!useUnit(selectedUnit)) return;

          water -= cost;
          suppressionQueue.push({ x: i, y: j, unit: selectedUnit });
          updateWaterDisplay();
          updateStagedActionsMap();
          renderGrid();
          updateUnitButtons();
        };
      }

      div.onmouseenter = () => {
        if (selectedUnit && phase === 2) {
          highlightAOE(i, j, getUnitAOE(selectedUnit));
        }
      };
      div.onmouseleave = () => clearHighlights();

      mapGrid.appendChild(div);
    });
  });
}

function setBackgroundForPhase(phase) {
  const background = document.getElementById("background");
    if (phase === 1) {
    // Phase 1: Prevention
    background.style.backgroundImage = "url('assets/image_2.png')";
  } else if (phase === 2) {
    // Phase 2: Wildfire
    background.style.backgroundImage = "url('assets/image_3.png')";
  }
}

function endPhaseOne() {
  phase = 2;
  document.querySelector(".unit-panel-wrapper").style.display = "flex";
  updateWeatherDisplay("N", 90, 42);
  document.querySelector('.phase-info').textContent = "Phase 2: Crisis Response";
  document.querySelector('.info-text').innerHTML = `
    <strong>Wildfires have erupted — and time is running out.</strong><br><br>
    Click a unit, then assign it to a location on the map. Suppression effects will apply at the end of your turn.<br><br>
    When ready, click <strong>‘End Turn’</strong> to continue.
  `;
  const button = document.querySelector('.decision-block button');
  button.textContent = "End Turn";
  button.onclick = endTurn;
  // igniteRandomFires(2);
  igniteInitialOutbreak();
  calculateScore();
  renderGrid();
  document.getElementById('turn-timer').style.display = 'block';
  startTurnTimer();
  setBackgroundForPhase(2);

}
function endTurn() {
  // clearTurnTimer(); // stop countdown if still running
  startTurnTimer();
  const { direction, speed, temperature } = getCurrentWeather();
  const favoredOffsets = getWindFavoredOffsets(direction);
  const toIgnite = [];
  const suppressedThisTurn = new Set();

  // 🔎 Step 0: Snapshot valid active burning cells before suppression
  const activeBurningAtStart = new Set();
  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell.fire_stage >= 1 && cell.fire_stage < 5) {
        activeBurningAtStart.add(`${i},${j}`);
      }
    });
  });

  // 🧯 Step 1: Apply suppression effects
  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      const suppression = stagedActions[i][j].length;
      if (suppression > 0 && cell.fire_stage > 0) {
        cell.max_stage = Math.max(cell.max_stage, cell.fire_stage);
        cell.fire_stage = Math.max(0, cell.fire_stage - suppression);
        suppressedThisTurn.add(`${i},${j}`);
      }
    });
  });

  // 🔥 Step 2: Spread fire from valid, unsuppressed, active sources
  const stagedForSuppression = new Set();
  suppressionQueue.forEach(({ x, y, unit }) => {
    const aoe = getUnitAOE(unit);
    aoe.forEach(([dx, dy]) => {
      const ni = x + dx;
      const nj = y + dy;
      if (ni >= 0 && nj >= 0 && ni < gridHeight && nj < gridWidth) {
        stagedForSuppression.add(`${ni},${nj}`);
      }
    });
  });

  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      const key = `${i},${j}`;
      if (!activeBurningAtStart.has(key)) return;
      if (suppressedThisTurn.has(key) || stagedForSuppression.has(key)) return;
      if (cell.fire_stage < 1 || cell.fire_stage >= 5 || cell.max_stage === 5) return;

      // 🔁 Advance fire safely
      cell.fire_stage = Math.min(5, cell.fire_stage + 1);
      cell.max_stage = Math.max(cell.max_stage, cell.fire_stage);

      // 🔥 Try to ignite neighbors
      getNeighbors(i, j).forEach(([ni, nj]) => {
        const neighbor = grid[ni][nj];
        const neighborKey = `${ni},${nj}`;

        if (
          neighbor.fire_stage === 0 &&
          !neighbor.firebreak &&
          !suppressedThisTurn.has(neighborKey) &&
          neighbor.max_stage < 5 &&
          shouldIgnite(cell, neighbor, i, j, ni, nj, favoredOffsets, speed, temperature)
        ) {
          toIgnite.push(neighbor);
        }
      });
    });
  });

  // 🔥 Step 3: Ignite new neighbors
  toIgnite.forEach(cell => {
    const key = `${cell.x},${cell.y}`;
    if (!suppressedThisTurn.has(key) && cell.max_stage < 5) {
      cell.fire_stage = 1;
      cell.max_stage = Math.max(cell.max_stage, 1);

      // 🚨 Immediately show alert if this is a city
      if (cell.type === 'city') {
        showCityFireAlert();
      }
    }
  });


  // ♻️ Step 4: Reset suppression and update map
  suppressionQueue = [];
  updateStagedActionsMap();

  // 🔁 Step 5: Process cooldowns
  processCooldowns();

  // 🌦️ Step 6: Update UI
  updateWeather();
  water = Math.min(water + 5, 15);
  updateWaterDisplay();
  renderGrid();
  updateUnitButtons();
  calculateScore();
  

  // 🔚 Step 7: Check for game end
  setTimeout(checkGameEnd, 0);
}

function showCityFireAlert() {
  const alertBox = document.createElement('div');
  alertBox.textContent = '⚠️ A city has caught fire! Prioritize it!';
  alertBox.style.position = 'fixed';
  alertBox.style.top = '20px';
  alertBox.style.left = '50%';
  alertBox.style.transform = 'translateX(-50%)';
  alertBox.style.background = 'crimson';
  alertBox.style.color = 'white';
  alertBox.style.padding = '1rem 2rem';
  alertBox.style.fontSize = '1.2rem';
  alertBox.style.fontWeight = 'bold';
  alertBox.style.borderRadius = '8px';
  alertBox.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
  alertBox.style.zIndex = '9999';
  alertBox.style.opacity = '1';
  alertBox.style.transition = 'opacity 1s ease-out';

  document.body.appendChild(alertBox);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    alertBox.style.opacity = '0';
    setTimeout(() => {
      alertBox.remove();
    }, 1000);
  }, 3000);
}






// === NEW: Fire spread logic ===
function spreadFire() {
  const { direction, speed, temperature } = getCurrentWeather();
  const favoredOffsets = getWindFavoredOffsets(direction);
  const newFires = [];

  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell.fire_stage >= 1 && cell.fire_stage < 5) {
        cell.fire_stage++;
        cell.max_stage = Math.max(cell.max_stage, cell.fire_stage);
        getNeighbors(i, j).forEach(([ni, nj]) => {
          const neighbor = grid[ni][nj];
          if (shouldIgnite(cell, neighbor, i, j, ni, nj, favoredOffsets, speed, temperature)) {
            newFires.push({ i: ni, j: nj });
          }
        });
      }
    });
  });

  newFires.forEach(({ i, j }) => {
    const cell = grid[i][j];
    cell.fire_stage = 1;
    cell.max_stage = Math.max(cell.max_stage, 1);
  });
}

function placeFirebreak(cell) {
  if (cell.type !== 'forest' || cell.firebreak) return;
  cell.firebreak = true;
  cell.type = 'empty';
  cell.icon = '🪵';
  firebreakPenalty -= 2.5;
  calculateScore();  // 🔁 Call instead of direct update
  renderGrid();
}

function updateWeather() {
  const current = getCurrentWeather();
  const index = windDirections.indexOf(current.direction);
  const rand = Math.random();
  let newDir = windDirections[(index + (rand < 0.43 ? -1 : rand > 0.66 ? 1 : 0) + windDirections.length) % windDirections.length];
  if (rand < 0.1) newDir = windDirections[Math.floor(Math.random() * windDirections.length)];
  const newSpeed = Math.max(10, Math.min(current.speed + Math.floor(Math.random() * 11 - 5), 100));
  const newTemp = Math.max(25, Math.min(current.temperature + Math.floor(Math.random() * 5 - 2), 45));
  updateWeatherDisplay(newDir, newSpeed, newTemp);
}

function updateWeatherDisplay(direction, speed, temperature) {
  document.getElementById("windDirection").textContent = direction;
  document.getElementById("windArrow").textContent = windArrows[direction];
  document.getElementById("windSpeed").textContent = speed;
  document.getElementById("temperature").textContent = temperature;
}

function initGrid() {
  const totalCells = gridHeight * gridWidth;
  const cityCount = Math.floor(totalCells * 0.1);
  const forestCount = totalCells - cityCount;
  const cellTypes = [...Array(cityCount).fill('city'), ...Array(forestCount).fill('forest')];
  for (let i = cellTypes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cellTypes[i], cellTypes[j]] = [cellTypes[j], cellTypes[i]];
  }
  grid = [];
  for (let i = 0; i < gridHeight; i++) {
    const row = [];
    for (let j = 0; j < gridWidth; j++) {
      row.push(createCell(cellTypes[i * gridWidth + j], i, j));
    }
    grid.push(row);
  }
  renderGrid();
}

function igniteRandomFires(n) {
  const forestCells = grid.flat().filter(c => c.type === 'forest' && !c.firebreak && c.fire_stage === 0);
  for (let i = 0; i < n && forestCells.length > 0; i++) {
    const index = Math.floor(Math.random() * forestCells.length);
    const cell = forestCells.splice(index, 1)[0];
    cell.fire_stage = 1;
    cell.max_stage = 1;
  }
}

// function igniteInitialOutbreak() {
//   const forestCells = grid.flat().filter(c => c.type === 'forest' && !c.firebreak && c.fire_stage === 0);

//   if (forestCells.length < 20) return;

//   // Randomly pick two center points for 3x3 kernels
//   const pickCenters = () => {
//     const randomIndex = () => Math.floor(Math.random() * forestCells.length);
//     const center1 = forestCells[randomIndex()];
//     let center2;
//     do {
//       center2 = forestCells[randomIndex()];
//     } while (center1 === center2); // avoid duplicates
//     return [center1, center2];
//   };

//   const [center1, center2] = pickCenters();

//   const applyKernel = (center) => {
//     const i0 = center.x;
//     const j0 = center.y;

//     for (let di = -1; di <= 1; di++) {
//       for (let dj = -1; dj <= 1; dj++) {
//         const i = i0 + di;
//         const j = j0 + dj;

//         if (i >= 0 && j >= 0 && i < gridHeight && j < gridWidth) {
//           const cell = grid[i][j];
//           if (cell.type === 'forest' && !cell.firebreak && Math.random() < 0.5) {
//             const stage = Math.floor(Math.random() * 3) + 1; // 1–3
//             cell.fire_stage = stage;
//             cell.max_stage = stage;
//           }
//         }
//       }
//     }
//   };

//   applyKernel(center1);
//   applyKernel(center2);
// }

function igniteInitialOutbreak() {
  const forestCells = grid.flat().filter(c =>
    c.type === 'forest' && !c.firebreak && c.fire_stage === 0
  );

  if (forestCells.length < 20) return;

  // Randomly pick two distinct center cells for 3x3 kernels
  const pickCenters = () => {
    const randomIndex = () => Math.floor(Math.random() * forestCells.length);
    const center1 = forestCells[randomIndex()];
    let center2;
    do {
      center2 = forestCells[randomIndex()];
    } while (center1 === center2);
    return [center1, center2];
  };

  const [center1, center2] = pickCenters();

  // Collect all forest cells in both 3x3 neighborhoods
  const getKernelCells = (center) => {
    const kernel = [];
    const { x: i0, y: j0 } = center;

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = i0 + di;
        const j = j0 + dj;
        if (i >= 0 && j >= 0 && i < gridHeight && j < gridWidth) {
          const cell = grid[i][j];
          if (cell.type === 'forest' && !cell.firebreak && cell.fire_stage === 0) {
            kernel.push(cell);
          }
        }
      }
    }

    return kernel;
  };

  const kernelCells = [...getKernelCells(center1), ...getKernelCells(center2)];

  // Limit to 20 stage points across all selected cells
  const totalStageSum = 20;
  const possibleStages = [1, 2, 3];
  const maxCells = Math.min(kernelCells.length, totalStageSum); // Usually 18 max

  // Build stage values that sum to 20
  const stageList = [];
  let sum = 0;

  while (sum < totalStageSum && stageList.length < maxCells) {
    const remaining = totalStageSum - sum;
    const options = possibleStages.filter(s => s <= remaining);
    const chosen = options[Math.floor(Math.random() * options.length)];
    stageList.push(chosen);
    sum += chosen;
  }

  // Shuffle cells and assign fire stages
  for (let i = kernelCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kernelCells[i], kernelCells[j]] = [kernelCells[j], kernelCells[i]];
  }

  for (let i = 0; i < stageList.length; i++) {
    const cell = kernelCells[i];
    const stage = stageList[i];
    cell.fire_stage = stage;
    cell.max_stage = stage;
  }
}

function getCurrentWeather() {
  return {
    direction: document.getElementById("windDirection").textContent,
    speed: parseInt(document.getElementById("windSpeed").textContent),
    temperature: parseInt(document.getElementById("temperature").textContent)
  };
}

function getWindFavoredOffsets(dir) {
  const offsets = {
    N: [[1, 0], [1, -1], [1, 1]],
    NE: [[1, -1], [1, 0], [0, -1]],
    E: [[0, -1], [-1, -1], [1, -1]],
    SE: [[-1, -1], [-1, 0], [0, -1]],
    S: [[-1, 0], [-1, 1], [-1, -1]],
    SW: [[-1, 1], [-1, 0], [0, 1]],
    W: [[0, 1], [-1, 1], [1, 1]],
    NW: [[1, 1], [1, 0], [0, 1]]
  };
  return offsets[dir] || [];
}

function getNeighbors(i, j) {
  const deltas = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  return deltas.map(([di, dj]) => [i + di, j + dj]).filter(([x, y]) => x >= 0 && y >= 0 && x < gridHeight && y < gridWidth);
}

function shouldIgnite(source, target, si, sj, ti, tj, favoredOffsets, windSpeed, temp) {
  if (target.fire_stage !== 0 || target.firebreak || target.type === 'water') return false;

  const dx = ti - si;
  const dy = tj - sj;

  // Base stage-dependent ignition chance
  const stageChance = [0, 0.01, 0.02, 0.04, 0.08][source.fire_stage - 1];
  let chance = stageChance;

  // Reduce wind influence (was ×3 → now ×1.5)
  if (favoredOffsets.some(([fx, fy]) => fx === dx && fy === dy)) {
    chance *= 5;
  }

  // Reduce temperature influence (was 0.02 → now 0.01)
  if (temp > 32) {
    chance *= 1 + ((temp - 30) * 0.01);
  }

  // Reduce wind speed impact (was /50 → now /70, max 1.2)
  chance *= Math.min(1.4, windSpeed / 70);

  return Math.random() < chance;
}

function checkGameEnd() {
  const anyFireLeft = grid.some(row =>
    row.some(cell => cell.fire_stage >= 1 && cell.fire_stage < 5)
  );

  if (!anyFireLeft) {
    document.getElementById('turn-timer').style.display = 'none';
    // Determine outcome tier
    let outcome, outcomeClass;
    if (score > -20) {
      outcome = "✅ Excellent work! Only a small area was burned.";
      outcomeClass = "result-good";
    } else if (score > -100) {
      outcome = "⚠️ The fire was tough, but you limited the damage.";
      outcomeClass = "result-okay";
    } else {
      outcome = "❌ Disaster! The wildfire devastated the region.";
      outcomeClass = "result-bad";
    }

    // Display result
    const phaseInfo = document.querySelector('.phase-info');
    const infoText = document.querySelector('.info-text');
    const decisionBlock = document.querySelector('.decision-block');

    phaseInfo.textContent = "🔥 Fire Contained!";
    infoText.innerHTML = `
      <strong>${outcome}</strong><br><br>
      Final Score: <strong>${score.toFixed(1)}</strong>
    `;
    phaseInfo.classList.add(outcomeClass);
    infoText.classList.add(outcomeClass);

    // Disable interactions
    suppressionQueue = [];
    selectedUnit = null;
    document.querySelectorAll('.unit-button').forEach(btn => btn.disabled = true);
    decisionBlock.innerHTML = `<button onclick="restartGame()">🔁 Restart Game</button>`;
  }
  const burning = grid.flat().filter(c => c.fire_stage >= 1 && c.fire_stage < 5);
  console.log('🔥 Remaining fires:', burning.length, burning.map(c => `(${c.x},${c.y})`));
}

// === RESTART GAME FUNCTION ===
function restartGame() {
  score = 0;
  water = 15;
  firebreakPenalty = 0;
  phase = 1;
  selectedUnit = null;
  suppressionQueue = [];
  resetCooldowns();

  document.querySelectorAll('.unit-button').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('selected');
  });

  document.querySelector(".unit-panel-wrapper").style.display = "none";
  document.querySelector('.phase-info').textContent = "Phase 1: Prevention";
  document.querySelector('.info-text').innerHTML = `
    <strong>Dry conditions have raised alarm bells across the region.</strong><br><br>
    With emergency funding secured, you’ve been tasked to act preemptively — now is your only chance to shape the battlefield.<br><br>
    <span style="font-style: normal;">🪵</span> <em>Click forest tiles to place firebreaks</em> and slow future wildfires. But beware: each firebreak damages the ecosystem and reduces your final score.<br><br>
    🔥 What you prevent now could save lives later. Choose your cuts wisely.`;

  document.querySelector('.decision-block').innerHTML = `<button onclick="endPhaseOne()">End Phase 1</button>`;
  document.querySelector('.phase-info').className = 'phase-info';
  document.querySelector('.info-text').className = 'info-text';

  updateWeatherDisplay("N", 90, 42);
  initGrid();
  updateWaterDisplay();
  calculateScore();
}

window.addEventListener('DOMContentLoaded', () => {
  initGrid();
  updateWaterDisplay();
  updateUnitButtons();
});
