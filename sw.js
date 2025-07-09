// sw.js - Service Worker pour la gestion du pointage hors ligne

let startTime = null;
let timerData = {};

// Écoute les messages venant de l'application
self.addEventListener('message', event => {
  if (!event.data) return;

  const { action, data } = event.data;

  if (action === 'startTimer') {
    startTime = new Date();
    timerData = data; // Sauvegarde les données initiales
    console.log('Service Worker: Pointage démarré à', startTime);
  }

  if (action === 'stopTimer') {
    if (event.source && startTime) {
      // Quand l'app demande d'arrêter, on renvoie l'heure de début
      event.source.postMessage({
        action: 'stopped',
        startTime: startTime,
        timerData: timerData
      });
      // Et on réinitialise
      startTime = null;
      timerData = {};
      console.log('Service Worker: Pointage arrêté et données envoyées.');
    }
  }

  if (action === 'getStatus') {
    if (event.source) {
      // L'app demande si un pointage est en cours
      event.source.postMessage({
        action: 'status',
        isTicking: !!startTime, // Renvoie true si startTime n'est pas null
        startTime: startTime,
        timerData: timerData
      });
    }
  }
});