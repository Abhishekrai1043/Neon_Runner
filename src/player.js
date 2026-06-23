/**
 * player.js — Neon Runner Player
 *
 * Physics: delta-time scaled (dtFactor = dt/16.666)
 * Collision: split-axis AABB — X resolved first, then Y
 * Features:
 *   - Coyote time + jump buffering for responsive feel
 *   - Variable jump height (release early to cut apex)
 *   - Mid-air Dash: 10-frame horizontal impulse, reduced gravity,
 *     ghost trail rendering, one air-dash per jump, 60f cooldown
 *   - Landing dust on high-velocity touchdowns
 *   - Invulnerability flicker on respawn
 *   - Procedural vector-graphics runner with run/jump/idle animation
 */
export class Player {
  constructor(x, y) {
    // ── Spatial & Vectors ─────────────────────────────────────────────────
    this.x  = x;
    this.y  = y;
    this.vx = 0;
    this.vy = 0;
    this.width  = 24;
    this.height = 42;

    // ── Physics Constants ─────────────────────────────────────────────────
    this.gravity          = 0.55;
    this.accel            = 0.95;
    this.friction         = 0.80;   // ground decel multiplier
    this.airFriction      = 0.95;   // air horizontal decel
    this.maxVx            = 7.5;
    this.terminalVelocity = 14;
    this.jumpForce        = -12.5;
    this.DASH_SPEED       = 18;     // vx applied on dash trigger
    this.DASH_FRAMES      = 10;     // duration in 60fps-frames
    this.DASH_COOLDOWN    = 60;     // cooldown in 60fps-frames

    // ── State Flags ────────────────────────────────────────────────────────
    this.grounded   = false;
    this.isDead     = false;
    this.facing     = 'right';
    this.runAnimTimer = 0;

    // ── Coyote Time & Jump Buffer ─────────────────────────────────────────
    this.coyoteTimer    = 0;
    this.maxCoyoteTime  = 8;
    this.jumpBuffer     = 0;
    this.maxJumpBuffer  = 8;

    // ── Dash State ────────────────────────────────────────────────────────
    this.dashFrames         = 0;    // frames remaining in active dash
    this.dashCooldown       = 0;    // cooldown frames remaining
    this.dashDir            = 1;    // direction of last dash
    this.airDashUsed        = false; // one air-dash per jump
    this._dashInputConsumed = false; // edge detection: prevent hold-to-dash
    this._ghostTimer        = 0;    // internal timer for ghost trail spawn rate

    // ── Event flags (read & cleared by game.js each frame) ───────────────
    this.dashTriggered  = false;   // → triggers camera shake in game.js
    this.justLanded     = false;   // → triggers landing dust in game.js
    this._prevGrounded  = false;   // previous frame grounded state

    // ── Ghost Trails (dash visual) ────────────────────────────────────────
    /** @type {{ x: number, y: number, alpha: number, anim: number }[]} */
    this.ghostTrails = [];

    // ── Motion history (background trail) ────────────────────────────────
    /** @type {{ x: number, y: number, anim: number }[]} */
    this.history    = [];
    this.maxHistory = 10;
    this.historyTimer = 0;

    // ── Aesthetics ────────────────────────────────────────────────────────
    this.color       = '#ff007f';
    this.accentColor = '#00f0ff';

    // ── Invulnerability ────────────────────────────────────────────────────
    this.invulnerabilityTimer = 0;

    // ── Checkpoints ───────────────────────────────────────────────────────
    this.checkpointX      = x;
    this.checkpointY      = y;
    this.checkpointVisualX = x;

    this.canDash = false;
    this.ridingPlatform = null;
    this.ridingConveyor = null;
  }

  // ── Public: Full State Reset ──────────────────────────────────────────────
  reset(x, y, resetDash = false) {
    this.x  = x;
    this.y  = y;
    this.vx = 0;
    this.vy = 0;

    this.grounded   = false;
    this.isDead     = false;
    this.facing     = 'right';
    this.runAnimTimer = 0;

    this.coyoteTimer = 0;
    this.jumpBuffer  = 0;

    this.dashFrames         = 0;
    this.dashCooldown       = 0;
    this.airDashUsed        = false;
    this._dashInputConsumed = false;
    this._ghostTimer        = 0;

    this.dashTriggered  = false;
    this.justLanded     = false;
    this._prevGrounded  = false;

    this.ghostTrails  = [];
    this.history      = [];
    this.historyTimer = 0;

    this.invulnerabilityTimer = 0;
    this.checkpointX       = x;
    this.checkpointY       = y;
    this.checkpointVisualX = x;

    this.ridingPlatform = null;
    this.ridingConveyor = null;
    if (resetDash) {
      this.canDash = false;
    }
  }

