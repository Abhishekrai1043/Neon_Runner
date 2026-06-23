/**
 * game.js — Main Game Engine
 *
 * Architecture:
 *   - Strict GameState enum with guarded transition method (setState)
 *   - Delta-time capped rAF loop → dtFactor passed to all subsystems
 *   - Clean separation: update() → draw() → HUD sync
 *   - ObstacleManager integrated for moving neon hazards
 *   - Dash → Camera shake wiring via player.dashTriggered event flag
 *   - 5-slot localStorage high score with 3-char name entry
 */

import { InputController, formatKeyCode, ACTION_META, DEFAULT_BINDINGS } from './input.js';
import { Player }           from './player.js';
import { Camera }           from './camera.js';
import { LevelManager }     from './level.js';
import { ParticleSystem }   from './particle.js';
import { ObstacleManager }  from './obstacles.js';
import { MeteorShower }     from './meteors.js';
import { LayoutEditor }     from './layout.js';
import { getActiveConfig }  from './platforms/router.js';

// ═════════════════════════════════════════════════════════════════════════════
// GameState Enum
// ═════════════════════════════════════════════════════════════════════════════
const GameState = Object.freeze({
  MENU          : 'MENU',
  PLAYING       : 'PLAYING',
  PAUSED        : 'PAUSED',
  PLAYER_DYING  : 'PLAYER_DYING',
  LEVEL_CLEAR   : 'LEVEL_CLEAR',
  GAME_OVER     : 'GAME_OVER',
  COMPLETE      : 'COMPLETE',
});

// ═════════════════════════════════════════════════════════════════════════════
// Web Audio Synthesizer
// ═════════════════════════════════════════════════════════════════════════════
class AudioSynth {
  constructor() {
    this.ctx = null;
    this.arpeggiatorInterval = null;
    this.musicStarted  = false;
    this.volumeLevel   = 'HIGH'; // 'HIGH' | 'LOW' | 'MUTED'
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  }

  cycleVolume() {
    const map = { HIGH: 'LOW', LOW: 'MUTED', MUTED: 'HIGH' };
    this.volumeLevel = map[this.volumeLevel];
    return this.volumeLevel;
  }

  _vol() {
    return this.volumeLevel === 'HIGH' ? 1.0
         : this.volumeLevel === 'LOW'  ? 0.25
         : 0.0;
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _osc(type, freq, gainVal, startDelay = 0, duration = 0.2, extraFn = null) {
    if (!this.ctx || this._vol() === 0) return;
    this._resume();
    const t    = this.ctx.currentTime + startDelay;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(gainVal * this._vol(), t);
    gain.gain.exponentialRampToValueAtTime(0.001 * this._vol(), t + duration);
    if (extraFn) extraFn(osc, gain, t);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  playJump() {
    this.init();
    if (!this.ctx || this._vol() === 0) return;
    this._resume();
    const t   = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    g.gain.setValueAtTime(0.2 * this._vol(), t);
    g.gain.exponentialRampToValueAtTime(0.01 * this._vol(), t + 0.2);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.2);
  }

  playDash() {
    this.init();
    if (!this.ctx || this._vol() === 0) return;
    this._resume();
    const t   = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.14);
    g.gain.setValueAtTime(0.18 * this._vol(), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.18);
  }

