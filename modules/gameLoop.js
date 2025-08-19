// modules/gameLoop.js
import { database } from './firebase.js';
import { localVillagersState, myVillagerId, villagers } from './state.js';

const GAME_TICK_MS = 1000;
const TILE_SIZE = 24; // This must match the --tile-size in your CSS
const villagersRef = database.ref('villagers');

export function startGameLoop() {
    setInterval(() => {
        for (const villagerId in localVillagersState) {
            const villagerData = localVillagersState[villagerId];
            const villagerEl = villagers[villagerId];
            if (!villagerData || !villagerEl) continue;

            if (villagerData.path && villagerData.path.length > 0) {
                const nextStep = villagerData.path.shift();
                villagerData.x = nextStep.x;
                villagerData.y = nextStep.y;
                // UPDATED: Use the correct TILE_SIZE for movement
                villagerEl.style.transform = `translate(${villagerData.x * TILE_SIZE}px, ${villagerData.y * TILE_SIZE}px)`;

                // When the path is complete...
                if (villagerData.path.length === 0) {
                    // FIX: Every villager must report their final position to the server.
                    // The "if (villagerId === myVillagerId)" check has been removed.
                    villagersRef.child(villagerId).update({
                        x: villagerData.x,
                        y: villagerData.y,
                        // We can also clear the action locally to prevent stale states
                        action: "Idle" 
                    });
                }
            }
        }
    }, GAME_TICK_MS);
}
