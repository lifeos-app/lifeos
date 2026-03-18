/**
 * Keyboard Controller — The Realm
 *
 * WASD / Arrow key movement for desktop.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export class KeyboardController {
  private keysDown = new Set<string>();
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;

  private readonly MOVE_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'w', 'a', 's', 'd', 'W', 'A', 'S', 'D',
  ]);

  attach(): void {
    this.boundKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (this.MOVE_KEYS.has(e.key)) {
        this.keysDown.add(e.key.toLowerCase());
        e.preventDefault();
      }
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  /**
   * Get movement direction vector based on currently pressed keys.
   * Returns {dx, dy} normalised to -1, 0, or 1.
   */
  getMovement(): { dx: number; dy: number; direction: Direction; isMoving: boolean } {
    let dx = 0;
    let dy = 0;

    if (this.keysDown.has('arrowleft') || this.keysDown.has('a')) dx -= 1;
    if (this.keysDown.has('arrowright') || this.keysDown.has('d')) dx += 1;
    if (this.keysDown.has('arrowup') || this.keysDown.has('w')) dy -= 1;
    if (this.keysDown.has('arrowdown') || this.keysDown.has('s')) dy += 1;

    const isMoving = dx !== 0 || dy !== 0;

    let direction: Direction = 'down';
    if (dy < 0) direction = 'up';
    else if (dy > 0) direction = 'down';
    else if (dx < 0) direction = 'left';
    else if (dx > 0) direction = 'right';

    return { dx, dy, direction, isMoving };
  }

  /** Check if any movement key is pressed */
  isAnyKeyDown(): boolean {
    return this.keysDown.size > 0;
  }

  detach(): void {
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
    this.boundKeyDown = null;
    this.boundKeyUp = null;
    this.keysDown.clear();
  }
}
