// modules/ui.js
import { emojiOptions, localVillagersState, mapLayout, walkableTiles, setMapLayout } from './state.js';

// DOM Element References
const mapContainer = document.getElementById('map-container');
const mapElement = document.getElementById('game-map');
const onboardingScreen = document.getElementById('onboarding-screen');
const playerControls = document.getElementById('player-controls');
const emojiSelect = document.getElementById('emoji-select');
// The crushSelect is no longer used, but we can leave the reference for now.
const crushSelect = document.getElementById('crush-select'); 
const rosterList = document.getElementById('roster-list');
const profileModal = document.getElementById('profile-modal');
const profileDetails = document.getElementById('profile-details');

export function buildEmojiDropdown() {
    emojiOptions.forEach(emoji => {
        const option = document.createElement('option');
        option.value = emoji;
        option.textContent = emoji;
        emojiSelect.appendChild(option);
    });
}

// This function is no longer needed with the new system.
export function updateCrushDropdown(myId) {
    // We can leave this empty or remove it later.
}

export function findRandomSpawnPoint() {
    let spawnPoint = null;
    let attempts = 0;
    const occupiedTiles = new Set();
    Object.values(localVillagersState).forEach(v => {
        occupiedTiles.add(`${v.x},${v.y}`);
    });
    while (spawnPoint === null && attempts < 100) {
        const x = Math.floor(Math.random() * mapLayout[0].length);
        const y = Math.floor(Math.random() * mapLayout.length);
        const tile = mapLayout[y]?.[x];
        const tileKey = `${x},${y}`;
        if (walkableTiles.includes(tile) && !occupiedTiles.has(tileKey)) {
            spawnPoint = { x, y };
        }
        attempts++;
    }
    return spawnPoint || { x: 5, y: 5 };
}

export function renderMap(newMapLayout) {
    if (!newMapLayout || newMapLayout.length === 0) return;
    setMapLayout(newMapLayout);

    mapElement.innerHTML = '';
    const treeEmojis = ['🌳', '🌲'];
    const berryEmojis = ['🫐', '🍇'];

    newMapLayout.forEach(rowString => {
        for (const char of rowString) {
            const tile = document.createElement('span');
            tile.classList.add('map-tile');

            switch (char) {
                case '.':
                    tile.textContent = '.';
                    tile.classList.add('grass');
                    break;
                case '~':
                    tile.textContent = '~';
                    tile.classList.add('water');
                    break;
                case 'T':
                    tile.textContent = treeEmojis[Math.floor(Math.random() * treeEmojis.length)];
                    break;
                case 'B':
                    tile.textContent = berryEmojis[Math.floor(Math.random() * berryEmojis.length)];
                    break;
                case 'H':
                    tile.textContent = '🏠';
                    break;
                case '#':
                    tile.textContent = '#';
                    break;
                default:
                    tile.textContent = char;
            }
            mapElement.appendChild(tile);
        }
    });
}


export function updateRoster() {
    rosterList.innerHTML = "";
    Object.keys(localVillagersState).forEach(villagerId => {
        const villagerData = localVillagersState[villagerId];
        const li = document.createElement('li');
        // UPDATED: Roster now shows mood
        li.textContent = `${villagerData.emoji} ${villagerData.name} (${villagerData.mood || '...'})`;
        li.addEventListener('click', () => {
            showProfile(villagerId);
        });
        rosterList.appendChild(li);
    });
}

export function showProfile(villagerId) {
    const villagerData = localVillagersState[villagerId];
    if (!villagerData) return;

    // UPDATED: Profile modal now shows the new data model
    let relationshipsHtml = '<h4>Relationships:</h4><ul>';
    if (villagerData.relationships) {
        for (const otherId in villagerData.relationships) {
            const otherName = localVillagersState[otherId]?.name || '...';
            const relData = villagerData.relationships[otherId];
            // Display the new state and opinion
            relationshipsHtml += `<li>${otherName}: ${relData.state} (${relData.opinion})</li>`;
        }
    }
    relationshipsHtml += '</ul>';

    profileDetails.innerHTML = `
        <h2>${villagerData.emoji} ${villagerData.name}</h2>
        <p><strong>Trait:</strong> ${villagerData.trait}</p>
        <p><strong>Mood:</strong> ${villagerData.mood}</p>
        <p><strong>Current Goal:</strong> ${villagerData.activeSocialGoal ? villagerData.activeSocialGoal.text : 'Nothing'}</p>
        ${villagerData.relationships ? relationshipsHtml : ''}
    `;
    profileModal.style.display = 'flex';
}

export function updateUI(myId) {
    if (myId && localVillagersState[myId]) {
        onboardingScreen.style.display = 'none';
        playerControls.style.display = 'block';
    } else {
        onboardingScreen.style.display = 'flex';
        playerControls.style.display = 'none';
    }
}
