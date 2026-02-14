import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'DIN_API_KEY',
  authDomain: 'DIN_AUTH_DOMAIN',
  projectId: 'DIN_PROJECT_ID',
  storageBucket: 'DIN_STORAGE_BUCKET',
  messagingSenderId: 'DIN_SENDER_ID',
  appId: 'DIN_APP_ID'
};

function hasValidFirebaseConfig(config) {
  return Object.values(config).every((value) => value && !String(value).startsWith('DIN_'));
}


function getDomainVariants(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return [];

  if (host.startsWith('www.')) {
    return [host, host.replace(/^www\./, '')];
  }

  return [host, `www.${host}`];
}

function getFriendlyAuthError(error) {
  if (error?.code === 'auth/unauthorized-domain') {
    const domainHints = getDomainVariants(window.location.hostname).join(' og ');
    return `Innlogging feilet: Du logger inn fra ${window.location.hostname}, men dette domenet er ikke godkjent i Firebase Authentication. Legg til ${domainHints} i Firebase Console → Authentication → Settings → Authorized domains.`;
  }

  if (error?.code === 'auth/operation-not-allowed') {
    return 'Innlogging feilet: Google-innlogging er ikke aktivert i Firebase (Authentication → Sign-in method).';
  }

  if (error?.code === 'auth/popup-blocked') {
    return 'Innlogging feilet: Nettleseren blokkerte popup-vinduet. Tillat popup og prøv igjen.';
  }

  return `Innlogging feilet: ${error?.message || 'Ukjent feil.'}`;
}

export function initFirebaseAuth() {
  const loginGoogleBtn = document.querySelector('#loginGoogle');
  const registerGoogleBtn = document.querySelector('#registerGoogle');
  const authMessage = document.querySelector('#authMessage');

  if (!loginGoogleBtn || !registerGoogleBtn || !authMessage) return;

  if (!hasValidFirebaseConfig(firebaseConfig)) {
    authMessage.textContent = 'Legg inn Firebase-konfigurasjon i firebase-auth.js for å aktivere Google-innlogging.';
    return;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const { user } = result;

      const userRef = doc(db, 'ambassadors', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          status: 'pending',
          commission_total: 0,
          created_at: serverTimestamp()
        });
      }

      authMessage.textContent = `Innlogget som ${user.displayName}`;
    } catch (error) {
      authMessage.textContent = getFriendlyAuthError(error);
    }
  };

  loginGoogleBtn.addEventListener('click', loginWithGoogle);
  registerGoogleBtn.addEventListener('click', loginWithGoogle);

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    authMessage.textContent = `Innlogget: ${user.email}`;
  });
}
