export function captureReferral() {
  const path = window.location.pathname;

  if (path.startsWith('/a/')) {
    const ambassadorId = path.split('/a/')[1];
    localStorage.setItem('ambassadorRef', ambassadorId);
  }
}
