const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// Initialize our connection to the Firebase Admin SDK
admin.initializeApp();

/**
 * This is our "Heartbeat" function that will run on a schedule.
 * It reads all villager data, decides their next move, and updates the database.
 */
exports.tick = onSchedule("every 1 minutes", async (event) => {
  console.log("Heartbeat tick has started!");

  const db = admin.database();
  const villagersRef = db.ref("/villagers");

  // Get the current list of all villagers
  const snapshot = await villagersRef.once("value");
  const villagersData = snapshot.val();

  const updates = {};

  for (const villagerId in villagersData) {
    if (Object.prototype.hasOwnProperty.call(villagersData, villagerId)) {
      const villager = villagersData[villagerId];

      // --- Simple "Wander" AI ---
      const direction = Math.floor(Math.random() * 4);
      let newX = villager.x;
      let newY = villager.y;

      if (direction === 0) newY--; // Move up
      if (direction === 1) newX++; // Move right
      if (direction === 2) newY++; // Move down
      if (direction === 3) newX--; // Move left

      updates[`/${villagerId}/x`] = newX;
      updates[`/${villagerId}/y`] = newY;
    }
  }

  await villagersRef.update(updates);

  console.log("Heartbeat tick has finished.");
});