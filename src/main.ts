import { Canvas, GameInput } from "./canvas";
import "./style.css";

const DEFAULT_GROUND = [
  6,
  [0, 1500],
  [1000, 2000],
  [2000, 500],
  [3500, 500],
  [5000, 1500],
  [6999, 1000],
];

//(X Y hSpeed vSpeed fuel rotate power)
const DEFAULT_SHIP = [5000, 2500, -50, 0, 1000, 90, 0];

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

function log(append: string) {
  const debug = document.querySelector("#debug");
  if (debug) {
    (debug as HTMLDivElement).textContent =
      append + "\n" + (debug as HTMLDivElement).textContent;
  }
}

// =====================================================
// Draw
// =====================================================

const canvas = new Canvas();

function drawGround() {
  const [_, ...groundPoints] = DEFAULT_GROUND;
  let [previous] = groundPoints;
  for (let i = 1; i < groundPoints.length; i++) {
    const [x1, y1] = groundPoints[i] as number[];
    const [x2, y2] = previous as number[];
    canvas.drawLine(x1, y1, x2, y2);
    previous = groundPoints[i];
  }
}

let iteration = 0;
const GRAVITY = 3.711;

function gameLoop(input: GameInput) {
  let text = `\nIteration ${iteration++}: ${JSON.stringify(input)}`;

  setTimeout(() => {
    canvas.reset();
    drawGround();

    // Draw the ship
    const angle = ((input.rotate + 90) / 180) * Math.PI;
    canvas.drawShip({
      ...input,
      rotate: angle,
    });

    // Get user calc
    const [desiredRotate, desiredPower] = code(input);
    text += `\n  out: ${desiredRotate}, ${desiredPower}`;

    // Validation
    if (desiredRotate > 90 || desiredRotate < -90)
      throw new Error("Rotate value incorrect");
    if (desiredPower > 4 || desiredPower < 0)
      throw new Error("Power value incorrect");

    const newRotate =
      Math.abs(desiredRotate + 90 - (input.rotate + 90)) <= 15
        ? desiredRotate
        : desiredRotate > input.rotate
        ? input.rotate + 15
        : input.rotate - 15;
    let newPower =
      Math.abs(input.power - desiredPower) <= 1
        ? desiredPower
        : desiredPower > input.power
        ? input.power + 1
        : input.power - 1;

    text += `\n  out: ${newRotate}, ${newPower}`;

    if (input.fuel === 0) {
      newPower = 0;
    }

    const newAngle = ((newRotate + 90) / 180) * Math.PI;
    const newHS = Number((input.hs + Math.cos(newAngle) * newPower).toFixed(0));
    const newVS = Number(
      (input.vs + Math.sin(newAngle) * newPower - GRAVITY).toFixed(0)
    );
    const newX = input.x + newHS;
    const newY = input.y + newVS;

    const newInput = {
      rotate: newRotate,
      power: newPower,
      x: newX,
      y: newY,
      hs: newHS,
      vs: newVS,
      fuel: input.fuel - newPower,
    };

    log(text);

    if (newX < 0 || newX > 7000 || newY < 0 || newY > 3000) {
      log("failed");
      return;
    }

    requestAnimationFrame(() => gameLoop(newInput));
  }, 1000);
}

function code(input: GameInput) {
  // TODO algo

  return [-20, 0];
}

function start() {
  const [x, y, hs, vs, fuel, rotate, power] = DEFAULT_SHIP;
  gameLoop({ x, y, hs, vs, fuel, rotate, power });
}

start();
