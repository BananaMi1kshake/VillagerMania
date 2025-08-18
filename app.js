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
            // This complete block checks all four boundaries of the map.
            if (neighborPos.y < 0 || neighborPos.y >= grid.length || neighborPos.x < 0 || neighborPos.x >= grid[neighborPos.y].length) {
                continue; // Skip this neighbor, it's out of bounds
            }

            const neighborKey = `${neighborPos.x},${neighborPos.y}`;
            if (closedSet.has(neighborKey) || dynamicObstacles.has(neighborKey)) {
                continue;
            }
            
            const tile = grid[neighborPos.y][neighborPos.x];
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

function findRandomSpawnPoint() {
    const spawnableTiles = ['.'];
    let spawnPoint = null;
    let attempts = 0;

    const occupiedTiles = new Set();
    Object.values(localVillagersState).forEach(v => {
        occupiedTiles.add(`${v.x},${v.y}`);
    });

    while (spawnPoint === null && attempts < 100) {
        const x = Math.floor(Math.random() * 20) + 7;
        const y = Math.floor(Math.random() * 8) + 2;
        const tile = mapLayout[y]?.[x];
        const tileKey = `${x},${y}`;

        if (spawnableTiles.includes(tile) && !occupiedTiles.has(tileKey)) {
            spawnPoint = { x, y };
        }
        attempts++;
    }
    return spawnPoint || { x: 5, y: 5 };
}

// --- 7. The Render Function for the Map ---
function renderMap(newMapLayout) {
    if (!newMapLayout) return;
    mapLayout = newMapLayout;
    mapElement.textContent = mapLayout.join('\n');
}

// --- 8. Real-Time Listeners & Auth Handling ---
auth.onAuthStateChanged(user => {
    if (user) {
        myVillagerId = user.uid;
        villagersRef.child(myVillagerId).once('value', snapshot => {
            if (snapshot.exists()) {
                onboardingScreen.style.display = 'none';
                playerControls.style.display = 'block';
            } else {
                onboardingScreen.style.display = 'flex';
                playerControls.style.display = 'none';
            }
        });
    } else {
        auth.signInAnonymously().catch(error => console.error("Anonymous sign in failed:", error));
    }
});

mapRef.on('value', (snapshot) => {
    renderMap(snapshot.val());
});

villagersRef.on('child_added', (snapshot) => {
    const villagerData = snapshot.val();
    const villagerId = snapshot.key;
    localVillagersState[villagerId] = villagerData;

    const villagerEl = document.createElement('div');
    villagerEl.classList.add('villager');
    villagerEl.textContent = villagerData.emoji;
    villagerEl.style.transform = `translate(${villagerData.x * 20}px, ${villagerData.y * 22}px)`;
    villagers[villagerId] = villagerEl;
    mapContainer.appendChild(villagerEl);

    updateCrushDropdown(localVillagersState, myVillagerId);
});

villagersRef.on('child_changed', (snapshot) => {
    const serverData = snapshot.val();
    const villagerId = snapshot.key;
    const localData = localVillagersState[villagerId];
    const villagerEl = villagers[villagerId];

    if (localData && villagerEl) {
        const oldTargetX = localData.targetX;
        const oldTargetY = localData.targetY;

        Object.assign(localData, serverData);

        if (oldTargetX !== localData.targetX || oldTargetY !== localData.targetY) {
            const start = { x: localData.x, y: localData.y };
            const end = { x: localData.targetX, y: localData.targetY };
            const obstacles = new Set();
            for (const otherId in localVillagersState) {
                if (otherId !== villagerId) {
                    obstacles.add(`${localVillagersState[otherId].x},${localVillagersState[otherId].y}`);
                }
            }
            localData.path = findPath(start, end, mapLayout, walkableTiles, obstacles);
        }
        
        villagerEl.textContent = localData.emoji;
        updateCrushDropdown(localVillagersState, myVillagerId);
    }
});

villagersRef.on('child_removed', (snapshot) => {
    const villagerId = snapshot.key;
    const villagerEl = villagers[villagerId];
    if (villagerEl) {
        villagerEl.remove();
        delete villagers[villagerId];
    }
    delete localVillagersState[villagerId];
    updateCrushDropdown(localVillagersState, myVillagerId);
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

// --- 10. Event Listeners ---
joinButton.addEventListener('click', () => {
    if (!myVillagerId) {
        alert("Not logged in yet. Please wait a moment and try again.");
        return;
    }
    const name = nameInput.value || "Anonymous";
    const emoji = emojiSelect.value;
    const newVillagerRef = database.ref(`villagers/${myVillagerId}`);
    const spawnPoint = findRandomSpawnPoint();
    newVillagerRef.set({
        id: myVillagerId,
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