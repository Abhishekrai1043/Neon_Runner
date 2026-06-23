import { desktopConfig } from './desktopConfig.js';
import { tabletConfig } from './tabletConfig.js';
import { mobileConfig } from './mobileConfig.js';

export function getActiveConfig() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // If width is larger than height and device is not strictly mobile/tablet, it could be desktop.
  if (!isTouch && w >= 1024) {
    return desktopConfig;
  } else if (w >= 768 && h >= 500) {
    return tabletConfig;
  } else {
    return mobileConfig;
  }
}
