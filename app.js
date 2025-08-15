// --- 1. Firebase Configuration ---
// IMPORTANT: Replace this with your project's configuration object
// Go to Project Settings -> General -> Your apps -> SDK setup and configuration
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
