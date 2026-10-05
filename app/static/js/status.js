// Poll /api/robot/status and update header status elements

function initStatus() {
  const connEl = document.getElementById('conn-indicator');
  const battEl = document.getElementById('battery-level');

  if (!connEl || !battEl) return;

  // Fetch status from the server and update the indicators
  async function fetchStatus() {
    try {
      const res = await fetch('/api/robot/status');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const connected = !!data.connected;
      const battery = (data.battery === null || data.battery === undefined) ? null : Number(data.battery);

      if (connected) {
        connEl.textContent = 'Connected';
        connEl.classList.remove('disconnected');
        connEl.classList.add('connected');
      } else {
        connEl.textContent = 'Disconnected';
        connEl.classList.remove('connected');
        connEl.classList.add('disconnected');
      }

      if (battery === null) {
        battEl.textContent = 'Battery: N/A';
      } else {
        const pct = Math.round(battery * 100);
        battEl.textContent = `Battery: ${pct}%`;
      }
    } catch (err) {
      connEl.textContent = 'Disconnected';
      connEl.classList.remove('connected');
      connEl.classList.add('disconnected');
      battEl.textContent = 'Battery: N/A';
      
      console.debug('status poll failed:', err);
    }
  }

  // Make the initial fetch and satrt the periodic polling
  fetchStatus();
  setInterval(fetchStatus, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStatus);
} else {
  setTimeout(initStatus, 0);
}
