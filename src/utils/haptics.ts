/**
 * Safely triggers haptic feedback on devices supporting the Vibration API.
 * Uses fallback/silent behavior on non-supporting browsers/devices.
 */
export function triggerHaptic(pattern: number | number[] = 40) {
  if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration blocker exceptions in sandbox iframes gracefully
    }
  }
}
