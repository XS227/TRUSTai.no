function extractReferralCode(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);

  if (!parts.length) return '';

  const aIndex = parts.lastIndexOf('a');
  if (aIndex >= 0 && parts[aIndex + 1]) {
    return decodeURIComponent(parts[aIndex + 1]).trim().toUpperCase();
  }

  return decodeURIComponent(parts[parts.length - 1]).trim().toUpperCase();
}

export function captureReferral() {
  const ambassadorId = extractReferralCode(window.location.pathname);
  if (!ambassadorId) return;

  if (!localStorage.getItem('ambassadorRef')) {
    localStorage.setItem('ambassadorRef', ambassadorId);
  }
}
