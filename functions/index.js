const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

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

const walkableTiles = [".", "H", "B"];

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
    
    const updates = {};
    const villagerIds = Object.keys(villagersData);

    for (const villagerId of villagerIds) {
        const villager = villagersData[villagerId];
        
        // Default action is to continue what they were doing
        let newAction = villager.action || "Wandering";

        // 1. Needs-Based AI Decision Making (Highest Priority)
        if (villager.needs.energy < 20) {
            newAction = "Resting";
        } else if (villager.needs.hunger > 80) {
            newAction = "Eating";
        } else if (villager.needs.hunger > 50) {
            newAction = "Foraging";
        } else if (villager.needs.energy >= 100 && villager.action === "Resting") {
            newAction = "Wandering";
        }

        // 2. Social AI (Only if not busy with a need)
        if (newAction === "Wandering") {
            for (const otherId of villagerIds) {
                if (villagerId === otherId || villagersData[otherId].action !== "Wandering") continue;

                const otherVillager = villagersData[otherId];
                const distance = Math.abs(villager.x - otherVillager.x) + Math.abs(villager.y - otherVillager.y);

                if (distance <= 2) {
                    newAction = `Chatting with ${otherVillager.name}`;
                    updates[`/${otherId}/action`] = `Chatting with ${villager.name}`;

                    const currentScoreA = villager.relationships?.[otherId] || 0;
                    const currentScoreB = otherVillager.relationships?.[villagerId] || 0;
                    updates[`/${villagerId}/relationships/${otherId}`] = currentScoreA + 5;
                    updates[`/${otherId}/relationships/${otherId}`] = currentScoreB + 5;
                    
                    break; 
                }
            }
        }

        // 3. Action Handling (Execute the chosen action)
        updates[`/${villagerId}/needs/energy`] = (villager.needs.energy || 100) - 2;
        updates[`/${villagerId}/needs/hunger`] = (villager.needs.hunger || 0) + 1;
        
        let newX = villager.x;
        let newY = villager.y;

        if (newAction.startsWith("Chatting")) {
            // Villagers stand still while chatting
        } else if (newAction === "Resting") {
            updates[`/${villagerId}/needs/energy`] = villager.needs.energy + 10;
        } else if (newAction === "Foraging") {
            if ((villager.inventory?.food || 0) > 0) {
                newAction = "Eating";
            } else {
                const nearestBush = findNearest(villager.x, villager.y, "B");
                if (nearestBush) {
                    if (villager.x === nearestBush.x && villager.y === nearestBush.y) {
                        updates[`/${villagerId}/inventory/food`] = 5;
                        newAction = "Eating";
                    } else {
                        if (nearestBush.x > villager.x) newX++;
                        else if (nearestBush.x < villager.x) newX--;
                        else if (nearestBush.y > villager.y) newY++;
                        else if (nearestBush.y < villager.y) newY--;
                    }
                }
            }
        } else if (newAction === "Eating") {
            if ((villager.inventory?.food || 0) > 0) {
                updates[`/${villagerId}/inventory/food`] = 0;
                updates[`/${villagerId}/needs/hunger`] = 0;
                newAction = "Wandering";
            } else {
                newAction = "Foraging";
            }
        } else { // Wandering
            const direction = Math.floor(Math.random() * 4);
            if (direction === 0) newY--;
            if (direction === 1) newX++;
            if (direction === 2) newY++;
            if (direction === 3) newX--;
        }

        // 4. Collision Detection & Final Updates
        if (newX !== villager.x || newY !== villager.y) {
            const targetTile = mapLayout[newY]?.[newX];
            if (walkableTiles.includes(targetTile)) {
                updates[`/${villagerId}/x`] = newX;
                updates[`/${villagerId}/y`] = newY;
            }
        }
        updates[`/${villagerId}/action`] = newAction;
    }

    if (Object.keys(updates).length > 0) {
        await villagersRef.update(updates);
    }

    console.log("Heartbeat tick has finished.");
});