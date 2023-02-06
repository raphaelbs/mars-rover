import { GameInput } from "./types";

export function clientStart(groundPoints: number[][]) {
  console.log(groundPoints);
  return function clientCode(input: GameInput) {
    // TODO algo
    console.log(input);

    return [0, 3];
  };
}
