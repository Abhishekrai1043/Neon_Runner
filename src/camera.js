/**
 * camera.js — Kinetic LERPing Camera with Screen Shake
 * Tracks player with 1/3 lookahead, bounded to map edges.
 * Screen shake: triggerShake(magnitude) → decays per frame.
 */
export class Camera {
  constructor() {
    this.x    = 0;
    this.y    = 0;
    this.width  = 800;
    this.height = 600;

    /** LERP smoothness: higher = snappier, lower = floatier */
    this.lerpSpeed = 0.08;

    // ── Screen Shake ─────────────────────────────────────────────────────
    this._shakeX     = 0;
    this._shakeY     = 0;
    this._shakeMag   = 0;   // current magnitude (pixels in logical space)
    this._shakeDecay = 0.88; // multiplied per frame — reaches ~0 in ~15 frames at 60fps
  }

  resize(width, height) {
    this.width  = width;
    this.height = height;
  }

  /**
   * Trigger a screen shake burst.
   * @param {number} magnitude  — peak pixel displacement (logical coords)
   * @param {number} [decay]    — optional custom decay (0-1); higher = lasts longer
   */
  triggerShake(magnitude, decay = 0.88) {
    // Only grow shake if new hit is stronger
    if (magnitude > this._shakeMag) {
      this._shakeMag   = magnitude;
      this._shakeDecay = decay;
    }
  }

  /**
   * @param {Player} player
   * @param {number} mapWidth
   * @param {number} dtFactor  — dt / 16.666
   */
  update(player, mapWidth, dtFactor = 1.0) {
    // Target: place player at 1/3 from left so upcoming terrain is visible
    const targetX = player.x - this.width / 3;

    // Smooth LERP — uses exponential decay formula for frame-rate independence
    this.x += (targetX - this.x) * (1 - Math.pow(1 - this.lerpSpeed, dtFactor));

    // Clamp to map bounds
    if (this.x < 0) this.x = 0;
    if (this.x > mapWidth - this.width) this.x = mapWidth - this.width;

    // Decay screen shake
    if (this._shakeMag > 0.05) {
      this._shakeMag *= Math.pow(this._shakeDecay, dtFactor);
      // Random direction each frame for chaotic feel
      this._shakeX = (Math.random() - 0.5) * 2 * this._shakeMag;
      this._shakeY = (Math.random() - 0.5) * 2 * this._shakeMag;
    } else {
      this._shakeMag = 0;
      this._shakeX   = 0;
      this._shakeY   = 0;
    }
  }

  /** Apply shake offset to canvas context (call inside ctx.save block) */
  applyShake(ctx) {
    if (this._shakeMag > 0.05) {
      ctx.translate(this._shakeX, this._shakeY);
    }
  }

  /** Check if shake is currently active */
  get isShaking() {
    return this._shakeMag > 0.05;
  }
}
