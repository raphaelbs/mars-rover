import { Canvas } from "./canvas";
import { clientStart } from "./client";
import "./style.css";
import { GameInput } from "./types";

const DEFAULT_GROUND = [
  [0, 1500],
  [1000, 2000],
  [2000, 500],
  [3500, 500],
  [5000, 1500],
  [6999, 1000],
];

//(X Y hSpeed vSpeed fuel rotate power)
const DEFAULT_SHIP = [5000, 2500, -50, 0, 1000, 90, 0];
const DEFAULT_SIMULATION_SPEED = 0.5;
const GAME_SPEED = 16;
let simulationSpeed = DEFAULT_SIMULATION_SPEED;

// =====================================================
// Acceptable landing parameters
// =====================================================

const LANDING_ANGLE = 0;
const LANDING_VERTICAL_SPEED = 40;
const LANDING_HORIZONTAL_SPEED = 20;

// =====================================================
// Set the values in the UI
// =====================================================

const ground: HTMLTextAreaElement | null = document.querySelector("#ground");
if (ground) {
  ground.textContent = DEFAULT_GROUND.join("\n");
  ground.setAttribute("rows", DEFAULT_GROUND.length + "");
}

const ship: HTMLInputElement | null = document.querySelector("#ship");
if (ship) {
  ship.value = DEFAULT_SHIP.join(", ");
}

const simulationSpeedEl: HTMLInputElement | null =
  document.querySelector("#simulationSpeed");
if (simulationSpeedEl) {
  simulationSpeedEl.value = (DEFAULT_SIMULATION_SPEED * 100).toString();

  simulationSpeedEl.oninput = function () {
    simulationSpeed =
      1 - Math.min(Number((this as HTMLInputElement).value), 99) / 100;
  };
}

function log(append: string[]) {
  const debug = document.querySelector("#debug");
  if (debug) {
    const list = document.createElement("div");
    list.classList.add("list");
    append.forEach((text) => {
      const item = document.createElement("div");
      list.append(item);
      item.textContent = text;
    });

    debug.insertBefore(list, debug.firstChild);
  }
}

function getPower() {
  const power: HTMLInputElement | null = document.querySelector("#power");
  if (power) {
    return power.value;
  }
  return 0;
}

function setPower(value: string) {
  const power: HTMLInputElement | null = document.querySelector("#power");
  if (power) {
    power.value = value;
  }
}

function getRotate() {
  const rotate: HTMLInputElement | null = document.querySelector("#rotate");
  if (rotate) {
    return rotate.value;
  }
  return 0;
}

function setRotate(value: string) {
  const rotate: HTMLInputElement | null = document.querySelector("#rotate");
  if (rotate) {
    rotate.value = value;
  }
}

function getManualControl() {
  const manual: HTMLInputElement | null = document.querySelector("#manual");
  if (manual) {
    return manual.checked;
  }
  return false;
}

const reset: HTMLButtonElement | null = document.querySelector("#reset");
if (reset) {
  reset.addEventListener("click", start);
}
const zero: HTMLButtonElement | null = document.querySelector("#zero");
if (zero) {
  zero.addEventListener("click", () => {
    setRotate("90");
  });
}
const playpause: HTMLButtonElement | null =
  document.querySelector("#playpause");
if (playpause) {
  playpause.addEventListener("click", () => {
    running = !running;
  });
}

// =====================================================
// Draw
// =====================================================

const canvas = new Canvas();

let iteration = 0,
  realIteration = 0,
  timeoutId: number,
  animationId: number,
  desiredRotate: number,
  desiredPower: number,
  running = true;
const GRAVITY = 3.711;

function strip(n: number) {
  return Number(n.toPrecision(7));
}

