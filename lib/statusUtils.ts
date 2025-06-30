/** Formatting helpers for match status and dates. */
/**
 * Map a match status value to a themed color string.
 * Used for rendering status labels and indicators.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'inProgress':
    case 'paused':
      return '#10B981';
    case 'upcoming':
      return '#F59E0B';
    case 'completed':
      return '#6B7280';
    default:
      return '#6B7280';
  }
}

/**
 * Convert a status code into a short uppercase text label.
 * Supports live, upcoming and completed values.
 */
export function getStatusText(status: string): string {
  switch (status) {
    case 'inProgress':
      return 'LIVE';
    case 'paused':
      return 'GEPAUZEERD';
    case 'upcoming':
      return 'AANKOMEND';
    case 'completed':
      return 'AFGEROND';
    default:
      return status.toUpperCase();
  }
}

/**
 * Format a date string into a human friendly short date.
 * Locale is Dutch to match the rest of the UI.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string into a two-digit hour and minute time.
 * Also uses Dutch locale for consistency across the app.
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('nl-NL', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
