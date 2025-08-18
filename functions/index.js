const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

const dialogueTemplates = {
    compliment: [
        "You look great today, [TARGET_NAME]!",
        "I really like your style.",
        "It's always nice to see you around.",
    ],
    complaint: [
        "I'm not sure I like your tone, [TARGET_NAME].",
        "You've been getting on my nerves lately.",
        "I think I need some space.",
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
        let targetX = villager.targetX ?? villager.x;
        let targetY = villager.targetY ?? villager.y;

        const hungerThreshold = villager.trait === 'Ambitious' ? 30 : 50;
        const energyThreshold = villager.trait === 'Easygoing' ? 10 : 20;
        const socialThreshold = villager.trait === 'Introvert' ? 80 : 60;
        const energyDrain = villager.trait === 'Ambitious' ? 3 : 2;
        const socialGain = villager.trait === 'Extrovert' ? 2 : 1;
        const energyGain = villager.trait === 'Easygoing' ? 15 : 10;

        // 1. Check for arrival at a destination
        if (villager.x === targetX && villager.y === targetY) {
            if (["Wandering", "Socializing"].includes(villager.action)) {
                newAction = "Idle";
            }
            if (villager.action === "Foraging") {
                updates[`/${villagerId}/inventory/food`] = 5;
                const row = mapLayout[villager.y];
                mapLayout[villager.y] = row.substring(0, villager.x) + '.' + row.substring(villager.x + 1);
                newAction = "Eating";
            } else if (villager.action === "Resting") {
                updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 0) + energyGain;
            }
        }

        // 2. Check for urgent needs (Priority Order)
        if (villager.needs.energy < energyThreshold) {
            newAction = "Resting";
        } else if (villager.needs.hunger > 80) {
            newAction = "Eating";
        } else if (villager.needs.hunger > hungerThreshold) {
            newAction = "Foraging";
        } else if (villager.needs.social > socialThreshold) {
            newAction = "Socializing";
        } else if (villager.needs.energy >= 100 && villager.action === "Resting") {
            newAction = "Wandering";
        }

        // 3. If Idle, try to socialize
        if (newAction === "Idle") {
            let interacted = false;
            for (const otherId of villagerIds) {
                if (villagerId === otherId || !["Idle", "Wandering"].includes(villagersData[otherId].action)) continue;
                const otherVillager = villagersData[otherId];
                const distance = Math.abs(villager.x - otherVillager.x) + Math.abs(villager.y - otherVillager.y);

                if (distance <= 2) {
                    const relationshipScore = villager.relationships?.[otherId] || 0;
                    let intent = 'compliment';
                    if (relationshipScore < 0 && Math.random() < 0.7) {
                        intent = 'complaint';
                    }
                    newAction = "Talking";
                    const template = dialogueTemplates[intent][Math.floor(Math.random() * dialogueTemplates[intent].length)];
                    const dialogueText = template.replace("[TARGET_NAME]", otherVillager.name);
                    updates[`/${villagerId}/dialogue`] = dialogueText;
                    setTimeout(() => db.ref(`/villagers/${villagerId}/dialogue`).set(null), 5000);
                    const scoreChange = (intent === 'compliment') ? 10 : -15;
                    updates[`/${villagerId}/relationships/${otherId}`] = relationshipScore + scoreChange;
                    updates[`/${otherId}/relationships/${villagerId}`] = (otherVillager.relationships?.[villagerId] || 0) + scoreChange;
                    
                    interacted = true;
                    break;
                }
            }
            if (!interacted) {
                newAction = "Wandering";
            }
        }
        
        // 4. Set a new target if the villager is starting a new task
        if (newAction !== villager.action || (newAction === "Wandering" && villager.x === targetX && villager.y === targetY)) {
             if (newAction === "Socializing") {
                const unmet = villagerIds.filter(id => id !== villagerId && !villager.relationships?.[id]);
                let targetId = unmet.length > 0 ? unmet[Math.floor(Math.random() * unmet.length)] : null;
                if (!targetId) {
                    const others = villagerIds.filter(id => id !== villagerId);
                    if (others.length > 0) targetId = others[Math.floor(Math.random() * others.length)];
                }
                if (targetId) {
                    targetX = villagersData[targetId].x;
                    targetY = villagersData[targetId].y;
                }
            } else if (newAction === "Foraging") {
                const nearestBush = findNearest(villager.x, villager.y, mapLayout, "B");
                if (nearestBush) { targetX = nearestBush.x; targetY = nearestBush.y; }
            } else if (newAction === "Resting") {
                const nearestHouse = findNearest(villager.x, villager.y, mapLayout, "H");
                if (nearestHouse) { targetX = nearestHouse.x; targetY = nearestHouse.y; }
            } else if (newAction === "Wandering") {
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

        // 5. Update needs and final data
        updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 100) - energyDrain;
        updates[`/${villagerId}/needs/hunger`] = (villager.needs.hunger || 0) + 1;
        updates[`/${villagerId}/needs/social`] = (villager.needs.social || 0) + socialGain;
        if (newAction === "Talking") {
             updates[`/${villagerId}/needs/social`] = 0;
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
        let bushCount = 0;
        const emptySpots = [];
        for (let y = 0; y < mapLayout.length; y++) {
            for (let x = 0; x < mapLayout[y].length; x++) {
                if (mapLayout[y][x] === '.') emptySpots.push({x, y});
                if (mapLayout[y][x] === 'B') bushCount++;
            }
        }
        if (bushCount < 5 && emptySpots.length > 0) {
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            const row = mapLayout[spot.y];
            mapLayout[spot.y] = row.substring(0, spot.x) + 'B' + row.substring(spot.x + 1);
        }
    }
    
    await db.ref('/villagers').update(updates);
    await db.ref('/map').set(mapLayout);
});