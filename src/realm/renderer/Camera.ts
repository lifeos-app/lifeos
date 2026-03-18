/**
 * Camera System — The Realm
 *
 * Smooth follow, 2 zoom levels, pan on mobile.
 * Keeps the player centered while respecting world bounds.
 */

export class Camera {
  /** Camera position in world pixels (top-left corner of viewport) */
  x = 0;
  y = 0;

  /** Viewport size in screen pixels */
  viewportWidth = 0;
  viewportHeight = 0;

  /** World bounds in world pixels */
  worldWidth = 0;
  worldHeight = 0;

  /** Zoom level: 1 = close, 0.5 = zoomed out */
  private _zoom = 1;
  private targetZoom = 1;

  /** Smoothing factor (0 = no smoothing, 1 = instant) */
  private smoothing = 0.08;

  /** Target position (lerps toward this) */
  private targetX = 0;
  private targetY = 0;

  /** Shake effect */
  private shakeIntensity = 0;
  private shakeDecay = 0.9;
  shakeOffsetX = 0;
  shakeOffsetY = 0;

  get zoom(): number {
    return this._zoom;
  }

  /**
   * Set world bounds (call when zone changes)
   */
  setWorldBounds(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /**
   * Set viewport size (call on resize)
   */
  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Follow a world position (usually the player)
   */
  follow(worldX: number, worldY: number): void {
    // Center the target in the viewport
    this.targetX = worldX - (this.viewportWidth / this._zoom) / 2;
    this.targetY = worldY - (this.viewportHeight / this._zoom) / 2;
  }

  /**
   * Toggle between zoom levels
   */
  toggleZoom(): void {
    this.targetZoom = this.targetZoom === 1 ? 0.6 : 1;
  }

  setZoom(z: number): void {
    this.targetZoom = Math.max(0.4, Math.min(1.5, z));
  }

  /**
   * Trigger screen shake
   */
  shake(intensity = 5): void {
    this.shakeIntensity = intensity;
  }

  /**
   * Update camera position (call every frame)
   */
  update(): void {
    // Lerp zoom
    this._zoom += (this.targetZoom - this._zoom) * 0.06;

    // Clamp target to world bounds
    const vpW = this.viewportWidth / this._zoom;
    const vpH = this.viewportHeight / this._zoom;

    // Center world when smaller than viewport
    if (this.worldWidth < vpW) {
      this.targetX = -(vpW - this.worldWidth) / 2;
    } else {
      const maxX = this.worldWidth - vpW;
      this.targetX = Math.max(0, Math.min(maxX, this.targetX));
    }

    if (this.worldHeight < vpH) {
      this.targetY = -(vpH - this.worldHeight) / 2;
    } else {
      const maxY = this.worldHeight - vpH;
      this.targetY = Math.max(0, Math.min(maxY, this.targetY));
    }

    // Lerp position
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;

    // Shake
    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
    }
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this._zoom + this.shakeOffsetX,
      y: (worldY - this.y) * this._zoom + this.shakeOffsetY,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.shakeOffsetX) / this._zoom + this.x,
      y: (screenY - this.shakeOffsetY) / this._zoom + this.y,
    };
  }

  /**
   * Check if a world rect is visible on screen
   */
  isVisible(worldX: number, worldY: number, width: number, height: number): boolean {
    const sx = (worldX - this.x) * this._zoom;
    const sy = (worldY - this.y) * this._zoom;
    const sw = width * this._zoom;
    const sh = height * this._zoom;
    return (
      sx + sw > 0 &&
      sy + sh > 0 &&
      sx < this.viewportWidth &&
      sy < this.viewportHeight
    );
  }

  /**
   * Snap to position instantly (no lerp)
   */
  snapTo(worldX: number, worldY: number): void {
    const vpW = this.viewportWidth / this._zoom;
    const vpH = this.viewportHeight / this._zoom;
    this.targetX = worldX - vpW / 2;
    this.targetY = worldY - vpH / 2;
    this.x = this.targetX;
    this.y = this.targetY;
  }
}
