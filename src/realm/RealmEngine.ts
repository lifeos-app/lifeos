/**
 * Realm Engine — Main game loop & state machine
 *
 * States: loading → playing → paused → menu
 * Coordinates rendering, input, pathfinding, and data bridge.
 */

import { RealmRenderer, type RenderFrame, type PlayerRenderState } from './renderer/RealmRenderer';
import { KeyboardController } from './input/KeyboardController';
import { TouchController } from './input/TouchController';
import { findPath, isTileWalkable } from './input/Pathfinding';
import { TILE_SIZE, type TileType } from './data/tiles';
import { LIFE_TOWN, type ZoneDef, type PortalPlacement, type BuildingPlacement } from './data/zones';
import { deriveWorldState, deriveDialogueContext, type RealmWorldState, type GardenPlant, type DynamicEntity } from './bridge/DataBridge';
import type { FloraSpecies } from './data/flora';
import { getFloraCache } from './hooks/useFlora';
import { getNPCDialogue } from './data/dialogue';
import { SFXEngine } from './audio/SFXEngine';
import { MusicEngine } from './audio/MusicEngine';
import { LightingSystem, type PointLight } from './renderer/LightingSystem';
import type { CharacterClass } from '../rpg/engine/types';
import { RealmMultiplayer } from './multiplayer/RealmMultiplayer';
import type { RemotePlayer, ChatMessage, EmoteType, PresencePayload } from './multiplayer/types';
import { RealmEventBus } from './bridge/RealmEventBus';
import { getMoonPhase, getTodayEvent, getSeason, SEASON_PALETTES } from './data/celestial';
import { updateCompanionBond } from './hooks/useFauna';

export type RealmState = 'loading' | 'playing' | 'paused' | 'menu';

export interface RealmCharacterData {
  name: string;
  class: CharacterClass;
  level: number;
  totalXp: number;
  appearance: { skinTone: number; hairStyle: number; hairColor: number; outfit: number };
  position: { map: string; x: number; y: number };
}

/** NPC interaction callback */
export type NPCInteractionHandler = (npcId: string, name: string, dialogue: string[]) => void;

/** Portal interaction callback */
export type PortalInteractionHandler = (portal: PortalPlacement, locked: boolean) => void;

/** Plant interaction callback */
export type PlantInteractionHandler = (plant: GardenPlant) => void;

/** Shadow/entity interaction callback */
export type EntityInteractionHandler = (entity: DynamicEntity) => void;

/** Building interaction callback */
export type BuildingInteractionHandler = (buildingType: string) => void;

/** Remote player tap callback */
export type RemotePlayerTapHandler = (player: RemotePlayer) => void;

/** Companion interaction callback */
export type CompanionInteractionHandler = () => void;

const SCALE = 3;
const MOVE_SPEED = 2.5; // pixels per frame in world coords

export class RealmEngine {
  private state: RealmState = 'loading';
  private renderer: RealmRenderer;
  private keyboard: KeyboardController;
  private touch: TouchController;
  readonly sfx = new SFXEngine();
  readonly music = new MusicEngine();

  private zone: ZoneDef = LIFE_TOWN;
  private worldState: RealmWorldState | null = null;
  private rpgCharacter: RealmCharacterData | null = null;

  // Player position in world pixels
  private playerX = 0;
  private playerY = 0;
  private playerDir: 'up' | 'down' | 'left' | 'right' = 'down';
  private playerMoving = false;

  // Pathfinding (tap-to-move)
  private path: { col: number; row: number }[] = [];
  private pathIndex = 0;

  // Tap indicator
  private tapIndicator: { worldX: number; worldY: number; time: number } | null = null;

  // Animation frame
  private animFrameId: number | null = null;
  private lastTime = 0;
  private isRunning = false;
  private footstepTimer = 0;
  private frameCount = 0;

  // Callbacks
  private onNPCInteraction: NPCInteractionHandler | null = null;
  private onPortalInteraction: PortalInteractionHandler | null = null;
  private onPlantInteraction: PlantInteractionHandler | null = null;
  private onEntityInteraction: EntityInteractionHandler | null = null;
  private onBuildingInteraction: BuildingInteractionHandler | null = null;
  private onRemotePlayerTap: RemotePlayerTapHandler | null = null;
  private onCompanionInteraction: CompanionInteractionHandler | null = null;
  private onStateChange: ((state: RealmState) => void) | null = null;

