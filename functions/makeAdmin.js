const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const uid = 'zEaweky04Zd1iSZUhB5lyiUD1J92';

admin
  .auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log('You are now SUPERADMIN');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed setting admin claim:', error.message);
    process.exit(1);
  });
