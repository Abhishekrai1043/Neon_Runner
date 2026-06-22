/**
 * meteors.js — Neon Synthwave Meteor Shower System
 *
 * Meteors spawn above the viewport, fall diagonally, and kill the player
 * on AABB contact. Rendered with a multi-layer neon glow + gradient trail.
 * Intensity scales per-level via loadForLevel().
 *
 * Collision model: each meteor exposes getRect() → AABB centred on its core.
 * The game loop calls getMeteors() and does the AABB check externally so the
 * subsystem stays free of player or game-state knowledge.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal Meteor — not exported; managed exclusively by MeteorShower
// ─────────────────────────────────────────────────────────────────────────────
class Meteor {
  /**
   * @param {number} x      — World spawn X (may be off-screen left/right)
   * @param {number} y      — World spawn Y (negative = above screen)
   * @param {number} vx     — Horizontal velocity (px / 60-fps frame)
   * @param {number} vy     — Downward velocity  (px / 60-fps frame)
   * @param {number} radius — Visual + collision radius
   * @param {string} color  — Primary neon colour
   */
  constructor(x, y, vx, vy, radius, color) {
    this.x      = x;
    this.y      = y;
    this.vx     = vx;
    this.vy     = vy;
    this.radius = radius;
    this.color  = color;
    this._alive = true;

    // Circular buffer of (x, y) snapshots — used to draw the fading trail
    this._trail    = [];
    this._maxTrail = 22;
  }

  get alive() { return this._alive; }

  /** @param {number} dtFactor */
  update(dtFactor) {
    // Push current position into trail before moving
    this._trail.push({ x: this.x, y: this.y });
    if (this._trail.length > this._maxTrail) this._trail.shift();

    this.x += this.vx * dtFactor;
    this.y += this.vy * dtFactor;

    // Despawn once below the player death zone
    if (this.y > 730) this._alive = false;
  }

  /** AABB centred on the meteor core for collision detection */
  getRect() {
    const r = this.radius;
    return { x: this.x - r, y: this.y - r, width: r * 2, height: r * 2 };
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} cameraX */
  draw(ctx, cameraX) {
    const sx = this.x - cameraX;

    // Frustum cull — give generous padding for the glow halo
    if (sx < -(this.radius * 4) || sx > 950 + this.radius * 4) return;

    ctx.save();

    // ── Gradient trail ────────────────────────────────────────────────────
    for (let i = 0; i < this._trail.length; i++) {
      const t    = this._trail[i];
      const frac = i / this._trail.length; // 0 = oldest → 1 = newest
      const size = this.radius * frac * 0.9;
      if (size < 0.5) continue;
      ctx.globalAlpha = frac * 0.6;
      ctx.fillStyle   = this.color;
      ctx.beginPath();
      ctx.arc(t.x - cameraX, t.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Outer diffuse halo ────────────────────────────────────────────────
    ctx.globalAlpha = 0.22;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(sx, this.y, this.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // ── Mid glow body ─────────────────────────────────────────────────────
    ctx.globalAlpha = 0.75;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(sx, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // ── Bright white hot core ─────────────────────────────────────────────
    ctx.globalAlpha = 1.0;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, this.y, this.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export class MeteorShower {
  constructor() {
    this._meteors    = [];
    this._spawnTimer = 0;
    this._warnTimer  = 0;

    // Safe default: no meteors until loadForLevel() is called
    this._cfg = {
      interval : Infinity,
      speed    : 0,
      spread   : 0,
      radius   : 8,
      colors   : ['#ff6600'],
    };
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  /**
   * Set shower intensity for the given level index (0-based).
   * Clears any in-flight meteors so the new level starts clean.
   */
  loadForLevel(levelIndex) {
    this._meteors    = [];
    this._spawnTimer = 0;
    this._warnTimer  = 0;

    const CONFIGS = [
      // Level 1 — Light shower: slow, sparse, classic fire
      {
        interval : 150,
        speed    : 4.8,
        spread   : 1.6,
        radius   : 9,
        colors   : ['#ff6600', '#ff8800', '#ffae00'],
      },
      // Level 2 — Medium shower: faster, denser, synthwave palette
      {
        interval : 95,
        speed    : 7.5,
        spread   : 2.4,
        radius   : 11,
        colors   : ['#ff007f', '#ff6600', '#ffae00', '#ff3300'],
      },
      // Level 3 — Intense shower: fast, dense, chaos of cyan-magenta-fire
      {
        interval : 55,
        speed    : 11.5,
        spread   : 3.5,
        radius   : 13,
        colors   : ['#00f0ff', '#ff007f', '#ff3300', '#ffae00', '#ffffff'],
      },
    ];

    this._cfg = CONFIGS[Math.min(levelIndex, CONFIGS.length - 1)];
  }

  // ── Per-frame Update ──────────────────────────────────────────────────────

  /**
   * @param {number} dtFactor      — dt / 16.666 (frame-rate normaliser)
   * @param {number} cameraX       — current camera world-X offset
   * @param {number} logicalWidth  — viewport logical width in px
   */
  update(dtFactor, cameraX, logicalWidth) {
    this._spawnTimer += dtFactor;
    this._warnTimer  += 0.07 * dtFactor;

    // Spawn one meteor whenever the timer crosses the threshold.
    // Subtract (not reset) to keep timing accurate across variable dtFactors.
    if (this._spawnTimer >= this._cfg.interval) {
      this._spawnTimer -= this._cfg.interval;
      this._spawnMeteor(cameraX, logicalWidth);
    }

    // Update active meteors and cull dead ones (reverse loop for safe splice)
    for (let i = this._meteors.length - 1; i >= 0; i--) {
      this._meteors[i].update(dtFactor);
      if (!this._meteors[i].alive) this._meteors.splice(i, 1);
    }
  }

  /** Spawn one meteor at a random position above the viewport. */
  _spawnMeteor(cameraX, logicalWidth) {
    const cfg = this._cfg;

    // X: random across ~140% of the viewport to allow left-/right-edge entries
    const x = cameraX + Math.random() * logicalWidth * 1.4 - logicalWidth * 0.2;
    const y = -28 - Math.random() * 35;

    // Slight rightward drift bias (classic meteor-shower look)
    const vx = (Math.random() - 0.3) * cfg.spread;
    const vy = cfg.speed + Math.random() * cfg.speed * 0.4;

    const color  = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    const radius = cfg.radius * (0.72 + Math.random() * 0.56);

    this._meteors.push(new Meteor(x, y, vx, vy, radius, color));
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cameraX
   * @param {number} logicalWidth   — for warning cull
   */
  draw(ctx, cameraX, logicalWidth) {
    // Draw meteor bodies and trails
    for (const m of this._meteors) {
      m.draw(ctx, cameraX);
    }

    // Draw pulsing warning chevrons at the top edge for incoming meteors
    this._drawWarnings(ctx, cameraX, logicalWidth);
  }

  /** Pulsing downward chevrons at y ≈ 14, aligned with each incoming meteor. */
  _drawWarnings(ctx, cameraX, logicalWidth) {
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(this._warnTimer));

    ctx.save();
    for (const m of this._meteors) {
      const sx = m.x - cameraX;

      // Only show the indicator while the meteor is near or above the screen top
      if (m.y > 55 || sx < 0 || sx > logicalWidth) continue;

      ctx.globalAlpha = pulse;

      // Filled chevron pointing downward
      ctx.fillStyle   = m.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - 9,  8);
      ctx.lineTo(sx,     22);
      ctx.lineTo(sx + 9,  8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Second smaller chevron above the first for depth
      ctx.globalAlpha = pulse * 0.45;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(sx - 5,  4);
      ctx.lineTo(sx,     14);
      ctx.lineTo(sx + 5,  4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ── External Interface ────────────────────────────────────────────────────

  /** Returns the live meteor array so game.js can do AABB collision checks. */
  getMeteors() {
    return this._meteors;
  }

  /** Reset in-flight meteors (called on level restart / game-over). */
  reset() {
    this._meteors    = [];
    this._spawnTimer = 0;
  }
}
