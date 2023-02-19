import { Canvas, CanvasDrawing, COLOR } from "./canvas";
import { GameInput } from "./types";

class Result<T> {
  readonly canvasDrawings: CanvasDrawing[];
  value: T;

  constructor(initialValue: T) {
    this.canvasDrawings = [];
    this.value = initialValue;
  }
}

export function clientStart(ground: number[][], canvas: Canvas) {
  const groundPoints = ground.map(([x, y]) => new Point(x, y));
  const groundPolygon = new Polygon(...groundPoints);

  const WORLD_WIDTH = 7000;
  const WORLD_HEIGHT = 3000;

  const landingZone = getFlatGround();

  return function clientCode(input: GameInput) {
    if (!landingZone) return [0, 0];

    canvas.emptyClientDrawing();

    const ship = new Ship(input);
    const shipPos = ship.getPoint();
    const inertialTrajectoryResult = inertialTrajectory();
    canvas.addClientDrawing(...inertialTrajectoryResult.canvasDrawings);

    const resultPoint = inertialTrajectoryResult.value.getPoint();
    const closestLzResult = getLandingLocation(landingZone, resultPoint);
    const closestLz = closestLzResult.value;
    canvas.addClientDrawing(...closestLzResult.canvasDrawings);

    const flightPlanResult = computeFlightPlan();
    canvas.addClientDrawing(...flightPlanResult.canvasDrawings);

    const predictedShipResult = computeTrajectory(flightPlanResult.value);
    canvas.addClientDrawing(...predictedShipResult.canvasDrawings);
    const predictedShip = predictedShipResult.value;
    canvas.addClientDrawing(...predictedShip.canvasDrawing);

    return predictedShip.getFlightParameters(ship);

    // =====================================================
    // Flight plan
    // =====================================================

    function computeTrajectory(flightPlan: Line[]): Result<Ship> {
      // Landing ship
      let predictedShip = new Ship({
        x: closestLz.x,
        y: closestLz.y,
        hs: ship.getAcceptableLandingHS(),
        vs: -Ship.LANDING_VERTICAL_SPEED,
        fuel: 0,
        rotate: 0,
        power: 4,
      });

      const result = new Result<Ship>(predictedShip);

      let line;
      const PROXIMITY = 50;
      const MARGIN = 200;

      while ((line = flightPlan.pop())) {
        const higherPoint = line.getPoint("y", "max");
        higherPoint.offset(0, MARGIN);

        prediction: for (let i = 0; i < 60; i++) {
          let shipPoint = predictedShip.getPoint();
          result.canvasDrawings.push((canvas: Canvas) => {
            shipPoint.draw(canvas, COLOR.BLUE);
          });
          const directPath = new Line(shipPoint, higherPoint);
          predictedShip.moveIn(directPath, true);

          if (shipPoint.isClose(higherPoint, PROXIMITY, PROXIMITY)) {
            break prediction;
          }
        }
      }
      result.value = predictedShip;

      return result;
    }

    function computeFlightPlan(): Result<Line[]> {
      const directLine = new Line(shipPos, closestLz);
      const groundIntersections = groundPolygon.getIntersections(directLine);

      const result = new Result<Line[]>([directLine]);
      result.canvasDrawings.push((canvas) =>
        groundIntersections.forEach((l) => l.draw(canvas))
      );

      if (groundIntersections.length > 0) {
        let higher = new Point(0, 0);
        groundIntersections.forEach((l) => {
          const point = l.getPoint("y", "max");
          if (point.isAboveOf(higher)) {
            higher = point;
          }
        });
        const l1 = new Line(closestLz, higher);
        const l2 = new Line(higher, shipPos);
        result.canvasDrawings.push((canvas) => {
          l1.draw(canvas, COLOR.BLUE);
          l2.draw(canvas, COLOR.BLUE);
        });
        result.value = [l1, l2];
      } else {
        result.canvasDrawings.push((canvas) => {
          directLine.draw(canvas, COLOR.BLUE);
        });
      }

      return result;
    }

    function inertialTrajectory(): Result<Ship> {
      const predictedShip = new Ship(input);
      let { rotate, power } = input;
      const predictions: Point[] = [];
      let groundColision = null,
        flyAway = false;

      const result = new Result<Ship>(predictedShip);

      while (!groundColision && !flyAway) {
        predictedShip.move(rotate, power);
        const point = predictedShip.getPoint();
        predictions.push(point);

        groundColision = checkGroundColision(point);
        flyAway = checkFlyAway(point);
      }

      result.canvasDrawings.push((canvas: Canvas) => {
        predictions.forEach((point, index) => {
          if (index < predictions.length - 1) point.draw(canvas);
        });
      });

      result.canvasDrawings.push((canvas: Canvas) => {
        const SIZE = 120;
        if (predictedShip.isAllowedToLand()) {
          canvas.drawText(
            "✅",
            resultPoint.x,
            resultPoint.y - SIZE / 2,
            SIZE,
            "center"
          );
        } else {
          canvas.drawText(
            "💥",
            resultPoint.x,
            resultPoint.y - SIZE / 2,
            SIZE,
            "center"
          );
        }
      });

      return result;
    }

    function getLandingLocation(lz: Line, point: Point): Result<Point> {
      const SAFETY_MARGIN = 20;
      const line = lz.getPerpendicular(point);
      let LZ;
      if (line.isTangencial()) {
        LZ = lz.getCoincident(point);
      } else {
        LZ = lz.getIntersection(line);
      }

      const result = new Result(LZ);

      if (LZ.x > lz.p2.x) {
        result.value = lz.p2.offset(-SAFETY_MARGIN, 0);
      }
      if (LZ.x < lz.p1.x) {
        result.value = lz.p1.offset(SAFETY_MARGIN, 0);
      }
      result.canvasDrawings.push((canvas: Canvas) => {
        result.value.draw(canvas);
        result.value.drawText(canvas, "cLZ");
      });

      return result;
    }
  };

  function checkGroundColision(ship: Point): Line | null {
    let prevPoint: Point | null = null;

    for (const point of groundPoints) {
      if (prevPoint && ship.x < point.x) {
        const line = new Line(prevPoint, point);

        const acceptedGroundY = line.fn(ship.x);

        if (acceptedGroundY > ship.y) {
          return line;
        }
        return null;
      } else {
        prevPoint = point;
      }
    }
    return null;
  }

  function checkFlyAway(ship: Point) {
    return (
      ship.x < 0 || ship.y < 0 || ship.x > WORLD_WIDTH || ship.y > WORLD_HEIGHT
    );
  }

  function getFlatGround(): Line | null {
    const points = ground.map(([x, y]) => new Point(x, y));
    let prevPoint: Point | null = null;

    for (const point of points) {
      if (point.y === prevPoint?.y) {
        return new Line(prevPoint, point);
      }
      prevPoint = point;
    }

    return null;
  }
}

