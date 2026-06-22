/**
 * particle.js — Pooled Particle System
 * Types: spark, trail, ring, text, dashTrail, landingDust
 * All updates are delta-time scaled via dtFactor.
 */

class Particle {
  constructor(options) {
    this.type     = options.type  || 'spark';
    this.x        = options.x;
    this.y        = options.y;
    this.vx       = options.vx   || 0;
    this.vy       = options.vy   || 0;
    this.color    = options.color || '#ff007f';
    this.size     = options.size  || 3;
    this.alpha    = options.alpha !== undefined ? options.alpha : 1;
    this.decay    = options.decay || 0.02;
    this.gravity  = options.gravity || 0;

    // Floating text
    this.text     = options.text     || '';
    this.fontSize = options.fontSize || 16;

    // Ring expansion
    this.radius   = options.radius   || 1;
    this.maxRadius = options.maxRadius || 30;
    this.growthRate = options.growthRate || 1.5;

    // Dash trail — wide rect, cyan-magenta tint
    this.width    = options.width  || 0;
    this.height   = options.height || 0;
    this.rotation = options.rotation || 0;
  }

  /** @returns {boolean} true while particle is still alive */
  update(dtFactor = 1.0) {
    this.x  += this.vx * dtFactor;
    this.y  += this.vy * dtFactor;
    this.vy += this.gravity * dtFactor;
    this.alpha -= this.decay * dtFactor;

    if (this.type === 'ring') {
      this.radius += this.growthRate * dtFactor;
    }
    if (this.type === 'landingDust') {
      this.size += 0.6 * dtFactor;
      this.vx   *= Math.pow(0.88, dtFactor);
      this.vy   *= Math.pow(0.88, dtFactor);
    }

    return this.alpha > 0;
  }

  draw(ctx, cameraX) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);

    switch (this.type) {
      case 'spark':
        ctx.fillStyle = this.color;
        ctx.fillRect(
          this.x - cameraX - this.size / 2,
          this.y - this.size / 2,
          this.size, this.size
        );
        break;

      case 'trail':
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - cameraX, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'ring': {
        // Double-ring for glow look without shadowBlur
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = this.alpha * 0.35;
        ctx.lineWidth   = 5;
        ctx.beginPath();
        ctx.arc(this.x - cameraX, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = this.alpha;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        break;
      }

      case 'text':
        ctx.fillStyle   = this.color;
        ctx.font        = `bold ${this.fontSize}px 'Orbitron', sans-serif`;
        ctx.textAlign   = 'center';
        ctx.fillText(this.text, this.x - cameraX, this.y);
        break;

      case 'dashTrail': {
        // Wide horizontal streak with gradient fade
        const sx = this.x - cameraX;
        ctx.strokeStyle = this.color;
        ctx.lineWidth   = this.size;
        ctx.lineCap     = 'round';
        ctx.globalAlpha = this.alpha * 0.65;
        ctx.beginPath();
        ctx.moveTo(sx - this.width / 2, this.y);
        ctx.lineTo(sx + this.width / 2, this.y);
        ctx.stroke();

        // Inner bright core
        ctx.globalAlpha = this.alpha * 0.9;
        ctx.lineWidth   = Math.max(1, this.size * 0.4);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(sx - this.width * 0.3, this.y);
        ctx.lineTo(sx + this.width * 0.3, this.y);
        ctx.stroke();
        break;
      }

      case 'landingDust':
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha * 0.6;
        ctx.beginPath();
        ctx.ellipse(
          this.x - cameraX, this.y,
          this.size * 1.5, this.size * 0.6,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  clear() {
    this.particles = [];
  }

  // ── Emitter helpers ──────────────────────────────────────────────────────

  addTrail(x, y, vx, vy, color = '#00f0ff') {
    this.particles.push(new Particle({
      type: 'trail',
      x, y,
      vx: vx + (Math.random() - 0.5) * 0.5,
      vy: vy + (Math.random() - 0.5) * 0.5,
      color,
      size:  3 + Math.random() * 4,
      decay: 0.03 + Math.random() * 0.02,
    }));
  }

  addBurst(x, y, color = '#ff007f', count = 15) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 5;
      this.particles.push(new Particle({
        type:    'spark',
        x, y,
        vx:      Math.cos(angle) * speed,
        vy:      Math.sin(angle) * speed,
        color,
        size:    2 + Math.random() * 4,
        gravity: 0.1,
        decay:   0.015 + Math.random() * 0.015,
      }));
    }
  }

  addRing(x, y, color = '#ff007f', maxRadius = 40) {
    this.particles.push(new Particle({
      type: 'ring',
      x, y, color,
      radius: 2,
      maxRadius,
      growthRate: 2,
      decay: 0.025,
    }));
  }

  addFloatingText(x, y, text, color = '#00f0ff') {
    this.particles.push(new Particle({
      type: 'text',
      x, y,
      vx: 0, vy: -1.2,
      color, text,
      fontSize: 14,
      decay: 0.015,
    }));
  }

  /**
   * Dash trail streak emitted each frame while dashing.
   * @param {number} x  — player center X (world coords)
   * @param {number} y  — player center Y
   * @param {string} color  — neon accent colour
   * @param {number} dir    — 1 (right) | -1 (left), shifts streak origin
   */
  addDashTrail(x, y, color = '#00f0ff', dir = 1) {
    const trailColors = ['#00f0ff', '#ff007f', '#ffffff'];
    for (let i = 0; i < 3; i++) {
      this.particles.push(new Particle({
        type:  'dashTrail',
        x:     x - dir * i * 8,
        y:     y + (Math.random() - 0.5) * 10,
        vx:    -dir * (0.5 + Math.random() * 1.5),
        vy:    (Math.random() - 0.5) * 0.5,
        color: trailColors[i % trailColors.length],
        size:  3 + (3 - i),           // thickness decreases with age
        width: 28 - i * 6,            // streak width
        alpha: 0.9 - i * 0.2,
        decay: 0.06 + Math.random() * 0.04,
      }));
    }
  }

  /**
   * Landing dust puff — emitted on hard landings / high-speed touchdowns.
   * @param {number} x  — foot centre X
   * @param {number} y  — foot Y
   * @param {string} color
   */
  addLandingDust(x, y, color = '#00f0ff') {
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      this.particles.push(new Particle({
        type:    'landingDust',
        x:       x + side * (4 + Math.random() * 10),
        y,
        vx:      side * (0.5 + Math.random() * 2),
        vy:      -(0.3 + Math.random() * 1.2),
        color,
        size:    3 + Math.random() * 3,
        gravity: 0.05,
        decay:   0.03 + Math.random() * 0.02,
      }));
    }
  }

  // ── Per-frame update & draw ──────────────────────────────────────────────

  update(dtFactor = 1.0) {
    // Filter in-place: keep only alive particles
    this.particles = this.particles.filter(p => p.update(dtFactor));
  }

  draw(ctx, cameraX) {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx, cameraX);
    }
  }
}
