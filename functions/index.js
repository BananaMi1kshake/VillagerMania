const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

// NEW: The Modular Dialogue Library
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
    // We can add Introvert/Extrovert later
};

// --- HELPER FUNCTIONS ---

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- CORE STORY ENGINE LOGIC ---

function generateSocialGoal(villager, villagerId, villagersData) {
    const villagerIds = Object.keys(villagersData);
    
    // Find strangers to meet
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

    return null; // No goal found
}

async function executeInteraction(db, initiator, initiatorId, target, targetId) {
    // For now, we only have the MAKE_FRIEND interaction (Introduction)
    const promptTemplate = getRandomElement(prompts.INTRODUCTION);
    const promptLine = promptTemplate.replace('[ACTOR]', initiator.name);

    const responseTemplate = getRandomElement(responses[target.trait]?.POSITIVE || responses.Easygoing.POSITIVE);
    const responseLine = responseTemplate.replace('[TARGET]', target.name).replace('[ACTOR]', initiator.name);

    const conversationLog = {
        participants: {
            [initiatorId]: initiator.name,
            [targetId]: target.name,
        },
        dialogue: [
            { speaker: initiatorId, line: promptLine },
            { speaker: targetId, line: responseLine },
        ],
        timestamp: admin.database.ServerValue.TIMESTAMP,
        summary: `${initiator.name} introduced themself to ${target.name}.`
    };

    // Save the full conversation to the new log
    await db.ref('/conversation_logs').push(conversationLog);

    // Update their relationships to "Acquaintances"
    const updates = {};
    updates[`/${initiatorId}/relationships/${targetId}`] = { state: 'Acquaintances', opinion: 'Neutral' };
    updates[`/${targetId}/relationships/${initiatorId}`] = { state: 'Acquaintances', opinion: 'Neutral' };
    updates[`/${initiatorId}/activeSocialGoal`] = null; // Goal is complete
    updates[`/${initiatorId}/action`] = "Wandering";
    updates[`/${targetId}/action`] = "Wandering"; // Target is also now idle

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
            // --- EXECUTE ACTIVE GOAL ---
            const goal = villager.activeSocialGoal;
            const target = villagersData[goal.target];
            if (!target) continue; // Target might have left

            // Check if they are close enough to interact
            const distance = Math.abs(villager.x - target.x) + Math.abs(villager.y - target.y);
            if (distance <= 2) {
                await executeInteraction(db, villager, villagerId, target, goal.target);
            } else {
                // Move towards target
                updates[`/${villagerId}/targetX`] = target.x;
                updates[`/${villagerId}/targetY`] = target.y;
                updates[`/${villagerId}/action`] = `Seeking ${target.name}`;
            }

        } else {
            // --- GENERATE NEW GOAL ---
            const newGoal = generateSocialGoal(villager, villagerId, villagersData);
            if (newGoal) {
                updates[`/${villagerId}/activeSocialGoal`] = newGoal;
            } else {
                // Wander if no goal is found
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
