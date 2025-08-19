import { auth, database } from './modules/firebase.js';
import { findPath } from './modules/pathfinding.js';
import * as state from './modules/state.js';
import * as ui from './modules/ui.js';
import { startGameLoop } from './modules/gameLoop.js';

const villagersRef = database.ref('villagers');
const mapRef = database.ref('map');
const conversationLogsRef = database.ref('conversation_logs'); // NEW

// --- DOM Element References ---
const conversationModal = document.getElementById('conversation-modal');
const conversationHeader = document.getElementById('conversation-header');
const conversationLogEl = document.getElementById('conversation-log');

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
        id: state.myVillagerId, name, emoji,
        x: spawnPoint.x, y: spawnPoint.y,
        targetX: spawnPoint.x, targetY: spawnPoint.y,
        action: "Wandering",
        trait: state.villagerTraits[Math.floor(Math.random() * state.villagerTraits.length)],
        mood: "Neutral", activeSocialGoal: null, relationships: {}
    });
});

document.getElementById('close-profile-button').addEventListener('click', () => {
    document.getElementById('profile-modal').style.display = 'none';
});

// NEW: Listener to close the conversation modal
document.getElementById('close-conversation-button').addEventListener('click', () => {
    conversationModal.style.display = 'none';
});

// --- REAL-TIME LISTENERS ---
auth.onAuthStateChanged(user => {
    if (user) {
        state.setMyVillagerId(user.uid);
        ui.updateUI(state.myVillagerId);
    } else {
        auth.signInAnonymously().catch(error => console.error(error));
    }
});

mapRef.on('value', (snapshot) => { ui.renderMap(snapshot.val()); });

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

// UPDATED: This now listens for and displays conversation summaries
const eventLogList = document.getElementById('event-log-list');
conversationLogsRef.limitToLast(15).on('child_added', (snapshot) => {
    const logData = snapshot.val();
    const logId = snapshot.key;

    const li = document.createElement('li');
    li.textContent = logData.summary;
    li.dataset.logId = logId; // Store the ID to fetch later

    li.addEventListener('click', async () => {
        const fetchedLog = (await database.ref(`conversation_logs/${logId}`).once('value')).val();
        if (fetchedLog) {
            displayConversation(fetchedLog);
        }
    });

    eventLogList.insertBefore(li, eventLogList.firstChild);
});

// NEW: Function to display the conversation in the modal
function displayConversation(logData) {
    const participantNames = Object.values(logData.participants).join(' & ');
    conversationHeader.textContent = `Conversation between ${participantNames}`;
    conversationLogEl.innerHTML = ''; // Clear previous log

    const initiatorId = Object.keys(logData.participants)[0];

    logData.dialogue.forEach(message => {
        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');
        bubble.textContent = message.line;

        if (message.speaker === initiatorId) {
            bubble.classList.add('initiator');
        } else {
            bubble.classList.add('responder');
        }
        conversationLogEl.appendChild(bubble);
    });

    conversationModal.style.display = 'flex';
}

// --- INITIALIZE THE APP ---
ui.buildEmojiDropdown();
startGameLoop();