  // Event bus subscriptions
  private eventBusUnsubs: (() => void)[] = [];

  // Multiplayer
  private multiplayer: RealmMultiplayer | null = null;
  private localChatBubble: { text: string; time: number } | null = null;

  constructor() {
    this.renderer = new RealmRenderer();
    this.keyboard = new KeyboardController();
    this.touch = new TouchController();
  }

  // ── Lifecycle ──────────────────────────────────

  init(
    canvas: HTMLCanvasElement,
    character: RealmCharacterData | null,
    callbacks: {
      onNPCInteraction?: NPCInteractionHandler;
      onPortalInteraction?: PortalInteractionHandler;
      onPlantInteraction?: PlantInteractionHandler;
      onEntityInteraction?: EntityInteractionHandler;
      onBuildingInteraction?: BuildingInteractionHandler;
      onRemotePlayerTap?: RemotePlayerTapHandler;
      onCompanionInteraction?: CompanionInteractionHandler;
      onStateChange?: (state: RealmState) => void;
    } = {},
    userId?: string,
  ): void {
    this.rpgCharacter = character;
    this.onNPCInteraction = callbacks.onNPCInteraction || null;
    this.onPortalInteraction = callbacks.onPortalInteraction || null;
    this.onPlantInteraction = callbacks.onPlantInteraction || null;
    this.onEntityInteraction = callbacks.onEntityInteraction || null;
    this.onBuildingInteraction = callbacks.onBuildingInteraction || null;
    this.onRemotePlayerTap = callbacks.onRemotePlayerTap || null;
    this.onCompanionInteraction = callbacks.onCompanionInteraction || null;
    this.onStateChange = callbacks.onStateChange || null;

    // Attach renderer
    this.renderer.attach(canvas);

    // Attach input
    this.keyboard.attach();
    this.touch.attach(
      canvas,
      (sx, sy) => this.renderer.screenToWorld(sx, sy),
      (tap) => this.handleTap(tap.worldX, tap.worldY),
      (target) => this.handleMoveTarget(target.worldX, target.worldY),
    );

    // Derive world state from stores
    this.worldState = deriveWorldState(character, getFloraCache());

    // Set initial player position
    if (character?.position) {
      this.playerX = character.position.x;
      this.playerY = character.position.y;
    } else {
      // Spawn at zone spawn point
      this.playerX = this.zone.spawnX * TILE_SIZE * SCALE + (TILE_SIZE * SCALE) / 2;
      this.playerY = this.zone.spawnY * TILE_SIZE * SCALE + (TILE_SIZE * SCALE) / 2;
    }

    // Snap camera to player
    this.renderer.camera.snapTo(this.playerX, this.playerY);

    // Set up lighting
    this.setupLighting();

    // Set celestial state
    this.updateCelestialState();

    // Subscribe to event bus for companion bond XP
    if (userId) {
      this.eventBusUnsubs.push(
        RealmEventBus.on('habit_logged', () => {
          updateCompanionBond(userId, 5);
        }),
      );
    }

    // Initialize multiplayer
    if (userId) {
      this.multiplayer = new RealmMultiplayer(userId);
      const payload = this.buildPresencePayload(userId);
      if (payload) {
        this.multiplayer.joinZone(this.zone.id, payload);
      }
    }

    // Start
    this.setState('playing');
    this.start();
  }

  private setupLighting(): void {
    const lights: PointLight[] = [];

    // Building window lights (visible at night)
    for (const b of this.zone.buildings) {
      if (b.type === 'house' || b.type === 'town_hall' || b.type === 'tavern') {
        lights.push({
          worldX: (b.tileX + b.widthTiles / 2) * TILE_SIZE * SCALE,
          worldY: (b.tileY + b.heightTiles / 2) * TILE_SIZE * SCALE,
          radius: 80,
          color: '#FFD700',
          intensity: 0.8,
          flicker: true,
        });
      }
    }

    // Well light
    const well = this.zone.buildings.find(b => b.type === 'well');
    if (well) {
      lights.push({
        worldX: (well.tileX + 0.5) * TILE_SIZE * SCALE,
        worldY: (well.tileY + 0.5) * TILE_SIZE * SCALE,
        radius: 50,
        color: '#4ECDC4',
        intensity: 0.5,
        flicker: false,
      });
    }

    this.renderer.lighting.setPointLights(lights);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.multiplayer?.resume();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.isRunning = false;
    this.multiplayer?.pause();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.eventBusUnsubs.forEach(u => u());
    this.eventBusUnsubs = [];
    this.multiplayer?.destroy();
    this.multiplayer = null;
    this.keyboard.detach();
    this.touch.detach();
    this.renderer.detach();
    this.sfx.destroy();
    this.music.destroy();
  }

