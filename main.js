import { auth, database } from './modules/firebase.js';
import { findPath } from './modules/pathfinding.js';
import * as state from './modules/state.js';
import * as ui from './modules/ui.js';
import { startGameLoop } from './modules/gameLoop.js';

const villagersRef = database.ref('villagers');
const mapRef = database.ref('map');
const eventsRef = database.ref('events'); // This will be replaced by conversation_logs later

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

    // UPDATED: Create villagers with the new data structure
    newVillagerRef.set({
        id: state.myVillagerId,
        name,
        emoji,
        x: spawnPoint.x,
        y: spawnPoint.y,
        targetX: spawnPoint.x,
        targetY: spawnPoint.y,
        action: "Wandering",
        trait: state.villagerTraits[Math.floor(Math.random() * state.villagerTraits.length)],
        
        // NEW data model for the story engine
        mood: "Neutral",
        activeSocialGoal: null,
        relationships: {} // Ready for the new state/opinion structure
    });
});

// The old crush button listener is removed.

document.getElementById('close-profile-button').addEventListener('click', () => {
    document.getElementById('profile-modal').style.display = 'none';
});

// --- REAL-TIME LISTENERS ---
// This section remains largely the same, as it's responsible for rendering
// what the server dictates. It will automatically work with the new data.

auth.onAuthStateChanged(user => {
    if (user) {
        state.setMyVillagerId(user.uid);
        ui.updateUI(state.myVillagerId);
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
    
    villagerEl.style.transform = `translate(${villagerData.x * 24}px, ${villagerData.y * 24}px)`;
    state.villagers[villagerId] = villagerEl;
    document.getElementById('map-container').appendChild(villagerEl);

    ui.updateRoster();
    ui.updateUI(state.myVillagerId);
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
    ui.updateRoster();
    ui.updateUI(state.myVillagerId);
});

// We can leave the old event log listener for now. It will be replaced in Phase 2.
const eventLogList = document.getElementById('event-log-list');
eventsRef.limitToLast(10).on('child_added', (snapshot) => {
    const event = snapshot.val();
    const li = document.createElement('li');
    li.textContent = event.text;
    eventLogList.insertBefore(li, eventLogList.firstChild);
});


// --- INITIALIZE THE APP ---
ui.buildEmojiDropdown();
startGameLoop();