  // ── Main Update ─────────────────────────────────────────────────────────
  /**
   * @param {InputController}  input
   * @param {Object[]}         platforms  — static platform array from level data
   * @param {ParticleSystem}   particleSystem
   * @param {number}           dtFactor   — dt / 16.666 (frame-rate normalization)
   */
  update(input, platforms, particleSystem, dtFactor = 1.0) {
    if (this.isDead) return;

    // ── Ride Moving Platform displacement (friction locking) ──
    if (this.ridingPlatform) {
      const plat = this.ridingPlatform;
      this.x += (plat.vx || 0) * dtFactor;
      this.y += (plat.vy || 0) * dtFactor;
    }

    // Clear one-frame event flags
    this.dashTriggered = false;
    this.justLanded    = false;

    // ── Invulnerability countdown ─────────────────────────────────────────
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer -= dtFactor;
      if (this.invulnerabilityTimer < 0) this.invulnerabilityTimer = 0;
    }

    // ── Timers: Coyote & Jump Buffer ─────────────────────────────────────
    if (this.grounded) {
      this.coyoteTimer = this.maxCoyoteTime;
    } else {
      if (this.coyoteTimer > 0) this.coyoteTimer -= dtFactor;
    }

    if (input.jump) {
      this.jumpBuffer = this.maxJumpBuffer;
    } else {
      if (this.jumpBuffer > 0) this.jumpBuffer -= dtFactor;
    }

    // ── Dash Input Edge Detection ─────────────────────────────────────────
    // Reset consumed flag when key is released so re-press works
    if (!input.dash) this._dashInputConsumed = false;

