import { Canvas } from "./canvas";
import { clientCode } from "./client";
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
// Set the values in the UI
// =====================================================

const ground = document.querySelector("#ground");
if (ground) {
  ground.textContent = DEFAULT_GROUND.join("\n");
  ground.setAttribute("rows", DEFAULT_GROUND.length + "");
}

const ship = document.querySelector("#ship");
if (ship) {
  (ship as HTMLInputElement).value = DEFAULT_SHIP.join(", ");
}

const simulationSpeedEl = document.querySelector("#simulationSpeed");
if (simulationSpeedEl) {
  (simulationSpeedEl as HTMLInputElement).value = (
    DEFAULT_SIMULATION_SPEED * 100
  ).toString();

  (simulationSpeedEl as HTMLInputElement).oninput = function () {
    simulationSpeed = 1 - Number((this as HTMLInputElement).value) / 100;
  };
}

function log(append: string) {
  const debug = document.querySelector("#debug");
  if (debug) {
    const list = document.createElement("div");
    list.classList.add("list");
    append.split("\n").forEach((text) => {
      const item = document.createElement("div");
      list.append(item);
      item.textContent = text;
    });

    debug.insertBefore(list, debug.firstChild);
  }
}

const reset = document.querySelector("#reset");
if (reset) {
  (reset as HTMLButtonElement).onclick = function onReset() {
    if (clear) {
      clearTimeout(clear);
    }
    iteration = 0;
    realIteration = 0;

    start();
  };
}

// =====================================================
// Draw
// =====================================================

const canvas = new Canvas();

function drawGround() {
  canvas.drawGround(DEFAULT_GROUND);
}

let iteration = 0,
  realIteration = 0,
  clear: number;
const GRAVITY = 3.711;

function gameLoop(input: GameInput, groundPoints: number[][]) {
  const GAME_TICK = Number(((1000 * simulationSpeed) / GAME_SPEED).toFixed(0));

  const userRun = realIteration++ % GAME_TICK === 0;
  let text = "";

  function buildIterationLog() {
    text = `Iteration ${iteration++}:`;
    text += `\n  x:${input.x}, y:${input.y}, hs:${input.hs}, vs:${input.vs}, rotate:${input.rotate}, power:${input.power}, fuel:${input.fuel}`;
  }

  if (userRun) {
    buildIterationLog();
  }

  clear = setTimeout(() => {
    canvas.reset();
    drawGround();

    // Draw the ship
    const angle = ((input.rotate + 90) / 180) * -Math.PI;
    canvas.drawShip({
      ...input,
      rotate: angle,
    });

    // check colision with screen
    if (input.x < 0 || input.x > 7000 || input.y < 0 || input.y > 3000) {
      buildIterationLog();
      log(text);

      log("flown away");
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
          buildIterationLog();
          log(text);
          canvas.drawFailure("wasted");
          log("crashed");
          return;
        } else {
          break;
        }
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
      const [desiredRotate, desiredPower] = clientCode(input);
      text += `\n  user out: ${desiredRotate}, ${desiredPower}`;

      // Validation
      if (desiredRotate > 90 || desiredRotate < -90)
        throw new Error("Rotate value incorrect");
      if (desiredPower > 4 || desiredPower < 0)
        throw new Error("Power value incorrect");

      // Calculate new parameters
      newRotate =
        Math.abs(desiredRotate + 90 - (input.rotate + 90)) <= 15
          ? desiredRotate
          : desiredRotate > input.rotate
          ? input.rotate + 15
          : input.rotate - 15;
      newPower =
        Math.abs(input.power - desiredPower) <= 1
          ? desiredPower
          : desiredPower > input.power
          ? input.power + 1
          : input.power - 1;

      text += `\n  comp out: ${newRotate}, ${newPower}`;

      if (input.fuel === 0) {
        newPower = 0;
      }
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
      fuel: input.fuel - newPower / GAME_TICK,
    };

    if (userRun) {
      log(text);
    }

    requestAnimationFrame(() => gameLoop(newInput, groundPoints));
  }, GAME_SPEED);
}

// =====================================================
// Initialize
// =====================================================

function start() {
  // clear debug
  const debug = document.querySelector("#debug");
  if (debug) {
    (debug as HTMLDivElement).innerHTML = "";
  }

  const [x, y, hs, vs, fuel, rotate, power] = DEFAULT_SHIP;
  gameLoop({ x, y, hs: hs, vs: vs, fuel, rotate, power }, DEFAULT_GROUND);
}

start();
