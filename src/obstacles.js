/**
 * obstacles.js — Moving Neon Hazard System
 * Sinusoidal interpolation, lethal AABB contact, per-level data configs.
 */

export class MovingObstacle {
  /**
   * @param {Object} cfg
   * cfg.x, cfg.y       — base world position
   * cfg.width, cfg.height
   * cfg.moveAxis       — 'x' | 'y'
   * cfg.min, cfg.max   — offset range from base position (e.g. min:-80, max:80)
   * cfg.speed          — oscillation speed multiplier (1 = ~1 cycle per 3s)
   * cfg.phase          — initial phase offset (radians) for desync between obstacles
   */
  constructor(cfg) {
    this.baseX   = cfg.x;
    this.baseY   = cfg.y;
    this.x       = cfg.x;
    this.y       = cfg.y;
    this.width   = cfg.width  || 50;
    this.height  = cfg.height || 30;
    this.moveAxis = cfg.moveAxis || 'x';
    this.min     = cfg.min !== undefined ? cfg.min : -60;
    this.max     = cfg.max !== undefined ? cfg.max :  60;
    this.speed   = cfg.speed || 1.0;
    this.type    = 'moving_spike';

    // Internal oscillator — starts at provided phase
    this._t = cfg.phase || 0;

    // Precompute range helpers
    this._halfRange = (this.max - this.min) / 2;
    this._center    = this.min + this._halfRange;

    // Visual state for glow pulse
    this._glowPhase = cfg.phase || 0;
  }

  /** Call every frame; dtFactor = dt / 16.666 */
  update(dtFactor) {
    this._t         += this.speed * 0.025 * dtFactor;
    this._glowPhase += 0.04 * dtFactor;

    const offset = this._center + Math.sin(this._t) * this._halfRange;
    if (this.moveAxis === 'x') {
      this.x = this.baseX + offset;
    } else {
      this.y = this.baseY + offset;
    }
  }

  /** Returns AABB rect for collision checks */
  getRect() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx, cameraX) {
    const screenX = this.x - cameraX;

    // Frustum cull
    if (screenX + this.width < -50 || screenX > 900) return;

    ctx.save();

    const numSpikes = Math.max(1, Math.floor(this.width / 22));
    const sw = this.width / numSpikes;
    const glowPulse = 0.35 + Math.abs(Math.sin(this._glowPhase)) * 0.25;

    // --- Dark body fill ---
    ctx.fillStyle = '#120008';
    ctx.beginPath();
    ctx.moveTo(screenX, this.y + this.height);
    for (let s = 0; s < numSpikes; s++) {
      const sx = screenX + s * sw;
      ctx.lineTo(sx + sw / 2, this.y);
      ctx.lineTo(sx + sw, this.y + this.height);
    }
    ctx.closePath();
    ctx.fill();

    // --- Outer glow stroke (orange-red, pulsing) ---
    ctx.strokeStyle = `rgba(255, 80, 0, ${glowPulse})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(screenX, this.y + this.height);
    for (let s = 0; s < numSpikes; s++) {
      const sx = screenX + s * sw;
      ctx.lineTo(sx + sw / 2, this.y);
      ctx.lineTo(sx + sw, this.y + this.height);
    }
    ctx.stroke();

    // --- Inner core stroke ---
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, this.y + this.height);
    for (let s = 0; s < numSpikes; s++) {
      const sx = screenX + s * sw;
      ctx.lineTo(sx + sw / 2, this.y);
      ctx.lineTo(sx + sw, this.y + this.height);
    }
    ctx.stroke();

    // --- Motion direction indicator arrows ---
    const velDir = Math.cos(this._t) * this.speed;
    if (Math.abs(velDir) > 0.1) {
      const arrowX = screenX + this.width / 2;
      const arrowY = this.y + this.height + 8;
      const dir = velDir > 0 ? 1 : -1;
      ctx.strokeStyle = `rgba(255, 120, 0, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(arrowX - dir * 8, arrowY);
      ctx.lineTo(arrowX + dir * 8, arrowY);
      ctx.lineTo(arrowX + dir * 4, arrowY - 4);
      ctx.moveTo(arrowX + dir * 8, arrowY);
      ctx.lineTo(arrowX + dir * 4, arrowY + 4);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ObstacleManager — pool management per level
// ---------------------------------------------------------------------------
export class ObstacleManager {
  constructor() {
    this.obstacles = [];
  }

  /** Load obstacles for a given level index (0-based) */
  loadForLevel(levelIndex) {
    this.obstacles = [];
    const configs = LEVEL_OBSTACLES[levelIndex] || [];
    for (const cfg of configs) {
      this.obstacles.push(new MovingObstacle(cfg));
    }
  }

  update(dtFactor) {
    for (let i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].update(dtFactor);
    }
  }

  draw(ctx, cameraX) {
    for (let i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].draw(ctx, cameraX);
    }
  }

  /** Returns raw obstacle array for AABB checks */
  getObstacles() {
    return this.obstacles;
  }

  clear() {
    this.obstacles = [];
  }
}

