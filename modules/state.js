// modules/state.js

export let myVillagerId = null;
export const villagers = {}; // Holds villager DOM elements
export let localVillagersState = {}; // Holds a local copy of all villager data
export let mapLayout = [];
export const walkableTiles = [".", "H", "B"]; 
export const emojiOptions = [
    '🧑‍🌾', '👩‍🍳', '👨‍🎨', '👩‍🚀', '🦊', '🦉', '🤖', '😊', '😎', '👻', '👽', '🧑‍💻', '🧑‍🎤', '🧙', '🧛', '🧟'
];
export const villagerTraits = ['Ambitious', 'Easygoing', 'Introvert', 'Extrovert'];

export function setMyVillagerId(id) {
    myVillagerId = id;
}

export function setMapLayout(layout) {
    mapLayout = layout;
}