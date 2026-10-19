import { useState, useEffect } from 'react';

export interface ViewportMetrics {
  innerHeight: number;
  vvHeight: number;
  vvOffsetTop: number;
  scrollY: number;
  isKeyboardOpen: boolean;
}

/**
 * Tracks window.visualViewport height and offsetTop in real time.
 *
 * Key design for iOS Safari / PWA:
 * 1. Synchronously writes `--vv-height` and `--vv-offset-top` to document.documentElement
 *    so the fixed app shell tracks the visual viewport without React re-render lag.
 * 2. Offsets the app shell by `vv.offsetTop` so when iOS Safari pans the visual viewport
 *    downward on textarea focus, the header never clips off-screen and no white gap
 *    appears below the bottom toolbar.
 * 3. Detects whether the mobile virtual keyboard is open so headers can auto-collapse
 *    to maximize visible editor lines.
 */
export function useVisualViewport(): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => {
    if (typeof window === 'undefined') {
      return {
        innerHeight: 0,
        vvHeight: 0,
        vvOffsetTop: 0,
        scrollY: 0,
        isKeyboardOpen: false,
      };
    }
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    document.documentElement.style.setProperty('--vv-height', `${h}px`);
    document.documentElement.style.setProperty('--vv-offset-top', `${top}px`);
    return {
      innerHeight: Math.round(window.innerHeight),
      vvHeight: Math.round(h),
      vvOffsetTop: Math.round(top),
      scrollY: Math.round(window.scrollY),
      isKeyboardOpen: false,
    };
  });

  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let blurResetTimer: number | null = null;

    const update = () => {
      const currentInnerHeight = window.innerHeight;
      const height = vv ? vv.height : currentInnerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      const currentScrollY = window.scrollY;

      // Synchronously update CSS variables for immediate layout positioning
      root.style.setProperty('--vv-height', `${height}px`);
      root.style.setProperty('--vv-offset-top', `${offsetTop}px`);

      const activeTag = document.activeElement?.tagName;
      const isInputFocused = activeTag === 'TEXTAREA' || activeTag === 'INPUT';
      const isMobileWidth = window.innerWidth < 640;
      const heightDiff = currentInnerHeight - height;
      const isShrunk =
        heightDiff > 100 || (isMobileWidth && height < window.screen.height * 0.68);
      const isKeyboardOpen = isMobileWidth && isInputFocused && isShrunk;

      setMetrics((prev) => {
        const nextInner = Math.round(currentInnerHeight);
        const nextVvH = Math.round(height);
        const nextTop = Math.round(offsetTop);
        const nextScrollY = Math.round(currentScrollY);
        if (
          prev.innerHeight === nextInner &&
          prev.vvHeight === nextVvH &&
          prev.vvOffsetTop === nextTop &&
          prev.scrollY === nextScrollY &&
          prev.isKeyboardOpen === isKeyboardOpen
        ) {
          return prev;
        }
        return {
          innerHeight: nextInner,
          vvHeight: nextVvH,
          vvOffsetTop: nextTop,
          scrollY: nextScrollY,
          isKeyboardOpen,
        };
      });
    };

    const handleFocusOut = () => {
      update();
      if (blurResetTimer !== null) {
        window.clearTimeout(blurResetTimer);
      }
      blurResetTimer = window.setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        const isInputFocused = activeTag === 'TEXTAREA' || activeTag === 'INPUT';
        if (!isInputFocused && window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
        update();
      }, 100);
    };

    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', handleFocusOut);

    update();

    return () => {
      if (blurResetTimer !== null) {
        window.clearTimeout(blurResetTimer);
      }
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return metrics;
}
