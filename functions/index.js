const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

// The old dialogue and findNearest functions have been removed.

exports.tick = onSchedule("every 1 minutes", async (event) => {
    const db = admin.database();
    const rootRef = db.ref();
    const snapshot = await rootRef.once("value");
    const data = snapshot.val() || {};
    
    const villagersData = data.villagers || {};
    const mapLayout = data.map || [];
    
    const updates = {};
    const villagerIds = Object.keys(villagersData);

    for (const villagerId of villagerIds) {
        const villager = villagersData[villagerId];

        // If a villager is idle (has no goal), make them wander.
        // This is the only behavior in Phase 1.
        if (!villager.activeSocialGoal) {
            // Check if they have arrived at their current wandering target
            if (villager.x === villager.targetX && villager.y === villager.targetY) {
                const emptySpots = [];
                for (let y = 0; y < mapLayout.length; y++) {
                    for (let x = 0; x < mapLayout[y].length; x++) {
                        if (walkableTiles.includes(mapLayout[y][x])) emptySpots.push({x, y});
                    }
                }
                if (emptySpots.length > 0) {
                    const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
                    updates[`/${villagerId}/targetX`] = spot.x;
                    updates[`/${villagerId}/targetY`] = spot.y;
                    updates[`/${villagerId}/action`] = "Wandering";
                }
            }
        }
        // All logic for needs, foraging, resting, etc., has been removed.
    }
    
    // The resource regrowth logic can be kept, but is less critical now.
    if (Math.random() < 0.1) {
        let bushCount = 0;
        const emptySpots = [];
        for (let y = 0; y < mapLayout.length; y++) {
            for (let x = 0; x < mapLayout[y].length; x++) {
                if (mapLayout[y][x] === '.') emptySpots.push({x, y});
                if (mapLayout[y][x] === 'B') bushCount++;
            }
        }
        if (bushCount < 10 && emptySpots.length > 0) {
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            const row = mapLayout[spot.y];
            mapLayout[spot.y] = row.substring(0, spot.x) + 'B' + row.substring(spot.x + 1);
        }
    }
    
    if (Object.keys(updates).length > 0) {
        await db.ref('/villagers').update(updates);
    }
    await db.ref('/map').set(mapLayout); // We keep map updates
});
