/** Hook that notifies when the framework has loaded. */
import { useEffect } from 'react';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

/**
 * Trigger a global callback once the React environment mounts.
 * Allows integration tests to detect when the app is ready.
 */
export function useFrameworkReady() {
  useEffect(() => {
    window.frameworkReady?.();
  });
}
