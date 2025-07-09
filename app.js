// Importations depuis le SDK Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, deleteDoc, doc, getDoc, query, where, orderBy, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// --- LISTE COMPLÈTE DES COLLÈGUES ---
const ALL_COLLEAGUES = [
    "Emma", "Laura", "Sabrina", "Leila", "Justine", "Laurine",
    "Thierry", "Baba", "Bryan", "Musty", "Eli", "Jason"
];

// --- Configuration et Initialisation de Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyCVAbwpiDH0FpE650_tAdiQnzy6skd-gjs",
    authDomain: "pointeuse-8d305.firebaseapp.com",
    projectId: "pointeuse-8d305",
    storageBucket: "pointeuse-8d305.appspot.com",
    messagingSenderId: "378848069195",
    appId: "1:378848069195:web:5ce90d1a3db8eac0c52fce"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const pointagesCollection = collection(db, "pointages");

// --- Éléments du DOM ---
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const exportBtn = document.getElementById("exportBtn");
const historyList = document.getElementById("historyList");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const historyContainer = document.getElementById("history");
const colleaguesContainer = document.getElementById("colleaguesContainer");
const manualBtn = document.getElementById("manualBtn");
const manualForm = document.getElementById("manualForm");
const manualColleaguesContainer = document.getElementById("manualColleaguesContainer");
const chantierInput = document.getElementById("chantierInput");
const notesInput = document.getElementById("notesInput");

const steps = [
    document.getElementById("stepColleagues"),
    document.getElementById("stepChantier"),
    document.getElementById("stepNotes")
];
const nextBtns = document.querySelectorAll(".nextBtn");

// --- État de l'application ---
let currentUser = null;
let isAdmin = false;
let colleagues = [];
let manualColleagues = [];

// =================================================================
// GESTION DU SERVICE WORKER
// =================================================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pointeuse/sw.js')
        .then(registration => console.log('Service Worker enregistré:', registration.scope))
        .catch(error => console.log('Erreur Service Worker:', error));

    navigator.serviceWorker.addEventListener('message', event => {
        const { action, startTime, timerData } = event.data;

        if (action === 'status' && event.data.isTicking) {
            alert("Un pointage en cours a été restauré.");
            colleagues = timerData.colleagues || [];
            chantierInput.value = timerData.chantier || "";
            notesInput.value = timerData.notes || "";
            
            startBtn.style.display = "none";
            stopBtn.style.display = "block";
            renderColleaguesSelection(colleagues, colleaguesContainer);
            steps.forEach(step => step.style.display = "block");
        }

        if (action === 'stopped') {
            saveToFirestore(new Date(startTime));
        }
    });
}

function getTimerStatus() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'getStatus' });
    }
}

// =================================================================
// AUTHENTIFICATION ET GESTION UI
// =================================================================

loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
logoutBtn.onclick = () => {
    isAdmin = false;
    signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const appContent = document.getElementById("app-content");
    const authContainer = document.getElementById("auth");

    if (user) {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        isAdmin = adminDocSnap.exists();
        if(isAdmin) console.log("Statut Admin : Activé");

        appContent.style.display = "block";
        authContainer.style.display = "none";
        logoutBtn.style.display = "block";
        loadHistory();
        setTimeout(getTimerStatus, 1000); // Attendre un peu que le SW soit prêt
    } else {
        appContent.style.display = "none";
        authContainer.style.display = "block";
        logoutBtn.style.display = "none";
    }
});

toggleHistoryBtn.onclick = () => {
    const isHidden = historyContainer.classList.toggle("hidden");
    toggleHistoryBtn.textContent = isHidden ? "Afficher l'historique" : "Cacher l'historique";
};

// =================================================================
// LOGIQUE DU POINTAGE EN TEMPS RÉEL
// =================================================================

startBtn.onclick = () => {
    resetTrackerForm();
    renderColleaguesSelection(colleagues, colleaguesContainer);
    startBtn.style.display = "none";
    stopBtn.style.display = "block";
    steps[0].style.display = "block";
    
    const data = {
        colleagues: [],
        chantier: "",
        notes: ""
    };
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'startTimer', data: data });
    }
};

nextBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
        if (index === 1 && chantierInput.value.trim() === "") {
            alert("Veuillez entrer un nom de client/chantier.");
            return;
        }
        steps[index].style.display = "none";
        if (steps[index + 1]) {
            steps[index + 1].style.display = "block";
        }
    });
});

stopBtn.onclick = () => {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'stopTimer' });
    }
};

async function saveToFirestore(startTime) {
    const endTime = new Date();
    const chantier = chantierInput.value.trim();
    const notesValue = notesInput.value.trim();

    if (!chantier) {
        alert("Le champ Client / Chantier est obligatoire pour enregistrer.");
        return;
    }

    const docData = {
        uid: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName,
        timestamp: startTime.toISOString(),
        chantier,
        notes: `Heure de fin : ${endTime.toLocaleTimeString()}${notesValue ? " - " + notesValue : ""}`,
        colleagues: colleagues.length ? colleagues : ["Seul"],
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(pointagesCollection, docData);
        alert("Session enregistrée !");
        resetTrackerForm();
        loadHistory();
    } catch (e) {
        console.error("Erreur d'enregistrement:", e);
        alert("Erreur lors de l'enregistrement.");
    }
}

function resetTrackerForm() {
    colleagues = [];
    chantierInput.value = "";
    notesInput.value = "";
    steps.forEach(step => step.style.display = "none");
    startBtn.style.display = "block";
    stopBtn.style.display = "none";
    renderColleaguesSelection([], colleaguesContainer);
}

