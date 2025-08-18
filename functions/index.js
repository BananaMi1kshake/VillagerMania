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
        const energyDrain = villager.trait === 'Ambitious' ? 3 : 2;
        const energyGain = villager.trait === 'Easygoing' ? 15 : 10;

        // 1. Check for arrival at a destination
        if (villager.x === targetX && villager.y === targetY) {
            if (villager.action === "Wandering") newAction = "Idle";
            if (villager.action === "Foraging") {
                updates[`/${villagerId}/inventory/food`] = 5;
                const row = mapLayout[villager.y];
                mapLayout[villager.y] = row.substring(0, villager.x) + '.' + row.substring(villager.x + 1);
                newAction = "Eating";
            } else if (villager.action === "Resting") {
                updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 0) + energyGain;
            }
        }

        // 2. Check for urgent needs
        if (villager.needs.energy < energyThreshold) {
            newAction = "Resting";
        } else if (villager.needs.hunger > 80) {
            newAction = "Eating";
        } else if (villager.needs.hunger > hungerThreshold) {
            newAction = "Foraging";
        }

        // 3. If Idle, try to socialize.
        if (newAction === "Idle" && !villager.partnerId) {
            let interacted = false;
            const crushId = villager.romanticInterest;

            // Partnership "Spark Check" (Highest social priority)
            if (crushId && villagersData[crushId] && !villagersData[crushId].partnerId) {
                const crush = villagersData[crushId];
                const relationshipScore = villager.relationships?.[crushId] || 0;

                if (relationshipScore > 50) {
                    const isMutual = crush.romanticInterest === villagerId;
                    const successChance = isMutual ? 0.8 : 0.2;
                    
                    if (Math.random() < successChance) {
                        newAction = `Forming a partnership!`;
                        updates[`/${villagerId}/partnerId`] = crushId;
                        updates[`/${crushId}/partnerId`] = villagerId;
                        updates[`/${crushId}/action`] = `Forming a partnership!`;
                        interacted = true;
                    }
                }
            }
            
            // General Social Check (if no partnership was formed)
            if (!interacted) {
                for (const otherId of villagerIds) {
                    if (villagerId === otherId || villagersData[otherId].action !== "Idle") continue;
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
            }

            if (!interacted) {
                newAction = "Wandering";
            }
        }
        
        // 4. Handle immediate state changes when a villager is AT their target
        if (villager.x === targetX && villager.y === targetY) {
            if (villager.action === "Foraging") {
                updates[`/${villagerId}/inventory/food`] = 5;
                const row = mapLayout[villager.y];
                mapLayout[villager.y] = row.substring(0, villager.x) + '.' + row.substring(villager.x + 1);
                newAction = "Eating";
            } else if (villager.action === "Resting") {
                updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 0) + energyGain;
            }
        }
        if (newAction === "Eating" && (villager.inventory?.food || 0) > 0) {
            updates[`/${villagerId}/inventory/food`] = 0;
            updates[`/${villagerId}/needs/hunger`] = 0;
            newAction = "Wandering";
        }
        
        // 5. Update needs and final action/target
        updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 100) - energyDrain;
        updates[`/${villagerId}/needs/hunger`] = (villager.needs.hunger || 0) + 1;
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