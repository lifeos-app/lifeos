/**
 * Touch & Mouse Controller — The Realm
 *
 * Handles tap-to-move (mobile) and click-to-move (desktop).
 * Dispatches move targets for pathfinding.
 */

export interface MoveTarget {
  worldX: number;
  worldY: number;
}

export interface TapEvent {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
}

type TapHandler = (event: TapEvent) => void;
type MoveHandler = (target: MoveTarget) => void;

export class TouchController {
  private canvas: HTMLCanvasElement | null = null;
  private onTap: TapHandler | null = null;
  private onMove: MoveHandler | null = null;
  private screenToWorld: ((sx: number, sy: number) => { worldX: number; worldY: number }) | null = null;

  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  private boundHandlers: {
    touchstart?: (e: TouchEvent) => void;
    touchend?: (e: TouchEvent) => void;
    mousedown?: (e: MouseEvent) => void;
    mouseup?: (e: MouseEvent) => void;
  } = {};

  attach(
    canvas: HTMLCanvasElement,
    screenToWorld: (sx: number, sy: number) => { worldX: number; worldY: number },
    onTap: TapHandler,
    onMove: MoveHandler,
  ): void {
    this.canvas = canvas;
    this.screenToWorld = screenToWorld;
    this.onTap = onTap;
    this.onMove = onMove;

    // Touch events
    this.boundHandlers.touchstart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.touchStartTime = Date.now();
    };

    this.boundHandlers.touchend = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      const dt = Date.now() - this.touchStartTime;

      // Only treat as tap if touch was short and didn't move much
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 300) {
        e.preventDefault();
        this.handleTap(t.clientX, t.clientY);
      }
    };

    // Mouse events (desktop)
    this.boundHandlers.mousedown = (e: MouseEvent) => {
      this.touchStartX = e.clientX;
      this.touchStartY = e.clientY;
      this.touchStartTime = Date.now();
    };

    this.boundHandlers.mouseup = (e: MouseEvent) => {
      const dx = e.clientX - this.touchStartX;
      const dy = e.clientY - this.touchStartY;
      const dt = Date.now() - this.touchStartTime;

      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
        this.handleTap(e.clientX, e.clientY);
      }
    };

    canvas.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: true });
    canvas.addEventListener('touchend', this.boundHandlers.touchend);
    canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    canvas.addEventListener('mouseup', this.boundHandlers.mouseup);
  }

  private handleTap(clientX: number, clientY: number): void {
    if (!this.canvas || !this.screenToWorld) return;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const world = this.screenToWorld(screenX, screenY);
    // Touch → world coordinate conversion

    // Dispatch tap for NPC/building interaction
    this.onTap?.({
      screenX,
      screenY,
      worldX: world.worldX,
      worldY: world.worldY,
    });

    // Dispatch move target
    this.onMove?.({
      worldX: world.worldX,
      worldY: world.worldY,
    });
  }

  detach(): void {
    if (!this.canvas) return;
    if (this.boundHandlers.touchstart) {
      this.canvas.removeEventListener('touchstart', this.boundHandlers.touchstart);
    }
    if (this.boundHandlers.touchend) {
      this.canvas.removeEventListener('touchend', this.boundHandlers.touchend);
    }
    if (this.boundHandlers.mousedown) {
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
    }
    if (this.boundHandlers.mouseup) {
      this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseup);
    }
    this.boundHandlers = {};
    this.canvas = null;
  }
}
