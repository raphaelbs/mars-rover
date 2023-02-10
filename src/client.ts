import { Canvas, COLOR } from "./canvas";
import { GameInput } from "./types";

export function clientStart(groundPoints: number[][], canvas: Canvas) {
  const LANDING_ANGLE = 0;
  const LANDING_VERTICAL_SPEED = 40;
  const LANDING_HORIZONTAL_SPEED = 20;
  const GRAVITY = 3.711;
  const WORLD_WIDTH = 7000;
  const WORLD_HEIGHT = 3000;

  const landingZone = getFlatGround();

  if (!landingZone)
    return function clientCode(_: GameInput) {
      return [0, 0];
    };

  return function clientCode(input: GameInput) {
    const ship = new Point(input.x, input.y);
    const { predictions, result } = inertialTrajectory();
    const resultPoint = new Point(result.x, result.y);
    const inertialSuccessLanding =
      Math.abs(result.hs) < LANDING_HORIZONTAL_SPEED &&
      Math.abs(result.vs) < LANDING_VERTICAL_SPEED &&
      result.rotate === LANDING_ANGLE;

    canvas.clientDrawings = function () {
      landingZone.p1.draw(canvas);
      landingZone.p2.draw(canvas);
      landingZone.draw(canvas);

      const closestLz = getLandingLocation(landingZone, resultPoint);
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
    };

    let rotate = -5,
      power = 3;

    return [rotate, power];

    // =====================================================
    // Flight plan
    // =====================================================

    function inertialTrajectory() {
      let predictedShip = ship;
      let { x, y, hs, vs, rotate, fuel, power } = input;
      const angle = ((rotate + 90) / 180) * Math.PI;
      const predictions: Point[] = [];
      let result = { x, y, hs, vs, rotate, fuel, power };
      let groundColision = false,
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

    function checkGroundColision(ship: Point) {
      const points = groundPoints.map(([x, y]) => new Point(x, y));
      let prevPoint: Point | null = null;

      for (const point of points) {
        if (prevPoint && ship.x < point.x) {
          const line = new Line(prevPoint, point);

          const acceptedGroundY = line.fn(ship.x);

          if (acceptedGroundY > ship.y) {
            return true;
          }
          return false;
        } else {
          prevPoint = point;
        }
      }
      return false;
    }

    function checkFlyAway(ship: Point) {
      return (
        ship.x < 0 ||
        ship.y < 0 ||
        ship.x > WORLD_WIDTH ||
        ship.y > WORLD_HEIGHT
      );
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

  function getFlatGround(): Line | null {
    const points = groundPoints.map(([x, y]) => new Point(x, y));
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
    const bigger = Math.max(line.p1[axis], line.p2[axis]);
    const smaller = Math.min(line.p1[axis], line.p2[axis]);
    return smaller < this[axis] && this[axis] < bigger;
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
