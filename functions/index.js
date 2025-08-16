const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

function findNearest(startX, startY, mapLayout, targetTile) {
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
    console.log("Server AI Tick (Brain): Making high-level decisions.");

    const db = admin.database();
    const rootRef = db.ref();
    const snapshot = await rootRef.once("value");
    const data = snapshot.val() || {};
    
    const villagersData = data.villagers || {};
    let mapLayout = data.map || [];
    
    const updates = {};
    const villagerIds = Object.keys(villagersData);

    for (const villagerId of villagerIds) {
        const villager = villagersData[villagerId];
        let newAction = villager.action || "Wandering";

        // Trait-based thresholds
        const hungerThreshold = villager.trait === 'Ambitious' ? 30 : 50;
        const energyThreshold = villager.trait === 'Easygoing' ? 10 : 20;
        const energyDrain = villager.trait === 'Ambitious' ? 3 : 2;
        const energyGain = villager.trait === 'Easygoing' ? 15 : 10;

        // AI makes a high-level decision based on needs
        if (villager.needs.energy < energyThreshold) {
            newAction = "Resting";
        } else if (villager.needs.hunger > 80) {
            newAction = "Eating";
        } else if (villager.needs.hunger > hungerThreshold) {
            newAction = "Foraging";
        } else if (villager.needs.energy >= 100 && villager.action === "Resting") {
            newAction = "Wandering";
        }
        
        // The server sets a TARGET, not the current position
        let targetX = villager.targetX ?? villager.x;
        let targetY = villager.targetY ?? villager.y;

        if (newAction === "Foraging") {
            const nearestBush = findNearest(villager.x, villager.y, mapLayout, "B");
            if (nearestBush) {
                targetX = nearestBush.x;
                targetY = nearestBush.y;
            }
        } else if (newAction === "Resting") {
            const nearestHouse = findNearest(villager.x, villager.y, mapLayout, "H");
            if (nearestHouse) {
                targetX = nearestHouse.x;
                targetY = nearestHouse.y;
            }
        } else if (newAction === "Wandering") {
            // Find a random walkable spot to wander to if current target is reached
            if (villager.x === targetX && villager.y === targetY) {
                const emptySpots = [];
                for (let y = 0; y < mapLayout.length; y++) {
                    for (let x = 0; x < mapLayout[y].length; x++) {
                        if (walkableTiles.includes(mapLayout[y][x])) emptySpots.push({x, y});
                    }
                }
                if (emptySpots.length > 0) {
                    const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
                    targetX = spot.x;
                    targetY = spot.y;
                }
            }
        }
        
        // Handle immediate state changes when a target is reached
        if (villager.x === targetX && villager.y === targetY) {
            if (newAction === "Foraging") {
                updates[`/${villagerId}/inventory/food`] = 5;
                const row = mapLayout[villager.y];
                mapLayout[villager.y] = row.substring(0, villager.x) + '.' + row.substring(villager.x + 1);
                newAction = "Eating"; // Next goal is to eat
            } else if (newAction === "Resting") {
                updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 0) + energyGain;
            }
        }
        if (newAction === "Eating" && (villager.inventory?.food || 0) > 0) {
            updates[`/${villagerId}/inventory/food`] = 0;
            updates[`/${villagerId}/needs/hunger`] = 0;
            newAction = "Wandering";
        }

        // Update needs
        updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 100) - energyDrain;
        updates[`/${villagerId}/needs/hunger`] = (villager.needs.hunger || 0) + 1;

        // Set the final decision in the database
        updates[`/${villagerId}/action`] = newAction;
        updates[`/${villagerId}/targetX`] = targetX;
        updates[`/${villagerId}/targetY`] = targetY;
    }

    // Resource Regrowth Logic
    if (Math.random() < 0.1) {
        const emptySpots = [];
        for (let y = 0; y < mapLayout.length; y++) {
            for (let x = 0; x < mapLayout[y].length; x++) {
                if (mapLayout[y][x] === '.') emptySpots.push({x, y});
            }
        }
        if (emptySpots.length > 0) {
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            const row = mapLayout[spot.y];
            mapLayout[spot.y] = row.substring(0, spot.x) + 'B' + row.substring(spot.x + 1);
        }
    }
    
    // Apply all updates to the database
    await db.ref('/villagers').update(updates);
    await db.ref('/map').set(mapLayout);
});