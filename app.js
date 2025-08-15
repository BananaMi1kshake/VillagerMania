// --- 1. Firebase Configuration ---
// IMPORTANT: Replace this with your project's configuration object
// Go to Project Settings -> General -> Your apps -> SDK setup and configuration
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

// --- 3. Game State & References ---
const mapElement = document.getElementById('game-map');
const villagersRef = database.ref('villagers');

// The static layout of our world
const mapLayout = [
    "######################",
    "#..T..............T..#",
    "#..TT........H.....TT#",
    "#...T................#",
    "#.........~~.........#",
    "#.........~~.........#",
    "#....................#",
    "######################"
];


// --- 4. The Render Function ---
function renderGame(villagersData) {
    // Create a mutable copy of the map layout
    const mapGrid = mapLayout.map(row => row.split(''));

    // Place villagers on the grid
    if (villagersData) {
        Object.values(villagersData).forEach(villager => {
            // Ensure villager is within map bounds
            if (mapGrid[villager.y] && mapGrid[villager.y][villager.x]) {
                mapGrid[villager.y][villager.x] = villager.emoji;
            }
        });
    }

    // Convert the grid back to a string and display it
    mapElement.textContent = mapGrid.map(row => row.join('')).join('\n');
}


// --- 5. The Real-Time Listener ---
villagersRef.on('value', (snapshot) => {
    const allVillagers = snapshot.val();
    // Render the game state whenever data changes
    renderGame(allVillagers);
});
