/**
 * input.js — Unified Input Controller with Dynamic Key Remapping
 *
 * Key bindings are stored as { action: [primaryCode, altCode] }.
 * Loaded from localStorage on init, persisted on every change.
 * A `capturing` flag lets the Controls UI pause normal dispatch during rebinding.
 */

// ── Storage key ────────────────────────────────────────────────────────────
const LS_BINDINGS_KEY = 'neon_runner_keybindings';

// ── Default bindings: action → [primary code, alternate code] ──────────────
export const DEFAULT_BINDINGS = {
  left:  ['KeyA',      'ArrowLeft'],
  right: ['KeyD',      'ArrowRight'],
  jump:  ['Space',     'ArrowUp'],
  dash:  ['ShiftLeft', 'KeyX'],
  pause: ['Escape',    'KeyP'],
};

// ── Pretty-print a KeyboardEvent.code ──────────────────────────────────────
const CODE_LABELS = {
  ShiftLeft:   'L-SHIFT', ShiftRight:  'R-SHIFT',
  ControlLeft: 'L-CTRL',  ControlRight:'R-CTRL',
  AltLeft:     'L-ALT',   AltRight:    'R-ALT',
  ArrowLeft:   '◀',       ArrowRight:  '▶',
  ArrowUp:     '▲',       ArrowDown:   '▼',
  Space:       'SPACE',   Enter:       'ENTER',
  Backspace:   'BKSP',    Tab:         'TAB',
  CapsLock:    'CAPS',    Escape:      'ESC',
  Delete:      'DEL',     Home:        'HOME',
  End:         'END',     PageUp:      'PG↑',
  PageDown:    'PG↓',     Insert:      'INS',
  F1:'F1', F2:'F2', F3:'F3',  F4:'F4',  F5:'F5',  F6:'F6',
  F7:'F7', F8:'F8', F9:'F9', F10:'F10', F11:'F11', F12:'F12',
};

export function formatKeyCode(code) {
  if (!code)                    return '—';
  if (CODE_LABELS[code])        return CODE_LABELS[code];
  if (code.startsWith('Key'))   return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code;
}

// ── Action display names ───────────────────────────────────────────────────
export const ACTION_META = {
  left:  { label: 'MOVE LEFT',  icon: '◀' },
  right: { label: 'MOVE RIGHT', icon: '▶' },
  jump:  { label: 'JUMP',       icon: '▲' },
  dash:  { label: 'DASH',       icon: '⚡' },
  pause: { label: 'PAUSE',      icon: '⏸' },
};

// ═══════════════════════════════════════════════════════════════════════════
export class InputController {
  constructor() {
    // Live state flags (read by player / game each frame)
    this.left     = false;
    this.right    = false;
    this.jump     = false;
    this.dash     = false;
    this.dashDown = false;  // edge-detection support for player.js

    // Set to true by ControlsUI while waiting for a keypress — pauses dispatch
    this.capturing = false;

    // Callbacks
    this.onPause = null;

    // Load (or initialise) bindings
    this.bindings = this._loadBindings();

    // Load mobile settings
    this.mobileControlType = localStorage.getItem('neon_runner_mobile_control_type') || 'buttons';
    this.mobileOpacity = parseFloat(localStorage.getItem('neon_runner_mobile_opacity') || '0.35');

    // Initial orientation/touch capability check for CSS toggles
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      document.body.classList.add('is-touch');
      document.body.classList.remove('is-no-touch');
    } else {
      document.body.classList.add('is-no-touch');
      document.body.classList.remove('is-touch');
    }

