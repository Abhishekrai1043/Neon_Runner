export const mobileConfig = {
  type: 'mobile',
  inputProfile: 'touch',
  uiScale: 1.5,
  assetScale: 0.8,
  touchMargin: 12,
  layout: {
    'btn-left': { display: 'flex', left: '2vw', top: 'calc(100vh - 18vh)' },
    'btn-right': { display: 'flex', left: '18vw', top: 'calc(100vh - 18vh)' },
    'btn-dash': { display: 'flex', left: 'calc(100vw - 32vw)', top: 'calc(100vh - 18vh)' },
    'btn-jump': { display: 'flex', left: 'calc(100vw - 16vw)', top: 'calc(100vh - 18vh)' },
    'joystick-container': { left: '4vw', top: 'calc(100vh - 20vh)' },
    'hud-left-group': { left: '2vw', top: '2vh' },
    'hud-right-cluster': { right: '2vw', top: '2vh', left: 'auto' },
    'hud-level-panel': { left: '50%', top: '2vh', transform: 'translateX(-50%)' }
  }
};
