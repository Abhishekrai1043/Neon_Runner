export const tabletConfig = {
  type: 'tablet',
  inputProfile: 'touch',
  uiScale: 1.2,
  assetScale: 1.0,
  touchMargin: 24,
  layout: {
    'btn-left': { display: 'flex', left: '4vw', top: 'calc(100vh - 12vh)' },
    'btn-right': { display: 'flex', left: '14vw', top: 'calc(100vh - 12vh)' },
    'btn-dash': { display: 'flex', left: 'calc(100vw - 22vw)', top: 'calc(100vh - 12vh)' },
    'btn-jump': { display: 'flex', left: 'calc(100vw - 10vw)', top: 'calc(100vh - 12vh)' },
    'joystick-container': { left: '4vw', top: 'calc(100vh - 15vh)' },
    'hud-left-group': { left: '2vw', top: '2vh' },
    'hud-right-cluster': { right: '2vw', top: '2vh', left: 'auto' },
    'hud-level-panel': { left: '50%', top: '2vh', transform: 'translateX(-50%)' }
  }
};