    this._initKeyboardListeners();
    this._initTouchListeners();
    this._applyMobileSettings();
  }

  // ── Binding Persistence ──────────────────────────────────────────────────
  _loadBindings() {
    try {
      const raw = localStorage.getItem(LS_BINDINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to handle missing actions after future updates
        return Object.assign({}, DEFAULT_BINDINGS, parsed);
      }
    } catch (_) { /* ignore corrupt data */ }
    return { ...DEFAULT_BINDINGS };
  }

  _saveBindings() {
    try {
      localStorage.setItem(LS_BINDINGS_KEY, JSON.stringify(this.bindings));
    } catch (_) { /* ignore quota errors */ }
  }

  /**
   * Update a single binding slot.
   * @param {string} action   — 'left' | 'right' | 'jump' | 'dash' | 'pause'
   * @param {number} slot     — 0 (primary) | 1 (alternate)
   * @param {string} code     — KeyboardEvent.code value
   * @returns {'ok'|'duplicate'} — 'duplicate' means key was taken from another action
   */
  updateBinding(action, slot, code) {
    let wasDuplicate = false;

    // Remove this code from any other action's slots to prevent conflicts
    for (const [act, codes] of Object.entries(this.bindings)) {
      if (act === action) continue;
      const idx = codes.indexOf(code);
      if (idx !== -1) {
        this.bindings[act] = [...codes];
        this.bindings[act][idx] = null; // clear that slot
        wasDuplicate = true;
      }
    }

    const current = [...(this.bindings[action] || [null, null])];
    current[slot] = code;
    this.bindings[action] = current;

    this._saveBindings();
    return wasDuplicate ? 'duplicate' : 'ok';
  }

  /** Restore factory defaults and persist */
  resetBindings() {
    this.bindings = { ...DEFAULT_BINDINGS };
    this._saveBindings();
  }

  // ── Mobile Settings & Layout Application ──────────────────────────────────
  _applyMobileSettings() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const joystickBase = document.getElementById('joystick-container');
    const gamepad = document.getElementById('mobile-gamepad');

    if (this.mobileControlType === 'joystick') {
      if (btnLeft) btnLeft.style.display = 'none';
      if (btnRight) btnRight.style.display = 'none';
      if (joystickBase) joystickBase.style.display = 'flex';
    } else {
      if (btnLeft) btnLeft.style.display = 'flex';
      if (btnRight) btnRight.style.display = 'flex';
      if (joystickBase) joystickBase.style.display = 'none';
    }

    if (gamepad) {
      gamepad.style.setProperty('--gamepad-opacity', this.mobileOpacity);
    }
  }

  updateMobileControlType(type) {
    this.mobileControlType = type;
    localStorage.setItem('neon_runner_mobile_control_type', type);
    this._applyMobileSettings();
  }

  updateMobileOpacity(opacity) {
    this.mobileOpacity = opacity;
    localStorage.setItem('neon_runner_mobile_opacity', String(opacity));
    this._applyMobileSettings();
  }

  resetMobileSettings() {
    this.mobileControlType = 'buttons';
    this.mobileOpacity = 0.35;
    localStorage.setItem('neon_runner_mobile_control_type', 'buttons');
    localStorage.setItem('neon_runner_mobile_opacity', '0.35');
    this._applyMobileSettings();
  }

  // ── Key Dispatch ──────────────────────────────────────────────────────────
  _handleCode(code, isDown) {
    if (this.capturing) return; // Controls UI owns the keyboard right now

    for (const [action, codes] of Object.entries(this.bindings)) {
      if (!codes || !codes.includes(code)) continue;

      switch (action) {
        case 'left':  this.left  = isDown; break;
        case 'right': this.right = isDown; break;
        case 'jump':  this.jump  = isDown; break;
        case 'dash':
          this.dash     = isDown;
          this.dashDown = isDown;
          break;
        case 'pause':
          if (isDown && this.onPause) this.onPause();
          break;
      }
    }
  }

  _initKeyboardListeners() {
    const SCROLL_BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Switch dynamically to keyboard controls layout if key is pressed
      document.body.classList.remove('is-touch');
      document.body.classList.add('is-no-touch');

      if (SCROLL_BLOCK.has(e.code)) e.preventDefault();
      this._handleCode(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this._handleCode(e.code, false);
    });
  }

  _initTouchListeners() {
    const btnLeft  = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump  = document.getElementById('btn-jump');
    const btnDash  = document.getElementById('btn-dash');
    const joystickBase = document.getElementById('joystick-container');
    const joystickHandle = document.getElementById('joystick-handle');

    // Switch dynamically to touch controls layout upon screen tap
    window.addEventListener('touchstart', () => {
      document.body.classList.add('is-touch');
      document.body.classList.remove('is-no-touch');
    }, { passive: true });

    const bind = (el, setter) => {
      if (!el) return;
      el.addEventListener('touchstart',  (e) => { e.preventDefault(); setter(true);  }, { passive: false });
      el.addEventListener('touchend',    (e) => { e.preventDefault(); setter(false); }, { passive: false });
      el.addEventListener('touchcancel', (e) => { e.preventDefault(); setter(false); }, { passive: false });
      el.addEventListener('mousedown',  () => setter(true));
      el.addEventListener('mouseup',    () => setter(false));
      el.addEventListener('mouseleave', () => setter(false));
    };

    bind(btnLeft,  (v) => { this.left  = v; });
    bind(btnRight, (v) => { this.right = v; });
    bind(btnJump,  (v) => { this.jump  = v; });
    bind(btnDash,  (v) => { this.dash = v; this.dashDown = v; });

    // ── Joystick Touch & Mouse Listeners ────────────────────────────────────
    if (joystickBase && joystickHandle) {
      let touchId = null;
      let isMouseDragging = false;

      const updateJoystickPosition = (point) => {
        const rect = joystickBase.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let dx = point.clientX - cx;
        let dy = point.clientY - cy;

        const dist = Math.hypot(dx, dy);
        const maxDist = rect.width / 2 - 10;

        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
        }

        joystickHandle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        // Set horizontal input state based on slider/handle offset (with deadzone)
        const deadzone = 12;
        if (dx < -deadzone) {
          this.left  = true;
          this.right = false;
        } else if (dx > deadzone) {
          this.right = true;
          this.left  = false;
        } else {
          this.left  = false;
          this.right = false;
        }
      };

      const endJoystick = (e) => {
        if (touchId === null) return;
        let finished = false;
        if (e.type === 'touchend' || e.type === 'touchcancel') {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
              finished = true;
              break;
            }
          }
        } else {
          finished = true;
        }

        if (finished) {
          touchId = null;
          this.left = false;
          this.right = false;
          joystickBase.classList.remove('active');
          joystickHandle.style.transform = 'translate(-50%, -50%)';
        }
      };

      joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (touchId !== null) return;
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        joystickBase.classList.add('active');
        updateJoystickPosition(touch);
      }, { passive: false });

      joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (touchId === null) return;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === touchId) {
            updateJoystickPosition(e.touches[i]);
            break;
          }
        }
      }, { passive: false });

      joystickBase.addEventListener('touchend', endJoystick, { passive: false });
      joystickBase.addEventListener('touchcancel', endJoystick, { passive: false });

      // Mouse drag handlers for simulation on desktop browsers
      joystickBase.addEventListener('mousedown', (e) => {
        isMouseDragging = true;
        joystickBase.classList.add('active');
        updateJoystickPosition(e);
      });

      window.addEventListener('mousemove', (e) => {
        if (!isMouseDragging) return;
        updateJoystickPosition(e);
      });

      window.addEventListener('mouseup', () => {
        if (!isMouseDragging) return;
        isMouseDragging = false;
        this.left = false;
        this.right = false;
        joystickBase.classList.remove('active');
        joystickHandle.style.transform = 'translate(-50%, -50%)';
      });
    }
  }

  reset() {
    this.left     = false;
    this.right    = false;
    this.jump     = false;
    this.dash     = false;
    this.dashDown = false;
  }
}