  /** Initialize audio after user gesture */
  initAudio(musicEnabled: boolean): void {
    this.sfx.init();
    if (musicEnabled) {
      this.music.init().then(() => {
        this.music.play(this.zone.id);
        if (this.worldState) {
          this.music.setMood(this.worldState.moodScore);
        }
      });
    }
  }

  setMusicEnabled(enabled: boolean): void {
    if (enabled) {
      this.music.init().then(() => {
        this.music.play(this.zone.id);
        if (this.worldState) this.music.setMood(this.worldState.moodScore);
      });
    } else {
      this.music.stop();
    }
  }

  resize(): void {
    this.renderer.resize();
  }

  // ── State ──────────────────────────────────────

  getState(): RealmState {
    return this.state;
  }

  private setState(newState: RealmState): void {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  /** Refresh world state from stores */
  refreshWorldState(): void {
    this.worldState = deriveWorldState(this.rpgCharacter, getFloraCache());
  }

  getPlayerPosition(): { x: number; y: number; map: string } {
    return { x: this.playerX, y: this.playerY, map: this.zone.id };
  }

  // ── Game Loop ──────────────────────────────────

  // FPS tracking
  private fpsFrames = 0;
  private fpsLastLog = 0;

  private tick = (time: number): void => {
    if (!this.isRunning) return;

    const delta = time - this.lastTime;
    this.lastTime = time;

    // Log FPS every 3 seconds
    this.fpsFrames++;
    if (time - this.fpsLastLog > 3000) {
      const elapsed = (time - this.fpsLastLog) / 1000;
      // FPS logging disabled
      this.fpsFrames = 0;
      this.fpsLastLog = time;
    }

    if (this.state === 'playing') {
      this.update(delta);
      this.render();
    }

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private update(deltaMs: number): void {
    if (!this.worldState) return;
    this.frameCount++;

    // Update multiplayer interpolation
    this.multiplayer?.updateInterpolation(deltaMs);

    // Keyboard movement takes priority over pathfinding
    const kb = this.keyboard.getMovement();
    if (kb.isMoving) {
      this.path = []; // Cancel pathfinding
      this.movePlayer(kb.dx, kb.dy, kb.direction);
    } else if (this.path.length > 0) {
      // Follow path
      this.followPath();
    } else {
      this.playerMoving = false;
    }

    // Footstep SFX
    if (this.playerMoving) {
      this.footstepTimer++;
      if (this.footstepTimer >= 12) {
        this.footstepTimer = 0;
        const tile = this.renderer.worldToTile(this.playerX, this.playerY);
        const tileType = this.zone.tiles[tile.row]?.[tile.col] || 'grass';
        this.sfx.playFootstep(tileType as TileType);
      }
    } else {
      this.footstepTimer = 0;
    }

    // Update weather
    this.renderer.weatherRenderer.setWeather(this.worldState.weather);

    // Update music mood/time
    if (this.frameCount % 60 === 0) {
      this.music.setMood(this.worldState.moodScore);
      const tod = this.renderer.lighting.getState().timeOfDay;
      this.music.setTimeOfDay(tod);
    }

    // Broadcast position to multiplayer
    this.multiplayer?.broadcastPosition(
      this.playerX, this.playerY, this.playerDir, this.playerMoving,
    );

    // Update celestial state every ~60 seconds
    if (this.frameCount % 3600 === 0) {
      this.updateCelestialState();
    }

    // Companion bond XP: +1 every 300 frames of active play (~5 seconds)
    if (this.playerMoving && this.frameCount % 300 === 0 && this.multiplayer) {
      const uid = (this.multiplayer as any).userId as string | undefined;
      if (uid) updateCompanionBond(uid, 1);
    }

    // Check portal proximity
    this.checkPortalProximity();
  }

  private updateCelestialState(): void {
    const now = new Date();
    const moonPhase = getMoonPhase(now);
    const season = getSeason(now);
    const palette = SEASON_PALETTES[season];
    const todayEvent = getTodayEvent(now);
    const meteorActive = todayEvent?.type === 'meteor_shower';
    this.renderer.lighting.setCelestialState(moonPhase, meteorActive, palette.ambientBoost);
  }

  private movePlayer(dx: number, dy: number, direction: 'up' | 'down' | 'left' | 'right'): void {
    const speed = MOVE_SPEED * SCALE;
    const newX = this.playerX + dx * speed;
    const newY = this.playerY + dy * speed;

    // Check walkability at new position
    const tile = this.renderer.worldToTile(newX, newY);
    if (isTileWalkable(this.zone, tile.col, tile.row)) {
      this.playerX = newX;
      this.playerY = newY;
    }

    this.playerDir = direction;
    this.playerMoving = true;
    this.multiplayer?.reportActivity();
  }

  private followPath(): void {
    if (this.pathIndex >= this.path.length) {
      this.path = [];
      this.pathIndex = 0;
      this.playerMoving = false;
      return;
    }

    const target = this.path[this.pathIndex];
    const targetWorld = this.renderer.tileToWorld(target.col, target.row);
    const dx = targetWorld.x - this.playerX;
    const dy = targetWorld.y - this.playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < MOVE_SPEED * SCALE) {
      this.playerX = targetWorld.x;
      this.playerY = targetWorld.y;
      this.pathIndex++;
    } else {
      const speed = MOVE_SPEED * SCALE;
      this.playerX += (dx / dist) * speed;
      this.playerY += (dy / dist) * speed;
    }

    // Set direction
    if (Math.abs(dx) > Math.abs(dy)) {
      this.playerDir = dx > 0 ? 'right' : 'left';
    } else {
      this.playerDir = dy > 0 ? 'down' : 'up';
    }
    this.playerMoving = true;
  }

  private checkPortalProximity(): void {
    if (!this.worldState) return;
    const ts = TILE_SIZE * SCALE;
    const threshold = ts * 1.5;

    for (const portal of this.zone.portals) {
      const px = portal.tileX * ts + ts / 2;
      const py = portal.tileY * ts + ts / 2;
      const dist = Math.sqrt(
        (this.playerX - px) ** 2 + (this.playerY - py) ** 2,
      );

      if (dist < threshold) {
        const locked = !this.worldState.zoneUnlocks[portal.targetZone];
        this.onPortalInteraction?.(portal, locked);
      }
    }
  }

  // ── Input Handlers ─────────────────────────────

  private handleTap(worldX: number, worldY: number): void {
    if (!this.worldState) {
      console.error('[Realm] handleTap: no worldState!');
      return;
    }
    const ts = TILE_SIZE * SCALE;
    this.multiplayer?.reportActivity();

    // Convert to screen coords for hit testing
    const screen = this.renderer.camera.worldToScreen(worldX, worldY);

    // Check NPC tap first — uses world-coordinate distance
    let nearestNPC: { id: string; name: string; dist: number } | null = null;
    for (const npc of this.zone.npcs) {
      const nx = npc.tileX * ts + ts / 2;
      const ny = npc.tileY * ts + ts / 2;
      const dist = Math.sqrt((worldX - nx) ** 2 + (worldY - ny) ** 2);
      if (!nearestNPC || dist < nearestNPC.dist) {
        nearestNPC = { id: npc.id, name: npc.name, dist };
      }
      if (dist < ts * 1.5) {
        this.debugLastTap = { worldX, worldY, nearestNPC: npc.name, dist, hit: true };
        try {
          this.sfx.playNPCInteract();
          const ctx = deriveDialogueContext(this.rpgCharacter);
          const lines = getNPCDialogue(npc.id, ctx);
          // NPC hit detected
          this.onNPCInteraction?.(npc.id, npc.name, lines);
        } catch (err) {
          console.error('[Realm] NPC interaction ERROR:', err);
        }
        return;
      }
    }
    // Store for debug overlay + log
    if (nearestNPC) {
      this.debugLastTap = { worldX, worldY, nearestNPC: nearestNPC.name, dist: nearestNPC.dist, hit: false };
    }
    // Tap miss logged for debugging if needed

    // Check remote player tap
    if (this.multiplayer) {
      const remotePlayers = this.multiplayer.getRemotePlayers();
      const tappedPlayer = this.renderer.getRemotePlayerAtScreen(screen.x, screen.y, remotePlayers);
      if (tappedPlayer) {
        this.onRemotePlayerTap?.(tappedPlayer);
        return;
      }
    }

    // Check companion tap
    if (this.worldState?.companion) {
      const hitCompanion = this.renderer.companionRenderer.getCompanionAtScreen(
        screen.x, screen.y, this.renderer.camera,
      );
      if (hitCompanion) {
        this.sfx.playNPCInteract();
        this.onCompanionInteraction?.();
        return;
      }
    }

    // Check garden plant tap
    const gardenBounds = this.computeGardenBounds();
    const plant = this.renderer.gardenRenderer.getPlantAtScreen(
      screen.x, screen.y, this.renderer.camera,
      this.worldState.gardenPlants, gardenBounds,
    );
    if (plant) {
      this.sfx.playNPCInteract();
      this.onPlantInteraction?.(plant);
      return;
    }

    // Check dynamic entity tap
    const allEntities = [
      ...this.worldState.shadows,
      ...this.worldState.goalCompanions,
      ...this.worldState.journalEchoes,
    ];
    const entity = this.renderer.entityRenderer.getEntityAtScreen(
      screen.x, screen.y, this.renderer.camera, allEntities,
    );
    if (entity) {
      this.sfx.playNPCInteract();
      this.onEntityInteraction?.(entity);
      return;
    }

    // Check building tap (bulletin board → quest board)
    for (const b of this.zone.buildings) {
      const bx = b.tileX * ts;
      const by = b.tileY * ts;
      const bw = b.widthTiles * ts;
      const bh = b.heightTiles * ts;
      if (worldX >= bx && worldX <= bx + bw && worldY >= by && worldY <= by + bh) {
        if (b.type === 'bulletin_board') {
          this.sfx.playMenuOpen();
          this.onBuildingInteraction?.(b.type);
          return;
        }
      }
    }
  }

  private handleMoveTarget(worldX: number, worldY: number): void {
    // Convert to tile coords
    const targetTile = this.renderer.worldToTile(worldX, worldY);
    const currentTile = this.renderer.worldToTile(this.playerX, this.playerY);

    // Set tap indicator
    this.tapIndicator = { worldX, worldY, time: Date.now() };

    // Run pathfinding
    this.path = findPath(
      this.zone,
      currentTile.col,
      currentTile.row,
      targetTile.col,
      targetTile.row,
    );
    this.pathIndex = 0;
  }

  // ── Rendering ──────────────────────────────────

  private computeGardenBounds(): { x: number; y: number; w: number; h: number } {
    const ts = TILE_SIZE * SCALE;
    const garden = this.zone.buildings.find(b => b.type === 'garden');
    if (garden) {
      return {
        x: garden.tileX * ts,
        y: garden.tileY * ts,
        w: garden.widthTiles * ts,
        h: garden.heightTiles * ts,
      };
    }
    // Fallback
    return { x: 20 * ts, y: 5 * ts, w: 8 * ts, h: 5 * ts };
  }

  private render(): void {
    if (!this.worldState) return;

    const gardenBounds = this.computeGardenBounds();
    const allEntities = [
      ...this.worldState.shadows,
      ...this.worldState.goalCompanions,
      ...this.worldState.journalEchoes,
    ];

    const frame: RenderFrame = {
      zone: this.zone,
      player: {
        ...this.worldState.player,
        worldX: this.playerX,
        worldY: this.playerY,
        direction: this.playerDir,
        isMoving: this.playerMoving,
      },
      houseLevel: this.worldState.houseLevel,
      portals: this.zone.portals.map(p => ({
        tileX: p.tileX,
        tileY: p.tileY,
        label: p.label,
        icon: p.icon,
        locked: !this.worldState!.zoneUnlocks[p.targetZone],
      })),
      npcs: this.zone.npcs.map(n => ({
        tileX: n.tileX,
        tileY: n.tileY,
        name: n.name,
        spriteType: n.spriteType,
        appearance: n.appearance,
      })),
      gardenPlants: this.worldState.gardenPlants,
      gardenBounds,
      dynamicEntities: allEntities,
      playerMood: this.worldState.moodScore,
      playerBestStreak: this.worldState.bestStreak,
      playerEnergy: this.worldState.energyScore,
      equippedVisuals: this.worldState.equippedVisuals,
      remotePlayers: this.multiplayer?.getRemotePlayers() ?? [],
      localChatBubble: this.localChatBubble && (Date.now() - this.localChatBubble.time < 5000)
        ? this.localChatBubble
        : null,
      companion: this.worldState.companion ?? undefined,
    };

    this.renderer.render(frame);

    // Render tap indicator (after main render)
    this.renderTapIndicator();

    // Debug overlay disabled (was showing yellow NPC circles + red tap dots)
  }

  private renderTapIndicator(): void {
    if (!this.tapIndicator) return;

    const age = Date.now() - this.tapIndicator.time;
    const duration = 800; // 800ms fade out

    if (age > duration) {
      this.tapIndicator = null;
      return;
    }

    const ctx = this.renderer['ctx'];
    if (!ctx) return;

    const screen = this.renderer.camera.worldToScreen(
      this.tapIndicator.worldX,
      this.tapIndicator.worldY,
    );

    const progress = age / duration;
    const alpha = 1 - progress;
    const radius = 8 + progress * 12; // Expand from 8 to 20

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // DEBUG: last tap info for overlay
  private debugLastTap: { worldX: number; worldY: number; nearestNPC: string; dist: number; hit: boolean } | null = null;

  private renderDebugOverlay(): void {
    const ctx = this.renderer['ctx'] as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const ts = TILE_SIZE * SCALE;

    ctx.save();

    // Draw NPC hit circles (yellow = interactable area)
    for (const npc of this.zone.npcs) {
      const nx = npc.tileX * ts + ts / 2;
      const ny = npc.tileY * ts + ts / 2;
      const screen = this.renderer.camera.worldToScreen(nx, ny);
      const radiusScreen = ts * 1.5 * this.renderer.camera.zoom;

      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radiusScreen, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radiusScreen, 0, Math.PI * 2);
      ctx.stroke();

      // NPC name + tile coords
      ctx.fillStyle = '#FFD700';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${npc.name} (${npc.tileX},${npc.tileY})`, screen.x, screen.y - radiusScreen - 4);
    }

    // Draw last tap point
    if (this.debugLastTap) {
      const tapScreen = this.renderer.camera.worldToScreen(this.debugLastTap.worldX, this.debugLastTap.worldY);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = this.debugLastTap.hit ? '#00FF00' : '#FF4444';
      ctx.beginPath();
      ctx.arc(tapScreen.x, tapScreen.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top-left debug text
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    const lines = [
      `NPCs: ${this.zone.npcs.length} | ts: ${ts} | hitR: ${ts * 1.5}`,
      `Player: (${Math.round(this.playerX)}, ${Math.round(this.playerY)})`,
    ];
    if (this.debugLastTap) {
      lines.push(`Tap: (${Math.round(this.debugLastTap.worldX)}, ${Math.round(this.debugLastTap.worldY)})`);
      lines.push(`→ ${this.debugLastTap.nearestNPC} dist:${Math.round(this.debugLastTap.dist)} ${this.debugLastTap.hit ? 'HIT!' : 'miss'}`);
    }
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 50 + i * 16);
    });

    ctx.restore();
  }

  // ── Multiplayer Public API ────────────────────────

  private buildPresencePayload(userId: string): PresencePayload | null {
    if (!this.worldState || !this.rpgCharacter) return null;
    return {
      userId,
      name: this.worldState.player.name,
      level: this.worldState.player.level,
      classIcon: this.worldState.player.classIcon,
      skinTone: this.worldState.player.skinTone,
      hairColor: this.worldState.player.hairColor,
      bodyColor: this.worldState.player.bodyColor,
      worldX: this.playerX,
      worldY: this.playerY,
      direction: this.playerDir,
      isMoving: this.playerMoving,
      status: 'active',
      lastActive: Date.now(),
    };
  }

  sendChat(content: string): boolean {
    return this.multiplayer?.sendChat(content) ?? false;
  }

  sendEmote(emote: EmoteType): void {
    this.multiplayer?.sendEmote(emote);
  }

  setTileBiome(biome: import('./data/biomes').BiomePalette | null): void {
    this.renderer.tileRenderer.setBiome(biome);
  }

  getRecentChat(): ChatMessage[] {
    return this.multiplayer?.getRecentChat() ?? [];
  }

  onChatMessage(cb: (msg: ChatMessage) => void): () => void {
    return this.multiplayer?.onChatMessage(cb) ?? (() => {});
  }

  getOnlineCount(): number {
    return this.multiplayer?.getOnlineCount() ?? 1;
  }

  setLocalChatBubble(text: string): void {
    this.localChatBubble = { text, time: Date.now() };
  }

  /** Get player position for minimap */
  getPlayerWorldPos(): { x: number; y: number } {
    return { x: this.playerX, y: this.playerY };
  }
}
