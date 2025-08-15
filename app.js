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
const emojiMenu = document.getElementById('emoji-menu');

// --- 4. Game Data ---
const emojiOptions = ['🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊'];
let selectedEmoji = emojiOptions[0];

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

// --- 5. Emoji Menu Creation ---
function buildEmojiMenu() {
    emojiOptions.forEach(emoji => {
        const button = document.createElement('button');
        button.classList.add('emoji-option');
        button.textContent = emoji;

        if (emoji === selectedEmoji) {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            selectedEmoji = emoji;
            document.querySelectorAll('.emoji-option').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
        });
        emojiMenu.appendChild(button);
    });
}

// --- 6. The Render Function ---
function renderGame(villagersData) {
    const mapGrid = mapLayout.map(row => row.split(''));
    if (villagersData) {
        Object.values(villagersData).forEach(villager => {
            if (mapGrid[villager.y] && mapGrid[villager.y][villager.x]) {
                mapGrid[villager.y][villager.x] = villager.emoji;
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

    auth.signInAnonymously().then(() => {
        const user = auth.currentUser;
        const newVillagerRef = villagersRef.child(user.uid);

        newVillagerRef.set({
            id: user.uid,
            name: name,
            emoji: selectedEmoji,
            x: 5,
            y: 5,
            needs: {
                energy: 100 // Villagers start with full energy
            },
            action: "Wandering" // Give them an initial action
        });

        onboardingScreen.style.display = 'none';

    }).catch((error) => {
        console.error("Error creating villager:", error);
    });
});

// --- Initialize the app ---
buildEmojiMenu();