  playCollect() {
    this.init();
    if (!this.ctx || this._vol() === 0) return;
    this._resume();
    const t = this.ctx.currentTime;
    [[587.33, 0], [880.00, 0.08]].forEach(([freq, delay]) => {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);
      g.gain.setValueAtTime(0.15 * this._vol(), t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.14);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(t + delay); osc.stop(t + delay + 0.2);
    });
  }

  playDeath() {
    this.init();
    if (!this.ctx || this._vol() === 0) return;
    this._resume();
    const t   = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.3 * this._vol(), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.5);
  }

  playLevelClear() {
    this.init();
    if (!this.ctx || this._vol() === 0) return;
    this._resume();
    const t     = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      g.gain.setValueAtTime(0.12 * this._vol(), t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.35);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.35);
    });
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicStarted) return;
    this.musicStarted = true;
    this._resume();

    let step = 0;
    const progressions = [
      [110.00, 165.00, 220.00, 330.00], // Am
      [87.31,  130.81, 174.61, 261.63], // F
      [130.81, 196.00, 261.63, 392.00], // C
      [98.00,  146.83, 196.00, 293.66], // G
    ];

    this.arpeggiatorInterval = setInterval(() => {
      if (this.ctx.state === 'suspended' || this._vol() === 0) return;
      const chord    = progressions[Math.floor(step / 16) % progressions.length];
      const baseFreq = chord[step % 4];
      const t        = this.ctx.currentTime;

      const osc    = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g      = this.ctx.createGain();

      osc.type    = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350 + Math.sin(step * 0.2) * 150, t);

      osc.frequency.setValueAtTime(baseFreq * 0.5, t);
      g.gain.setValueAtTime(0.06 * this._vol(), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(filter); filter.connect(g); g.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.15);
      step++;
    }, 150);
  }

  stopMusic() {
    if (this.arpeggiatorInterval) {
      clearInterval(this.arpeggiatorInterval);
      this.arpeggiatorInterval = null;
    }
    this.musicStarted = false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Game Engine
// ═════════════════════════════════════════════════════════════════════════════
class Game {
  constructor() {
    // Canvas
    this.canvas = document.getElementById('game-canvas');
    this.ctx    = this.canvas.getContext('2d');

    // Subsystems
    this.input         = new InputController();
    this.player        = new Player(100, 300);
    this.camera        = new Camera();
    this.levelManager  = new LevelManager();
    this.particles     = new ParticleSystem();
    this.obstacleManager = new ObstacleManager();
    this.meteorShower    = new MeteorShower();
    this.audio         = new AudioSynth();

    // State Machine
    this._state = null;

    // Game data
    this.lives              = 3;
    this.score              = 0;
    this.cassettesCollected = 0;
    this.totalCassettes     = 0;
    this.deathTimer         = 0;
    this.levelTransitionTimer = 0;
    this.pendingHighScore   = false;
    this._survivalFrames    = 0; // for time-bonus score
    this.dashUnlockedNotificationTimer = 0;

    // Viewport
    this.mapWidth     = 6000;
    this.logicalHeight = 600;
    this.logicalWidth  = 800;

    this._setupUIHandlers();
    this._setupResizeHandler();
    this._setupInputCallbacks();

    // Restore saved UI scale preference
    this._applyUIScale(localStorage.getItem('neon_runner_ui_scale') || 'default');

    this.layoutEditor = new LayoutEditor(this);
    this.layoutEditor.applyLayout();

    this.setState(GameState.MENU);

    this.resize();
    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ── State Machine ──────────────────────────────────────────────────────────
  get state() { return this._state; }

  /**
   * Central transition guard.
   * Prevents illegal transitions and runs entry/exit side effects.
   */
  setState(newState) {
    const prev = this._state;
    if (prev === newState) return;

    // ── Exit actions ────────────────────────────────────────────────────────
    // (none currently needed — handled in specific methods below)

    this._state = newState;

    // Synchronize state classes on body for CSS-driven layout rules
    const body = document.body;
    body.classList.remove('state-menu', 'state-playing', 'state-paused', 'state-gameover', 'state-complete');
    switch (newState) {
      case GameState.MENU:
        body.classList.add('state-menu');
        break;
      case GameState.PLAYING:
      case GameState.PLAYER_DYING:
      case GameState.LEVEL_CLEAR:
        body.classList.add('state-playing');
        break;
      case GameState.PAUSED:
        body.classList.add('state-paused');
        break;
      case GameState.GAME_OVER:
        body.classList.add('state-gameover');
        break;
      case GameState.COMPLETE:
        body.classList.add('state-complete');
        break;
    }

    // ── Entry actions ────────────────────────────────────────────────────────
    switch (newState) {
      case GameState.PLAYING:
        document.getElementById('hud').style.display = 'block';
        break;

      case GameState.PAUSED:
        this.input.reset();
        this._syncPauseVolumeBtn();
        this.updateLeaderboard();
        document.getElementById('pause-menu').classList.add('active');
        break;

      case GameState.PLAYER_DYING:
        this.deathTimer = 70;
        this.camera.triggerShake(22, 0.82);
        break;

      case GameState.LEVEL_CLEAR:
        this.levelTransitionTimer = 120;
        break;

      case GameState.GAME_OVER:
        this._showEndScreen(false);
        break;

      case GameState.COMPLETE:
        this._showEndScreen(true);
        break;
    }
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  _setupInputCallbacks() {
    this.input.onPause = () => {
      // 1. Close About Modal if open
      const aboutModal = document.getElementById('about-modal');
      if (aboutModal && aboutModal.classList.contains('active')) {
        aboutModal.classList.remove('active');
        return;
      }

      // 2. Layout Editor has its own interception
      if (this.layoutEditor && this.layoutEditor.isActive) {
        this.layoutEditor.promptCancel();
        return;
      }

      // 3. Normal Pause / Resume
      if (this._state === GameState.PLAYING) {
        this.setState(GameState.PAUSED);
      } else if (this._state === GameState.PAUSED) {
        this._resumeGame();
      }
    };

    // Mobile hardware back button capture
    window.addEventListener('popstate', (e) => {
      if (this.input && this.input.onPause) {
        this.input.onPause();
      }
      // Trap the history state so subsequent back presses are also caught
      history.pushState(null, '', location.href);
    });
    // Initial trap
    history.pushState(null, '', location.href);
  }

  _setupUIHandlers() {
    const $ = (id) => document.getElementById(id);

    $('start-btn').addEventListener('click', () => {
      this.audio.init();
      this._startGame();
    });

    const startAboutBtn = $('start-about-btn');
    if (startAboutBtn) {
      startAboutBtn.addEventListener('click', () => {
        const modal = $('about-modal');
        if (modal) modal.classList.add('active');
      });
    }

    const pauseAboutBtn = $('pause-about-btn');
    if (pauseAboutBtn) {
      pauseAboutBtn.addEventListener('click', () => {
        const modal = $('about-modal');
        if (modal) modal.classList.add('active');
      });
    }

    const closeAboutBtn = $('close-about-btn');
    if (closeAboutBtn) {
      closeAboutBtn.addEventListener('click', () => {
        const modal = $('about-modal');
        if (modal) modal.classList.remove('active');
      });
    }

    $('resume-btn').addEventListener('click', () => this._resumeGame());

    $('restart-btn').addEventListener('click', () => {
      $('game-over-menu').classList.remove('active');
      this._startGame();
    });

    const hudPause = $('hud-pause-btn');
    if (hudPause) {
      hudPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._state === GameState.PLAYING) {
          this.setState(GameState.PAUSED);
        }
      });
    }

    // Fullscreen button in HUD
    const hudFullscreenBtn = $('hud-fullscreen-btn');
    if (hudFullscreenBtn) {
      hudFullscreenBtn.addEventListener('click', () => this._toggleFullscreen());
    }

    // Fullscreen button in Start Menu
    const startFullscreenBtn = $('start-fullscreen-btn');
    if (startFullscreenBtn) {
      startFullscreenBtn.addEventListener('click', () => this._toggleFullscreen());
    }

    const pauseNewGame = $('pause-new-game-btn');
    if (pauseNewGame) {
      pauseNewGame.addEventListener('click', () => {
        $('pause-menu').classList.remove('active');
        this._startGame();
      });
    }

    const pauseVol = $('pause-volume-btn');
    if (pauseVol) {
      pauseVol.addEventListener('click', () => {
        const vol = this.audio.cycleVolume();
        pauseVol.textContent = `VOLUME: ${vol}`;
      });
    }

    const arcadeSubmit = $('arcade-submit-btn');
    if (arcadeSubmit) {
      arcadeSubmit.addEventListener('click', () => {
        const input    = $('arcade-name-input');
        const initials = input ? input.value : 'PLAYER1';
        this._submitHighScore(initials);
      });
    }

    // Allow Enter key in arcade name input to submit
    const arcadeInput = $('arcade-name-input');
    if (arcadeInput) {
      arcadeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const submitBtn = $('arcade-submit-btn');
          if (submitBtn && !submitBtn.disabled) submitBtn.click();
        }
        // Force uppercase as user types
        setTimeout(() => {
          arcadeInput.value = arcadeInput.value.toUpperCase().slice(0, 7);
        }, 0);
      });
      arcadeInput.addEventListener('focus', () => {
        const gm = $('game-over-menu');
        if (gm) gm.classList.add('keyboard-active');
      });
      arcadeInput.addEventListener('blur', () => {
        const gm = $('game-over-menu');
        if (gm) gm.classList.remove('keyboard-active');
      });
    }

    // ── Controls Remapping ──────────────────────────────────────────────────
    const pauseControlsBtn = $('pause-controls-btn');
    if (pauseControlsBtn) {
      pauseControlsBtn.addEventListener('click', () => this._openControlsPanel());
    }

    const controlsCloseBtn = $('controls-close-btn');
    if (controlsCloseBtn) {
      controlsCloseBtn.addEventListener('click', () => this._closeControlsPanel());
    }

    const controlsResetBtn = $('controls-reset-btn');
    if (controlsResetBtn) {
      controlsResetBtn.addEventListener('click', () => {
        this._cancelRebind();
        this.input.resetBindings();
        this.input.resetMobileSettings();
        this._renderControlsTable();
        this._syncMobileSettingsUI();
        this._showControlsStatus('DEFAULTS RESTORED', 'info', 2000);
      });
    }

    // Clicking the dark backdrop closes the panel
    const controlsOverlay = $('controls-panel');
    if (controlsOverlay) {
      controlsOverlay.addEventListener('click', (e) => {
        if (e.target === controlsOverlay) this._closeControlsPanel();
      });
    }

    // Mobile style toggle event listeners
    const btnStyleButtons = $('control-style-buttons');
    const btnStyleJoystick = $('control-style-joystick');
    if (btnStyleButtons && btnStyleJoystick) {
      btnStyleButtons.addEventListener('click', () => {
        this.input.updateMobileControlType('buttons');
        this._syncMobileSettingsUI();
      });
      btnStyleJoystick.addEventListener('click', () => {
        this.input.updateMobileControlType('joystick');
        this._syncMobileSettingsUI();
      });
    }

    // Mobile opacity slider event listener
    const opacitySlider = $('control-opacity-slider');
    const opacityValLabel = $('opacity-val-label');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        this.input.updateMobileOpacity(val);
        if (opacityValLabel) {
          opacityValLabel.textContent = `${Math.round(val * 100)}%`;
        }
      });
    }

    // Button size slider
    const btnSizeSlider = $('control-btn-size-slider');
    const btnSizeValLabel = $('btn-size-val-label');
    if (btnSizeSlider) {
      btnSizeSlider.addEventListener('input', (e) => {
        const sz = parseInt(e.target.value, 10);
        this.input.updateMobileBtnSize(sz);
        if (btnSizeValLabel) {
          btnSizeValLabel.textContent = sz < 62 ? 'S' : sz > 82 ? 'L' : 'M';
        }
      });
    }

    // UI scale toggles
    const UI_SCALES = ['small', 'default', 'large'];
    UI_SCALES.forEach((scale) => {
      const btn = $(`ui-scale-${scale}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this._applyUIScale(scale);
          this._syncMobileSettingsUI();
        });
      }
    });

    // Layout Editor button
    const layoutEditorBtn = $('layout-editor-btn');
    if (layoutEditorBtn) {
      layoutEditorBtn.addEventListener('click', () => {
        // Temporarily close controls panel while editing layout
        this._closeControlsPanel();
        this.layoutEditor.openEditor(() => {
          // Re-open controls panel when done
          this._openControlsPanel();
        });
      });
    }
  }

  // ── Controls Remapping UI ──────────────────────────────────────────────────

  _openControlsPanel() {
    this._cancelRebind(); // clear any stale capture state
    const panel = document.getElementById('controls-panel');
    if (panel) {
      panel.classList.add('active');
      panel.setAttribute('aria-hidden', 'false');
    }
    this._renderControlsTable();
    this._syncMobileSettingsUI();
  }

  _closeControlsPanel() {
    this._cancelRebind();
    const panel = document.getElementById('controls-panel');
    if (panel) {
      panel.classList.remove('active');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  /** Rebuild the entire bindings table from current input.bindings */
  _renderControlsTable() {
    const container = document.getElementById('controls-table');
    if (!container) return;
    container.innerHTML = '';

    // Column headers
    const header = document.createElement('div');
    header.className = 'controls-col-header';
    header.innerHTML = '<span>ACTION</span><span>PRIMARY</span><span>ALTERNATE</span>';
    container.appendChild(header);

    const ACTIONS = ['left', 'right', 'jump', 'dash', 'pause'];

    for (const action of ACTIONS) {
      const meta   = ACTION_META[action];
      const codes  = this.input.bindings[action] || [null, null];

      const row = document.createElement('div');
      row.className = 'controls-row';
      row.dataset.action = action;

      // Action label
      const label = document.createElement('div');
      label.className = 'controls-action-label';
      label.innerHTML =
        `<span class="controls-action-icon">${meta.icon}</span>${meta.label}`;
      row.appendChild(label);

      // Slots 0 (primary) and 1 (alternate)
      for (let slot = 0; slot < 2; slot++) {
        const code = codes[slot];
        const btn  = document.createElement('button');
        btn.className = 'key-rebind-btn' + (code ? '' : ' empty');
        btn.textContent = code ? formatKeyCode(code) : '+';
        btn.dataset.action = action;
        btn.dataset.slot   = slot;
        btn.title = code
          ? `Click to rebind (currently: ${code})`
          : 'Click to add a binding';

        btn.addEventListener('click', () => {
          this._startRebind(action, slot, btn);
        });

        row.appendChild(btn);
      }

      container.appendChild(row);
    }
  }

  /**
   * Begin listening for the next keypress and bind it to action[slot].
   * Only one capture can be active at a time.
   */
  _startRebind(action, slot, btnElement) {
    // Cancel any existing capture first
    this._cancelRebind();

    // Mark InputController as capturing so game keys don't fire
    this.input.capturing = true;

    // Visual feedback on the button
    btnElement.classList.add('listening');
    btnElement.textContent = 'PRESS KEY…';
    btnElement.classList.remove('empty');

    this._showControlsStatus('Waiting for input — press ESC to cancel', 'warn', 0);

    // Save references so we can cancel from anywhere
    this._rebindAction  = action;
    this._rebindSlot    = slot;
    this._rebindElement = btnElement;

    // One-shot window keydown — captures the pressed key
    this._rebindListener = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // ESC cancels without binding
      if (e.code === 'Escape') {
        this._cancelRebind();
        this._showControlsStatus('REBIND CANCELLED', 'warn', 1800);
        return;
      }

      // Apply the binding
      const result = this.input.updateBinding(action, slot, e.code);

      // Flash the button to confirm
      btnElement.classList.remove('listening');
      btnElement.classList.add('success-flash');
      btnElement.textContent = formatKeyCode(e.code);
      btnElement.classList.remove('empty');
      setTimeout(() => btnElement.classList.remove('success-flash'), 500);

      // Release capture
      this.input.capturing = false;
      this._rebindListener = null;

      if (result === 'duplicate') {
        this._showControlsStatus(
          `KEY CONFLICT — removed from previous action`, 'warn', 2500
        );
      } else {
        this._showControlsStatus(
          `${ACTION_META[action].label}: ${formatKeyCode(e.code)} BOUND`, 'info', 2000
        );
      }

      // Re-render the whole table so conflicts are reflected everywhere
      this._renderControlsTable();

      window.removeEventListener('keydown', this._rebindListener, true);
    };

    window.addEventListener('keydown', this._rebindListener, { capture: true, once: true });
  }

  /** Abort any active rebind without applying it */
  _cancelRebind() {
    if (this._rebindListener) {
      window.removeEventListener('keydown', this._rebindListener, true);
      this._rebindListener = null;
    }
    if (this._rebindElement) {
      this._rebindElement.classList.remove('listening');
      // Restore original text from binding
      const code = (this.input.bindings[this._rebindAction] || [])[this._rebindSlot];
      this._rebindElement.textContent = code ? formatKeyCode(code) : '+';
      if (!code) this._rebindElement.classList.add('empty');
      this._rebindElement = null;
    }
    this.input.capturing  = false;
    this._rebindAction    = null;
    this._rebindSlot      = null;
  }

  /**
   * Display a status message in the controls panel.
   * @param {string} msg      — message text
   * @param {'info'|'warn'|'error'} type
   * @param {number} duration — ms before auto-hide (0 = persistent)
   */
  _showControlsStatus(msg, type = 'info', duration = 2000) {
    const el = document.getElementById('controls-status');
    if (!el) return;
    clearTimeout(this._statusTimeout);
    el.textContent = msg;
    el.className   = `controls-status visible ${type}`;
    if (duration > 0) {
      this._statusTimeout = setTimeout(() => {
        el.classList.remove('visible');
      }, duration);
    }
  }

  _setupResizeHandler() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.resize();
        if (this.layoutEditor) {
          this.layoutEditor.applyLayout();
        }
      }, 100);
    });
  }

  resize() {
    const config = getActiveConfig();
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Performance-Capped High-DPI Resolution Scaler
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

    // Aspect Ratio Safe-Zone Matrix (16:9 virtual box)
    const targetAspect = 16 / 9;
    const windowAspect = w / h;

    let displayWidth, displayHeight;
    if (windowAspect > targetAspect) {
      // Pillarboxing
      displayHeight = h;
      displayWidth = h * targetAspect;
    } else {
      // Letterboxing
      displayWidth = w;
      displayHeight = w / targetAspect;
    }

    this.canvas.width  = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;
    this.canvas.style.width  = displayWidth + 'px';
    this.canvas.style.height = displayHeight + 'px';
    
    // Center the canvas viewport
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${(w - displayWidth) / 2}px`;
    this.canvas.style.top = `${(h - displayHeight) / 2}px`;

    this.scale        = displayHeight / this.logicalHeight;
    this.logicalWidth = displayWidth / this.scale;

    this.camera.resize(this.logicalWidth, this.logicalHeight);
  }

  // ── Game Flow ──────────────────────────────────────────────────────────────
  _startGame() {
    // Flush any pending high score from previous session
    if (this.pendingHighScore) {
      const input    = document.getElementById('arcade-name-input');
      const initials = input ? input.value : 'PLAYER1';
      this._saveHighScore(this.score, initials);
      this.pendingHighScore = false;
    }

    // Hard reset all game state
    this.score              = 0;
    this.lives              = 3;
    this._survivalFrames    = 0;

    this.levelManager.loadLevel(0);
    this.obstacleManager.loadForLevel(0);
    this._initLevel();

    document.getElementById('start-menu').classList.remove('active');
    document.getElementById('pause-menu').classList.remove('active');

    this.audio.startMusic();
    this.setState(GameState.PLAYING);
  }

  _initLevel() {
    const data         = this.levelManager.getCurrentLevel();
    this.mapWidth      = data.mapWidth;
    this.cassettesCollected = 0;
    this.totalCassettes     = data.cassettes.length;

    // Reset player (lock canDash back to false for a new level start / GAME_OVER reset)
    this.player.reset(100, 300, true);
    this.player.checkpointX = 100;
    this.player.checkpointY = 300;

    // Reset camera
    this.camera.x = 0;
    this.camera.y = 0;

    // Clear pools
    this.particles.clear();
    this.input.reset();

    // Reset collectibles
    data.cassettes.forEach(c => (c.collected = false));
    if (data.lifeItems) data.lifeItems.forEach(li => (li.collected = false));

    // Reset moving platforms and restore dash core item
    this.levelManager.resetMovingPlatforms();
    this.dashUnlockedNotificationTimer = 0;

    // Load meteor shower intensity for this level (also resets any in-flight meteors)
    this.meteorShower.loadForLevel(this.levelManager.currentLevelIndex);

    this._updateHUD();
    const lvlLabel = document.getElementById('hud-level-label');
    if (lvlLabel) {
      lvlLabel.textContent  = data.name;
      lvlLabel.style.textShadow = '0 0 10px #00f0ff';
    }
  }

  _resumeGame() {
    document.getElementById('pause-menu').classList.remove('active');
    this.input.reset();
    this.setState(GameState.PLAYING);
  }

  _triggerLevelClear() {
    this.audio.playLevelClear();
    this.particles.addRing(
      this.player.x + this.player.width  / 2,
      this.player.y + this.player.height / 2,
      '#00f0ff', 100
    );
    this.particles.addFloatingText(
      this.player.x + this.player.width  / 2,
      this.player.y - 20,
      'SYSTEM SYNC COMPLETE', '#00f0ff'
    );

    const nextIdx  = this.levelManager.currentLevelIndex + 1;
    const nextData = this.levelManager.levels[nextIdx];
    if (nextData) {
      this.particles.addFloatingText(
        this.player.x + this.player.width  / 2,
        this.player.y + 10,
        `ENTERING ${nextData.name}`, '#ff007f'
      );
    }

    this.setState(GameState.LEVEL_CLEAR);
  }

  _showEndScreen(isComplete) {
    this.audio[isComplete ? 'playLevelClear' : 'playDeath']();
    this.audio.stopMusic();
    this.pendingHighScore = true;

    const $ = (id) => document.getElementById(id);

    // Reset arcade form
    const nameEntry = $('arcade-name-entry');
    if (nameEntry) nameEntry.style.display = 'block';

    const feedback = $('arcade-submit-feedback');
    if (feedback) feedback.style.display = 'none';

    const submitBtn = $('arcade-submit-btn');
    if (submitBtn) submitBtn.disabled = false;

    const arcadeInput = $('arcade-name-input');
    if (arcadeInput) {
      arcadeInput.disabled = false;
      arcadeInput.value    = localStorage.getItem('neon_runner_last_initials') || 'PLAYER1';
    }

    $('final-score').textContent     = Math.floor(this.score).toLocaleString();
    $('final-cassettes').textContent = `${this.cassettesCollected} / ${this.totalCassettes}`;

    $('game-over-title').textContent   = isComplete ? 'SYSTEM INTEGRATED' : 'SYSTEM FAULT';
    $('game-over-message').textContent = isComplete
      ? 'Core grid synchronized. You are now the Architect of Neon.'
      : 'Connection terminated. Cyber-runner de-synchronized from grid.';

    $('game-over-menu').classList.add('active');
    this.updateLeaderboard();
  }

  // ── High Score Persistence ─────────────────────────────────────────────────
  _getHighScores() {
    const raw = localStorage.getItem('neon_runner_highscores');
    if (raw) {
      try { return JSON.parse(raw); } catch (_) { /* fallthrough */ }
    }
    const defaults = [
      { name: 'ARC', score: 15000 },
      { name: 'SYN', score: 10000 },
      { name: 'RUN', score:  8000 },
      { name: 'GRD', score:  5000 },
      { name: 'OUT', score:  3000 },
    ];
    localStorage.setItem('neon_runner_highscores', JSON.stringify(defaults));
    return defaults;
  }

  _saveHighScore(newScore, initials = 'AAA') {
    const name   = initials.trim().toUpperCase().slice(0, 3) || 'AAA';
    localStorage.setItem('neon_runner_last_initials', name);

    const scores = this._getHighScores();
    scores.push({ name, score: Math.floor(newScore) });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem('neon_runner_highscores', JSON.stringify(scores.slice(0, 5)));
  }

  _submitHighScore(initials) {
    if (!this.pendingHighScore) return;

    this._saveHighScore(this.score, initials);
    this.pendingHighScore = false;

    const feedback = document.getElementById('arcade-submit-feedback');
    if (feedback) {
      feedback.style.display = 'block';
      const name = (initials || 'PLAYER1').toUpperCase().slice(0, 7);
      feedback.textContent   = `"${name}" SYNCED TO GRID`;
    }
    const submitBtn = document.getElementById('arcade-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    const arcadeInput = document.getElementById('arcade-name-input');
    if (arcadeInput) arcadeInput.disabled = true;

    this.updateLeaderboard();
  }

  updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    const scores = this._getHighScores();
    list.innerHTML = '';

    scores.forEach((entry, i) => {
      const row  = document.createElement('div');
      row.className = 'leaderboard-row' + (entry.name === 'YOU' || entry.name === 'AAA' ? '' : '');

      // Highlight current player's new score if just submitted
      const lastInitials = localStorage.getItem('neon_runner_last_initials');
      if (entry.name === lastInitials && entry.score === Math.floor(this.score)) {
        row.classList.add('highlight');
      }

      const rankSpan  = document.createElement('span');
      rankSpan.textContent = `${i + 1}. ${entry.name}`;

      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = String(Math.floor(entry.score)).padStart(5, '0');

      row.appendChild(rankSpan);
      row.appendChild(scoreSpan);
      list.appendChild(row);
    });
  }

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  _toggleFullscreen() {
    const el = document.documentElement;
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFS) {
      if (el.requestFullscreen)       el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen)        document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  _syncFullscreenBtn() {
    // Label sync is no longer needed as the HUD button is just an icon
  }

  _syncPauseVolumeBtn() {
    const btn = document.getElementById('pause-volume-btn');
    if (btn) btn.textContent = `VOLUME: ${this.audio.volumeLevel}`;
  }

  // ── UI Scale ────────────────────────────────────────────────────────────────
  _applyUIScale(scale) {
    document.body.classList.remove('ui-small', 'ui-large');
    if (scale === 'small') document.body.classList.add('ui-small');
    if (scale === 'large') document.body.classList.add('ui-large');
    localStorage.setItem('neon_runner_ui_scale', scale);
  }

  _syncMobileSettingsUI() {
    const $ = (id) => document.getElementById(id);
    const btnStyleButtons = $('control-style-buttons');
    const btnStyleJoystick = $('control-style-joystick');
    const opacitySlider = $('control-opacity-slider');
    const opacityValLabel = $('opacity-val-label');
    const btnSizeSlider = $('control-btn-size-slider');
    const btnSizeValLabel = $('btn-size-val-label');

    if (btnStyleButtons && btnStyleJoystick) {
      if (this.input.mobileControlType === 'joystick') {
        btnStyleJoystick.classList.add('active');
        btnStyleButtons.classList.remove('active');
      } else {
        btnStyleButtons.classList.add('active');
        btnStyleJoystick.classList.remove('active');
      }
    }

    if (opacitySlider) {
      opacitySlider.value = Math.round(this.input.mobileOpacity * 100);
    }
    if (opacityValLabel) {
      opacityValLabel.textContent = `${Math.round(this.input.mobileOpacity * 100)}%`;
    }

    // Sync button size slider
    const sz = this.input.mobileBtnSize || 72;
    if (btnSizeSlider) btnSizeSlider.value = sz;
    if (btnSizeValLabel) btnSizeValLabel.textContent = sz < 62 ? 'S' : sz > 82 ? 'L' : 'M';

    // Sync UI scale toggle buttons
    const currentScale = localStorage.getItem('neon_runner_ui_scale') || 'default';
    ['small', 'default', 'large'].forEach((scale) => {
      const btn = $(`ui-scale-${scale}`);
      if (btn) btn.classList.toggle('active', scale === currentScale);
    });
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  _updateHUD() {
    const $ = (id) => document.getElementById(id);

    $('hud-score').textContent     = String(Math.floor(this.score)).padStart(5, '0');
    $('hud-cassettes').textContent = `${this.cassettesCollected} / ${this.totalCassettes}`;

    const progress = Math.min(100, (this.player.x / this.mapWidth) * 100);
    $('progress-bar').style.width = `${progress}%`;

    const hudLives = $('hud-lives');
    if (hudLives) {
      hudLives.textContent = this.lives > 0 ? '▲ '.repeat(this.lives).trim() : 'NONE';
    }

    // Dash cooldown bar and button visibility
    const dashGroup = document.querySelector('.hud-dash-group');
    const dashBtn   = document.getElementById('btn-dash');
    const dashBar   = $('hud-dash-bar');

    if (!this.player.canDash) {
      if (dashGroup) dashGroup.style.display = 'none';
      if (dashBtn)   dashBtn.style.display   = 'none';
    } else {
      if (dashGroup) dashGroup.style.display = '';
      if (dashBtn)   dashBtn.style.display   = '';

      if (dashBar) {
        const cooldownPct = this.player.dashCooldown > 0
          ? Math.max(0, 1 - this.player.dashCooldown / this.player.DASH_COOLDOWN)
          : 1;
        dashBar.style.width      = `${cooldownPct * 100}%`;
        dashBar.style.background = cooldownPct >= 1
          ? 'linear-gradient(90deg, #ffb800, #ff5500)'
          : 'rgba(255, 120, 0, 0.4)';
      }
    }
  }

  // ── rAF Game Loop ──────────────────────────────────────────────────────────
  loop(timestamp) {
    if (!this.lastTime) {
      this.lastTime = timestamp;
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    let dt = timestamp - this.lastTime;
    // Clamp: prevents huge jumps when tab goes background, limits 120Hz overshoot
    if (dt > 100) dt = 16.666;
    if (dt < 1)   dt = 1;
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(dt) {
    const dtFactor = Math.min(2.5, dt / 16.666);

    // ── Unlock Alert timer countdown
    if (this.dashUnlockedNotificationTimer > 0) {
      this.dashUnlockedNotificationTimer -= dtFactor;
      if (this.dashUnlockedNotificationTimer < 0) this.dashUnlockedNotificationTimer = 0;
    }

    switch (this._state) {

      case GameState.PLAYING: {
        // ── Moving Platforms update before player update
        this.levelManager.updateMovingPlatforms(dtFactor);

        // ── Audio: jump sound triggered before player update for tight timing
        if (this.input.jump
            && this.player.coyoteTimer > 0
            && this.player.jumpBuffer >= this.player.maxJumpBuffer - 0.01) {
          this.audio.playJump();
        }

        // ── Player update
        this.player.update(
          this.input,
          this.levelManager.getCurrentLevel().platforms,
          this.particles,
          dtFactor
        );

        // ── Dash event wiring
        if (this.player.dashTriggered) {
          this.camera.triggerShake(8, 0.86);
          this.audio.playDash();
        }

        // ── Landing dust
        if (this.player.justLanded && Math.abs(this.player.vy) > -1) {
          this.particles.addLandingDust(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height,
            this.player.accentColor
          );
        }

        // ── Moving obstacles update + collision check
        this.obstacleManager.update(dtFactor);
        this._checkMovingObstacles();

        // ── Meteor shower update + collision check
        this.meteorShower.update(dtFactor, this.camera.x, this.logicalWidth);
        this._checkMeteors();

        // ── Camera
        this.camera.update(this.player, this.mapWidth, dtFactor);

        // ── Score: distance + time bonus
        if (this.player.vx > 0.5 && !this.player.isDead) {
          this.score += (this.player.vx / this.player.maxVx) * 0.25 * dtFactor;
        }
        this._survivalFrames += dtFactor;
        if (this._survivalFrames % 60 < dtFactor) {
          // Award 10 pts every ~1 second of survival
          this.score += 10;
        }

        // ── Collectibles
        this._checkCollectibles();
        this._checkDashCore();
        this._checkLifeItems();

        // ── Death check
        if (this.player.isDead) {
          this.lives--;
          this._updateHUD();
          this.setState(GameState.PLAYER_DYING);
        }

        // ── Finish portal
        this._checkFinishPortal();

        // ── HUD sync every frame
        this._updateHUD();
        break;
      }

      case GameState.PLAYER_DYING: {
        this.deathTimer -= dtFactor;
        this.camera.update(this.player, this.mapWidth, dtFactor);

        if (this.deathTimer <= 0) {
          if (this.lives > 0) {
            // Respawn
            this.player.reset(this.player.checkpointX, this.player.checkpointY);
            this.player.invulnerabilityTimer = 90;
            this.camera.x = Math.max(0, this.player.x - this.logicalWidth / 3);
            this.setState(GameState.PLAYING);
          } else {
            this.setState(GameState.GAME_OVER);
          }
        }
        break;
      }

      case GameState.LEVEL_CLEAR: {
        this.levelTransitionTimer -= dtFactor;
        if (this.levelTransitionTimer <= 0) {
          const nextExists = this.levelManager.nextLevel();
          if (nextExists) {
            const nextIdx = this.levelManager.currentLevelIndex;
            this.obstacleManager.loadForLevel(nextIdx);
            this._initLevel();
            this.setState(GameState.PLAYING);
          } else {
            this.setState(GameState.COMPLETE);
          }
        }
        break;
      }

      // MENU, PAUSED, GAME_OVER, COMPLETE — no per-frame logic needed
      default:
        break;
    }

    // Particles always update (for death explosions visible on PLAYER_DYING screen)
    this.particles.update(dtFactor);
  }

  // ── Collision Helpers ──────────────────────────────────────────────────────
  _checkCollectibles() {
    const data = this.levelManager.getCurrentLevel();
    const cw = 32, ch = 20;

    for (let i = 0; i < data.cassettes.length; i++) {
      const cass = data.cassettes[i];
      if (cass.collected) continue;

      const cassRect = { x: cass.x - cw / 2, y: cass.y - ch / 2, width: cw, height: ch };
      if (this.player.checkAABB(this.player, cassRect)) {
        cass.collected = true;
        this.cassettesCollected++;
        this.score += 500;

        this.audio.playCollect();
        this.particles.addRing(cass.x, cass.y, '#ffb800', 40);
        this.particles.addBurst(cass.x, cass.y, '#ffb800', 15);
        this.particles.addFloatingText(cass.x, cass.y - 15, '+500 CORE DATA', '#ffb800');
        this._updateHUD();
      }
    }
  }

  _checkFinishPortal() {
    const portals = this.levelManager.getCurrentLevel().platforms.filter(p => p.type === 'finish');
    for (const portal of portals) {
      if (this.player.checkAABB(this.player, portal)) {
        this._triggerLevelClear();
        return;
      }
    }
  }

  _checkMovingObstacles() {
    if (this.player.isDead || this.player.invulnerabilityTimer > 0) return;

    const obstacles = this.obstacleManager.getObstacles();
    for (let i = 0; i < obstacles.length; i++) {
      if (this.player.checkAABB(this.player, obstacles[i].getRect())) {
        this.player.die(this.particles);
        return;
      }
    }
  }

  _checkMeteors() {
    if (this.player.isDead || this.player.invulnerabilityTimer > 0) return;

    const meteors = this.meteorShower.getMeteors();
    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      if (this.player.checkAABB(this.player, m.getRect())) {
        // Impact burst at meteor's world position before killing player
        this.particles.addRing(m.x, m.y, m.color, 55);
        this.particles.addBurst(m.x, m.y, m.color, 20);
        this.camera.triggerShake(6, 0.82);
        this.player.die(this.particles);
        return;
      }
    }
  }

  _checkLifeItems() {
    if (this.player.isDead || this.player.invulnerabilityTimer > 0) return;
    const data = this.levelManager.getCurrentLevel();
    if (!data.lifeItems) return;

    for (const item of data.lifeItems) {
      if (item.collected) continue;
      const rect = { x: item.x - 18, y: item.y - 18, width: 36, height: 36 };
      if (this.player.checkAABB(this.player, rect)) {
        item.collected = true;
        this.lives = Math.min(this.lives + 1, 9);
        this._updateHUD();
        this.audio.playCollect();
        this.camera.triggerShake(5, 0.88);
        this.particles.addRing(item.x, item.y, '#ff007f', 70);
        this.particles.addRing(item.x, item.y, '#ffffff', 40);
        this.particles.addBurst(item.x, item.y, '#ff007f', 28);
        this.particles.addFloatingText(item.x, item.y - 28, '+1 LIFE', '#ff007f');
        return;
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  draw() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();

    // Scale: device pixel ratio + logical viewport scaling
    this.ctx.scale(dpr * this.scale, dpr * this.scale);

    // Screen shake offset (applied via camera helper)
    this.camera.applyShake(this.ctx);

    const camX = this.camera.x;

    // 1. Parallax background (cached sky + dynamic mountains + grid)
    this.levelManager.drawBackground(this.ctx, camX, this.logicalWidth, this.logicalHeight);

    // 2. Static platforms + cassettes
    this.levelManager.drawLevel(this.ctx, camX, this.logicalWidth, this.logicalHeight);

    // 3. Moving neon obstacles
    this.obstacleManager.draw(this.ctx, camX);

    // 3b. Meteor shower (behind player so player silhouette stays readable)
    this.meteorShower.draw(this.ctx, camX, this.logicalWidth);

    // 4. Player (ghost trails + body + cooldown arc)
    this.player.draw(this.ctx, camX);

    // 5. Particles (trail blobs, sparks, rings, floating text, dash streaks)
    this.particles.draw(this.ctx, camX);

    // 6. Level transition overlay
    if (this._state === GameState.LEVEL_CLEAR) {
      this._drawLevelClearOverlay(camX);
    }

    // 7. Dash unlocked high-visibility neon notification overlay
    if (this.dashUnlockedNotificationTimer > 0) {
      this._drawDashUnlockedNotification();
    }

    this.ctx.restore();
  }

  _drawLevelClearOverlay(camX) {
    const alpha = 1 - this.levelTransitionTimer / 120;

    this.ctx.save();
    this.ctx.fillStyle   = `rgba(13, 2, 23, ${alpha * 0.85})`;
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    this.ctx.globalAlpha = alpha;
    this.ctx.textAlign   = 'center';

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font      = "bold 28px 'Orbitron', sans-serif";
    this.ctx.fillText('SYSTEM SYNC COMPLETE', this.logicalWidth / 2, this.logicalHeight / 2 - 30);

    const nextIdx  = this.levelManager.currentLevelIndex + 1;
    const nextData = this.levelManager.levels[nextIdx];
    if (nextData) {
      this.ctx.fillStyle = '#ff007f';
      this.ctx.font      = "bold 18px 'Orbitron', sans-serif";
      this.ctx.fillText(
        `ENTERING LEVEL ${nextIdx + 1}: ${nextData.name}`,
        this.logicalWidth / 2, this.logicalHeight / 2 + 14
      );
    }

    this.ctx.restore();
  }

  _checkDashCore() {
    if (this.player.isDead) return;

    const data = this.levelManager.getCurrentLevel();
    if (!data || !data.dashCore || !data.dashCore.active) return;

    const core = data.dashCore;
    const cw = 30, ch = 30;
    const coreRect = { x: core.x - cw / 2, y: core.y - ch / 2, width: cw, height: ch };

    if (this.player.checkAABB(this.player, coreRect)) {
      core.active = false;
      this.player.canDash = true;

      // Yellow particle burst + green expanding ring
      this.particles.addBurst(core.x, core.y, '#fff000', 40);
      this.particles.addRing(core.x, core.y, '#39ff14', 60);
      this.particles.addFloatingText(core.x, core.y - 25, 'DASH UNLOCKED', '#fff000');

      this.camera.triggerShake(12, 0.88);
      this.audio.playCollect();

      this.dashUnlockedNotificationTimer = 180; // 3 seconds at 60 FPS
      this._updateHUD();
    }
  }

  _drawDashUnlockedNotification() {
    this.ctx.save();

    const alpha = Math.min(1, this.dashUnlockedNotificationTimer / 30);
    this.ctx.globalAlpha = alpha;

    const bannerH = 70;
    const cy = this.logicalHeight * 0.25;

    // Dark glassmorphism banner background
    this.ctx.fillStyle = 'rgba(13, 2, 23, 0.85)';
    this.ctx.fillRect(0, cy - bannerH / 2, this.logicalWidth, bannerH);

    // Glowing green border lines
    this.ctx.strokeStyle = '#39ff14';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = '#39ff14';

    this.ctx.beginPath();
    this.ctx.moveTo(0, cy - bannerH / 2);
    this.ctx.lineTo(this.logicalWidth, cy - bannerH / 2);
    this.ctx.moveTo(0, cy + bannerH / 2);
    this.ctx.lineTo(this.logicalWidth, cy + bannerH / 2);
    this.ctx.stroke();

    // Main unlocked text with yellow glow
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = "bold 20px 'Orbitron', sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.shadowColor = '#fff000';
    this.ctx.shadowBlur = 8;
    this.ctx.fillText('⚡ DASH ABILITY UNLOCKED! ⚡', this.logicalWidth / 2, cy - 5);

    // Sub-instructions with green glow
    this.ctx.fillStyle = '#39ff14';
    this.ctx.font = "11px 'Orbitron', sans-serif";
    this.ctx.shadowColor = '#39ff14';
    this.ctx.shadowBlur = 4;
    this.ctx.fillText('PRESS SHIFT (OR ASSIGNED DASH KEY) TO DASH IN MID-AIR', this.logicalWidth / 2, cy + 18);

    this.ctx.restore();
  }
}

// ── Boot ────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  new Game();
});
