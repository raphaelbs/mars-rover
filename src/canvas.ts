import { GameInput } from "./types";

const SCALE = 0.2;

export const COLOR = {
  WHITE: "#FFF",
  BLACK: "#000",
  BLUE: "#00F",
  GREEN: "#0F0",
  RED: "#F00",
  SKY: "#ad6242",
  GROUND: "#c1440e",
};

export type CanvasDrawing = (canvas: Canvas) => void;

export class Canvas {
  private ctx: CanvasRenderingContext2D | undefined;
  private width: number | undefined;
  private height: number | undefined;
  private readonly clientDrawings: CanvasDrawing[];
  onClick: ((x: number, y: number) => void) | null;

  constructor() {
    this.getCtx((ctx) => {
      ctx.transform(1, 0, 0, -1, 0, ctx.canvas.height);
      ctx.scale(SCALE, SCALE);
    });
    this.reset();
    this.clientDrawings = [];
    this.onClick = null;
  }

  addClientDrawing(...clientDrawings: CanvasDrawing[]) {
    this.clientDrawings.push(...clientDrawings);
  }

  emptyClientDrawing() {
    let d;
    while ((d = this.clientDrawings.pop())) {
      d(this);
    }
  }

  drawClientDrawing() {
    this.clientDrawings.forEach((d) => d(this));
  }

  getCtx(
    cb: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  ) {
    if (this.ctx && this.width && this.height) {
      cb(this.ctx, this.width, this.height);
      return;
    }
    const c = document.getElementById("myCanvas");
    if (c) {
      const ctx = (c as HTMLCanvasElement).getContext("2d");

      if (ctx) {
        c.addEventListener("click", (ev) => {
          this.onClick?.(
            ev.offsetX / SCALE,
            (ctx.canvas.height - ev.offsetY) / SCALE
          );
        });
        this.ctx = ctx;
        this.width = ctx.canvas.width / SCALE;
        this.height = ctx.canvas.height / SCALE;
        cb(ctx, this.width, this.height);
      }
    }
  }

  reset() {
    this.getCtx((ctx, width, height) => {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.scale(5, 5);
      this.drawRect(0, 0, width, height, COLOR.SKY);
      ctx.scale(SCALE, SCALE);

      ctx.font = "60px Arial";
    });
  }

  drawLine(
    x: number,
    y: number,
    xf: number,
    yf: number,
    dashed: boolean = false,
    color: string = COLOR.BLACK
  ) {
    this.getCtx((ctx) => {
      ctx.beginPath();
      if (dashed) ctx.setLineDash([50, 30]);
      ctx.strokeStyle = color;
      ctx.moveTo(x, y);
      ctx.lineTo(xf, yf);
      ctx.stroke();
      if (dashed) ctx.setLineDash([]);
    });
  }

  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string = COLOR.BLACK
  ) {
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

  drawText(
    text: string,
    x: number,
    y: number,
    size: number = 60,
    position: CanvasTextAlign = "left",
    color: string = COLOR.BLACK
  ) {
    this.getCtx((ctx) => {
      ctx.save();
      ctx.scale(1, -1);
      ctx.font = `${size}px Arial`;
      ctx.textAlign = position;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y * -1);
      ctx.font = "60px Arial";
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

  drawCircle(x: number, y: number, radius: number, color: string = "#000") {
    this.getCtx((ctx) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  drawImg(
    x: number,
    y: number,
    angle: number = 0,
    img: HTMLImageElement,
    size: number
  ) {
    this.getCtx((ctx) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-1 * angle + Math.PI / 4);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  }

  drawShip(input: GameInput) {
    this.getCtx((ctx) => {
      // Ship
      imgRef.then((img) => {
        this.drawImg(input.x, input.y, input.rotate, img, 150);
      });

      ctx.fillStyle = COLOR.BLACK;

      // Direction
      const ARROW_SIZE = 120;
      const xDir = input.hs > 0 ? 0 : Math.PI; // 0 = →, PI = ←
      this.drawInfoVector(
        input.x,
        input.y,
        ARROW_SIZE,
        xDir,
        Math.round(input.hs) + "",
        true
      );
      const yDir = input.vs > 0 ? Math.PI / 2 : -Math.PI / 2; // +1=↓, -1=↑
      this.drawInfoVector(
        input.x,
        input.y,
        ARROW_SIZE,
        yDir,
        Math.round(input.vs) + "",
        true
      );

      // Thrusters
      this.drawInfoVector(
        input.x,
        input.y,
        (input.power / 4 + 1.5) * ARROW_SIZE,
        Math.PI - input.rotate,
        Math.round(input.power) + ""
      );

      // Fuel
      this.drawText(`Fuel: ${input.fuel.toFixed(0)}`, input.x, input.y + 200);
    });
  }

  drawFailure(text: string) {
    this.getCtx((_, width, height) => {
      this.drawText(text, width / 2, height / 2 - 360, 720, "center");
    });
  }

  drawGround(groundPoints: number[][]) {
    this.getCtx((ctx) => {
      if (this.width) {
        const copy = [...groundPoints];
        copy.push([this.width, 0], [0, 0]);
        let [previous] = copy;

        let region = new Path2D();
        region.moveTo(previous[0], previous[1]);
        for (let i = 1; i < copy.length; i++) {
          const [x, y] = copy[i];
          region.lineTo(x, y);
        }
        region.closePath();
        ctx.fillStyle = COLOR.GROUND;
        ctx.fill(region, "evenodd");
        ctx.stroke();
      }
    });
  }
}

const imgRef: Promise<HTMLImageElement> = new Promise((resolve) => {
  const image = new Image();
  image.addEventListener("load", function () {
    resolve(this);
  });
  image.src = "rocket-svgrepo-com.svg";
});
