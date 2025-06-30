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

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('nl-NL', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
