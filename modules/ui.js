// modules/ui.js
import { emojiOptions, localVillagersState, mapLayout, walkableTiles } from './state.js';

// DOM Element References
const mapContainer = document.getElementById('map-container');
const mapElement = document.getElementById('game-map');
const onboardingScreen = document.getElementById('onboarding-screen');
const playerControls = document.getElementById('player-controls');
const emojiSelect = document.getElementById('emoji-select');
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

export function updateCrushDropdown(myId) {
    const currentCrush = crushSelect.value;
    crushSelect.innerHTML = '<option value="">-- None --</option>';
    for (const villagerId in localVillagersState) {
        if (villagerId !== myId) {
            const villager = localVillagersState[villagerId];
            const option = document.createElement('option');
            option.value = villagerId;
            option.textContent = villager.name;
            crushSelect.appendChild(option);
        }
    }
    crushSelect.value = currentCrush;
}

export function findRandomSpawnPoint() {
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
        if (walkableTiles.includes(tile) && !occupiedTiles.has(tileKey)) {
            spawnPoint = { x, y };
        }
        attempts++;
    }
    return spawnPoint || { x: 5, y: 5 };
}

export function renderMap(newMapLayout) {
    if (!newMapLayout) return;
    setMapLayout(newMapLayout);
    mapElement.textContent = mapLayout.join('\n');
}

export function updateRoster() {
    rosterList.innerHTML = "";
    Object.keys(localVillagersState).forEach(villagerId => {
        const villagerData = localVillagersState[villagerId];
        const li = document.createElement('li');
        li.textContent = `${villagerData.emoji} ${villagerData.name} - ${villagerData.action}`;
        li.addEventListener('click', () => {
            showProfile(villagerId);
        });
        rosterList.appendChild(li);
    });
}

export function showProfile(villagerId) {
    const villagerData = localVillagersState[villagerId];
    if (!villagerData) return;
    let relationshipsHtml = '<h4>Relationships:</h4><ul>';
    if (villagerData.relationships) {
        for (const otherId in villagerData.relationships) {
            const otherName = localVillagersState[otherId]?.name || '...';
            relationshipsHtml += `<li>${otherName}: ${villagerData.relationships[otherId]}</li>`;
        }
    }
    relationshipsHtml += '</ul>';
    profileDetails.innerHTML = `
        <h2>${villagerData.emoji} ${villagerData.name}</h2>
        <p><strong>Trait:</strong> ${villagerData.trait}</p>
        <p><strong>Action:</strong> ${villagerData.action}</p>
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