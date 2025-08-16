// --- 1. Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDbLi0f7Y1ijPKzFSMjCW1v-qpEjgyVTII",
  authDomain: "villagermania-debf4.firebaseapp.com",
  databaseURL: "https://villagermania-debf4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "villagermania-debf4",
  storageBucket: "villagermania-debf4.firebasestorage.app",
  messagingSenderId: "1042393850938",
  appId: "1:1042393850938:web:af2a2c677c714a97c64103"
};

// --- 2. Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// --- 3. DOM Element References ---
const mapElement = document.getElementById('game-map');
const onboardingScreen = document.getElementById('onboarding-screen');
const nameInput = document.getElementById('name-input');
const joinButton = document.getElementById('join-button');
const villagersRef = database.ref('villagers');
const emojiSelect = document.getElementById('emoji-select');
const playerControls = document.getElementById('player-controls');
const crushSelect = document.getElementById('crush-select');
const saveCrushButton = document.getElementById('save-crush-button');

// --- 4. Game State & Data ---
let myVillagerId = null;
const emojiOptions = [
    '🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊', '😎', '👻', '👽', '🧑‍💻', '🧑‍🎤', '🧙', '🧛', '🧟'
];
const mapLayout = [
    "####################################",
    "#..T.........B............T...T....#",
    "#..TT........H................TT...#",
    "#...T................B.............#",
    "#...................~~~~...........#",
    "#..................~~~~~~..........#",
    "#..T...............~~~~............#",
    "#..TT..............................#",
    "#...........B..........H........T..#",
    "#..................................#",
    "#...T...T....................TT....#",
    "####################################"
];

// --- 5. UI Creation Functions ---
function buildEmojiDropdown() {
    emojiOptions.forEach(emoji => {
        const option = document.createElement('option');
        option.value = emoji;
        option.textContent = emoji;
        emojiSelect.appendChild(option);
    });
}

function updateCrushDropdown(allVillagers, myId) {
    crushSelect.innerHTML = '<option value="">-- None --</option>'; // Default empty option
    for (const villagerId in allVillagers) {
        if (villagerId !== myId) { // Can't have a crush on yourself
            const villager = allVillagers[villagerId];
            const option = document.createElement('option');
            option.value = villagerId;
            option.textContent = villager.name;
            crushSelect.appendChild(option);
        }
    }
}

// --- 6. The Render Function ---
function renderGame(villagersData) {
    const mapGrid = mapLayout.map(row => row.split(''));
    if (villagersData) {
        Object.values(villagersData).forEach(villager => {
            if (villager && typeof villager.y !== 'undefined' && typeof villager.x !== 'undefined') {
                if (mapGrid[villager.y] && mapGrid[villager.y][villager.x]) {
                    mapGrid[villager.y][villager.x] = villager.emoji;
                }
            }
        });
    }
    mapElement.textContent = mapGrid.map(row => row.join('')).join('\n');
}

// --- 7. Real-Time Listeners & Auth Handling ---
auth.onAuthStateChanged(user => {
    if (user) {
        myVillagerId = user.uid;
        // Check if this user already has a villager
        villagersRef.child(myVillagerId).once('value', snapshot => {
            if (snapshot.exists()) {
                // If they exist, hide onboarding and show controls
                onboardingScreen.style.display = 'none';
                playerControls.style.display = 'block';
            }
        });
    }
});

villagersRef.on('value', (snapshot) => {
    // If snapshot.val() is null (empty village), use an empty object {} instead.
    const allVillagers = snapshot.val() || {};
    
    renderGame(allVillagers);

    // If the player is logged in, keep their crush dropdown updated
    if (myVillagerId) {
        updateCrushDropdown(allVillagers, myVillagerId);
        const myVillagerData = allVillagers[myVillagerId];
        if (myVillagerData && myVillagerData.romanticInterest) {
            crushSelect.value = myVillagerData.romanticInterest;
        }
    }
});

// --- 8. Event Listeners ---
joinButton.addEventListener('click', () => {
    const name = nameInput.value || "Anonymous";
    const emoji = emojiSelect.value;

    auth.signInAnonymously().catch(error => console.error(error)).then(() => {
        const user = auth.currentUser;
        if (!user) return;

        const newVillagerRef = villagersRef.child(user.uid);
        newVillagerRef.set({
            id: user.uid,
            name: name,
            emoji: emoji,
            x: 5,
            y: 5,
            needs: { energy: 100, hunger: 0 },
            inventory: { food: 0 },
            action: "Wandering",
            relationships: {},
            romanticInterest: null,
            partnerId: null
        });
    });
});

saveCrushButton.addEventListener('click', () => {
    const newCrushId = crushSelect.value;
    if (myVillagerId) {
        villagersRef.child(myVillagerId).update({
            romanticInterest: newCrushId || null // Set to null if "-- None --" is chosen
        });
    }
});

// --- Initialize the app ---
buildEmojiDropdown();






