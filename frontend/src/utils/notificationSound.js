let audioContext = null;
let gestureUnlocked = false;

function unlock() {
  gestureUnlocked = true;
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
}

window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

export function playNotificationSound() {
  if (!gestureUnlocked) return;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audioContext = audioContext || new Ctor();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.55);
  } catch (e) {
    // Audio is best-effort; never break the notification flow.
  }
}
