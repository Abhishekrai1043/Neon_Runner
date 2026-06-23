export const tabletConfig = {
  type: 'tablet',
  inputProfile: 'touch',
  uiScale: 1.2,
  assetScale: 1.0,
  touchMargin: 24,
  layout: {
    'btn-left': { display: 'flex', left: 'max(40px, env(safe-area-inset-left))', top: 'auto', bottom: 'max(40px, env(safe-area-inset-bottom))' },
    'btn-right': { display: 'flex', left: 'max(150px, calc(env(safe-area-inset-left) + 110px))', top: 'auto', bottom: 'max(40px, env(safe-area-inset-bottom))' },
    'btn-dash': { display: 'flex', right: 'max(150px, calc(env(safe-area-inset-right) + 110px))', left: 'auto', top: 'auto', bottom: 'max(40px, env(safe-area-inset-bottom))' },
    'btn-jump': { display: 'flex', right: 'max(40px, env(safe-area-inset-right))', left: 'auto', top: 'auto', bottom: 'max(40px, env(safe-area-inset-bottom))' },
    'joystick-container': { left: 'max(40px, env(safe-area-inset-left))', top: 'auto', bottom: 'max(40px, env(safe-area-inset-bottom))' },
    'hud-left-group': { left: 'max(24px, env(safe-area-inset-left))', top: 'max(24px, env(safe-area-inset-top))' },
    'hud-right-cluster': { right: 'max(24px, env(safe-area-inset-right))', left: 'auto', top: 'max(24px, env(safe-area-inset-top))' },
    'hud-level-panel': { left: '50%', top: 'max(24px, env(safe-area-inset-top))', transform: 'translateX(-50%)' }
  }
};
