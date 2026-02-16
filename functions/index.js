const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

exports.makeFirstUserAdmin = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();

  try {
    const ambassadorsSnapshot = await db.collection("ambassadors").limit(1).get();

    // Hvis ingen ambassadører finnes
    if (ambassadorsSnapshot.empty) {
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
      console.log(`User ${user.email} is now SUPERADMIN`);
    } else {
      console.log("Admin already exists. Skipping.");
    }

  } catch (error) {
    console.error("Error setting admin claim:", error);
  }
});
