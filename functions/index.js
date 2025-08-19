const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const walkableTiles = [".", "H", "B"];

const relationshipConfig = {
    thresholds: {
        GoodFriends: 70, Friends: 30, Acquaintances: 1,
        Neutral: 0, Tense: -20, Rivals: -50,
    },
    points: {
        INTRODUCTION: 10, FRIENDLY_CHAT: 15, COMPLAIN: -20,
        WITNESS_POSITIVE: 2, WITNESS_NEGATIVE: -5, // NEW
    },
    modifiers: {
        Easygoing_BONUS: 5, Ambitious_PENALTY: -5,
    }
};

// --- DIALOGUE LIBRARY ---
const topics = ["the weather", "a nice-looking tree", "a funny-shaped cloud", "the taste of berries", "fishing", "stargazing"];
const prompts = {
    INTRODUCTION: ["Hi, I'm [ACTOR]. I don't think we've met!", "Hello there! My name is [ACTOR]."],
    FIND_COMMON_GROUND: ["So, what do you think about [TOPIC]?", "I was just thinking about [TOPIC]. Any thoughts?"],
    COMPLAIN: ["Honestly, [TARGET], I'm not a fan of your attitude lately.", "I need to be honest, [TARGET], you've been getting on my nerves."],
};
const responses = {
    Easygoing: {
        POSITIVE: ["Nice to meet you, [ACTOR]! I'm [TARGET].", "Oh, I love it!", "That sounds wonderful."],
        NEUTRAL: ["I don't mind it.", "I haven't really thought about it."],
        NEGATIVE: ["Oh. I'm sorry you feel that way.", "I see. Well, that's a shame."],
    },
    Ambitious: {
        POSITIVE: ["It's the best, obviously.", "Of course it's great."],
        NEUTRAL: ["[TARGET]. Good to meet you.", "It's a waste of time."],
        NEGATIVE: ["And? You think I care?", "Whatever, [ACTOR]."],
    },
};

// --- HELPER FUNCTIONS ---
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function findAdjacentTarget(target, mapLayout) {
    const neighbors = [ { x: target.x, y: target.y - 1 }, { x: target.x, y: target.y + 1 }, { x: target.x - 1, y: target.y }, { x: target.x + 1, y: target.y } ];
    const validNeighbors = neighbors.filter(n => { const tile = mapLayout[n.y]?.[n.x]; return tile && walkableTiles.includes(tile); });
    return validNeighbors.length > 0 ? getRandomElement(validNeighbors) : null;
}

// --- CORE STORY ENGINE LOGIC ---
function generateSocialGoal(villager, villagerId, villagersData) {
    const villagerIds = Object.keys(villagersData);
    const disliked = villagerIds.filter(id => {
        if (id === villagerId) return false;
        const rel = villager.relationships?.[id];
        const chance = villager.trait === 'Ambitious' ? 0.5 : 0.1;
        return rel && rel.opinion === 'Disliked' && Math.random() < chance;
    });
    if (disliked.length > 0) {
        const targetId = getRandomElement(disliked);
        return { type: 'COMPLAIN', target: targetId, text: `Confront ${villagersData[targetId].name}.` };
    }
    const strangers = villagerIds.filter(id => id !== villagerId && (!villager.relationships || !villager.relationships[id]));
    if (strangers.length > 0) {
        const targetId = getRandomElement(strangers);
        return { type: 'MAKE_FRIEND', target: targetId, text: `Introduce myself to ${villagersData[targetId].name}.` };
    }
    const acquaintances = villagerIds.filter(id => {
        if (id === villagerId) return false;
        const rel = villager.relationships?.[id];
        return rel && (rel.state === 'Acquaintances' || rel.state === 'Friends');
    });
    if (acquaintances.length > 0) {
        const targetId = getRandomElement(acquaintances);
        return { type: 'IMPROVE_FRIENDSHIP', target: targetId, text: `Chat with ${villagersData[targetId].name}.` };
    }
    return null;
}

