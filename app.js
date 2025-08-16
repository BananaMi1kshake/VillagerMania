// --- 1. Firebase Configuration ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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
    const emoji = emojiSelect.value;

    auth.signInAnonymously().then(() => {
        const user = auth.currentUser;
        if (!user) return;

        const newVillagerRef = villagersRef.child(user.uid);

        newVillagerRef.set({
            id: user.uid,
            name: name,
            emoji: emoji,
            x: 5,
            y: 5,
            needs: {
                energy: 100,
                hunger: 0
            },
            inventory: {
                food: 0
            },
            action: "Wandering",
            relationships: {} // Villagers start with no relationships
        });

        onboardingScreen.style.display = 'none';

    }).catch((error) => {
        console.error("Error creating villager:", error);
        alert("Could not create villager. Check console for details.");
    });
});

// --- Initialize the app ---
buildEmojiDropdown();