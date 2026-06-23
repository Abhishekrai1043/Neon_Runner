export const mobileConfig = {
  type: 'mobile',
  inputProfile: 'touch',
  uiScale: 1.5,
  assetScale: 0.8,
  touchMargin: 12,
  layout: {
    'btn-left': { display: 'flex', left: 'max(32px, env(safe-area-inset-left))', top: 'auto', bottom: 'max(32px, env(safe-area-inset-bottom))' },
    'btn-right': { display: 'flex', left: 'max(130px, calc(env(safe-area-inset-left) + 98px))', top: 'auto', bottom: 'max(32px, env(safe-area-inset-bottom))' },
    'btn-dash': { display: 'flex', right: 'max(130px, calc(env(safe-area-inset-right) + 98px))', left: 'auto', top: 'auto', bottom: 'max(32px, env(safe-area-inset-bottom))' },
    'btn-jump': { display: 'flex', right: 'max(32px, env(safe-area-inset-right))', left: 'auto', top: 'auto', bottom: 'max(32px, env(safe-area-inset-bottom))' },
    'joystick-container': { left: 'max(32px, env(safe-area-inset-left))', top: 'auto', bottom: 'max(32px, env(safe-area-inset-bottom))' },
    'hud-left-group': { left: 'max(16px, env(safe-area-inset-left))', top: 'max(16px, env(safe-area-inset-top))' },
    'hud-right-cluster': { right: 'max(16px, env(safe-area-inset-right))', left: 'auto', top: 'max(16px, env(safe-area-inset-top))' },
    'hud-level-panel': { left: '50%', top: 'max(16px, env(safe-area-inset-top))', transform: 'translateX(-50%)' }
  }
};
