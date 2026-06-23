export class LayoutEditor {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('layout-editor-overlay');
    this.isActive = false;
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };
    
    this.targets = [
      'mobile-left-group',
      'mobile-right-group',
      'joystick-container',
      'hud-left-group',
      'hud-level-panel',
      'hud-right-cluster'
    ];

    this.layout = this._loadLayout();

    this._bindEvents();
  }

  _bindEvents() {
    const btnReset = document.getElementById('le-reset-btn');
    const btnSave = document.getElementById('le-save-btn');
    
    if (btnReset) btnReset.addEventListener('click', () => this.resetLayout());
    if (btnSave) btnSave.addEventListener('click', () => this.closeEditor());

    document.querySelectorAll('.le-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._applyPreset(e.target.dataset.preset);
      });
    });

    // Pointer events for dragging
    document.addEventListener('pointerdown', this._onPointerDown.bind(this), { passive: false });
    document.addEventListener('pointermove', this._onPointerMove.bind(this), { passive: false });
    document.addEventListener('pointerup', this._onPointerUp.bind(this));
    document.addEventListener('pointercancel', this._onPointerUp.bind(this));
  }

  _loadLayout() {
    try {
      const saved = localStorage.getItem('neon_runner_layout');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  _saveLayout() {
    localStorage.setItem('neon_runner_layout', JSON.stringify(this.layout));
  }

  openEditor(onDoneCallback) {
    this.isActive = true;
    this.onDoneCallback = onDoneCallback;
    if (this.overlay) this.overlay.style.display = 'flex';

    // Force show gamepad and HUD during edit
    document.getElementById('mobile-gamepad').style.display = 'block';
    document.getElementById('hud').style.display = 'block';
    // Remove pointer-events none from gamepad wrapper so we can drag it
    document.getElementById('mobile-gamepad').style.pointerEvents = 'auto';

    // Hide pause menu if open
    const pm = document.getElementById('pause-menu');
    if (pm) {
      this.originalPauseMenuDisplay = pm.style.display;
      pm.style.display = 'none';
    }

    this.targets.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('layout-draggable');
        // Ensure absolute positioning during drag if not already
        if (!el.style.position || el.style.position !== 'absolute') {
          const rect = el.getBoundingClientRect();
          el.style.position = 'absolute';
          // Temporarily lock current absolute coordinates before drag
          el.style.left = `${rect.left}px`;
          el.style.top = `${rect.top}px`;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.transform = 'none';
          el.style.margin = '0';
        }
      }
    });
  }

  closeEditor() {
    this.isActive = false;
    if (this.overlay) this.overlay.style.display = 'none';

    document.getElementById('mobile-gamepad').style.pointerEvents = '';
    
    // Hide gamepad if not on touch
    if (!document.body.classList.contains('is-touch')) {
       document.getElementById('mobile-gamepad').style.display = '';
    }

    // Restore pause menu visibility
    const pm = document.getElementById('pause-menu');
    if (pm && this.originalPauseMenuDisplay !== undefined) {
      pm.style.display = this.originalPauseMenuDisplay;
    }

    this.targets.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('layout-draggable');
        el.classList.remove('layout-dragging');
      }
    });

    this._saveLayout();
    this.applyLayout(); // re-apply properly

    if (this.onDoneCallback) this.onDoneCallback();
  }

  applyLayout() {
    this.layout = this._loadLayout();
    
    this.targets.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const pos = this.layout[id];
      if (pos) {
        el.style.position = 'absolute';
        el.style.left = pos.left;
        el.style.top = pos.top;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
        el.style.margin = '0';
      } else {
        // Reset to CSS defaults
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.transform = '';
        el.style.margin = '';
      }
    });
  }

  resetLayout() {
    this.layout = {};
    this._saveLayout();
    this.applyLayout();
    
    // If editor is open, re-init the absolute coordinates for dragging
    if (this.isActive) {
      this.targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          el.style.position = 'absolute';
          el.style.left = `${rect.left}px`;
          el.style.top = `${rect.top}px`;
        }
      });
    }
  }

  _applyPreset(preset) {
    // Some rough predefined positions
    const presets = {
      '2thumb': {
        'mobile-left-group': { left: '32px', top: 'calc(100% - 110px)' },
        'mobile-right-group': { left: 'calc(100% - 190px)', top: 'calc(100% - 110px)' },
        'joystick-container': { left: '32px', top: 'calc(100% - 150px)' },
        'hud-left-group': { left: '16px', top: '16px' },
        'hud-right-cluster': { left: 'calc(100% - 130px)', top: '16px' }
      },
      'claw': {
        'mobile-left-group': { left: '32px', top: 'calc(100% - 110px)' },
        'mobile-right-group': { left: '16px', top: '60px' }, // Moved up for left index finger
        'joystick-container': { left: '32px', top: 'calc(100% - 150px)' },
        'hud-left-group': { left: '16px', top: '16px' },
        'hud-right-cluster': { left: 'calc(100% - 130px)', top: '16px' }
      }
    };

    if (presets[preset]) {
      this.layout = { ...this.layout, ...presets[preset] };
      this.applyLayout();
      
      // Re-trigger absolute coords for active editor
      if (this.isActive) {
        this.targets.forEach(id => {
          const el = document.getElementById(id);
          if (el && this.layout[id]) {
            el.style.position = 'absolute';
            el.style.left = this.layout[id].left;
            el.style.top = this.layout[id].top;
          }
        });
      }
    }
  }

  _onPointerDown(e) {
    if (!this.isActive) return;
    
    // Find if we clicked on a draggable target
    const target = e.target.closest('.layout-draggable');
    if (target) {
      e.preventDefault();
      this.dragTarget = target;
      target.classList.add('layout-dragging');
      
      // Calculate offset from top-left of element
      const rect = target.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
    }
  }

  _onPointerMove(e) {
    if (!this.isActive || !this.dragTarget) return;
    e.preventDefault();

    let x = e.clientX - this.dragOffset.x;
    let y = e.clientY - this.dragOffset.y;

    // Clamp to viewport
    const rect = this.dragTarget.getBoundingClientRect();
    x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
    y = Math.max(0, Math.min(y, window.innerHeight - rect.height));

    this.dragTarget.style.left = `${x}px`;
    this.dragTarget.style.top = `${y}px`;
  }

  _onPointerUp(e) {
    if (!this.isActive || !this.dragTarget) return;
    
    // Save new position
    const id = this.dragTarget.id;
    if (id) {
      // Convert to percentages for better cross-device scaling
      const vw = (parseFloat(this.dragTarget.style.left) / window.innerWidth) * 100;
      const vh = (parseFloat(this.dragTarget.style.top) / window.innerHeight) * 100;
      
      this.layout[id] = {
        left: `${vw.toFixed(2)}vw`,
        top: `${vh.toFixed(2)}vh`
      };
    }

    this.dragTarget.classList.remove('layout-dragging');
    this.dragTarget = null;
  }
}
