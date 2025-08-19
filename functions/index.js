const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

// --- DIALOGUE LIBRARY ---
const topics = ["the weather", "a nice-looking tree", "a funny-shaped cloud", "the taste of berries"];

const prompts = {
    INTRODUCTION: [
        "Hi, I'm [ACTOR]. I don't think we've met!",
        "Hello there! My name is [ACTOR].",
    ]
};

const responses = {
    Easygoing: {
        POSITIVE: ["Nice to meet you, [ACTOR]! I'm [TARGET].", "A pleasure to meet you! I'm [TARGET]."],
    },
    Ambitious: {
        NEUTRAL: ["[TARGET]. Good to meet you.", "I'm [TARGET].", "You must be new."],
    },
};

// --- HELPER FUNCTIONS ---

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// NEW: Helper function to find a valid, walkable tile next to a target
function findAdjacentTarget(target, mapLayout) {
    const neighbors = [
        { x: target.x, y: target.y - 1 }, { x: target.x, y: target.y + 1 },
        { x: target.x - 1, y: target.y }, { x: target.x + 1, y: target.y }
    ];

    const validNeighbors = neighbors.filter(n => {
        const tile = mapLayout[n.y]?.[n.x];
        return tile && walkableTiles.includes(tile);
    });

    return validNeighbors.length > 0 ? getRandomElement(validNeighbors) : null;
}


// --- CORE STORY ENGINE LOGIC ---

function generateSocialGoal(villager, villagerId, villagersData) {
    const villagerIds = Object.keys(villagersData);
    
    const strangers = villagerIds.filter(id => {
        if (id === villagerId) return false;
        return !villager.relationships || !villager.relationships[id];
    });

    if (strangers.length > 0) {
        const targetId = getRandomElement(strangers);
        return {
            type: 'MAKE_FRIEND',
            target: targetId,
            step: 1,
            text: `Introduce myself to ${villagersData[targetId].name}.`
        };
    }

    return null;
}

async function executeInteraction(db, initiator, initiatorId, target, targetId) {
    const promptTemplate = getRandomElement(prompts.INTRODUCTION);
    const promptLine = promptTemplate.replace('[ACTOR]', initiator.name);

    const responseTemplate = getRandomElement(responses[target.trait]?.POSITIVE || responses.Easygoing.POSITIVE);
    const responseLine = responseTemplate.replace('[TARGET]', target.name).replace('[ACTOR]', initiator.name);

    const conversationLog = {
        participants: { [initiatorId]: initiator.name, [targetId]: target.name },
        dialogue: [
            { speaker: initiatorId, line: promptLine },
            { speaker: targetId, line: responseLine },
        ],
        timestamp: admin.database.ServerValue.TIMESTAMP,
        summary: `${initiator.name} introduced themself to ${target.name}.`
    };

    await db.ref('/conversation_logs').push(conversationLog);

    const updates = {};
    updates[`/${initiatorId}/relationships/${targetId}`] = { state: 'Acquaintances', opinion: 'Neutral' };
    updates[`/${targetId}/relationships/${initiatorId}`] = { state: 'Acquaintances', opinion: 'Neutral' };
    updates[`/${initiatorId}/activeSocialGoal`] = null;
    updates[`/${initiatorId}/action`] = "Wandering";
    updates[`/${targetId}/action`] = "Wandering";

    await db.ref('/villagers').update(updates);
}


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

        if (villager.activeSocialGoal) {
            const goal = villager.activeSocialGoal;
            const target = villagersData[goal.target];
            if (!target) continue;

            const distance = Math.abs(villager.x - target.x) + Math.abs(villager.y - target.y);
            if (distance <= 2) {
                await executeInteraction(db, villager, villagerId, target, goal.target);
            } else {
                // UPDATED: Find an adjacent tile to the target instead of the target's exact position
                const adjacentTarget = findAdjacentTarget(target, mapLayout);
                if (adjacentTarget) {
                    updates[`/${villagerId}/targetX`] = adjacentTarget.x;
                    updates[`/${villagerId}/targetY`] = adjacentTarget.y;
                    updates[`/${villagerId}/action`] = `Seeking ${target.name}`;
                }
            }

        } else {
            const newGoal = generateSocialGoal(villager, villagerId, villagersData);
            if (newGoal) {
                updates[`/${villagerId}/activeSocialGoal`] = newGoal;
            } else {
                if (villager.x === villager.targetX && villager.y === villager.targetY) {
                    const emptySpots = [];
                    for (let y = 0; y < mapLayout.length; y++) {
                        for (let x = 0; x < mapLayout[y].length; x++) {
                            if (walkableTiles.includes(mapLayout[y][x])) emptySpots.push({x, y});
                        }
                    }
                    if (emptySpots.length > 0) {
                        const spot = getRandomElement(emptySpots);
                        updates[`/${villagerId}/targetX`] = spot.x;
                        updates[`/${villagerId}/targetY`] = spot.y;
                        updates[`/${villagerId}/action`] = "Wandering";
                    }
                }
            }
        }
    }
    
    if (Object.keys(updates).length > 0) {
        await db.ref('/villagers').update(updates);
    }
});