// =====================================================
// Geometry
// =====================================================

interface Sprite {
  draw(canvas: Canvas, color?: string): void;
}

class Point implements Sprite {
  constructor(readonly x: number, readonly y: number) {}

  isBetween(line: Line, axis: "x" | "y") {
    return (
      line.getPoint(axis, "min")[axis] < this[axis] &&
      this[axis] < line.getPoint(axis, "max")[axis]
    );
  }

  isRightOf(point: Point) {
    return this.x > point.x;
  }

  isAboveOf(point: Point) {
    return this.y > point.y;
  }

  draw(canvas: Canvas, color: string = COLOR.WHITE) {
    canvas.drawCircle(this.x, this.y, 10, color);
  }

  drawText(canvas: Canvas, text: string) {
    canvas.drawText(text, this.x, this.y - 100, 80, "center");
  }

  getDistance(point: Point): number {
    return Math.sqrt(
      Math.pow(point.x - this.x, 2) + Math.pow(point.y - this.y, 2)
    );
  }

  offset(x: number, y: number) {
    return new Point(this.x + x, this.y + y);
  }

  isClose(point: Point, x: number, y: number) {
    return Math.abs(this.x - point.x) <= x && Math.abs(this.y - point.y) <= y;
  }
}

class Line implements Sprite {
  private a: number;
  private b: number;

  constructor(readonly p1: Point, readonly p2: Point) {
    const a = (p1.y - p2.y) / (p1.x - p2.x);
    const b = p2.y - a * p2.x;
    this.a = a;
    this.b = b;
  }