// NEW: Function to handle witness reactions
function processWitnesses(db, updates, initiator, initiatorId, target, targetId, goalType, villagersData) {
    const villagerIds = Object.keys(villagersData);
    const interactionPoint = { x: initiator.x, y: initiator.y };

    for (const witnessId of villagerIds) {
        if (witnessId === initiatorId || witnessId === targetId) continue;
        const witness = villagersData[witnessId];
        const distance = Math.abs(witness.x - interactionPoint.x) + Math.abs(witness.y - interactionPoint.y);

        if (distance <= 7) { // Witnessing radius
            let summary = "";
            if (goalType === 'COMPLAIN') {
                const currentScore = witness.relationships?.[initiatorId]?.score || 0;
                updates[`/${witnessId}/relationships/${initiatorId}/score`] = currentScore + relationshipConfig.points.WITNESS_NEGATIVE;
                updates[`/${witnessId}/relationships/${initiatorId}/opinion`] = 'Disliked'; // Simplified for now
                summary = `${witness.name} saw ${initiator.name} complain about ${target.name}.`;
            } else if (goalType === 'IMPROVE_FRIENDSHIP') {
                const currentScore = witness.relationships?.[initiatorId]?.score || 0;
                updates[`/${witnessId}/relationships/${initiatorId}/score`] = currentScore + relationshipConfig.points.WITNESS_POSITIVE;
                summary = `${witness.name} saw ${initiator.name} having a nice chat with ${target.name}.`;
            }

            if (summary) {
                const log = {
                    summary,
                    participants: { [witnessId]: witness.name },
                    timestamp: admin.database.ServerValue.TIMESTAMP,
                    type: 'witness'
                };
                db.ref('/conversation_logs').push(log);
            }
        }
    }
}

