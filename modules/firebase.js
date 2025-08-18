// modules/firebase.js

// IMPORTANT: The firebase SDK scripts must remain in your index.html

const firebaseConfig = {
  apiKey: "AIzaSyDbLi0f7Y1ijPKzFSMjCW1v-qpEjgyVTII",
  authDomain: "villagermania-debf4.firebaseapp.com",
  databaseURL: "https://villagermania-debf4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "villagermania-debf4",
  storageBucket: "villagermania-debf4.firebasestorage.app",
  messagingSenderId: "1042393850938",
  appId: "1:1042393850938:web:af2a2c677c714a97c64103",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to the services we need
const database = firebase.database();
const auth = firebase.auth();

// Make them available to other files
export { database, auth };