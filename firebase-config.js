// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVAbwpiDH0FpE650_tAdiQnzy6skd-gjs",
  authDomain: "pointeuse-8d305.firebaseapp.com",
  projectId: "pointeuse-8d305",
  storageBucket: "pointeuse-8d305.appspot.com",
  messagingSenderId: "378848069195",
  appId: "1:378848069195:web:5ce90d1a3db8eac0c52fce",
  measurementId: "G-DN375W1D31"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Services Firebase
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db };