// ---------------------------------------------------------------------------
// Per-level moving obstacle definitions
// ---------------------------------------------------------------------------
const LEVEL_OBSTACLES = [
  // ── Level 1: Neon Highway ──────────────────────────────────────────────
  [
    // Above the cascade steps area — sweeps left/right
    { x: 2350, y: 270, width: 48, height: 28, moveAxis: 'x', min: -70, max: 70, speed: 1.2, phase: 0.0 },
    // Near long stretch — bobs up/down
    { x: 3600, y: 260, width: 48, height: 28, moveAxis: 'y', min: -45, max: 45, speed: 1.5, phase: 1.6 },
    // Final approach — fast horizontal sweep
    { x: 4550, y: 340, width: 56, height: 28, moveAxis: 'x', min: -90, max: 90, speed: 1.0, phase: 3.1 },
  ],

  // ── Level 2: Grid Overdrive ────────────────────────────────────────────
  [
    // High floating platforms area
    { x: 2000, y: 180, width: 50, height: 28, moveAxis: 'x', min: -75, max: 75, speed: 1.5, phase: 0.5 },
    // Danger zone — vertical guard
    { x: 3050, y: 360, width: 50, height: 28, moveAxis: 'y', min: -55, max: 55, speed: 2.0, phase: 1.0 },
    // Spiky tunnel bridge
    { x: 3950, y: 410, width: 56, height: 28, moveAxis: 'x', min: -85, max: 85, speed: 1.8, phase: 2.2 },
    // Leaps of faith
    { x: 4650, y: 260, width: 50, height: 28, moveAxis: 'y', min: -65, max: 65, speed: 1.3, phase: 0.9 },
  ],

  // ── Level 3: Outrun Singularity ────────────────────────────────────────
  [
    // Gauntlet of small steps — threats between platforms
    { x: 750,  y: 330, width: 60, height: 28, moveAxis: 'x', min: -95, max: 95, speed: 2.0, phase: 0.0 },
    { x: 1250, y: 250, width: 50, height: 28, moveAxis: 'y', min: -50, max: 50, speed: 2.5, phase: 0.7 },
    // Wall climbing
    { x: 2650, y: 240, width: 60, height: 28, moveAxis: 'x', min: -75, max: 75, speed: 1.8, phase: 1.5 },
    // After long drop hazard
    { x: 3700, y: 310, width: 50, height: 28, moveAxis: 'y', min: -65, max: 65, speed: 2.2, phase: 2.1 },
    // Final sky steps — most aggressive
    { x: 4950, y: 230, width: 60, height: 28, moveAxis: 'x', min: -90, max: 90, speed: 2.5, phase: 0.3 },
  ],
];
