const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

const dialogueTemplates = {
    compliment: [
        "You look great today, [TARGET_NAME]!",
        "I really like your style.",
        "It's always nice to see you around.",
        "You have a great energy about you!",
    ],
};

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

    const occupiedTiles = new Set();
    villagerIds.forEach(id => {
        const v = villagersData[id];
        occupiedTiles.add(`${v.x},${v.y}`);
    });

    for (const villagerId of villagerIds) {
        const villager = villagersData[villagerId];
        let newAction = villager.action || "Wandering";

        const hungerThreshold = villager.trait === 'Ambitious' ? 30 : 50;
        const energyThreshold = villager.trait === 'Easygoing' ? 10 : 20;
        const energyDrain = villager.trait === 'Ambitious' ? 3 : 2;
        const energyGain = villager.trait === 'Easygoing' ? 15 : 10;

        // 1. Needs-Based AI Decision
        if (villager.needs.energy < energyThreshold) {
            newAction = "Resting";
        } else if (villager.needs.hunger > 80) {
            newAction = "Eating";
        } else if (villager.needs.hunger > hungerThreshold) {
            newAction = "Foraging";
        } else if (villager.needs.energy >= 100 && villager.action === "Resting") {
            newAction = "Wandering";
        }

        // 2. Social AI (if not busy with a need)
        if (newAction === "Wandering") {
            for (const otherId of villagerIds) {
                if (villagerId === otherId || villagersData[otherId].action !== "Wandering") continue;

                const otherVillager = villagersData[otherId];
                const distance = Math.abs(villager.x - otherVillager.x) + Math.abs(villager.y - otherVillager.y);

                if (distance <= 2) {
                    let complimentChance = 0.1; // Base chance
                    if (villager.romanticInterest === otherId) complimentChance = 0.5;
                    else if ((villager.relationships?.[otherId] || 0) > 50) complimentChance = 0.3;
                    
                    if (Math.random() < complimentChance) {
                        newAction = "Talking";
                        const template = dialogueTemplates.compliment[Math.floor(Math.random() * dialogueTemplates.compliment.length)];
                        const dialogueText = template.replace("[TARGET_NAME]", otherVillager.name);
                        
                        updates[`/${villagerId}/dialogue`] = dialogueText;
                        setTimeout(() => db.ref(`/villagers/${villagerId}/dialogue`).set(null), 5000);

                        updates[`/${villagerId}/relationships/${otherId}`] = (villager.relationships?.[otherId] || 0) + 10;
                    }
                    break;
                }
            }
        }

        // 3. Action & Movement Handling
        updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 100) - energyDrain;
        updates[`/${villagerId}/needs/hunger`] = (villager.needs.hunger || 0) + 1;
        
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
        } else if (newAction === "Wandering" && villager.x === targetX && villager.y === targetY) {
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
        
        if (villager.x === targetX && villager.y === targetY) {
            if (newAction === "Foraging") {
                updates[`/${villagerId}/inventory/food`] = 5;
                const row = mapLayout[villager.y];
                mapLayout[villager.y] = row.substring(0, villager.x) + '.' + row.substring(villager.x + 1);
                newAction = "Eating";
            } else if (newAction === "Resting") {
                updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 0) + energyGain;
            }
        }
        if (newAction === "Eating" && (villager.inventory?.food || 0) > 0) {
            updates[`/${villagerId}/inventory/food`] = 0;
            updates[`/${villagerId}/needs/hunger`] = 0;
            newAction = "Wandering";
        }

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
    
    await db.ref('/villagers').update(updates);
    await db.ref('/map').set(mapLayout);
});