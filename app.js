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
let isTicking = false;

// =================================================================
// GESTION DU SERVICE WORKER
// =================================================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pointeuse/sw.js')
        .then(registration => console.log('Service Worker enregistré:', registration.scope))
        .catch(error => console.log('Erreur Service Worker:', error));

    navigator.serviceWorker.addEventListener('message', event => {
        const { action, startTime } = event.data;

        if (action === 'status' && event.data.isTicking) {
            restoreUiFromServiceWorker(event.data);
        }

        if (action === 'stopped') {
            saveToFirestore(new Date(startTime), event.data.timerData);
        }
    });
}

function postMessageToServiceWorker(message) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.active.postMessage(message);
        });
    }
}

function updateServiceWorkerData() {
    if (!isTicking) return; // Ne met à jour que si un pointage est actif
    const data = {
        colleagues,
        chantier: chantierInput.value,
        notes: notesInput.value
    };
    postMessageToServiceWorker({ action: 'updateTimerData', data });
}

function restoreUiFromServiceWorker(data) {
    isTicking = true;
    alert("Un pointage en cours a été restauré.");
    colleagues = data.timerData.colleagues || [];
    chantierInput.value = data.timerData.chantier || "";
    notesInput.value = data.timerData.notes || "";
    
    startBtn.style.display = "none";
    stopBtn.style.display = "block";
    renderColleaguesSelection(colleagues, colleaguesContainer);
    steps.forEach(step => step.style.display = "block");
}

// =================================================================
// AUTHENTIFICATION
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
        postMessageToServiceWorker({ action: 'getStatus' });
    } else {
        appContent.style.display = "none";
        authContainer.style.display = "block";
        logoutBtn.style.display = "none";
    }
});


// =================================================================
// LOGIQUE DU POINTAGE EN TEMPS RÉEL
// =================================================================

startBtn.onclick = () => {
    isTicking = true;
    resetTrackerForm();
    renderColleaguesSelection(colleagues, colleaguesContainer);
    startBtn.style.display = "none";
    stopBtn.style.display = "block";
    steps[0].style.display = "block";
    
    const data = { colleagues, chantier: "", notes: "" };
    postMessageToServiceWorker({ action: 'startTimer', data });
};

stopBtn.onclick = () => {
    postMessageToServiceWorker({ action: 'stopTimer' });
};

async function saveToFirestore(startTime, timerData) {
    const endTime = new Date();
    const chantier = chantierInput.value.trim();
    const notesValue = notesInput.value.trim();

    if (!chantier) {
        alert("Le champ Client / Chantier est obligatoire pour enregistrer.");
        resetTrackerForm(); // On réinitialise l'UI même si l'enregistrement échoue
        return;
    }

    const docData = {
        uid: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName,
        timestamp: startTime.toISOString(),
        chantier,
        notes: `Heure de fin : ${endTime.toLocaleTimeString()}${notesValue ? " - " + notesValue : ""}`,
        colleagues: timerData.colleagues.length ? timerData.colleagues : ["Seul"],
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(pointagesCollection, docData);
        alert("Session enregistrée !");
    } catch (e) {
        console.error("Erreur d'enregistrement:", e);
        alert("Erreur lors de l'enregistrement.");
    } finally {
        resetTrackerForm();
        loadHistory();
    }
}

function resetTrackerForm() {
    isTicking = false;
    colleagues = [];
    chantierInput.value = "";
    notesInput.value = "";
    steps.forEach(step => step.style.display = "none");
    startBtn.style.display = "block";
    stopBtn.style.display = "none";
    renderColleaguesSelection([], colleaguesContainer);
}

// Ajout des écouteurs pour la sauvegarde automatique
chantierInput.addEventListener('input', updateServiceWorkerData);
notesInput.addEventListener('input', updateServiceWorkerData);
// (la sauvegarde pour les collègues est dans renderColleaguesSelection)

// Le reste du code est ici...
// =================================================================
// FONCTION COMMUNE POUR LA SÉLECTION DES COLLÈGUES
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
            // On met à jour les données dans le SW si c'est le pointage en temps réel
            if (container.id === 'colleaguesContainer') {
                updateServiceWorkerData();
            }
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
toggleHistoryBtn.onclick = () => {
    const isHidden = historyContainer.classList.toggle("hidden");
    toggleHistoryBtn.textContent = isHidden ? "Afficher l'historique" : "Cacher l'historique";
};
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
