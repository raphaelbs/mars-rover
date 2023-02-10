import { Canvas, COLOR } from "./canvas";
import { GameInput } from "./types";

export function clientStart(groundPoints: number[][], canvas: Canvas) {
  const LANDING_ANGLE = 0;
  const LANDING_VERTICAL_SPEED = 40;
  const LANDING_HORIZONTAL_SPEED = 20;
  const GRAVITY = 3.711;
  const lz = getFlatGround();

  return function clientCode(input: GameInput) {
    // TODO algo
    // console.log(input);

    const ship = new Point(input.x, input.y);

    canvas.clientDrawings = function () {
      if (lz) {
        lz.p1.draw(canvas);
        lz.p2.draw(canvas);
        lz.draw(canvas);

        const LZ = getLandingLocation(lz);
        canvas.drawText("LZ", LZ.x, LZ.y, 80, COLOR.BLACK, "center");

        inertialTrajectory().forEach((point) => point.draw(canvas));
      }
    };

    return [-5, 3];

    // =====================================================
    // Flight plan
    // =====================================================

    function inertialTrajectory() {
      let predictedShip = new Point(input.x, input.y);
      let { x, y, hs, vs, rotate, fuel, power } = input;
      const angle = ((rotate + 90) / 180) * Math.PI;
      const predictions: Point[] = [];

      while (!checkGroundColision(predictedShip)) {
        hs += Math.cos(angle) * power;
        vs += Math.sin(angle) * power - GRAVITY;
        x += hs;
        y += vs;
        fuel -= power;

        predictedShip = new Point(x, y);
        predictions.push(predictedShip);
      }

      return predictions;
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

    function getLandingLocation(lz: Line): Point {
      const line = lz.getPerpendicular(ship);
      let LZ;
      if (line.isTangencial()) {
        LZ = lz.getCoincident(ship);
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

  draw(canvas: Canvas, color: string = COLOR.WHITE) {
    canvas.drawCircle(this.x, this.y, 10, color);
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