// =================================================================
// LOGIQUE DU POINTAGE MANUEL
// =================================================================

manualBtn.onclick = () => {
    manualForm.classList.toggle("hidden");
    if (!manualForm.classList.contains("hidden")) {
        manualColleagues = [];
        renderColleaguesSelection(manualColleagues, manualColleaguesContainer);
    }
};

manualForm.onsubmit = async (e) => {
    e.preventDefault();
    const chantier = document.getElementById("manualChantier").value.trim();
    const date = document.getElementById("manualDate").value;
    const startTimeValue = document.getElementById("manualStart").value;
    const endTimeValue = document.getElementById("manualEnd").value;
    const notes = document.getElementById("manualNotes").value.trim();

    if (!chantier || !date || !startTimeValue || !endTimeValue) {
        alert("Veuillez remplir le chantier, la date et les heures.");
        return;
    }

    const startDateTime = new Date(`${date}T${startTimeValue}`);
    const endDateTime = new Date(`${date}T${endTimeValue}`);

    if (endDateTime <= startDateTime) {
        alert("L'heure de fin doit être après l'heure de début.");
        return;
    }
    
    const docData = {
        uid: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName,
        timestamp: startDateTime.toISOString(),
        chantier,
        notes: `(Saisie manuelle) Heure de fin : ${endDateTime.toLocaleTimeString()}${notes ? " - " + notes : ""}`,
        colleagues: manualColleagues.length ? manualColleagues : ["Seul"],
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(pointagesCollection, docData);
        alert("Pointage manuel enregistré !");
        manualForm.reset();
        manualForm.classList.add("hidden");
        loadHistory();
    } catch (error) {
        console.error("Erreur d'enregistrement manuel:", error);
        alert("Une erreur est survenue.");
    }
};

// =================================================================
// HISTORIQUE ET EXPORT
// =================================================================

async function loadHistory() {
    if (!currentUser) return;
    historyList.innerHTML = "<p>Chargement...</p>";
    
    let q = isAdmin
        ? query(pointagesCollection, orderBy("createdAt", "desc"))
        : query(pointagesCollection, where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(q);
    historyList.innerHTML = "";
    if (querySnapshot.empty) {
        historyList.innerHTML = "<p>Aucun pointage trouvé.</p>";
    }
    querySnapshot.forEach(docSnap => {
        const entryElement = createHistoryEntryElement(docSnap.id, docSnap.data());
        historyList.appendChild(entryElement);
    });
}

function createHistoryEntryElement(docId, d) {
    const wrapper = document.createElement("div");
    wrapper.className = "p-4 border rounded-lg bg-white relative shadow-sm";
    const date = new Date(d.timestamp);

    const userDisplay = isAdmin && d.userName ? `<div class="text-xs text-blue-600 font-semibold">${d.userName}</div>` : "";

    wrapper.innerHTML = `
      ${userDisplay}
      <div class="font-bold">${date.toLocaleDateString()} à ${date.toLocaleTimeString()}</div>
      <div><strong>Client / Chantier :</strong> ${d.chantier}</div>
      <div><strong>Collègues :</strong> ${d.colleagues.join(", ")}</div>
      <div class="mt-1 pt-1 border-t text-sm"><strong>Notes :</strong> ${d.notes}</div>
    `;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✖";
    deleteBtn.className = "absolute top-2 right-3 text-gray-400 hover:text-red-600 font-bold";
    deleteBtn.onclick = async () => {
        if (confirm("Supprimer ce pointage ?")) {
            await deleteDoc(doc(db, "pointages", docId));
            loadHistory();
        }
    };
    wrapper.appendChild(deleteBtn);
    return wrapper;
}

exportBtn.onclick = async () => {
    if (!currentUser) return;
    
    let q = isAdmin
        ? query(pointagesCollection, orderBy("timestamp", "desc"))
        : query(pointagesCollection, where("uid", "==", currentUser.uid), orderBy("timestamp", "desc"));
    
    const snap = await getDocs(q);
    if (snap.empty) {
        alert("Aucune donnée à exporter.");
        return;
    }

    let csvContent = "Nom,Email,Date,Client-Chantier,Collegues,Notes\n";
    snap.forEach(doc => {
        const d = doc.data();
        const date = new Date(d.timestamp).toLocaleString();
        const sanitize = (str) => `"${(str || "").replace(/"/g, '""')}"`;
        const row = [
            sanitize(d.userName),
            sanitize(d.userEmail),
            sanitize(date),
            sanitize(d.chantier),
            sanitize(d.colleagues.join(", ")),
            sanitize(d.notes)
        ].join(",") + "\n";
        csvContent += row;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_pointages_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// =================================================================
// FONCTION COMMUNE
// =================================================================

function renderColleaguesSelection(list, container) {
    container.innerHTML = "";
    ALL_COLLEAGUES.forEach(name => {
        const button = document.createElement("button");
        button.textContent = name;
        button.type = "button";
        
        button.onclick = () => {
            const listIndex = list.indexOf(name);
            if (listIndex > -1) {
                list.splice(listIndex, 1);
            } else {
                list.push(name);
            }
            updateColleagueButtonStyle(button, list.includes(name));
        };
        updateColleagueButtonStyle(button, list.includes(name));
        container.appendChild(button);
    });
}

function updateColleagueButtonStyle(button, isSelected) {
    button.className = isSelected
        ? "px-4 py-2 rounded-full border bg-blue-600 text-white"
        : "px-4 py-2 rounded-full border bg-gray-200 hover:bg-gray-300";
}