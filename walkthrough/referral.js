function normalizeReferralCode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized) return '';
  return normalized.startsWith('amb') ? normalized : `amb${normalized.slice(0, 8)}`;
}

function extractReferralCode(pathname) {
  const path = String(pathname || '');
  const legacyMatch = path.match(/\/a\/([^/?#]+)/i);
  if (legacyMatch?.[1]) {
    return normalizeReferralCode(decodeURIComponent(legacyMatch[1]));
  }

  const shortMatch = path.match(/\/(amb[0-9a-z]+)(?:\/|$|\?|#)/i);
  if (shortMatch?.[1]) {
    return normalizeReferralCode(decodeURIComponent(shortMatch[1]));
  }

  return '';
}

function setReferralCookie(value, days = 90) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `ambassadorRef=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function captureReferral() {
  const referralCode = extractReferralCode(window.location.pathname);
  if (!referralCode) return;

  if (!localStorage.getItem('ambassadorRef')) {
    localStorage.setItem('ambassadorRef', referralCode);
  }

  setReferralCookie(referralCode);
}
