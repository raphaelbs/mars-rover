import { Canvas, COLOR } from "./canvas";
import { GameInput } from "./types";

export function clientStart(ground: number[][], canvas: Canvas) {
  const groundPoints = ground.map(([x, y]) => new Point(x, y));
  const groundPolygon = new Polygon(...groundPoints);

  const LANDING_ANGLE = 0;
  const LANDING_VERTICAL_SPEED = 40;
  const LANDING_HORIZONTAL_SPEED = 20;
  const GRAVITY = 3.711;
  const WORLD_WIDTH = 7000;
  const WORLD_HEIGHT = 3000;

  const landingZone = getFlatGround();

  return function clientCode(input: GameInput) {
    if (!landingZone) return [0, 0];

    const ship = new Point(input.x, input.y);
    const { predictions, result } = inertialTrajectory();
    const resultPoint = new Point(result.x, result.y);
    const closestLz = getLandingLocation(landingZone, resultPoint);
    const inertialSuccessLanding =
      Math.abs(result.hs) < LANDING_HORIZONTAL_SPEED &&
      Math.abs(result.vs) < LANDING_VERTICAL_SPEED &&
      result.rotate === LANDING_ANGLE;

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
      if (inertialSuccessLanding) {
        canvas.drawText("✅", result.x, result.y - SIZE / 2, SIZE, "center");
      } else {
        canvas.drawText("💥", result.x, result.y - SIZE / 2, SIZE, "center");
      }

      computeFlightPlan(canvas).forEach((l) => l.draw(canvas, COLOR.BLUE));
    }

    // =====================================================
    // Flight plan
    // =====================================================

    function computeFlightPlan(canvas: Canvas) {
      const directLine = new Line(ship, closestLz);
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

        return [new Line(closestLz, higher), new Line(higher, ship)];
      }

      return [directLine];
    }

    function inertialTrajectory() {
      let predictedShip = ship;
      let { x, y, hs, vs, rotate, fuel, power } = input;
      const angle = ((rotate + 90) / 180) * Math.PI;
      const predictions: Point[] = [];
      let result = { x, y, hs, vs, rotate, fuel, power };
      let groundColision = null,
        flyAway = false;

      while (!groundColision && !flyAway) {
        if (fuel === 0) {
          power = 0;
        }
        hs += Math.cos(angle) * power;
        vs += Math.sin(angle) * power - GRAVITY;
        x += hs;
        y += vs;
        fuel = Math.max(fuel - power, 0);
        result = { x, y, hs, vs, rotate, fuel, power };

        predictedShip = new Point(x, y);
        predictions.push(predictedShip);

        groundColision = checkGroundColision(predictedShip);
        flyAway = checkFlyAway(predictedShip);
      }

      return { predictions, result };
    }

    function getLandingLocation(lz: Line, point: Point): Point {
      const line = lz.getPerpendicular(point);
      let LZ;
      if (line.isTangencial()) {
        LZ = lz.getCoincident(point);
      } else {
        LZ = lz.getIntersection(line);
      }

      const dp1p2 = lz.p1.getDistance(lz.p2);
      const dLZp1 = LZ.getDistance(lz.p1);
      const dLZp2 = LZ.getDistance(lz.p2);
      if (dLZp1 > dp1p2) {
        return lz.p2;
      }
      if (dLZp2 > dp1p2) {
        return lz.p1;
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