  getCoincident(point: Point): Point {
    return new Point(point.x, this.fn(point.x));
  }

  getPerpendicular(point: Point): Line {
    const p = this.getCoincident(point);
    const line = new Line(p, this.p1).getNormal("p1");
    line.translate(point.y - p.y);

    return line;
  }

  getNormal(pivot: "p1" | "p2"): Line {
    const p = this[pivot];
    const angle = Math.PI / 2 + this.getAngle();
    const fx = p.x + Math.cos(angle);
    const fy = p.y + Math.sin(angle);
    return new Line(this[pivot], new Point(fx, fy));
  }

  getAngle() {
    const { p1, p2 } = this;
    return Math.atan((p1.y - p2.y) / (p1.x - p2.x));
  }

  getPoint(axis: "x" | "y", comparator: "min" | "max"): Point {
    return Math[comparator](this.p1[axis], this.p2[axis]) === this.p1[axis]
      ? this.p1
      : this.p2;
  }

  getIntersection(line: Line): Point {
    const x = (line.b - this.b) / (this.a - line.a);
    const y = this.fn(x);
    return new Point(x, y);
  }

  isTangencial() {
    return Number.isNaN(this.fn(0));
  }

  translate(t: number) {
    this.b += t;
  }

  fn(x: number) {
    return this.a * x + this.b;
  }

  // ifn(y: number) {
  //   return (y - this.b) / this.a
  // }

  intersectsBetween(line: Line) {
    const intersection = this.getIntersection(line);
    return (
      intersection.isBetween(line, "x") && intersection.isBetween(line, "y")
    );
  }

  draw(canvas: Canvas, color: string = COLOR.WHITE) {
    canvas.drawLine(this.p1.x, this.p1.y, this.p2.x, this.p2.y, true, color);
  }

  plot(canvas: Canvas, color: string = COLOR.WHITE) {
    canvas.getCtx((_, width, height) => {
      if (this.isTangencial()) {
        new Line(new Point(this.p1.x, 0), new Point(this.p1.x, height)).draw(
          canvas,
          color
        );
      } else {
        new Line(
          new Point(0, this.fn(0)),
          new Point(width, this.fn(width))
        ).draw(canvas, color);
      }
    });
  }
}

class Polygon {
  readonly lines: Array<Line> = [];

  constructor(...points: Point[]) {
    if (points.length < 2)
      throw new Error("Polygons require at least two points");

    let [prevPoint] = points;
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      this.lines.push(new Line(prevPoint, point));

      prevPoint = point;
    }
  }

  getIntersections(line: Line) {
    return this.lines.filter((l) => line.intersectsBetween(l));
  }
}

class Ship {
  static GRAVITY = 3.711;
  static LANDING_ANGLE = 0;
  static LANDING_VERTICAL_SPEED = 40;
  static LANDING_HORIZONTAL_SPEED = 20;
  static MAX_ANGLE_STEP = 15;

  private fuel: number;
  private power: number;
  private rotate: Angle;
  private vs: number;
  private hs: number;
  private x: number;
  private y: number;
  private pDiff: number;
  private soDiff: number;
  private pRotate: Angle | null;
  readonly canvasDrawing: CanvasDrawing[];

  constructor(gameInput: GameInput) {
    this.x = gameInput.x;
    this.y = gameInput.y;
    this.fuel = gameInput.fuel;
    this.rotate = Angle.fromInput(gameInput.rotate);
    this.vs = gameInput.vs;
    this.hs = gameInput.hs;
    this.power = gameInput.power;
    this.pDiff = -Infinity;
    this.soDiff = 0;
    this.pRotate = null;
    this.canvasDrawing = [];
  }

  move(rotate: number, power: number, isReverse = false) {
    const direction = isReverse ? -1 : 1;
    this.rotate = Angle.fromInput(rotate);
    this.power = power;

    if (!isReverse && this.fuel === 0) {
      this.power = 0;
    }

    const angle = this.rotate.toRad();
    this.hs += Math.cos(angle) * this.power * direction;
    this.vs += (Math.sin(angle) * this.power - Ship.GRAVITY) * direction;
    this.x += this.hs * direction;
    this.y += this.vs * direction;
    this.fuel = Math.max(this.fuel - this.power * direction, 0);
  }

