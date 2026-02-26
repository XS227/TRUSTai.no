const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const uid = 'cyGngARJUgNBxrTaFkA6EFKhfwp2';

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
