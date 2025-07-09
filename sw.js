// sw.js - Service Worker (mis à jour)

let startTime = null;
let timerData = {};

self.addEventListener('message', event => {
  if (!event.data) return;

  const { action, data } = event.data;

  if (action === 'startTimer') {
    startTime = new Date();
    timerData = data;
    console.log('SW: Pointage démarré');
  }

  // NOUVELLE INSTRUCTION pour mettre à jour les données
  if (action === 'updateTimerData') {
    if (startTime) { // On met à jour seulement si un pointage est en cours
      timerData = data;
    }
  }

  if (action === 'stopTimer') {
    if (event.source && startTime) {
      event.source.postMessage({
        action: 'stopped',
        startTime: startTime,
        timerData: timerData
      });
      startTime = null;
      timerData = {};
      console.log('SW: Pointage arrêté');
    }
  }

  if (action === 'getStatus') {
    if (event.source) {
      event.source.postMessage({
        action: 'status',
        isTicking: !!startTime,
        startTime: startTime,
        timerData: timerData
      });
    }
  }
});