  moveIn(line: Line, isReverse = false) {
    const direction = isReverse ? -1 : 1;
    const angle = this.rotate.toRad();
    const inertialHs = this.hs + Math.cos(angle) * this.power * direction;
    const inertialVs =
      this.vs + (Math.sin(angle) * this.power - Ship.GRAVITY) * direction;
    const inertialX = this.x + inertialHs * direction;
    const inertialY = this.y + inertialVs * direction;

    const lineAngle = Angle.fromRad(line.getAngle());
    const inertialPoint = new Point(inertialX, inertialY);
    const inertialLine = new Line(this.getPoint(), inertialPoint);
    const inertialAngle = Angle.fromRad(inertialLine.getAngle());
    const diff = Math.abs(lineAngle.toRad() - inertialAngle.toRad());

    let desiredAngle = Angle.fromInput(0);

    const soDiff = diff - this.pDiff;
    if (diff > this.pDiff || soDiff > this.soDiff) {
      const allowedDiff = Math.min(diff, (Ship.MAX_ANGLE_STEP / 180) * Math.PI);
      const operation = inertialAngle.toRad() > lineAngle.toRad() ? -1 : 1;

      desiredAngle = Angle.constrain(
        this.rotate.toRad() + allowedDiff * operation
      );
    } else {
      if (this.pRotate) {
        desiredAngle = Angle.constrain(
          this.rotate.toRad() -
            (this.rotate.toRad() - this.pRotate.toRad()) * 0.9
        );
      }
    }

    this.canvasDrawing.push((canvas: Canvas) => {
      canvas.drawArrow(this.x, this.y, 100, this.rotate.toRad());
    });

    const resultRotate = desiredAngle.toInput();
    // console.log(
    //   `Linha: ${lineAngle.toInput().toFixed(0)}, Inercia: ${inertialAngle
    //     .toInput()
    //     .toFixed(0)}, Rotate atual: ${this.rotate
    //     .toInput()
    //     .toFixed(0)}, Resultado: ${resultRotate.toFixed(0)}`
    // );
    this.soDiff = diff - this.pDiff;
    this.pDiff = diff;
    this.pRotate = this.rotate;

    let power = 4;
    // if (soDiff < 0.1) power = 3;
    // if (soDiff < 0.01) power = 2;
    // if (soDiff < 0.001) power = 1;
    // if (soDiff < 0.0001) power = 0;

    this.move(resultRotate, power, isReverse);
  }

  getPoint() {
    return new Point(this.x, this.y);
  }

  isAllowedToLand() {
    return (
      Math.abs(this.hs) < Ship.LANDING_HORIZONTAL_SPEED &&
      Math.abs(this.vs) < Ship.LANDING_VERTICAL_SPEED &&
      this.rotate.toInput() === Ship.LANDING_ANGLE
    );
  }

  getAcceptableLandingHS() {
    return Ship.LANDING_HORIZONTAL_SPEED * (this.hs > 0 ? 1 : -1);
  }

  getFlightParameters(currentShip: Ship) {
    const deltaRotate = Math.abs(
      this.rotate.toInput() + 90 - (currentShip.rotate.toInput() + 90)
    );
    const dirRotate = this.rotate.toRad() > currentShip.rotate.toRad() ? -1 : 1;
    const maxRotate = this.rotate.toInput() + Ship.MAX_ANGLE_STEP * dirRotate;
    const allowedRotate = Math.min(deltaRotate, maxRotate);

    return [allowedRotate, this.power];
  }
}

class Angle {
  constructor(private readonly value: number) {}

  toInput() {
    return (this.value / Math.PI) * 180 - 90;
  }

  toRad() {
    return this.value;
  }

  static fromInput(value: number) {
    return new Angle(((value + 90) / 180) * Math.PI);
  }

  static fromRad(value: number) {
    return new Angle(value < 0 ? value + Math.PI : value);
  }

  static constrain(value: number) {
    const angle = value < 0 ? value + Math.PI : value;
    return new Angle(Math.min(Math.max(angle, 0), Math.PI));
  }
}
