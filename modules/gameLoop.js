// modules/gameLoop.js
import { database } from './firebase.js';
import { localVillagersState, myVillagerId, villagers } from './state.js';

const GAME_TICK_MS = 1000;
const villagersRef = database.ref('villagers');

export function startGameLoop() {
    setInterval(() => {
        for (const villagerId in localVillagersState) {
            const villagerData = localVillagersState[villagerId];
            const villagerEl = villagers[villagerId];
            if (!villagerData || !villagerEl) continue;

            if (villagerData.path && villagerData.path.length > 0) {
                // Peek at the next step without removing it from the path yet
                const nextStep = villagerData.path[0];

                // Check if another villager is already on the target tile
                let isOccupied = false;
                for (const otherId in localVillagersState) {
                    if (otherId !== villagerId) {
                        const otherVillager = localVillagersState[otherId];
                        if (otherVillager.x === nextStep.x && otherVillager.y === nextStep.y) {
                            isOccupied = true;
                            break;
                        }
                    }
                }

                // Only move if the next step is not occupied
                if (!isOccupied) {
                    // It's clear, so now we officially take the step by removing it from the path
                    villagerData.path.shift();
                    villagerData.x = nextStep.x;
                    villagerData.y = nextStep.y;
                    villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;
                }
                // If isOccupied is true, the villager does nothing this tick, effectively "waiting".

                if (villagerData.path.length === 0) {
                    // Update the server with the final position only when the path is complete
                    if (villagerId === myVillagerId) {
                        villagersRef.child(villagerId).update({
                            x: villagerData.x,
                            y: villagerData.y
                        });
                    }
                }
            }
        }
    }, GAME_TICK_MS);
}