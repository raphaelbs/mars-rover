import { Canvas, COLOR } from "./canvas";
import { GameInput } from "./types";

export function clientStart(ground: number[][], canvas: Canvas) {
  const groundPoints = ground.map(([x, y]) => new Point(x, y));
  const groundPolygon = new Polygon(...groundPoints);

  const WORLD_WIDTH = 7000;
  const WORLD_HEIGHT = 3000;

  const landingZone = getFlatGround();

  return function clientCode(input: GameInput) {
    if (!landingZone) return [0, 0];

    const ship = new Ship(input);
    const shipPos = ship.getPoint();
    const { predictions, result } = inertialTrajectory();
    const resultPoint = result.getPoint();
    const closestLz = getLandingLocation(landingZone, resultPoint);

    canvas.clientDrawings = clientDrawings;

    let rotate = -5,
      power = 3;

    return [rotate, power];

    function clientDrawings() {
      if (!landingZone) return;

      // landingZone.p1.draw(canvas);
      // landingZone.p2.draw(canvas);
      // landingZone.draw(canvas);

      closestLz.draw(canvas);
      closestLz.drawText(canvas, "cLZ");

      predictions.forEach((point, index) => {
        if (index < predictions.length - 1) point.draw(canvas);
      });

      const SIZE = 120;
      if (result.isAllowedToLand()) {
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

      const flightPlan = computeFlightPlan(canvas);
      flightPlan.forEach((l) => l.draw(canvas, COLOR.BLUE));
      computeTrajectory(flightPlan);
    }

    // =====================================================
    // Flight plan
    // =====================================================

    function computeTrajectory(flightPlan: Line[]) {
      console.clear();

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

      let line;
      while ((line = flightPlan.pop())) {
        const CLOSE = 100;
        const higherPoint = line.getPoint("y", "max");
        for (let i = 0; i < 100; i++) {
          let shipPoint = predictedShip.getPoint();
          shipPoint.draw(canvas, COLOR.BLUE);

          const directPath = new Line(shipPoint, higherPoint);
          predictedShip.moveIn(directPath, true, canvas);
        }
        // while (s
        //   Math.abs(shipPoint.x - higherPoint.x) > CLOSE ||
        //   Math.abs(shipPoint.y - higherPoint.y) > CLOSE
        // ) {

        // }
      }
      console.log(
        "==============================================================="
      );
    }

    function computeFlightPlan(canvas: Canvas) {
      const directLine = new Line(shipPos, closestLz);
      const groundIntersections = groundPolygon.getIntersections(directLine);
      groundIntersections.forEach((l) => l.draw(canvas));

      if (groundIntersections.length > 0) {
        let higher = new Point(0, 0);
        groundIntersections.forEach((l) => {
          const point = l.getPoint("y", "max");
          if (point.isAboveOf(higher)) {
            higher = point;
          }
        });

        return [new Line(closestLz, higher), new Line(higher, shipPos)];
      }

      return [directLine];
    }

    function inertialTrajectory() {
      const predictedShip = new Ship(input);
      let { rotate, power } = input;
      const predictions: Point[] = [];
      let groundColision = null,
        flyAway = false;

      while (!groundColision && !flyAway) {
        predictedShip.move(rotate, power);
        const point = predictedShip.getPoint();
        predictions.push(point);

        groundColision = checkGroundColision(point);
        flyAway = checkFlyAway(point);
      }

      return { predictions, result: predictedShip };
    }

    function getLandingLocation(lz: Line, point: Point): Point {
      const SAFETY_MARGIN = 20;
      const line = lz.getPerpendicular(point);
      let LZ;
      if (line.isTangencial()) {
        LZ = lz.getCoincident(point);
      } else {
        LZ = lz.getIntersection(line);
      }

      if (LZ.x > lz.p2.x) {
        return lz.p2.offset(-SAFETY_MARGIN, 0);
      }
      if (LZ.x < lz.p1.x) {
        return lz.p1.offset(SAFETY_MARGIN, 0);
      }
      return LZ;
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

  moveIn(line: Line, isReverse = false, canvas: Canvas) {
    const direction = isReverse ? -1 : 1;
    const angle = this.rotate.toRad();
    const inertialHs = this.hs + Math.cos(angle) * this.power * direction;
    const inertialVs =
      this.vs + (Math.sin(angle) * this.power - Ship.GRAVITY) * direction;
    const inertialX = this.x + inertialHs * direction;
    const inertialY = this.y + inertialVs * direction;

    const lineAngle = Angle.fromRad(line.getAngle());
    const movingInAngle = Angle.fromRad(
      Math.atan((inertialY - this.y) / (inertialX - this.x))
    );
    const diff = Math.abs(lineAngle.toRad() - movingInAngle.toRad());

    let desiredAngle = Angle.fromInput(0);

    const soDiff = diff - this.pDiff;
    if (soDiff > this.soDiff) {
      const allowedDiff = Math.min(diff, (Ship.MAX_ANGLE_STEP / 180) * Math.PI);
      const operation = movingInAngle.toRad() > lineAngle.toRad() ? -1 : 1;

      desiredAngle = Angle.fromRad(
        this.rotate.toRad() + allowedDiff * operation
      );
      console.log("SODIFF");
    } else {
      console.log("PROTATE#");
      if (this.pRotate) {
        desiredAngle = Angle.fromRad(
          this.rotate.toRad() -
            (this.rotate.toRad() - this.pRotate.toRad()) * 0.5
        );
      }
    }

    canvas.drawArrow(this.x, this.y, 100, desiredAngle.toRad());

    const resultRotate = desiredAngle.toInput();
    console.log(
      `Linha: ${lineAngle.toInput().toFixed(0)}, Inercia: ${movingInAngle
        .toInput()
        .toFixed(0)}, Rotate atual: ${this.rotate
        .toInput()
        .toFixed(0)}, Resultado: ${resultRotate.toFixed(0)}`
    );
    this.pDiff = diff;
    this.pRotate = this.rotate;
    this.soDiff = diff - this.pDiff;

    this.move(resultRotate, 4, isReverse);
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
    return new Angle(value);
  }
}