async function executeInteraction(db, initiator, initiatorId, target, targetId, goal, villagersData) {
    let conversationLog;
    const updates = {};
    let pointsChanged = 0;
    const currentScore = initiator.relationships?.[targetId]?.score || 0;

    if (goal.type === 'MAKE_FRIEND') {
        pointsChanged = relationshipConfig.points.INTRODUCTION;
        const promptTemplate = getRandomElement(prompts.INTRODUCTION);
        const promptLine = promptTemplate.replace('[ACTOR]', initiator.name);
        const responseKey = target.trait && responses[target.trait] ? target.trait : 'Easygoing';
        const responseTemplate = getRandomElement(responses[responseKey].POSITIVE);
        const responseLine = responseTemplate.replace('[TARGET]', target.name).replace('[ACTOR]', initiator.name);
        conversationLog = {
            summary: `${initiator.name} introduced themself to ${target.name}.`,
            dialogue: [ { speaker: initiatorId, line: promptLine }, { speaker: targetId, line: responseLine } ],
        };
        updates[`/${initiatorId}/relationships/${targetId}`] = { state: 'Acquaintances', opinion: 'Neutral', score: pointsChanged };
        updates[`/${targetId}/relationships/${initiatorId}`] = { state: 'Acquaintances', opinion: 'Neutral', score: pointsChanged };
    } else if (goal.type === 'IMPROVE_FRIENDSHIP') {
        pointsChanged = relationshipConfig.points.FRIENDLY_CHAT;
        if (initiator.trait === 'Easygoing') pointsChanged += relationshipConfig.modifiers.Easygoing_BONUS;
        if (target.trait === 'Ambitious') pointsChanged += relationshipConfig.modifiers.Ambitious_PENALTY;
        const topic = getRandomElement(topics);
        const promptTemplate = getRandomElement(prompts.FIND_COMMON_GROUND);
        const promptLine = promptTemplate.replace('[TOPIC]', topic);
        const responseKey = target.trait && responses[target.trait] ? target.trait : 'Easygoing';
        const responseTemplate = getRandomElement(responses[responseKey].POSITIVE);
        const responseLine = responseTemplate;
        conversationLog = {
            summary: `${initiator.name} and ${target.name} chatted about ${topic}.`,
            dialogue: [ { speaker: initiatorId, line: promptLine }, { speaker: targetId, line: responseLine } ],
        };
    } else if (goal.type === 'COMPLAIN') {
        pointsChanged = relationshipConfig.points.COMPLAIN;
        const promptTemplate = getRandomElement(prompts.COMPLAIN);
        const promptLine = promptTemplate.replaceAll('[TARGET]', target.name);
        const responseKey = target.trait && responses[target.trait] ? target.trait : 'Easygoing';
        const responseTemplate = getRandomElement(responses[responseKey].NEGATIVE);
        const responseLine = responseTemplate.replaceAll('[ACTOR]', initiator.name);
        conversationLog = {
            summary: `${initiator.name} complained about ${target.name}.`,
            dialogue: [ { speaker: initiatorId, line: promptLine }, { speaker: targetId, line: responseLine } ],
        };
    }

    const newScore = currentScore + pointsChanged;
    let newState = initiator.relationships?.[targetId]?.state || 'Strangers';
    if (newScore >= relationshipConfig.thresholds.GoodFriends) newState = 'Good Friends';
    else if (newScore >= relationshipConfig.thresholds.Friends) newState = 'Friends';
    else if (newScore >= relationshipConfig.thresholds.Acquaintances) newState = 'Acquaintances';
    else if (newScore <= relationshipConfig.thresholds.Rivals) newState = 'Rivals';
    else if (newScore <= relationshipConfig.thresholds.Tense) newState = 'Tense';
    
    if (newState !== (initiator.relationships?.[targetId]?.state || 'Strangers')) {
        updates[`/${initiatorId}/relationships/${targetId}/state`] = newState;
        updates[`/${targetId}/relationships/${initiatorId}/state`] = newState;
        if (newState !== 'Acquaintances') {
             conversationLog.summary = `${initiator.name} and ${target.name} are now ${newState}!`;
        }
    }
    
    updates[`/${initiatorId}/relationships/${targetId}/score`] = newScore;
    updates[`/${targetId}/relationships/${initiatorId}/score`] = newScore;

    conversationLog.participants = { [initiatorId]: initiator.name, [targetId]: target.name };
    conversationLog.timestamp = admin.database.ServerValue.TIMESTAMP;
    await db.ref('/conversation_logs').push(conversationLog);
    
    // NEW: Process witnesses after the main interaction is logged
    processWitnesses(db, updates, initiator, initiatorId, target, targetId, goal.type, villagersData);

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
    const decisions = {};

    for (const villagerId of villagerIds) {
        const villager = villagersData[villagerId];
        decisions[villagerId] = {};
        if (villager.activeSocialGoal) {
            const goal = villager.activeSocialGoal;
            const target = villagersData[goal.target];
            if (!target) continue;
            const distance = Math.abs(villager.x - target.x) + Math.abs(villager.y - target.y);
            if (distance <= 2) {
                decisions[villagerId].executeInteraction = true;
            } else {
                const adjacentTarget = findAdjacentTarget(target, mapLayout);
                if (adjacentTarget) {
                    decisions[villagerId].targetX = adjacentTarget.x;
                    decisions[villagerId].targetY = adjacentTarget.y;
                    decisions[villagerId].action = `Seeking ${target.name}`;
                }
            }
        } else {
            const newGoal = generateSocialGoal(villager, villagerId, villagersData);
            if (newGoal) {
                decisions[villagerId].activeSocialGoal = newGoal;
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
                        decisions[villagerId].targetX = spot.x;
                        decisions[villagerId].targetY = spot.y;
                        decisions[villagerId].action = "Wandering";
                    }
                }
            }
        }
    }

    for (const villagerId of villagerIds) {
        const decision = decisions[villagerId];
        if (decision.executeInteraction) {
            const villager = villagersData[villagerId];
            const goal = villager.activeSocialGoal;
            const target = villagersData[goal.target];
            // UPDATED: Pass all villagersData to handle witnesses
            await executeInteraction(db, villager, villagerId, target, goal.target, goal, villagersData);
        } else {
            for (const key in decision) {
                updates[`/${villagerId}/${key}`] = decision[key];
            }
        }
    }
    
    if (Object.keys(updates).length > 0) {
        await db.ref('/villagers').update(updates);
    }
});
