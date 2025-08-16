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
const villagersRef = database.ref('villagers');
const mapRef = database.ref('map');
const emojiSelect = document.getElementById('emoji-select');
const playerControls = document.getElementById('player-controls');
const crushSelect = document.getElementById('crush-select');
const saveCrushButton = document.getElementById('save-crush-button');

// --- 4. Game State & Data ---
let myVillagerId = null;
const villagers = {}; // An object to hold villager DOM elements
let localVillagersState = {}; // Holds a local copy of all villager data for the game loop
const emojiOptions = [
    '🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊', '😎', '👻', '👽', '🧑‍💻', '🧑‍🎤', '🧙', '🧛', '🧟'
];
let mapLayout = [];

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

// --- 6. Render Function (Map only) ---
function renderMap(newMapLayout) {
    if (!newMapLayout) return;
    mapLayout = newMapLayout;
    mapElement.textContent = mapLayout.join('\n');
}

// --- 7. Real-Time Listeners & Auth Handling ---
auth.onAuthStateChanged(user => {
    if (user) {
        myVillagerId = user.uid;
        villagersRef.child(myVillagerId).once('value', snapshot => {
            if (snapshot.exists()) {
                onboardingScreen.style.display = 'none';
                playerControls.style.display = 'block';
            }
        });
    }
});

mapRef.on('value', (snapshot) => {
    const newMapLayout = snapshot.val();
    renderMap(newMapLayout);
});

villagersRef.on('child_added', (snapshot) => {
    const villagerData = snapshot.val();
    const villagerId = snapshot.key;
    const villagerEl = document.createElement('div');
    villagerEl.classList.add('villager');
    villagerEl.textContent = villagerData.emoji;
    villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;
    villagerEl.setAttribute('data-id', villagerId);
    villagers[villagerId] = villagerEl;
    mapContainer.appendChild(villagerEl);
});

villagersRef.on('child_removed', (snapshot) => {
    const villagerId = snapshot.key;
    const villagerEl = villagers[villagerId];
    if (villagerEl) {
        villagerEl.remove();
        delete villagers[villagerId];
    }
});

// A single listener to keep our local data copy in sync for the game loop
villagersRef.on('value', (snapshot) => {
    localVillagersState = snapshot.val() || {};
    if (myVillagerId) {
        updateCrushDropdown(localVillagersState, myVillagerId);
        const myVillagerData = localVillagersState[myVillagerId];
        if (myVillagerData && myVillagerData.romanticInterest) {
            crushSelect.value = myVillagerData.romanticInterest;
        }
    }
});

// --- 8. Client-Side Game Loop (The "Muscles") ---
const GAME_TICK_MS = 2000; // Move every 2 seconds

setInterval(() => {
    for (const villagerId in localVillagersState) {
        const villagerData = localVillagersState[villagerId];
        const villagerEl = villagers[villagerId];
        if (!villagerData || !villagerEl) continue;

        let { x, y, targetX, targetY } = villagerData;
        targetX = targetX ?? x; // Use current x if target is not set
        targetY = targetY ?? y; // Use current y if target is not set

        // If we are not at our server-defined target, move one step closer
        if (x !== targetX || y !== targetY) {
            if (x < targetX) x++;
            else if (x > targetX) x--;
            else if (y < targetY) y++;
            else if (y > targetY) y--;

            // Update the local state for the next tick
            villagerData.x = x;
            villagerData.y = y;

            // Update the visual position on screen
            villagerEl.style.transform = `translate(${x * 20}px, ${y * 22}px)`;
        }
    }
}, GAME_TICK_MS);


// --- 9. Event Listeners ---
joinButton.addEventListener('click', () => {
    const name = nameInput.value || "Anonymous";
    const emoji = emojiSelect.value;
    auth.signInAnonymously().catch(error => console.error(error)).then(() => {
        const user = auth.currentUser;
        if (!user) return;
        const newVillagerRef = villagersRef.child(user.uid);
        const spawnPoint = findRandomSpawnPoint();
        newVillagerRef.set({
            id: user.uid,
            name: name,
            emoji: emoji,
            x: spawnPoint.x,
            y: spawnPoint.y,
            targetX: spawnPoint.x, // Set initial target
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
        villagersRef.child(myVillagerId).update({
            romanticInterest: newCrushId || null
        });
    }
});

// --- Initialize the app ---
buildEmojiDropdown();