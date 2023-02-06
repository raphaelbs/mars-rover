import { GameInput } from "./types";

const SCALE = 0.2;

export class Canvas {
  private ctx: CanvasRenderingContext2D | undefined;
  private width: number | undefined;
  private height: number | undefined;

  constructor() {
    this.getCtx((ctx, _, height) => {
      ctx.transform(1, 0, 0, -1, 0, height);
      ctx.scale(SCALE, SCALE);
    });
    this.reset();
  }

  private getCtx(
    cb: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  ) {
    if (this.ctx && this.width && this.height) {
      cb(this.ctx, this.width, this.height);
      return;
    }
    const c = document.getElementById("myCanvas");
    if (c) {
      const ctx = (c as HTMLCanvasElement).getContext("2d");
      const { width, height } = c.getBoundingClientRect();

      if (ctx) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        cb(ctx, width, height);
      }
    }
  }

  reset() {
    this.getCtx((ctx) => {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.scale(5, 5);
      this.drawRect(0, 0, ctx.canvas.width, ctx.canvas.height, "#ad6242");
      ctx.scale(SCALE, SCALE);

      ctx.font = "60px Arial";
    });
  }

  drawLine(
    x: number,
    y: number,
    xf: number,
    yf: number,
    dashed: boolean = false
  ) {
    this.getCtx((ctx) => {
      if (dashed) ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(xf, yf);
      ctx.stroke();
      ctx.closePath();
      if (dashed) ctx.setLineDash([]);
    });
  }

  drawRect(x: number, y: number, w: number, h: number, color: string) {
    this.getCtx((ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    });
  }

  drawVector(
    x: number,
    y: number,
    size: number,
    angle: number,
    dashed: boolean = false
  ) {
    const fx = x + size * Math.cos(angle);
    const fy = y + size * Math.sin(angle);
    this.drawLine(x, y, fx, fy, dashed);
    return [fx, fy];
  }

  drawArrow(
    x: number,
    y: number,
    size: number,
    angle: number,
    dashed: boolean = false
  ) {
    const [ax, ay] = this.drawVector(x, y, size, angle, dashed);

    this.drawVector(ax, ay, size / 5, angle + (3 * Math.PI) / 4, dashed);
    this.drawVector(ax, ay, size / 5, angle - (3 * Math.PI) / 4, dashed);
    return [ax, ay];
  }

  drawText(text: string, x: number, y: number) {
    this.getCtx((ctx) => {
      ctx.save();
      ctx.scale(1, -1);
      ctx.fillText(text, x, y * -1);
      ctx.restore();
    });
  }

  drawInfoVector(
    x: number,
    y: number,
    size: number,
    angle: number,
    info: string,
    dashed: boolean = false
  ) {
    this.getCtx(() => {
      const [ax, ay] = this.drawArrow(x, y, size, angle, dashed);

      const fx = ax + size * Math.cos(angle);
      const fy = ay + size * Math.sin(angle);

      this.drawText(info, fx, fy);
    });
  }

  drawShip(input: GameInput) {
    this.getCtx((ctx) => {
      ctx.fillStyle = "#000";
      // Ship
      ctx.beginPath();
      ctx.arc(input.x, input.y, 50, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.closePath();

      // Direction
      const ARROW_SIZE = 120;
      const xDir = input.hs > 0 ? 0 : Math.PI; // 0 = →, PI = ←
      this.drawInfoVector(
        input.x,
        input.y,
        ARROW_SIZE,
        xDir,
        input.hs.toFixed(0),
        true
      );
      const yDir = input.vs > 0 ? Math.PI / 2 : -Math.PI / 2; // +1=↓, -1=↑
      this.drawInfoVector(
        input.x,
        input.y,
        ARROW_SIZE,
        yDir,
        input.vs.toFixed(0),
        true
      );

      // Thrusters
      this.drawInfoVector(
        input.x,
        input.y,
        (input.power / 4 + 1.5) * ARROW_SIZE,
        Math.PI - input.rotate,
        input.power + ""
      );

      // Fuel
      this.drawText(
        `Liters of fuel: ${input.fuel.toFixed(0)}`,
        input.x - 200,
        input.y + 200
      );
    });
  }

  drawFailure(text: string) {
    this.getCtx((ctx, width, height) => {
      ctx.font = "720px Arial";
      ctx.save();
      ctx.scale(1, -1);
      ctx.textAlign = "center";
      ctx.fillText(text, width / SCALE / 2, (height / SCALE / 2 - 360) * -1);
      ctx.restore();
      ctx.font = "60px Arial";
    });
  }

  drawGround(groundPoints: number[][]) {
    this.getCtx((ctx, width) => {
      groundPoints.push([width / SCALE, 0], [0, 0]);
      let [previous] = groundPoints;

      let region = new Path2D();
      region.moveTo(previous[0], previous[1]);
      for (let i = 1; i < groundPoints.length; i++) {
        const [x, y] = groundPoints[i];
        region.lineTo(x, y);
      }
      region.closePath();
      ctx.fillStyle = "#c1440e";
      ctx.fill(region, "evenodd");
      ctx.stroke();
    });
  }
}