const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

// The map layout is defined on the server so the AI can see it.
const mapLayout = [
    "####################################",
    "#..T.........B............T...T....#",
    "#..TT........H................TT...#",
    "#...T................B.............#",
    "#...................~~~~...........#",
    "#..................~~~~~~..........#",
    "#..T...............~~~~............#",
    "#..TT..............................#",
    "#...........B..........H........T..#",
    "#..................................#",
    "#...T...T....................TT....#",
    "####################################",
];

// Define which tiles villagers can walk on
const walkableTiles = [".", "H", "B"];

// A helper function to find the nearest tile of a certain type
function findNearest(startX, startY, targetTile) {
    let nearest = null;
    let minDistance = Infinity;

    for (let y = 0; y < mapLayout.length; y++) {
        for (let x = 0; x < mapLayout[y].length; x++) {
            if (mapLayout[y][x] === targetTile) {
                const distance = Math.abs(startX - x) + Math.abs(startY - y);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = { x, y };
                }
            }
        }
    }
    return nearest;
}

exports.tick = onSchedule("every 1 minutes", async (event) => {
  console.log("Heartbeat tick has started!");

  const db = admin.database();
  const villagersRef = db.ref("/villagers");

  const snapshot = await villagersRef.once("value");
  const villagersData = snapshot.val() || {};
  
  // Create a set of all currently occupied tiles for quick lookups
  const occupiedTiles = new Set();
  Object.values(villagersData).forEach(v => {
      occupiedTiles.add(`${v.x},${v.y}`);
  });

  const updates = {};
  const villagerIds = Object.keys(villagersData);

  for (const villagerId of villagerIds) {
      const villager = villagersData[villagerId];
      
      let newAction = villager.action || "Wandering";

      // AI Needs & Social Logic... (This part remains the same)
      if (villager.needs.energy < 20) {
        newAction = "Resting";
      } else if (villager.needs.hunger > 80) {
        newAction = "Eating";
      } else if (villager.needs.hunger > 50) {
        newAction = "Foraging";
      } else if (villager.needs.energy >= 100 && villager.action === "Resting") {
        newAction = "Wandering";
      }
      
      updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 100) - 2;
      updates[`/${villagerId}/needs/hunger`] = (villager.needs.hunger || 0) + 1;
      
      let newX = villager.x;
      let newY = villager.y;
      
      if (newAction === "Wandering") {
          const direction = Math.floor(Math.random() * 4);
          if (direction === 0) newY--;
          if (direction === 1) newX++;
          if (direction === 2) newY++;
          if (direction === 3) newX--;
      }
      
      // Other action handling (Resting, Foraging, etc.) would go here...

      // Collision Detection & Final Updates
      if (newX !== villager.x || newY !== villager.y) {
          const targetTile = mapLayout[newY]?.[newX];
          const targetTileKey = `${newX},${newY}`;

          if (walkableTiles.includes(targetTile) && !occupiedTiles.has(targetTileKey)) {
              updates[`/${villagerId}/x`] = newX;
              updates[`/${villagerId}/y`] = newY;
              occupiedTiles.delete(`${villager.x},${villager.y}`);
              occupiedTiles.add(targetTileKey);
          }
      }
      updates[`/${villagerId}/action`] = newAction;
  }

  if (Object.keys(updates).length > 0) {
      await villagersRef.update(updates);
  }

  console.log("Heartbeat tick has finished.");
});