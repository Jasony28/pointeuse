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
const exportBtn = document.getElementById("exportBtn");
const historyList = document.getElementById("historyList");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const historyContainer = document.getElementById("history");
const manualForm = document.getElementById("manualForm");
const manualColleaguesContainer = document.getElementById("manualColleaguesContainer");

// --- État de l'application ---
let currentUser = null;
let isAdmin = false;
let manualColleagues = [];

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
        renderColleaguesSelection(manualColleagues, manualColleaguesContainer);
        loadHistory();
    } else {
        appContent.style.display = "none";
        authContainer.style.display = "block";
        logoutBtn.style.display = "none";
    }
});

toggleHistoryBtn.onclick = () => {
    historyContainer.classList.toggle("hidden");
};

// =================================================================
// LOGIQUE DU POINTAGE MANUEL
// =================================================================

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
        endTime: endDateTime.toISOString(),
        chantier,
        notes: `(Saisie manuelle)${notes ? " " + notes : ""}`,
        colleagues: manualColleagues.length ? manualColleagues : ["Seul"],
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(pointagesCollection, docData);
        alert("Pointage manuel enregistré !");
        manualForm.reset();
        manualColleagues = [];
        renderColleaguesSelection(manualColleagues, manualColleaguesContainer);
        loadHistory();
    } catch (error) {
        console.error("Erreur d'enregistrement manuel:", error);
        alert("Une erreur est survenue.");
    }
};

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

// ### MODIFICATION PRINCIPALE ICI ###
function createHistoryEntryElement(docId, d) {
    const wrapper = document.createElement("div");
    wrapper.className = "p-4 border rounded-lg bg-white relative shadow-sm space-y-1"; // Ajout de space-y-1 pour espacer les lignes
    
    const startDate = new Date(d.timestamp);
    const endDate = d.endTime ? new Date(d.endTime) : null;

    const userDisplay = isAdmin && d.userName ? `<div class="text-xs text-blue-600 font-semibold">${d.userName}</div>` : "";
    
    let timeDisplay = "";
    let durationDisplay = "";

    if (endDate) {
        // Formatage des heures sans les secondes
        const timeFormat = { hour: '2-digit', minute: '2-digit' };
        const startTimeString = startDate.toLocaleTimeString('fr-FR', timeFormat);
        const endTimeString = endDate.toLocaleTimeString('fr-FR', timeFormat);
        
        timeDisplay = `<div>De ${startTimeString} à ${endTimeString}</div>`;

        // Calcul et formatage de la durée
        const durationMs = endDate - startDate;
        const durationHours = Math.floor(durationMs / 3600000);
        const durationMinutes = Math.round((durationMs % 3600000) / 60000);
        durationDisplay = `<div class="text-sm text-gray-600">Durée : ${durationHours}h ${durationMinutes}min</div>`;
    } else {
        timeDisplay = `<div>Le ${startDate.toLocaleDateString('fr-FR')} à ${startDate.toLocaleTimeString('fr-FR')}</div>`;
    }

    // Nouvelle mise en page de l'affichage
    wrapper.innerHTML = `
      ${userDisplay}
      <div class="font-bold text-lg">${d.chantier}</div>
      <div>${startDate.toLocaleDateString('fr-FR')}</div>
      ${timeDisplay}
      ${durationDisplay}
      <div class="mt-2"><strong>Collègues :</strong> ${d.colleagues.join(", ")}</div>
      ${d.notes ? `<div class="mt-1 pt-2 border-t text-sm"><strong>Notes :</strong> ${d.notes}</div>` : ""}
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

    let csvContent = "Nom,Email,Date,Heure début,Heure fin,Durée (min),Client-Chantier,Collegues,Notes\n";
    snap.forEach(doc => {
        const d = doc.data();
        const startDate = new Date(d.timestamp);
        const endDate = d.endTime ? new Date(d.endTime) : null;
        let durationMinutes = 0;

        if (endDate) {
            durationMinutes = Math.round((endDate - startDate) / 60000);
        }

        const sanitize = (str) => `"${(str || "").replace(/"/g, '""')}"`;
        const row = [
            sanitize(d.userName),
            sanitize(d.userEmail),
            sanitize(startDate.toLocaleDateString('fr-FR')),
            sanitize(startDate.toLocaleTimeString('fr-FR')),
            sanitize(endDate ? endDate.toLocaleTimeString('fr-FR') : 'N/A'),
            durationMinutes,
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