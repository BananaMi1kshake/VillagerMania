// functions/index.js
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

// ... (keep your mapLayout, walkableTiles, and findNearest function as they are)

exports.tick = onSchedule("every 1 minutes", async (event) => {
    // ... (keep the initial setup to get villagersData)

    for (const villagerId of villagerIds) {
        const villager = villagersData[villagerId];
        let newAction = villager.action || "Wandering";

        // 1. Needs-Based AI (Highest Priority)
        // ... (keep the existing logic for Resting, Foraging, Eating)

        // 2. Social & Romance AI (If not busy with a need)
        if (newAction === "Wandering" && !villager.partnerId) {
            let interacted = false;

            // --- Romance Check (High Priority Social) ---
            const crushId = villager.romanticInterest;
            if (crushId && villagersData[crushId]) {
                const crush = villagersData[crushId];
                const relationshipScore = villager.relationships?.[crushId] || 0;

                // Attempt to form a partnership
                if (relationshipScore > 50) { // Must be at least Friends
                    const mutualCrush = crush.romanticInterest === villagerId;
                    const successChance = mutualCrush ? 0.8 : 0.2; // 80% if mutual, 20% if one-sided
                    
                    if (Math.random() < successChance) {
                        newAction = `Forming a partnership!`;
                        updates[`/${villagerId}/partnerId`] = crushId;
                        updates[`/${crushId}/partnerId`] = villagerId;
                        updates[`/${crushId}/action`] = `Forming a partnership!`;
                        interacted = true;
                    }
                }
            }

            // --- Regular Social Check ---
            if (!interacted) {
                 // ... (keep your existing logic for finding a nearby villager to chat with)
                 // You can enhance this to prioritize chatting with the romanticInterest.
            }
        }

        // 3. Action Handling
        // ... (keep your existing logic for handling movement, needs depletion, etc.)
        
        updates[`/${villagerId}/action`] = newAction;
    }
    
    // ... (apply updates at the end)
});