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
                const nextStep = villagerData.path.shift();
                villagerData.x = nextStep.x;
                villagerData.y = nextStep.y;
                villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;

                if (villagerData.path.length === 0) {
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