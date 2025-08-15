const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

// The map layout is defined on the server so the AI can see it.
const mapLayout = [
    "####################################",
    "#..T......................T...T....#",
    "#..TT........H................TT...#",
    "#...T..............................#",
    "#...................~~~~...........#",
    "#..................~~~~~~..........#",
    "#..T...............~~~~............#",
    "#..TT..............................#",
    "#......................H........T..#",
    "#..................................#",
    "#...T...T....................TT....#",
    "####################################",
];

// Define which tiles villagers can walk on
const walkableTiles = [".", "H"];

exports.tick = onSchedule("every 1 minutes", async (event) => {
  console.log("Heartbeat tick has started!");

  const db = admin.database();
  const villagersRef = db.ref("/villagers");

  const snapshot = await villagersRef.once("value");
  const villagersData = snapshot.val();

  const updates = {};

  for (const villagerId in villagersData) {
    if (Object.prototype.hasOwnProperty.call(villagersData, villagerId)) {
      const villager = villagersData[villagerId];
      let currentAction = villager.action;
      let currentEnergy = villager.needs.energy;

      // --- AI Decision Making ---

      // 1. Check if the villager is tired
      if (currentEnergy < 20) {
        currentAction = "Resting";
      }
      // 2. Check if the villager has rested enough
      else if (currentEnergy >= 100) {
        currentAction = "Wandering";
      }

      // --- Action Handling ---

      if (currentAction === "Resting") {
        // Replenish energy while resting
        currentEnergy += 10;
        // Ensure energy doesn't go over 100
        if (currentEnergy > 100) currentEnergy = 100;

        // Prepare updates for the database
        updates[`/${villagerId}/action`] = "Resting";
        updates[`/${villagerId}/needs/energy`] = currentEnergy;

      } else { // Default action is Wandering
        // Deplete energy while wandering
        currentEnergy -= 2;

        const direction = Math.floor(Math.random() * 4);
        let newX = villager.x;
        let newY = villager.y;

        if (direction === 0) newY--; // Move up
        if (direction === 1) newX++; // Move right
        if (direction === 2) newY++; // Move down
        if (direction === 3) newX--; // Move left
        
        // Collision Detection
        const targetTile = mapLayout[newY]?.[newX];
        if (walkableTiles.includes(targetTile)) {
          // If the move is valid, prepare the position update
          updates[`/${villagerId}/x`] = newX;
          updates[`/${villagerId}/y`] = newY;
        }

        // Prepare other updates for the database
        updates[`/${villagerId}/action`] = "Wandering";
        updates[`/${villagerId}/needs/energy`] = currentEnergy;
      }
    }
  }

  // Execute all updates simultaneously
  if (Object.keys(updates).length > 0) {
      await villagersRef.update(updates);
  }

  console.log("Heartbeat tick has finished.");
});