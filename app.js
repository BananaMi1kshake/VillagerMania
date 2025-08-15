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

// --- 4. Game Data ---
const emojiOptions = [
    '🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊', '😎', '👻', '👽', '🧑‍💻', '🧑‍🎤', '🧙', '🧛', '🧟'
];

const mapLayout = [
    "####################################",
    "#..T......................T...T....#",
    "#..TT........H................TT...#",
    "#...T..............................#",
    "#...................~~~~...........#",
    "#..................~~~~~~..........#",
    "#..T...............~~~~............#",
    "#..TT..............................#",
    "#......................H........T..#",
    "#..................................#",
    "#...T...T....................TT....#",
    "####################################"
];

// --- 5. Emoji Dropdown Creation ---
function buildEmojiDropdown() {
    emojiOptions.forEach(emoji => {
        const option = document.createElement('option');
        option.value = emoji;
        option.textContent = emoji;
        emojiSelect.appendChild(option);
    });
}

// --- 6. The Render Function ---
function renderGame(villagersData) {
    const mapGrid = mapLayout.map(row => row.split(''));
    if (villagersData) {
        Object.values(villagersData).forEach(villager => {
            // Check if villager data and coordinates are valid
            if (villager && typeof villager.y !== 'undefined' && typeof villager.x !== 'undefined') {
                if (mapGrid[villager.y] && mapGrid[villager.y][villager.x]) {
                    mapGrid[villager.y][villager.x] = villager.emoji;
                }
            }
        });
    }
    mapElement.textContent = mapGrid.map(row => row.join('')).join('\n');
}

// --- 7. The Real-Time Listener ---
villagersRef.on('value', (snapshot) => {
    const allVillagers = snapshot.val();
    renderGame(allVillagers);
});

// --- 8. Onboarding Logic ---
joinButton.addEventListener('click', () => {
    const name = nameInput.value || "Anonymous";
    const emoji = emojiSelect.value; // Get value from the dropdown

    auth.signInAnonymously().then(() => {
        const user = auth.currentUser;
        if (!user) return; // Guard against null user

        const newVillagerRef = villagersRef.child(user.uid);

        newVillagerRef.set({
            id: user.uid,
            name: name,
            emoji: emoji,
            x: 5, // A safe starting position
            y: 5,
            needs: {
                energy: 100
            },
            action: "Wandering"
        });

        onboardingScreen.style.display = 'none';

    }).catch((error) => {
        console.error("Error creating villager:", error);
        alert("Could not create villager. Check console for details.");
    });
});

// --- Initialize the app ---
buildEmojiDropdown();