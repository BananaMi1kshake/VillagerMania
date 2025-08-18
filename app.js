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
const villagersRef = database.ref('villagers');
const mapRef = database.ref('map');
const emojiSelect = document.getElementById('emoji-select');
const playerControls = document.getElementById('player-controls');
const crushSelect = document.getElementById('crush-select');
const saveCrushButton = document.getElementById('save-crush-button');

// --- 4. Game State & Data ---
let myVillagerId = null;
const villagers = {}; 
let localVillagersState = {}; 
let mapLayout = [];
const walkableTiles = [".", "H", "B"]; 
const emojiOptions = [
    '🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊', '😎', '👻', '👽', '🧑‍💻', '🧑‍🎤', '🧙', '🧛', '🧟'
];
const villagerTraits = ['Ambitious', 'Easygoing', 'Introvert', 'Extrovert'];

// --- 5. A* Pathfinding Algorithm ---
function findPath(start, end, grid, walkable, dynamicObstacles) {
    function Node(x, y, parent = null) {
        this.x = x;
        this.y = y;
        this.parent = parent;
        this.g = parent ? parent.g + 1 : 0;
        this.h = Math.abs(x - end.x) + Math.abs(y - end.y);
        this.f = this.g + this.h;
    }

    const openSet = [new Node(start.x, start.y)];
    const closedSet = new Set();

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const currentNode = openSet.shift();

        if (currentNode.x === end.x && currentNode.y === end.y) {
            const path = [];
            let current = currentNode;
            while (current) {
                path.unshift({ x: current.x, y: current.y });
                current = current.parent;
            }
            return path.slice(1);
        }

        closedSet.add(`${currentNode.x},${currentNode.y}`);

        const neighbors = [
            { x: currentNode.x, y: currentNode.y - 1 },
            { x: currentNode.x, y: currentNode.y + 1 },
            { x: currentNode.x - 1, y: currentNode.y },
            { x: currentNode.x + 1, y: currentNode.y }
        ];

        for (const neighborPos of neighbors) {
            const neighborKey = `${neighborPos.x},${neighborPos.y}`;
            if (closedSet.has(neighborKey) || dynamicObstacles.has(neighborKey)) {
                continue;
            }
            
            const tile = grid[neighborPos.y]?.[neighborPos.x];
            if (!walkable.includes(tile)) {
                continue;
            }

            const neighborNode = new Node(neighborPos.x, neighborPos.y, currentNode);
            const openNode = openSet.find(node => node.x === neighborNode.x && node.y === neighborNode.y);

            if (!openNode || neighborNode.g < openNode.g) {
                if (!openNode) {
                    openSet.push(neighborNode);
                } else {
                    openNode.parent = currentNode;
                    openNode.g = neighborNode.g;
                    openNode.f = neighborNode.f;
                }
            }
        }
    }
    return []; // No path found
}

// --- 6. UI Creation & Helper Functions ---
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

// UPDATED: Function to find a valid AND UNOCCUPIED random spawn point
function findRandomSpawnPoint() {
    const spawnableTiles = ['.'];
    let spawnPoint = null;
    let attempts = 0; // Prevent infinite loops

    // Create a set of currently occupied tiles for quick checking
    const occupiedTiles = new Set();
    Object.values(localVillagersState).forEach(v => {
        occupiedTiles.add(`${v.x},${v.y}`);
    });

    while (spawnPoint === null && attempts < 100) {
        const x = Math.floor(Math.random() * 20) + 7;
        const y = Math.floor(Math.random() * 8) + 2;
        const tile = mapLayout[y]?.[x];
        const tileKey = `${x},${y}`;

        // Check if the tile is both walkable AND not occupied
        if (spawnableTiles.includes(tile) && !occupiedTiles.has(tileKey)) {
            spawnPoint = { x, y };
        }
        attempts++;
    }
    return spawnPoint || { x: 5, y: 5 }; // Fallback if no spot is found
}

// --- 7. The Render Functions ---
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
            mapContainer.appendChild(villagerEl);
            villagers[villagerId] = villagerEl;
        }
        villagerEl.textContent = villagerData.emoji;
        villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;
    });
}

// --- 8. Real-Time Listeners & Auth Handling ---
auth.onAuthStateChanged(user => {
    if (user) {
        myVillagerId = user.uid;
        rootRef.on('value', snapshot => {
            const data = snapshot.val() || {};
            const allVillagers = data.villagers || {};
            const newMapLayout = data.map || [];
            localVillagersState = allVillagers;
            renderMap(newMapLayout);
            renderVillagers(allVillagers);
            if (myVillagerId) {
                updateCrushDropdown(allVillagers, myVillagerId);
                const myVillagerData = allVillagers[myVillagerId];
                if (myVillagerData?.romanticInterest) {
                    crushSelect.value = myVillagerData.romanticInterest;
                }
            }
            if (myVillagerId && allVillagers[myVillagerId]) {
                onboardingScreen.style.display = 'none';
                playerControls.style.display = 'block';
            } else {
                onboardingScreen.style.display = 'flex';
                playerControls.style.display = 'none';
            }
        });
    } else {
        myVillagerId = null;
    }
});

villagersRef.on('child_changed', (snapshot) => {
    const villagerData = snapshot.val();
    const villagerId = snapshot.key;
    const localData = localVillagersState[villagerId];

    if (localData && (localData.targetX !== villagerData.targetX || localData.targetY !== villagerData.targetY)) {
        const start = { x: localData.x, y: localData.y };
        const end = { x: villagerData.targetX, y: villagerData.targetY };
        const obstacles = new Set();
        for (const otherId in localVillagersState) {
            if (otherId !== villagerId) {
                const other = localVillagersState[otherId];
                obstacles.add(`${other.x},${other.y}`);
            }
        }
        localData.path = findPath(start, end, mapLayout, walkableTiles, obstacles);
    }
});

// --- 9. Client-Side Game Loop ---
const GAME_TICK_MS = 1000;
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
        }
    }
}, GAME_TICK_MS);

// --- 10. Event Listeners ---
joinButton.addEventListener('click', () => {
    const name = nameInput.value || "Anonymous";
    const emoji = emojiSelect.value;
    auth.signInAnonymously().catch(error => console.error(error)).then(() => {
        const user = auth.currentUser;
        if (!user) return;
        const newVillagerRef = database.ref(`villagers/${user.uid}`);
        const spawnPoint = findRandomSpawnPoint();
        newVillagerRef.set({
            id: user.uid,
            name,
            emoji,
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