    // Cooldown countdown
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dtFactor;
      if (this.dashCooldown < 0) this.dashCooldown = 0;
    }

    // ── Dash Trigger ──────────────────────────────────────────────────────
    const canDash = this.canDash
                 && this.dashCooldown <= 0
                 && this.dashFrames <= 0
                 && (this.grounded || !this.airDashUsed);

    if (input.dash && !this._dashInputConsumed && canDash) {
      this._dashInputConsumed = true;

      if (!this.grounded) this.airDashUsed = true;

      this.dashDir    = this.facing === 'right' ? 1 : -1;
      this.vx         = this.dashDir * this.DASH_SPEED;
      this.vy         = Math.min(this.vy, 1.5); // soft cancel upward momentum
      this.dashFrames = this.DASH_FRAMES;
      this.dashCooldown = this.DASH_COOLDOWN;
      this.dashTriggered = true;                // game.js reads this → shake

      particleSystem.addBurst(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.accentColor, 12
      );
      particleSystem.addRing(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.accentColor, 30
      );
    }

    // ── Active Dash Logic ─────────────────────────────────────────────────
    const isDashing = this.dashFrames > 0;
    if (isDashing) {
      this.dashFrames -= dtFactor;
      if (this.dashFrames < 0) this.dashFrames = 0;

      // Ghost trail — spawn every ~2 frames
      this._ghostTimer += dtFactor;
      if (this._ghostTimer >= 2) {
        this.ghostTrails.push({
          x:     this.x,
          y:     this.y,
          alpha: 0.65,
          anim:  this.runAnimTimer,
        });
        if (this.ghostTrails.length > 7) this.ghostTrails.shift();
        this._ghostTimer = 0;
      }

      // Emit moving dash trail particles
      particleSystem.addDashTrail(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.accentColor,
        this.dashDir
      );
    } else {
      this._ghostTimer = 0;
    }

    // Fade ghost trails
    for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
      this.ghostTrails[i].alpha -= 0.065 * dtFactor;
      if (this.ghostTrails[i].alpha <= 0) {
        this.ghostTrails.splice(i, 1);
      }
    }

    // ── Horizontal Movement ────────────────────────────────────────────────
    let moveDir = 0;
    if (input.left)  moveDir -= 1;
    if (input.right) moveDir += 1;

    let currentBeltVelocity = 0;
    if (this.ridingConveyor) {
      currentBeltVelocity = this.ridingConveyor.beltVelocity || 0;
    }

    if (moveDir !== 0) {
      // Only apply normal accel if not mid-dash (dash sets its own vx)
      if (!isDashing) {
        this.vx += moveDir * this.accel * dtFactor;
      }
      this.facing = moveDir > 0 ? 'right' : 'left';
      this.runAnimTimer += Math.abs(this.vx) * 0.8 * dtFactor;

      // Foot sparks while running fast on ground
      if (this.grounded && Math.abs(this.vx) > 2 && Math.random() < 0.3 * dtFactor) {
        particleSystem.addTrail(
          this.x + this.width / 2,
          this.y + this.height,
          -this.vx * 0.2,
          (Math.random() - 1) * 0.5,
          Math.random() > 0.5 ? this.accentColor : this.color
        );
      }
    } else {
      // Apply friction; dash direction carries through (don't cut it)
      if (!isDashing) {
        if (this.grounded) {
          if (this.ridingConveyor) {
            // Apply friction relative to the belt velocity so the player matches the belt velocity when standing still
            this.vx = (this.vx - currentBeltVelocity) * Math.pow(this.friction, dtFactor) + currentBeltVelocity;
          } else {
            this.vx *= Math.pow(this.friction, dtFactor);
          }
        } else {
          this.vx *= Math.pow(this.airFriction, dtFactor);
        }
        if (Math.abs(this.vx - currentBeltVelocity) < 0.1) this.vx = currentBeltVelocity;
      }
      this.runAnimTimer += 0.5 * dtFactor;
    }

    // Speed clamp — dash can exceed maxVx temporarily, re-clamp after dash expires
    if (!isDashing) {
      // Clamp velocity relative to belt velocity so running with/against belt adjusts net speed limit
      let relativeVx = this.vx - currentBeltVelocity;
      if (relativeVx >  this.maxVx) relativeVx =  this.maxVx;
      if (relativeVx < -this.maxVx) relativeVx = -this.maxVx;
      this.vx = relativeVx + currentBeltVelocity;
    }

    // ── Gravity ───────────────────────────────────────────────────────────
    if (isDashing) {
      // Greatly reduced gravity during dash window
      this.vy += this.gravity * 0.12 * dtFactor;
      if (this.vy > 3) this.vy = 3;
    } else {
      this.vy += this.gravity * dtFactor;
      if (this.vy > this.terminalVelocity) this.vy = this.terminalVelocity;
    }

    // ── Jump ──────────────────────────────────────────────────────────────
    if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
      this.vy        = this.jumpForce;
      this.grounded  = false;
      this.coyoteTimer = 0;
      this.jumpBuffer  = 0;
      this.ridingPlatform = null;
      this.ridingConveyor = null;

      particleSystem.addRing(
        this.x + this.width / 2, this.y + this.height,
        this.accentColor, 35
      );
      particleSystem.addBurst(
        this.x + this.width / 2, this.y + this.height,
        this.accentColor, 10
      );
    }

    // Variable jump height: cut upward velocity on early release
    if (!input.jump && this.vy < -3 && !isDashing) {
      this.vy = -3;
    }

    // ── Motion History (background trail) ────────────────────────────────
    this.historyTimer += dtFactor;
    if (this.historyTimer >= 2) {
      this.history.push({ x: this.x, y: this.y, anim: this.runAnimTimer });
      if (this.history.length > this.maxHistory) this.history.shift();
      this.historyTimer = 0;
    }

    // ── Collision Resolution: Split-Axis AABB ────────────────────────────
    this._prevGrounded = this.grounded;
    this.grounded = false; // will be confirmed in Y-axis pass

    this.x += this.vx * dtFactor;
    this._resolveCollisions(platforms, 'x', particleSystem);

    this.ridingPlatform = null; // Reset riding platform before Y-axis check
    this.ridingConveyor = null; // Reset riding conveyor before Y-axis check
    this.y += this.vy * dtFactor;
    this._resolveCollisions(platforms, 'y', particleSystem);

    // Detect landing event for landing dust
    if (this.grounded && !this._prevGrounded && Math.abs(this.vy) >= 0 ) {
      this.justLanded = true;
      // Reset air dash
      this.airDashUsed = false;
    }

    // ── Fall Death ────────────────────────────────────────────────────────
    if (this.y > 680) {
      this.die(particleSystem);
    }
  }

  // ── Collision Resolution ─────────────────────────────────────────────────
  _resolveCollisions(platforms, axis, particleSystem) {
    for (let i = 0; i < platforms.length; i++) {
      const plat = platforms[i];
      if (plat.type === 'finish') continue; // walk-through portals

      if (this.checkAABB(this, plat)) {
        if (plat.type === 'spike' || plat.type === 'hazard_floor') {
          this.die(particleSystem);
          return;
        }

        if (axis === 'x') {
          if (this.vx > 0) {
            this.x  = plat.x - this.width;
          } else if (this.vx < 0) {
            this.x  = plat.x + plat.width;
          }
          this.vx = 0;

        } else if (axis === 'y') {
          if (this.vy > 0) {
            // Land on top
            this.y       = plat.y - this.height;
            this.vy      = 0;
            this.grounded = true;

            // Advance checkpoint on normal platforms
            if (plat.type === 'normal') {
              this.checkpointX = this.x;
              this.checkpointY = this.y;

              if (this.x > this.checkpointVisualX + 250 && particleSystem) {
                particleSystem.addFloatingText(
                  this.x + this.width / 2, this.y - 15,
                  'GRID SYNCED', this.accentColor
                );
                particleSystem.addRing(
                  this.x + this.width / 2, this.y + this.height,
                  this.accentColor, 25
                );
                this.checkpointVisualX = this.x;
              }
            } else if (plat.type === 'moving') {
              this.ridingPlatform = plat;
            } else if (plat.type === 'conveyor') {
              this.ridingConveyor = plat;
            }
          } else if (this.vy < 0) {
            // Hit ceiling
            this.y  = plat.y + plat.height;
            this.vy = 0;
          }
        }
      }
    }
  }

  // ── Public AABB Helper ────────────────────────────────────────────────────
  checkAABB(a, b) {
    return (
      a.x             < b.x + b.width  &&
      a.x + a.width   > b.x            &&
      a.y             < b.y + b.height &&
      a.y + a.height  > b.y
    );
  }

  // ── Death ─────────────────────────────────────────────────────────────────
  die(particleSystem) {
    if (this.isDead || this.invulnerabilityTimer > 0) return;
    this.isDead = true;

    particleSystem.addRing(
      this.x + this.width / 2, this.y + this.height / 2,
      this.color, 75
    );
    particleSystem.addBurst(
      this.x + this.width / 2, this.y + this.height / 2,
      this.color, 40
    );
    particleSystem.addBurst(
      this.x + this.width / 2, this.y + this.height / 2,
      this.accentColor, 20
    );
    particleSystem.addFloatingText(
      this.x + this.width / 2, this.y - 20,
      'SYSTEM FAULT', this.color
    );
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  draw(ctx, cameraX) {
    if (this.isDead) return;

    // Respawn flicker
    if (this.invulnerabilityTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) return;

    const isDashing = this.dashFrames > 0 || this.ghostTrails.length > 0;

    // 1. Ghost trails (dashing only)
    if (isDashing) {
      for (let i = 0; i < this.ghostTrails.length; i++) {
        const ghost = this.ghostTrails[i];
        ctx.save();
        ctx.globalAlpha = ghost.alpha;
        this._drawVectorRunner(ctx, ghost.x - cameraX, ghost.y, ghost.anim, true);
        ctx.restore();
      }
    }

    // 2. Motion history trail (faint body echo, always visible when moving)
    for (let i = 0; i < this.history.length; i += 2) {
      const pos   = this.history[i];
      const alpha = (i / this.history.length) * 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      this._drawVectorRunner(ctx, pos.x - cameraX, pos.y, pos.anim, true);
      ctx.restore();
    }

    // 3. Player body — subtle glow via reduced shadowBlur
    ctx.save();
    if (this.dashFrames > 0) {
      // Bright cyan glow during active dash
      ctx.shadowBlur  = 15;
      ctx.shadowColor = this.accentColor;
    } else {
      ctx.shadowBlur  = 5;
      ctx.shadowColor = this.color;
    }
    this._drawVectorRunner(ctx, this.x - cameraX, this.y, this.runAnimTimer, false);
    ctx.restore();

    // 4. Dash cooldown arc on player (small arc above head when cooling down)
    if (this.canDash && this.dashCooldown > 0 && this.dashFrames <= 0) {
      const pct    = 1 - (this.dashCooldown / this.DASH_COOLDOWN);
      const cx     = this.x - cameraX + this.width / 2;
      const cy     = this.y - 8;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 184, 0, 0.6)`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Vector Runner Renderer ────────────────────────────────────────────────
  _drawVectorRunner(ctx, x, y, animTime, isTrail) {
    const magentaColor = this.color;
    const accentColor  = this.accentColor;
    const bodyColor    = isTrail ? magentaColor : '#ffffff';
    const isDashing    = this.dashFrames > 0;

    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = magentaColor;

    const dirMul = this.facing === 'right' ? 1 : -1;
    const cx = x + this.width / 2;

    // Pose parameters
    let legL = 0, legR = 0, armL = 0, armR = 0, headBob = 0;

    if (isDashing) {
      // Streamlined dash pose — body flat, arms back
      legL    =  6;
      legR    = -6;
      armL    = -18 * dirMul;
      armR    = -12 * dirMul;
      headBob = -3;
    } else if (!this.grounded) {
      legL    =  10; legR    = -8;
      armL    = -12; armR    =  12;
      headBob = -2;
    } else if (Math.abs(this.vx) > 0.5) {
      const cycle = Math.sin(animTime * 0.22);
      legL    =  cycle * 12;
      legR    = -cycle * 12;
      armL    = -cycle * 8;
      armR    =  cycle * 8;
      headBob = Math.abs(cycle) * 2;
    } else {
      const breath = Math.sin(animTime * 0.1);
      legL    =  2;  legR    = -2;
      armL    =  breath * 2;
      armR    = -breath * 2;
      headBob =  breath * 1;
    }

    const lean    = Math.abs(this.vx) * 0.08 * dirMul;
    const neckX   = cx + lean * 10;
    const neckY   = y + 12 + headBob;
    const pelvisX = cx - lean * 4;
    const pelvisY = y + 28;

    // Spine
    ctx.beginPath();
    ctx.moveTo(neckX, neckY);
    ctx.lineTo(pelvisX, pelvisY);
    ctx.strokeStyle = bodyColor;
    ctx.stroke();

    // Helmet
    ctx.beginPath();
    ctx.arc(neckX + dirMul * 2, neckY - 6, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0217';
    ctx.fill();
    ctx.strokeStyle = magentaColor;
    ctx.stroke();

    // Visor glow — cyan when dashing, normal otherwise
    ctx.beginPath();
    ctx.moveTo(neckX + dirMul * 0, neckY - 8);
    ctx.lineTo(neckX + dirMul * 8, neckY - 6);
    ctx.strokeStyle = isDashing ? '#ffffff' : accentColor;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.lineWidth = 3;

    // Left Leg
    const kneeL_X = pelvisX + (legL * 0.5) * dirMul - 2;
    const kneeL_Y = pelvisY + 8;
    const footL_X = pelvisX + legL * dirMul;
    const footL_Y = y + this.height;
    ctx.beginPath();
    ctx.moveTo(pelvisX, pelvisY);
    ctx.lineTo(kneeL_X, kneeL_Y);
    ctx.lineTo(footL_X, footL_Y);
    ctx.strokeStyle = magentaColor;
    ctx.stroke();

    // Right Leg
    const kneeR_X = pelvisX + (legR * 0.5) * dirMul + 2;
    const kneeR_Y = pelvisY + 8;
    const footR_X = pelvisX + legR * dirMul;
    const footR_Y = y + this.height;
    ctx.beginPath();
    ctx.moveTo(pelvisX, pelvisY);
    ctx.lineTo(kneeR_X, kneeR_Y);
    ctx.lineTo(footR_X, footR_Y);
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    // Left Arm
    const elbowL_X = neckX + (armL * 0.3) - 3;
    const elbowL_Y = neckY + 6;
    const handL_X  = neckX + armL;
    const handL_Y  = neckY + 12;
    ctx.beginPath();
    ctx.moveTo(neckX, neckY + 2);
    ctx.lineTo(elbowL_X, elbowL_Y);
    ctx.lineTo(handL_X, handL_Y);
    ctx.strokeStyle = magentaColor;
    ctx.stroke();

    // Right Arm
    const elbowR_X = neckX + (armR * 0.3) + 3;
    const elbowR_Y = neckY + 6;
    const handR_X  = neckX + armR;
    const handR_Y  = neckY + 12;
    ctx.beginPath();
    ctx.moveTo(neckX, neckY + 2);
    ctx.lineTo(elbowR_X, elbowR_Y);
    ctx.lineTo(handR_X, handR_Y);
    ctx.strokeStyle = accentColor;
    ctx.stroke();
  }
}