function gameLoop(
  input: GameInput,
  groundPoints: number[][],
  clientCode: (input: GameInput) => number[]
) {
  if (!running) {
    animationId = requestAnimationFrame(() =>
      gameLoop(input, groundPoints, clientCode)
    );
    return;
  }

  const GAME_TICK = Math.round((1000 * simulationSpeed) / GAME_SPEED);
  const MAX_DELTA_ANGLE = strip(15 / GAME_TICK);
  const MAX_DELTA_POWER = 1 / GAME_TICK;

  const userRun = realIteration++ % GAME_TICK === 0;

  function logIteration(extra?: string) {
    const text: string[] = [];

    text.push(`🕗 ${iteration++}s`);
    text.push(
      `  x: ${Math.round(input.x)}, y: ${Math.round(input.y)}, hs: ${Math.round(
        input.hs
      )}, vs: ${Math.round(input.vs)}, rotate: ${Math.round(
        input.rotate
      )}, power: ${Math.round(input.power)}, fuel: ${Math.round(input.fuel)}`
    );

    if (extra) {
      text.push(extra);
    }

    log(text);
  }

  function terminate(message: string) {
    canvas.drawFailure(message);
    logIteration();
    log([message]);
  }

  // Draw the ship
  function drawShip() {
    const angle = ((input.rotate + 90) / 180) * -Math.PI;
    canvas.drawShip({
      ...input,
      rotate: angle,
    });
  }

  function drawFire() {
    canvas.drawText("🔥", input.x - 160, input.y - 100, 320);
  }

  timeoutId = setTimeout(() => {
    canvas.reset();
    canvas.drawGround(groundPoints);

    // check colision with screen
    if (input.x < 0 || input.x > 7000 || input.y < 0 || input.y > 3000) {
      logIteration();

      terminate("flown away 👋");
      return;
    }
    // check colision with ground
    let lastX, lastY;
    for (const [x, y] of groundPoints) {
      if (input.x < x && lastY !== undefined && lastX !== undefined) {
        const a = (y - lastY) / (x - lastX);
        const b = lastY - a * lastX;
        const groundY = a * input.x + b;

        if (groundY > input.y) {
          // Check landing conditions
          if (
            input.rotate === LANDING_ANGLE &&
            Math.abs(input.vs) < LANDING_VERTICAL_SPEED &&
            Math.abs(input.hs) < LANDING_HORIZONTAL_SPEED
          ) {
            drawShip();

            terminate("landed! 🏆");
          } else {
            drawFire();
            terminate("crashed ☠️");
          }
          return;
        }
        drawShip();
        break;
      } else {
        lastX = x;
        lastY = y;
      }
    }

    let newRotate = input.rotate,
      newX,
      newY,
      newPower = input.power;

    // Get user calc
    if (userRun) {
      const manualOverride = getManualControl();

      const ts = Date.now();
      [desiredRotate, desiredPower] = clientCode(input);
      if (Date.now() - ts > 100) {
        return terminate(`Too long to respond (${Date.now() - ts}ms)`);
      }
      if (manualOverride) {
        desiredPower = Number(getPower());
        desiredRotate = Number(getRotate()) - 90;
      } else {
        // Set in the UI
        setPower(desiredPower + "");
        setRotate(desiredRotate + 90 + "");
      }

      // Validation
      if (desiredRotate > 90 || desiredRotate < -90)
        return terminate(`Rotate value [${desiredRotate}] incorrect`);
      if (desiredPower > 4 || desiredPower < 0)
        return terminate(`Power value [${desiredPower}] incorrect`);
    }
    // Calculate new parameters
    const rotateDelta = strip(desiredRotate + 90 - (input.rotate + 90));
    const rotateDir = rotateDelta > 0 ? 1 : -1;
    newRotate = strip(
      input.rotate +
        Math.min(Math.abs(rotateDelta), MAX_DELTA_ANGLE) * rotateDir
    );

    if (input.fuel === 0) {
      newPower = 0;
    } else {
      const powerDelta = desiredPower - input.power;
      const powerDir = powerDelta > 0 ? 1 : -1;
      newPower =
        input.power +
        Math.min(Math.abs(powerDelta), MAX_DELTA_POWER) * powerDir;
    }

    // Calculate new position values
    const newAngle = ((newRotate + 90) / 180) * Math.PI;
    const newHS = input.hs + (Math.cos(newAngle) * newPower) / GAME_TICK;
    const newVS =
      input.vs + (Math.sin(newAngle) * newPower - GRAVITY) / GAME_TICK;

    newX = input.x + newHS / GAME_TICK;
    newY = input.y + newVS / GAME_TICK;

    const newInput = {
      rotate: newRotate,
      power: newPower,
      x: newX,
      y: newY,
      hs: newHS,
      vs: newVS,
      fuel: Math.max(input.fuel - newPower / GAME_TICK, 0),
    };

    if (userRun) {
      logIteration(`  user out: ${desiredRotate}, ${desiredPower}`);
    }

    if (canvas.clientDrawings) canvas.clientDrawings();

    animationId = requestAnimationFrame(() =>
      gameLoop(newInput, groundPoints, clientCode)
    );
  }, GAME_SPEED);
}

// =====================================================
// Initialize
// =====================================================

function stopListeners() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
}

function start() {
  stopListeners();
  iteration = 0;
  realIteration = 0;

  // clear debug
  const debug = document.querySelector("#debug");
  if (debug) {
    (debug as HTMLDivElement).innerHTML = "";
  }

  let groundInputs = DEFAULT_GROUND;
  let shipInputs = DEFAULT_SHIP;

  const ground: HTMLTextAreaElement | null = document.querySelector("#ground");
  if (ground && ground.value) {
    groundInputs = ground.value
      .split("\n")
      .map((row) => row.split(",").map(Number));
  }

  const ship: HTMLInputElement | null = document.querySelector("#ship");
  if (ship && ship.value) {
    shipInputs = ship.value.split(",").map(Number);
  }

  const [x, y, hs, vs, fuel, rotate, power] = shipInputs;
  const clientCode = clientStart(groundInputs, canvas);

  gameLoop(
    { x, y, hs: hs, vs: vs, fuel, rotate, power },
    groundInputs,
    clientCode
  );
}

start();
