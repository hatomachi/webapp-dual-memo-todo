import { useState, useEffect } from 'react';

/**
 * Hook to track window.visualViewport height in real time.
 * On mobile devices (iOS Safari, Android Chrome), when the virtual keyboard appears,
 * window.visualViewport.height shrinks to match the visible area above the keyboard.
 *
 * This allows the app to dynamically resize to fit the visible area,
 * docking the bottom toolbar directly on top of the virtual keyboard (like native Obsidian).
 */
export function useVisualViewport(): number | null {
  const [viewportHeight, setViewportHeight] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return null;
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setViewportHeight(vv.height);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);

    // Initial measure
    handleResize();

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewportHeight;
}
