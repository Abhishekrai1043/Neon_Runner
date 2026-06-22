/**
 * level.js — Level Data Manager + Renderer
 *
 * Optimizations:
 *   - Static background (sky gradient + sun) cached to an off-screen canvas.
 *     Cache is invalidated only when viewport dimensions change.
 *   - Platform rendering batched by type; shadowBlur omitted for performance.
 *   - Cassette draw skipped for off-screen items via frustum cull.
 */
export class LevelManager {
  constructor() {
    this.levels = [
      this.getLevel1Data(),
      this.getLevel2Data(),
      this.getLevel3Data(),
    ];
    this.currentLevelIndex = 0;
    this.mapWidth = 6000;

    // Off-screen canvas cache for static sky background
    /** @type {HTMLCanvasElement|null} */
    this._bgCache   = null;
    this._bgCacheW  = 0;
    this._bgCacheH  = 0;
  }

  getCurrentLevel() {
    return this.levels[this.currentLevelIndex];
  }

  loadLevel(index) {
    if (index >= 0 && index < this.levels.length) {
      this.currentLevelIndex = index;
      this.resetMovingPlatforms();
    }
  }

  nextLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.currentLevelIndex++;
      this.resetMovingPlatforms(); // Reset moving platforms on next level as well
      return true;
    }
    return false;
  }

  getLevelCount() {
    return this.levels.length;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Level 1: Neon Highway — Introductory
  // ══════════════════════════════════════════════════════════════════════════
  getLevel1Data() {
    const platforms = [
      { x: 0,    y: 480, width: 800, height: 200, type: 'normal' },
      { x: 950,  y: 420, width: 220, height:  40, type: 'conveyor', beltVelocity: 2.5 },
      { x: 1300, y: 340, width: 300, height:  40, type: 'normal' },
      { x: 1600, y: 550, width: 400, height:  30, type: 'hazard_floor' },
      { x: 1750, y: 340, width: 200, height:  40, type: 'normal' },
      { x: 2100, y: 440, width: 250, height:  40, type: 'normal' },
      { x: 2500, y: 380, width: 350, height:  40, type: 'normal' },
      { x: 2650, y: 350, width:  50, height:  30, type: 'spike' },
      // Diagonal Bi-Directional Moving Platform
      { x: 2800, y: 420, width: 100, height:  40, type: 'moving', startX: 2800, endX: 2950, startY: 420, endY: 280, speedX: 1.0, speedY: 0.93, _prevX: 2800, _prevY: 420, _dir: 1 },
      { x: 3000, y: 300, width: 120, height:  40, type: 'normal' },
      { x: 3250, y: 220, width: 120, height:  40, type: 'normal' },
      { x: 3500, y: 300, width: 120, height:  40, type: 'conveyor', beltVelocity: -2.0 },
      { x: 3750, y: 460, width: 500, height: 200, type: 'normal' },
      { x: 3950, y: 430, width: 100, height:  30, type: 'spike' },
      // Moving Platform 2 (Horizontal)
      { x: 4120, y: 360, width: 120, height:  40, type: 'moving', axis: 'x', startX: 4120, endX: 4320, startY: 360, endY: 360, speed: 1.5, _prevX: 4120, _prevY: 360, _dir: 1 },
      { x: 4400, y: 380, width: 250, height:  40, type: 'normal' },
      { x: 4800, y: 420, width: 900, height: 200, type: 'normal' },
      { x: 5500, y: 220, width: 200, height: 200, type: 'finish' },
    ];

    const cassettes = [
      { id: 1,  x: 1050, y: 350, collected: false },
      { id: 2,  x: 1450, y: 270, collected: false },
      { id: 3,  x: 1850, y: 270, collected: false },
      { id: 4,  x: 2220, y: 370, collected: false },
      { id: 5,  x: 2550, y: 300, collected: false },
      { id: 6,  x: 3120, y: 180, collected: false },
      { id: 7,  x: 3370, y: 140, collected: false },
      { id: 8,  x: 4100, y: 300, collected: false },
      { id: 9,  x: 4520, y: 300, collected: false },
      { id: 10, x: 5200, y: 340, collected: false },
    ];

    const dashCore = { x: 3310, y: 90, width: 30, height: 30, active: true };

    return { name: 'NEON HIGHWAY', platforms, cassettes, dashCore, mapWidth: 5700 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Level 2: Grid Overdrive — Medium  (15 cassettes · extended play area)
  // ══════════════════════════════════════════════════════════════════════════
  getLevel2Data() {
    const platforms = [
      // ── Original layout ───────────────────────────────────────────────────
      { x: 0,    y: 480, width: 600, height: 200, type: 'normal' },
      { x: 610,  y: 420, width: 100, height:  40, type: 'moving', startX: 610, endX: 720, startY: 420, endY: 340, speedX: 1.1, speedY: 0.8, _prevX: 610, _prevY: 420, _dir: 1 },
      { x: 750,  y: 390, width: 150, height:  40, type: 'normal' },
      { x: 1050, y: 320, width: 150, height:  40, type: 'conveyor', beltVelocity: 3.5 },
      { x: 1350, y: 370, width: 350, height:  40, type: 'normal' },
      { x: 1500, y: 340, width:  50, height:  30, type: 'spike' },
      { x: 1850, y: 260, width: 220, height:  40, type: 'normal' },
      { x: 2200, y: 200, width: 220, height:  40, type: 'conveyor', beltVelocity: -2.5 },
      { x: 2550, y: 280, width: 220, height:  40, type: 'normal' },
      { x: 2800, y: 550, width: 600, height:  30, type: 'hazard_floor' },
      { x: 2900, y: 400, width: 120, height:  40, type: 'normal' },
      { x: 3150, y: 320, width: 120, height:  40, type: 'moving', rangeX: 120, rangeY: -80, speedX: 1.2, speedY: 0.8, _dir: 1 },
      { x: 3400, y: 400, width: 120, height:  40, type: 'normal' },
      { x: 3700, y: 450, width: 600, height:  40, type: 'normal' },
      { x: 3850, y: 420, width:  60, height:  30, type: 'spike' },
      { x: 4100, y: 420, width:  60, height:  30, type: 'spike' },
      { x: 4320, y: 420, width: 110, height:  40, type: 'moving', axis: 'y', startX: 4320, endX: 4320, startY: 420, endY: 260, speed: 1.5, _prevX: 4320, _prevY: 420, _dir: 1 },
      { x: 4500, y: 350, width: 140, height:  40, type: 'normal' },
      { x: 4800, y: 280, width: 140, height:  40, type: 'normal' },
      { x: 5100, y: 350, width: 400, height: 200, type: 'normal' }, // shortened to create a gap before gauntlet
      // ── Extension gauntlet (x 5550–6300) — harder section ────────────────
      { x: 5500, y: 560, width: 1000, height:  30, type: 'hazard_floor' },
      { x: 5600, y: 310, width:  90, height:  40, type: 'conveyor', beltVelocity: 3.5 },
      { x: 5750, y: 230, width:  90, height:  40, type: 'normal' },
      { x: 5740, y: 200, width:  50, height:  30, type: 'spike' },
      { x: 5900, y: 310, width:  90, height:  40, type: 'normal' },
      { x: 6000, y: 220, width:  90, height:  40, type: 'moving', axis: 'y', startX: 6000, endX: 6000, startY: 220, endY: 360, speed: 2.0, _prevX: 6000, _prevY: 220, _dir: 1 },
      { x: 6100, y: 100, width: 200, height: 200, type: 'finish' },
    ];

    const cassettes = [
      // ── Original 10 ───────────────────────────────────────────────────────
      { id:  1, x:  450, y: 400, collected: false },
      { id:  2, x:  825, y: 310, collected: false },
      { id:  3, x: 1125, y: 240, collected: false },
      { id:  4, x: 1650, y: 290, collected: false },
      { id:  5, x: 1960, y: 180, collected: false },
      { id:  6, x: 2310, y: 120, collected: false },
      { id:  7, x: 2660, y: 200, collected: false },
      { id:  8, x: 3210, y: 240, collected: false },
      { id:  9, x: 3975, y: 360, collected: false },
      { id: 10, x: 4950, y: 200, collected: false },
      // ── 5 harder extras ──────────────────────────────────────────────────
      { id: 11, x:  970, y: 210, collected: false }, // High above conveyor — big jump needed
      { id: 12, x: 2310, y:  30, collected: false }, // Above dashCore — requires dash-jump
      { id: 13, x: 3565, y: 340, collected: false }, // In double-spike zone — very tight
      { id: 14, x: 4380, y: 130, collected: false }, // Above vertical platform apex — dash needed
      { id: 15, x: 5790, y: 140, collected: false }, // Extension hazard section
    ];

    // Extra 1UP — atop the oscillating platform's apex, then jump off the edge.
    // No safe landing platform nearby; only the moving platform returns.
    const lifeItems = [
      { x: 6060, y: 80, collected: false },
    ];

    const dashCore = { x: 2310, y: 60, width: 30, height: 30, active: true };

    return { name: 'GRID OVERDRIVE', platforms, cassettes, lifeItems, dashCore, mapWidth: 6350 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Level 3: Outrun Singularity — High difficulty (18 cassettes · extended map)
  // ══════════════════════════════════════════════════════════════════════════
  getLevel3Data() {
    const platforms = [
      // ── Original layout ───────────────────────────────────────────────────
      { x: 0,    y: 480, width: 450, height: 200, type: 'normal' },
      { x: 460,  y: 460, width:  80, height:  40, type: 'moving', axis: 'x', startX: 460, endX: 530, startY: 460, endY: 460, speed: 1.4, _prevX: 460, _prevY: 460, _dir: 1 },
      { x: 550,  y: 440, width: 250, height:  40, type: 'normal' },
      { x: 650,  y: 410, width:  50, height:  30, type: 'spike' },
      { x: 950,  y: 360, width:  80, height:  40, type: 'conveyor', beltVelocity: 4.0 },
      { x: 1150, y: 280, width:  80, height:  40, type: 'normal' },
      { x: 1350, y: 200, width:  80, height:  40, type: 'conveyor', beltVelocity: -4.0 },
      { x: 1550, y: 280, width:  80, height:  40, type: 'normal' },
      { x: 1750, y: 360, width:  80, height:  40, type: 'normal' },
      { x: 1950, y: 440, width: 350, height:  40, type: 'normal' },
      { x: 2000, y: 410, width:  50, height:  30, type: 'spike' },
      { x: 2200, y: 410, width:  50, height:  30, type: 'spike' },
      { x: 2350, y: 420, width:  90, height:  40, type: 'moving', startX: 2350, endX: 2430, startY: 420, endY: 200, speedX: 0.6, speedY: 1.6, _prevX: 2350, _prevY: 420, _dir: 1 },
      { x: 2450, y: 350, width: 100, height:  40, type: 'normal' },
      { x: 2600, y: 270, width: 100, height:  40, type: 'normal' },
      { x: 2750, y: 190, width: 100, height:  40, type: 'normal' },
      { x: 2950, y: 550, width: 900, height:  30, type: 'hazard_floor' },
      { x: 3050, y: 350, width: 120, height:  40, type: 'normal' },
      { x: 3300, y: 280, width: 120, height:  40, type: 'normal' },
      { x: 3550, y: 350, width: 120, height:  40, type: 'normal' },
      { x: 3700, y: 340, width: 110, height:  40, type: 'moving', rangeX: 200, rangeY: 100, speedX: 1.6, speedY: 0.8, _dir: 1 },
      { x: 3950, y: 440, width: 500, height:  40, type: 'normal' },
      { x: 4050, y: 410, width:  60, height:  30, type: 'spike' },
      { x: 4150, y: 410, width:  60, height:  30, type: 'spike' },
      { x: 4250, y: 410, width:  60, height:  30, type: 'spike' },
      { x: 4600, y: 350, width: 100, height:  40, type: 'normal' },
      { x: 4850, y: 270, width: 100, height:  40, type: 'normal' },
      { x: 5100, y: 200, width: 100, height:  40, type: 'normal' },
      // ── Extension gauntlet (x 5300–6400) — intense finale ─────────────────
      { x: 5250, y: 560, width: 1400, height:  30, type: 'hazard_floor' },
      { x: 5300, y: 270, width:  70, height:  40, type: 'conveyor', beltVelocity: 4.5 },
      { x: 5430, y: 190, width:  70, height:  40, type: 'normal' },
      { x: 5420, y: 160, width:  40, height:  30, type: 'spike' },
      { x: 5560, y: 270, width:  70, height:  40, type: 'normal' },
      { x: 5680, y: 190, width:  80, height:  40, type: 'moving', rangeX: 130, rangeY: -90, speedX: 1.6, speedY: 1.1, _dir: 1 },
      { x: 5860, y: 280, width:  70, height:  40, type: 'normal' },
      { x: 5980, y: 200, width:  70, height:  40, type: 'normal' },
      { x: 5970, y: 170, width:  40, height:  30, type: 'spike' },
      { x: 6100, y: 130, width:  70, height:  40, type: 'conveyor', beltVelocity: -4.5 },
      { x: 6200, y: 80, width: 200, height: 200, type: 'finish' },
    ];

    const cassettes = [
      // ── Original 10 ───────────────────────────────────────────────────────
      { id:  1, x:  250, y: 400, collected: false },
      { id:  2, x: 1000, y: 280, collected: false },
      { id:  3, x: 1200, y: 200, collected: false },
      { id:  4, x: 1400, y: 120, collected: false },
      { id:  5, x: 1600, y: 200, collected: false },
      { id:  6, x: 1800, y: 280, collected: false },
      { id:  7, x: 2650, y: 190, collected: false },
      { id:  8, x: 3360, y: 200, collected: false },
      { id:  9, x: 4700, y: 270, collected: false },
      { id: 10, x: 4950, y: 190, collected: false },
      // ── 8 harder extras ──────────────────────────────────────────────────
      { id: 11, x:  510, y: 340, collected: false }, // Tight moving platform area
      { id: 12, x: 1760, y: 270, collected: false }, // Between the zigzag conveyors
      { id: 13, x: 2560, y:  80, collected: false }, // Extreme height — requires dash-jump
      { id: 14, x: 3100, y: 250, collected: false }, // Over hazard floor — risky
      { id: 15, x: 3750, y: 240, collected: false }, // On diagonal moving platform's path
      { id: 16, x: 5150, y: 100, collected: false }, // Top of the staircase — big jump needed
      { id: 17, x: 5450, y:  90, collected: false }, // Extension — above spike platform
      { id: 18, x: 6130, y:  30, collected: false }, // Near finish — extreme height
    ];

    // Extra 1UP — over the hazard-floor gap. Requires a precise jump from the
    // platform at (3300, y=280). Fall too far and you hit the hazard floor.
    const lifeItems = [
      { x: 3450, y: 170, collected: false },
    ];

    const dashCore = { x: 1390, y: 60, width: 30, height: 30, active: true };

    return { name: 'OUTRUN SINGULARITY', platforms, cassettes, lifeItems, dashCore, mapWidth: 6850 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Background Rendering
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build the off-screen canvas cache for the static sky (gradient + sun + scanlines).
   * Rebuilt only when viewport dimensions change.
   */
  _buildBgCache(w, h) {
    const oc  = document.createElement('canvas');
    oc.width  = w;
    oc.height = h;
    const octx = oc.getContext('2d');

    // Sky gradient
    const bgGrad = octx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0,   '#04010a');
    bgGrad.addColorStop(0.5, '#0c0217');
    bgGrad.addColorStop(1,   '#20073e');
    octx.fillStyle = bgGrad;
    octx.fillRect(0, 0, w, h);

    // Synthwave sun (half-circle above horizon)
    const horizonY  = h * 0.65;
    const sunX      = w / 2;
    const sunY      = horizonY - 40;
    const sunRadius = Math.min(w, h) * 0.28;

    const sunGrad = octx.createLinearGradient(0, sunY - sunRadius, 0, sunY);
    sunGrad.addColorStop(0,   '#ffe600');
    sunGrad.addColorStop(0.5, '#ff5b00');
    sunGrad.addColorStop(1,   '#ff007f');
    octx.fillStyle = sunGrad;
    octx.beginPath();
    octx.arc(sunX, sunY, sunRadius, Math.PI, 0, false);
    octx.fill();

    // Scanline gaps (signature synthwave stripes)
    octx.fillStyle = '#0c0217';
    for (let sy = sunY - sunRadius; sy < sunY; sy += 8) {
      const rel   = (sy - (sunY - sunRadius)) / sunRadius;
      const lineH = Math.max(1, 6 * rel);
      octx.fillRect(sunX - sunRadius - 10, sy, sunRadius * 2 + 20, lineH);
    }

    this._bgCache  = oc;
    this._bgCacheW = w;
    this._bgCacheH = h;
  }

  /** Full background: cached sky + dynamic mountains + dynamic grid */
  drawBackground(ctx, cameraX, canvasWidth, canvasHeight) {
    // Rebuild static cache if viewport changed
    if (!this._bgCache || this._bgCacheW !== canvasWidth || this._bgCacheH !== canvasHeight) {
      this._buildBgCache(canvasWidth, canvasHeight);
    }

    // Blit cached sky layer in a single drawImage call
    ctx.drawImage(this._bgCache, 0, 0);

    const horizonY = canvasHeight * 0.65;

    // Dynamic parallax mountains (cheap, no shadowBlur)
    this._drawMountains(ctx, cameraX * 0.1, horizonY, canvasWidth, [
      { x: -100, w: 400, h: 120 },
      { x:  200, w: 500, h: 180 },
      { x:  600, w: 450, h: 140 },
      { x:  900, w: 600, h: 220 },
    ], '#1b0235', '#ff007f');

    this._drawMountains(ctx, cameraX * 0.25, horizonY, canvasWidth, [
      { x:  50, w: 300, h:  80 },
      { x: 300, w: 400, h: 110 },
      { x: 650, w: 350, h:  90 },
      { x: 850, w: 500, h: 130 },
    ], '#250549', '#00f0ff');

    // Dynamic perspective grid (moves with camera for forward-scroll illusion)
    this._drawPerspectiveGrid(ctx, cameraX, canvasWidth, canvasHeight, horizonY);
  }

  _drawMountains(ctx, scrollOffset, horizonY, canvasWidth, peaks, fillColor, strokeColor) {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle   = fillColor;
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.moveTo(-100, horizonY);

    const period = 1200;
    for (let i = -1; i <= 2; i++) {
      const base = i * period - (scrollOffset % period);
      for (const p of peaks) {
        const px = base + p.x;
        ctx.lineTo(px,              horizonY);
        ctx.lineTo(px + p.w / 2,   horizonY - p.h);
        ctx.lineTo(px + p.w,       horizonY);
      }
    }

    ctx.lineTo(canvasWidth + 100, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawPerspectiveGrid(ctx, cameraX, canvasWidth, canvasHeight, horizonY) {
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth   = 1;

    const cx             = canvasWidth / 2;
    const numVertical    = 36;
    const floorHeight    = canvasHeight - horizonY;

    // Radiating vertical lines
    for (let i = 0; i <= numVertical; i++) {
      const ratio  = i / numVertical;
      const xStart = (ratio - 0.5) * canvasWidth * 3.5 + cx;
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(xStart, canvasHeight);
      ctx.stroke();
    }

    // Horizontal lines — scroll with camera for motion illusion
    const gridMovement   = (cameraX * 0.8) % 60;
    const numHorizontal  = 14;
    for (let i = 0; i < numHorizontal; i++) {
      const t        = (i + gridMovement / 60) / numHorizontal;
      const progress = Math.pow(t, 2.5);
      const ly       = horizonY + progress * floorHeight;
      ctx.globalAlpha = progress * 0.85;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(canvasWidth, ly);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Level Rendering — Platforms & Cassettes
  // ══════════════════════════════════════════════════════════════════════════
  drawLevel(ctx, cameraX, canvasWidth, canvasHeight) {
    const data = this.getCurrentLevel();
    if (!data) return;

    for (let i = 0; i < data.platforms.length; i++) {
      const plat    = data.platforms[i];
      const screenX = plat.x - cameraX;

      // Frustum cull
      if (screenX + plat.width < -100 || screenX > canvasWidth + 100) continue;

      ctx.save();

      switch (plat.type) {
        case 'normal':
          this._drawNormalPlatform(ctx, screenX, plat);
          break;
        case 'hazard_floor':
          this._drawHazardFloor(ctx, screenX, plat);
          break;
        case 'spike':
          this._drawSpike(ctx, screenX, plat);
          break;
        case 'finish':
          this._drawFinish(ctx, screenX, plat);
          break;
        case 'moving':
          this._drawMovingPlatform(ctx, screenX, plat);
          break;
        case 'conveyor':
          this._drawConveyorPlatform(ctx, screenX, plat);
          break;
      }

      ctx.restore();
    }

    // Cassettes
    this._drawCassettes(ctx, cameraX, canvasWidth, data.cassettes);

    // Dash core item
    if (data.dashCore) {
      this._drawDashCore(ctx, cameraX, canvasWidth, data.dashCore);
    }

    // Extra life items (1UP)
    if (data.lifeItems && data.lifeItems.length > 0) {
      this._drawLifeItems(ctx, cameraX, canvasWidth, data.lifeItems);
    }
  }

  _drawNormalPlatform(ctx, sx, plat) {
    ctx.fillStyle = '#0f021e';
    ctx.fillRect(sx, plat.y, plat.width, plat.height);

    // Outer glow pass
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.35)';
    ctx.lineWidth   = 6;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    // Inner core
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    // Grid texture
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth   = 1.5;
    const gw = 30;
    for (let gx = gw; gx < plat.width; gx += gw) {
      ctx.beginPath();
      ctx.moveTo(sx + gx, plat.y);
      ctx.lineTo(sx + gx, plat.y + plat.height);
      ctx.stroke();
    }
    for (let gy = gw; gy < plat.height; gy += gw) {
      ctx.beginPath();
      ctx.moveTo(sx, plat.y + gy);
      ctx.lineTo(sx + plat.width, plat.y + gy);
      ctx.stroke();
    }
  }

  _drawMovingPlatform(ctx, sx, plat) {
    ctx.fillStyle = '#0f021e';
    ctx.fillRect(sx, plat.y, plat.width, plat.height);

    // Pulsing neon cyan outer border
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth   = 6;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    // Bright cyan inner core
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    // Animated diagonal bars texture inside the moving platform
    ctx.strokeStyle = `rgba(255, 0, 127, ${0.3 + pulse * 0.3})`;
    ctx.lineWidth   = 1.5;
    const gw = 20;
    const scrollOffset = (Date.now() / 20) % gw;

    ctx.save();
    // Clip drawing to platform boundaries to prevent leakage
    ctx.beginPath();
    ctx.rect(sx, plat.y, plat.width, plat.height);
    ctx.clip();

    for (let gx = -gw; gx < plat.width + gw; gx += gw) {
      ctx.beginPath();
      ctx.moveTo(sx + gx + scrollOffset, plat.y);
      ctx.lineTo(sx + gx + scrollOffset - 10, plat.y + plat.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawConveyorPlatform(ctx, sx, plat) {
    ctx.fillStyle = '#0a0114';
    ctx.fillRect(sx, plat.y, plat.width, plat.height);

    // Pulsing neon green outer border
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120);
    ctx.strokeStyle = `rgba(57, 255, 20, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth   = 6;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    ctx.strokeStyle = '#39ff14'; // Electric neon green inner border
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    ctx.save();
    // Clip to platform boundaries
    ctx.beginPath();
    ctx.rect(sx, plat.y, plat.width, plat.height);
    ctx.clip();

    // Draw scrolling chevrons
    const chevronSpacing = 30;
    const direction = plat.beltVelocity > 0 ? 1 : -1;
    const scrollOffset = (Date.now() * 0.1 * plat.beltVelocity) % chevronSpacing;

    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const halfH = plat.height / 2;
    const chevronHeight = Math.min(12, plat.height * 0.3);

    for (let xOffset = -chevronSpacing * 2; xOffset < plat.width + chevronSpacing * 2; xOffset += chevronSpacing) {
      const cx = sx + xOffset + scrollOffset;
      ctx.beginPath();
      if (direction > 0) {
        // Point right >
        ctx.moveTo(cx - 5, plat.y + halfH - chevronHeight);
        ctx.lineTo(cx + 5, plat.y + halfH);
        ctx.lineTo(cx - 5, plat.y + halfH + chevronHeight);
      } else {
        // Point left <
        ctx.moveTo(cx + 5, plat.y + halfH - chevronHeight);
        ctx.lineTo(cx - 5, plat.y + halfH);
        ctx.lineTo(cx + 5, plat.y + halfH + chevronHeight);
      }
      ctx.stroke();
    }

    // Top surface neon dashed line (belt texture)
    ctx.strokeStyle = '#00f0ff'; // Cyan top line
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = - (Date.now() * 0.15 * plat.beltVelocity) % 16;
    ctx.beginPath();
    ctx.moveTo(sx, plat.y);
    ctx.lineTo(sx + plat.width, plat.y);
    ctx.stroke();

    ctx.restore();
  }

  _drawDashCore(ctx, cameraX, canvasWidth, dashCore) {
    if (!dashCore || !dashCore.active) return;

    const screenX = dashCore.x - cameraX;
    // Frustum cull
    if (screenX < -50 || screenX > canvasWidth + 50) return;

    const now = Date.now();
    const floatY = dashCore.y + Math.sin(now / 150) * 6;
    const size = 16;

    ctx.save();

    // Explicit neon glow shadowBlur properties
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#39ff14'; // Electric Green glow

    // Spinning animation
    ctx.translate(screenX, floatY);
    ctx.rotate(now / 250);

    // Neon Core Drawing: spinning yellow/green lightning bolt
    ctx.fillStyle = '#fff000'; // Yellow core
    ctx.strokeStyle = '#39ff14'; // Electric green outline
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    // Lightning-style diamond path
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.7, -size * 0.2);
    ctx.lineTo(size * 0.2, 0);
    ctx.lineTo(size * 0.6, size * 0.6);
    ctx.lineTo(-size * 0.1, size * 1.0);
    ctx.lineTo(0, size * 0.3);
    ctx.lineTo(-size * 0.6, size * 0.2);
    ctx.lineTo(-size * 0.2, -size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _drawLifeItems(ctx, cameraX, canvasWidth, lifeItems) {
    const now = Date.now();
    for (let i = 0; i < lifeItems.length; i++) {
      const item = lifeItems[i];
      if (item.collected) continue;

      const sx = item.x - cameraX;
      if (sx < -60 || sx > canvasWidth + 60) continue;

      ctx.save();

      // Floating bob + glow pulse
      const floatY = item.y + Math.sin(now / 420 + i * 1.7) * 7;
      const pulse  = 0.55 + 0.45 * Math.abs(Math.sin(now / 550 + i));

      // ── Outer diffuse glow ─────────────────────────────────────────────
      ctx.globalAlpha = 0.28 * pulse;
      ctx.fillStyle   = '#ff007f';
      ctx.beginPath();
      ctx.arc(sx, floatY, 30, 0, Math.PI * 2);
      ctx.fill();

      // ── Mid glow ring ──────────────────────────────────────────────────
      ctx.globalAlpha = 0.55 * pulse;
      ctx.fillStyle   = '#ff4499';
      ctx.beginPath();
      ctx.arc(sx, floatY, 20, 0, Math.PI * 2);
      ctx.fill();

      // ── Heart symbol (glow layer) ──────────────────────────────────────
      ctx.globalAlpha = 0.9;
      ctx.fillStyle   = '#ff007f';
      ctx.font        = "bold 30px Arial, sans-serif";
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2665', sx, floatY + 1);

      // ── Heart core highlight ────────────────────────────────────────────
      ctx.globalAlpha = 0.6;
      ctx.fillStyle   = '#ffffff';
      ctx.font        = "bold 14px Arial, sans-serif";
      ctx.fillText('\u2665', sx, floatY + 1);

      // ── "1UP" label ─────────────────────────────────────────────────────
      ctx.globalAlpha = pulse;
      ctx.fillStyle   = '#ffffff';
      ctx.font        = "bold 9px 'Orbitron', monospace";
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('1UP', sx, floatY - 22);

      // ── Orbiting sparkle dots ──────────────────────────────────────────
      ctx.globalAlpha = 0.85 * pulse;
      ctx.fillStyle   = '#ff007f';
      const orbitR = 22;
      for (let s = 0; s < 6; s++) {
        const angle = (now / 900 + s * Math.PI / 3) + i * 0.5;
        ctx.beginPath();
        ctx.arc(
          sx      + Math.cos(angle) * orbitR,
          floatY  + Math.sin(angle) * orbitR,
          2.5, 0, Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawHazardFloor(ctx, sx, plat) {
    ctx.fillStyle = 'rgba(255, 60, 0, 0.2)';
    ctx.fillRect(sx, plat.y, plat.width, plat.height);

    ctx.strokeStyle = 'rgba(255, 60, 0, 0.4)';
    ctx.lineWidth   = 6;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    ctx.strokeStyle = '#ff3c00';
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    ctx.strokeStyle = '#ffae00';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let gx = 20; gx < plat.width; gx += 20) {
      ctx.moveTo(sx + gx,       plat.y);
      ctx.lineTo(sx + gx + 10,  plat.y + plat.height);
    }
    ctx.stroke();
  }

  _drawSpike(ctx, sx, plat) {
    const numSpikes = Math.floor(plat.width / 25);
    const sw        = plat.width / numSpikes;

    const spikeOutline = () => {
      ctx.beginPath();
      ctx.moveTo(sx, plat.y + plat.height);
      for (let s = 0; s < numSpikes; s++) {
        const spx = sx + s * sw;
        ctx.lineTo(spx + sw / 2, plat.y);
        ctx.lineTo(spx + sw,     plat.y + plat.height);
      }
    };

    // Fill
    ctx.fillStyle = '#1c0114';
    spikeOutline();
    ctx.closePath();
    ctx.fill();

    // Outer glow
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.35)';
    ctx.lineWidth   = 5;
    spikeOutline();
    ctx.stroke();

    // Inner core
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth   = 2;
    spikeOutline();
    ctx.stroke();
  }

  _drawFinish(ctx, sx, plat) {
    ctx.fillStyle = '#061726';
    ctx.fillRect(sx, plat.y, plat.width, plat.height);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth   = 8;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth   = 3;
    ctx.strokeRect(sx, plat.y, plat.width, plat.height);

    // Animated concentric rectangles
    const timeOffset = (Date.now() / 150) % 20;
    ctx.lineWidth    = 1.5;
    for (let d = 15; d < plat.width / 2; d += 15) {
      const od = (d + timeOffset) % (plat.width / 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 + (1 - od / (plat.width / 2)) * 0.4})`;
      ctx.strokeRect(
        sx + od,          plat.y + od,
        plat.width - od * 2, plat.height - od * 2
      );
    }

    ctx.fillStyle  = '#ffffff';
    ctx.font       = "bold 18px 'Orbitron', sans-serif";
    ctx.textAlign  = 'center';
    ctx.fillText('SYNC PORTAL', sx + plat.width / 2, plat.y - 15);
  }

  _drawCassettes(ctx, cameraX, canvasWidth, cassettes) {
    const now = Date.now();
    for (let i = 0; i < cassettes.length; i++) {
      const cass    = cassettes[i];
      if (cass.collected) continue;

      const screenX = cass.x - cameraX;
      if (screenX < -50 || screenX > canvasWidth + 50) continue;

      ctx.save();

      const floatY = cass.y + Math.sin(now / 200 + cass.id) * 8;
      const cw = 32, ch = 20;

      ctx.fillStyle = '#0d0217';

      // Outer glow
      ctx.strokeStyle = 'rgba(255, 184, 0, 0.4)';
      ctx.lineWidth   = 5;
      ctx.beginPath();
      ctx.roundRect(screenX - cw / 2, floatY - ch / 2, cw, ch, 3);
      ctx.stroke();

      // Shell
      ctx.strokeStyle = '#ffb800';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.roundRect(screenX - cw / 2, floatY - ch / 2, cw, ch, 3);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(screenX - cw / 2 + 4, floatY - ch / 2 + 3, cw - 8, ch - 8);

      // Spool holes
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(screenX - 6, floatY + 1, 3, 0, Math.PI * 2);
      ctx.arc(screenX + 6, floatY + 1, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  updateMovingPlatforms(dtFactor) {
    const data = this.getCurrentLevel();
    if (!data || !data.platforms) return;

    for (let i = 0; i < data.platforms.length; i++) {
      const plat = data.platforms[i];
      if (plat.type !== 'moving') continue;

      // Snapshot position before movement for displacement-derived velocity
      plat._prevX = plat.x;
      plat._prevY = plat.y;

      // Resolve speed per axis (supports speedX/speedY and legacy axis/speed)
      const speedX = plat.speedX !== undefined ? plat.speedX
                   : (plat.axis === 'x' ? (plat.speed || 0) : 0);
      const speedY = plat.speedY !== undefined ? plat.speedY
                   : (plat.axis === 'y' ? (plat.speed || 0) : 0);

      const startX = plat.startX !== undefined ? plat.startX : plat.x;
      const endX   = plat.endX   !== undefined ? plat.endX   : plat.x;
      const startY = plat.startY !== undefined ? plat.startY : plat.y;
      const endY   = plat.endY   !== undefined ? plat.endY   : plat.y;

      // signX / signY encode the forward direction unit vector derived from
      // the start→end segment. This lets negative ranges (e.g. endY < startY)
      // work correctly without per-axis direction flags.
      const signX = Math.sign(endX - startX); // +1 right, -1 left,  0 stationary
      const signY = Math.sign(endY - startY); // +1 down,  -1 up,    0 stationary

      // Single _dir: +1 = moving toward endpoint, -1 = moving toward start
      if (plat._dir === undefined) plat._dir = 1;

      // Apply dt-adjusted displacement on each active axis
      if (speedX > 0 && signX !== 0) plat.x += speedX * signX * plat._dir * dtFactor;
      if (speedY > 0 && signY !== 0) plat.y += speedY * signY * plat._dir * dtFactor;

      // Bound check: the formula  _dir * sign * (pos − target) >= 0  is true
      // exactly when pos has reached or passed the target in the travel direction.
      let hitBound = false;
      if (speedX > 0 && signX !== 0) {
        const targetX = plat._dir === 1 ? endX : startX;
        if (plat._dir * signX * (plat.x - targetX) >= 0) {
          plat.x = targetX;
          hitBound = true;
        }
      }
      if (speedY > 0 && signY !== 0) {
        const targetY = plat._dir === 1 ? endY : startY;
        if (plat._dir * signY * (plat.y - targetY) >= 0) {
          plat.y = targetY;
          hitBound = true;
        }
      }

      // Both axes reverse together → clean diagonal / straight oscillation
      if (hitBound) plat._dir = -plat._dir;

      // Velocity derived from actual pixel displacement this frame.
      // Using real displacement keeps friction-locking accurate on bounce frames.
      plat.vx = dtFactor > 0 ? (plat.x - plat._prevX) / dtFactor : 0;
      plat.vy = dtFactor > 0 ? (plat.y - plat._prevY) / dtFactor : 0;
    }
  }

  resetMovingPlatforms() {
    const data = this.getCurrentLevel();
    if (!data || !data.platforms) return;

    for (let i = 0; i < data.platforms.length; i++) {
      const plat = data.platforms[i];
      if (plat.type !== 'moving' && plat.type !== 'conveyor') continue;

      if (plat.type === 'moving') {
        // Cache spawn coords once so range-based bounds stay correct on repeated resets
        if (plat._originX === undefined) plat._originX = plat.x;
        if (plat._originY === undefined) plat._originY = plat.y;

        // Resolve rangeX/rangeY into absolute bounds relative to the spawn origin
        if (plat.rangeX !== undefined) {
          plat.startX = plat._originX;
          plat.endX   = plat._originX + plat.rangeX;
        }
        if (plat.rangeY !== undefined) {
          plat.startY = plat._originY;
          plat.endY   = plat._originY + plat.rangeY;
        }

        // Fallbacks when neither range nor explicit bounds were supplied
        if (plat.startX === undefined) plat.startX = plat._originX;
        if (plat.endX   === undefined) plat.endX   = plat._originX;
        if (plat.startY === undefined) plat.startY = plat._originY;
        if (plat.endY   === undefined) plat.endY   = plat._originY;

        // Reset to start
        plat.x      = plat.startX;
        plat.y      = plat.startY;
        plat._prevX = plat.startX;
        plat._prevY = plat.startY;

        // Single _dir = 1 → start moving toward the endpoint.
        // signX/signY computed in updateMovingPlatforms handle the actual direction.
        plat._dir  = 1;

        // Clear any stale per-axis direction fields from earlier code iterations
        delete plat._dirX;
        delete plat._dirY;

        // Zero velocity at rest
        plat.vx = 0;
        plat.vy = 0;
      }
    }

    if (data.dashCore) {
      data.dashCore.active = true;
    }
  }
}


