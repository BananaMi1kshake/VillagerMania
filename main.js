import { auth, database } from './modules/firebase.js';
import { findPath } from './modules/pathfinding.js';
import * as state from './modules/state.js';
import * as ui from './modules/ui.js';
import { startGameLoop } from './modules/gameLoop.js';

const villagersRef = database.ref('villagers');
const mapRef = database.ref('map');

// --- EVENT LISTENERS ---
document.getElementById('join-button').addEventListener('click', () => {
    if (!state.myVillagerId) {
        alert("Not logged in yet. Please wait a moment and try again.");
        return;
    }
    const name = document.getElementById('name-input').value || "Anonymous";
    const emoji = document.getElementById('emoji-select').value;
    const newVillagerRef = database.ref(`villagers/${state.myVillagerId}`);
    const spawnPoint = ui.findRandomSpawnPoint();
    newVillagerRef.set({
        id: state.myVillagerId,
        name,
        emoji,
        x: spawnPoint.x,
        y: spawnPoint.y,
        targetX: spawnPoint.x,
        targetY: spawnPoint.y,
        needs: { 
            energy: 100, 
            hunger: 0,
            social: 0 // Add the new social need
        },
        inventory: { food: 0, wood: 0 },
        action: "Wandering",
        relationships: {},
        romanticInterest: null,
        partnerId: null,
        trait: state.villagerTraits[Math.floor(Math.random() * state.villagerTraits.length)],
        idleTurns: 0
    });
});

document.getElementById('save-crush-button').addEventListener('click', () => {
    const newCrushId = document.getElementById('crush-select').value;
    if (state.myVillagerId) {
        villagersRef.child(state.myVillagerId).update({
            romanticInterest: newCrushId || null
        });
    }
});

document.getElementById('close-profile-button').addEventListener('click', () => {
    document.getElementById('profile-modal').style.display = 'none';
});


// --- REAL-TIME LISTENERS ---
auth.onAuthStateChanged(user => {
    if (user) {
        state.setMyVillagerId(user.uid);
        villagersRef.child(state.myVillagerId).once('value', snapshot => {
            ui.updateUI(state.myVillagerId);
        });
    } else {
        auth.signInAnonymously().catch(error => console.error(error));
    }
});

mapRef.on('value', (snapshot) => {
    ui.renderMap(snapshot.val());
});

villagersRef.on('child_added', (snapshot) => {
    const villagerData = snapshot.val();
    const villagerId = snapshot.key;
    state.localVillagersState[villagerId] = villagerData;

    const villagerEl = document.createElement('div');
    villagerEl.classList.add('villager');
    villagerEl.setAttribute('data-id', villagerId);
    
    const bubbleEl = document.createElement('div');
    bubbleEl.classList.add('speech-bubble');
    
    const emojiEl = document.createElement('div');
    emojiEl.classList.add('villager-emoji');
    emojiEl.textContent = villagerData.emoji;

    villagerEl.appendChild(bubbleEl);
    villagerEl.appendChild(emojiEl);
    
    villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;
    state.villagers[villagerId] = villagerEl;
    document.getElementById('map-container').appendChild(villagerEl);

    ui.updateCrushDropdown(state.myVillagerId);
    ui.updateRoster();
});

villagersRef.on('child_changed', (snapshot) => {
    const serverData = snapshot.val();
    const villagerId = snapshot.key;
    const localData = state.localVillagersState[villagerId];
    const villagerEl = state.villagers[villagerId];

    if (localData && villagerEl) {
        const oldTargetX = localData.targetX;
        const oldTargetY = localData.targetY;
        
        Object.assign(localData, serverData);

        if (oldTargetX !== localData.targetX || oldTargetY !== localData.targetY) {
            const start = { x: localData.x, y: localData.y };
            const end = { x: localData.targetX, y: localData.targetY };
            const obstacles = new Set();
            for (const otherId in state.localVillagersState) {
                if (otherId !== villagerId) {
                    obstacles.add(`${state.localVillagersState[otherId].x},${state.localVillagersState[otherId].y}`);
                }
            }
            localData.path = findPath(start, end, state.mapLayout, state.walkableTiles, obstacles);
        }
        
        villagerEl.querySelector('.villager-emoji').textContent = localData.emoji;
        const bubbleEl = villagerEl.querySelector('.speech-bubble');
        if (localData.dialogue) {
            bubbleEl.textContent = localData.dialogue;
            bubbleEl.style.opacity = 1;
            setTimeout(() => { bubbleEl.style.opacity = 0; }, 4000);
        }
        
        ui.updateCrushDropdown(state.myVillagerId);
        ui.updateRoster();
    }
});

villagersRef.on('child_removed', (snapshot) => {
    const villagerId = snapshot.key;
    const villagerEl = state.villagers[villagerId];
    if (villagerEl) {
        villagerEl.remove();
        delete state.villagers[villagerId];
    }
    delete state.localVillagersState[villagerId];
    ui.updateCrushDropdown(state.myVillagerId);
    ui.updateRoster();
});

// --- INITIALIZE THE APP ---
ui.buildEmojiDropdown();
startGameLoop();