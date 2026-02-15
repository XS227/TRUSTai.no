export function captureReferral() {
  const path = window.location.pathname;

  const match = String(path || '').match(/\/a\/([^/?#]+)/i);
  if (match?.[1]) {
    const ambassadorId = decodeURIComponent(match[1]).trim().toUpperCase();
    if (!localStorage.getItem('ambassadorRef')) {
      localStorage.setItem('ambassadorRef', ambassadorId);
    }
  }
}
