export class Canvas {
  private ctx: CanvasRenderingContext2D | undefined;
  private width: number | undefined;
  private height: number | undefined;

  constructor() {
    this.getCtx((ctx, width, height) => {
      ctx.transform(1, 0, 0, -1, 0, height);
      ctx.scale(0.2, 0.2);
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
    this.getCtx((ctx, width, height) => {
      //   ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      // ctx.scale(0.2, 0.2);
      //   ctx.scale(5, 5);

      //   context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.scale(5, 5);
      this.drawRect(0, 0, ctx.canvas.width, ctx.canvas.height, "#ffffff");
      ctx.scale(0.2, 0.2);

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
    if (this.ctx) {
      if (dashed) this.ctx.setLineDash([5, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(xf, yf);
      this.ctx.stroke();
      this.ctx.closePath();
      if (dashed) this.ctx.setLineDash([]);
    }
  }

  drawRect(x: number, y: number, w: number, h: number, color: string) {
    if (this.ctx) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, w, h);
    }
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
    if (this.ctx) {
      this.ctx.save();
      this.ctx.scale(1, -1);
      this.ctx.fillText(text, x, y * -1);
      this.ctx.restore();
    }
  }

  drawInfoVector(
    x: number,
    y: number,
    size: number,
    angle: number,
    info: string,
    dashed: boolean = false
  ) {
    if (this.ctx) {
      const [ax, ay] = this.drawArrow(x, y, size, angle, dashed);

      const fx = ax + size * Math.cos(angle);
      const fy = ay + size * Math.sin(angle);

      this.drawText(info, fx, fy);
    }
  }

  drawShip(input: GameInput) {
    if (this.ctx) {
      this.ctx.fillStyle = "#000";
      // Ship
      this.ctx.beginPath();
      this.ctx.arc(input.x, input.y, 50, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.closePath();

      // Direction
      const ARROW_SIZE = 120;
      const xDir = input.hs > 0 ? 0 : Math.PI; // 0 = →, PI = ←
      this.drawInfoVector(
        input.x,
        input.y,
        ARROW_SIZE,
        xDir,
        input.hs + "",
        true
      );
      const yDir = input.vs > 0 ? Math.PI / 2 : -Math.PI / 2; // +1=↓, -1=↑
      this.drawInfoVector(
        input.x,
        input.y,
        ARROW_SIZE,
        yDir,
        input.vs + "",
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
        `Liters of fuel: ${input.fuel}`,
        input.x - 200,
        input.y + 200
      );
    }
  }
}

export type GameInput = {
  x: number;
  y: number;
  hs: number;
  vs: number;
  fuel: number;
  rotate: number;
  power: number;
};
