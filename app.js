// --- 1. Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDbLi0f7Y1ijPKzFSMjCW1v-qpEjgyVTII",
  authDomain: "villagermania-debf4.firebaseapp.com",
  databaseURL: "https://villagermania-debf4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "villagermania-debf4",
  storageBucket: "villagermania-debf4.firebasestorage.app",
  messagingSenderId: "1042393850938",
  appId: "1:1042393850938:web:af2a2c677c714a97c64103",
};

// --- 2. Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// --- 3. DOM Element References ---
const mapContainer = document.getElementById('map-container');
const mapElement = document.getElementById('game-map');
const onboardingScreen = document.getElementById('onboarding-screen');
const nameInput = document.getElementById('name-input');
const joinButton = document.getElementById('join-button');
const rootRef = database.ref();
const emojiSelect = document.getElementById('emoji-select');
const playerControls = document.getElementById('player-controls');
const crushSelect = document.getElementById('crush-select');
const saveCrushButton = document.getElementById('save-crush-button');

// --- 4. Game State & Data ---
let myVillagerId = null;
const villagers = {};
let localVillagersState = {};
let mapLayout = [];
const emojiOptions = [
    '🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊', '😎', '👻', '👽', '🧑‍💻', '🧑‍🎤', '🧙', '🧛', '🧟'
];
const villagerTraits = ['Ambitious', 'Easygoing', 'Introvert', 'Extrovert'];

// --- 5. UI Creation & Helper Functions ---
function buildEmojiDropdown() {
    emojiOptions.forEach(emoji => {
        const option = document.createElement('option');
        option.value = emoji;
        option.textContent = emoji;
        emojiSelect.appendChild(option);
    });
}

function updateCrushDropdown(allVillagers, myId) {
    crushSelect.innerHTML = '<option value="">-- None --</option>';
    for (const villagerId in allVillagers) {
        if (villagerId !== myId) {
            const villager = allVillagers[villagerId];
            const option = document.createElement('option');
            option.value = villagerId;
            option.textContent = villager.name;
            crushSelect.appendChild(option);
        }
    }
}

function findRandomSpawnPoint() {
    const spawnableTiles = ['.'];
    let spawnPoint = null;
    while (spawnPoint === null && mapLayout.length > 0) {
        const x = Math.floor(Math.random() * 20) + 7;
        const y = Math.floor(Math.random() * 8) + 2;
        const tile = mapLayout[y]?.[x];
        if (spawnableTiles.includes(tile)) {
            spawnPoint = { x, y };
        }
    }
    return spawnPoint || { x: 5, y: 5 };
}

// --- 6. The Render Functions ---
function renderMap(newMapLayout) {
    if (!newMapLayout) return;
    mapLayout = newMapLayout;
    mapElement.textContent = mapLayout.join('\n');
}

function renderVillagers(allVillagers) {
    const villagerIdsInData = Object.keys(allVillagers);
    for (const villagerId in villagers) {
        if (!villagerIdsInData.includes(villagerId)) {
            villagers[villagerId].remove();
            delete villagers[villagerId];
        }
    }
    villagerIdsInData.forEach(villagerId => {
        const villagerData = allVillagers[villagerId];
        let villagerEl = villagers[villagerId];
        if (!villagerEl) {
            villagerEl = document.createElement('div');
            villagerEl.classList.add('villager');
            villagerEl.setAttribute('data-id', villagerId);
            villagers[villagerId] = villagerEl;
            mapContainer.appendChild(villagerEl);
        }
        villagerEl.textContent = villagerData.emoji;
        villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;
    });
}

// --- 7. The Single UI Update Function ---
function updateUI() {
    console.log("--- Updating UI ---");
    console.log("Current User ID (myVillagerId):", myVillagerId);
    console.log("Does my villager exist in the local data?", localVillagersState.hasOwnProperty(myVillagerId));
    
    if (myVillagerId && localVillagersState[myVillagerId]) {
        console.log("DECISION: Show game, hide onboarding.");
        onboardingScreen.style.display = 'none';
        playerControls.style.display = 'block';
    } else {
        console.log("DECISION: Show onboarding.");
        onboardingScreen.style.display = 'flex';
        playerControls.style.display = 'none';
    }
    console.log("--------------------");
}

// --- 8. Restructured Listeners & Auth Handling ---
auth.onAuthStateChanged(user => {
    console.log("Auth state changed. User:", user ? user.uid : "Logged out");
    if (user) {
        myVillagerId = user.uid;
        // Start listening to all game data now that we know who the user is
        rootRef.on('value', (snapshot) => {
            console.log("Database data received.");
            const data = snapshot.val() || {};
            const allVillagers = data.villagers || {};
            const newMapLayout = data.map || [];

            localVillagersState = allVillagers;
            
            renderMap(newMapLayout);
            renderVillagers(allVillagers);

            if (myVillagerId) {
                updateCrushDropdown(allVillagers, myVillagerId);
                const myVillagerData = allVillagers[myVillagerId];
                if (myVillagerData && myVillagerData.romanticInterest) {
                    crushSelect.value = myVillagerData.romanticInterest;
                }
            }
            
            updateUI();
        });
    } else {
        myVillagerId = null;
        renderMap([]);
        renderVillagers({});
        updateUI();
    }
});

// --- 9. Client-Side Game Loop (The "Muscles") ---
const GAME_TICK_MS = 2000;
setInterval(() => {
    for (const villagerId in localVillagersState) {
        const villagerData = localVillagersState[villagerId];
        const villagerEl = villagers[villagerId];
        if (!villagerData || !villagerEl) continue;

        let { x, y, targetX, targetY } = villagerData;
        targetX = targetX ?? x;
        targetY = targetY ?? y;

        if (x !== targetX || y !== targetY) {
            if (x < targetX) x++;
            else if (x > targetX) x--;
            else if (y < targetY) y++;
            else if (y > targetY) y--;
            villagerData.x = x;
            villagerData.y = y;
            villagerEl.style.transform = `translate(${x * 20}px, ${y * 22}px)`;
        }
    }
}, GAME_TICK_MS);

// --- 10. Event Listeners ---
joinButton.addEventListener('click', () => {
    console.log("Join Village button clicked.");
    const name = nameInput.value || "Anonymous";
    const emoji = emojiSelect.value;
    auth.signInAnonymously().catch(error => console.error(error)).then(() => {
        const user = auth.currentUser;
        if (!user) {
            console.error("Authentication failed, user is null.");
            return;
        }
        console.log("Sign-in successful. Creating villager for user:", user.uid);
        const newVillagerRef = database.ref(`villagers/${user.uid}`);
        const spawnPoint = findRandomSpawnPoint();
        newVillagerRef.set({
            id: user.uid,
            name: name,
            emoji: emoji,
            x: spawnPoint.x,
            y: spawnPoint.y,
            targetX: spawnPoint.x,
            targetY: spawnPoint.y,
            needs: { energy: 100, hunger: 0 },
            inventory: { food: 0 },
            action: "Wandering",
            relationships: {},
            romanticInterest: null,
            partnerId: null,
            trait: villagerTraits[Math.floor(Math.random() * villagerTraits.length)]
        });
    });
});

saveCrushButton.addEventListener('click', () => {
    const newCrushId = crushSelect.value;
    if (myVillagerId) {
        database.ref(`villagers/${myVillagerId}`).update({
            romanticInterest: newCrushId || null
        });
    }
});

// --- Initialize the app ---
buildEmojiDropdown();