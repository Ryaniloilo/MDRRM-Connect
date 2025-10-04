// resident.js — Revised complete version
// Depends on common.js (read/write/DB helpers must exist)

// -------------------------
// Elements (defensive)
// -------------------------
const incidentType = document.getElementById('incident-type');
const incidentDesc = document.getElementById('incident-desc');
const residentName = document.getElementById('resident-name');
const residentPhone = document.getElementById('resident-phone');
const residentZone = document.getElementById('resident-zone');
const oneTapBtn = document.getElementById('one-tap-report');
const residentFeedback = document.getElementById('resident-feedback');

const reportsList = document.getElementById('reports-list');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const exportHistoryBtn = document.getElementById('export-history');

// Map controls
const mapZoneFilterEl = document.getElementById('map-zone-filter');
const refreshMapBtn = document.getElementById('refresh-map');

// -------------------------
// Helpers
// -------------------------
function safeEl(id) { return document.getElementById(id); }

function fmtDateSafe(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toLocaleString();
}

// ensure DB arrays exist
function ensureDBArray(name) {
  try {
    const arr = read(name);
    if (!Array.isArray(arr)) write(name, []);
  } catch (e) {
    write(name, []);
  }
}

// -------------------------
// Setup: ensure DB arrays & populate zones
// -------------------------
ensureDBArray(DB.reports);
ensureDBArray(DB.history);
ensureDBArray(DB.notifications);
ensureDBArray(DB.zones);

(function populateZoneSelect() {
  if (!residentZone) return;
  // clear existing options except placeholder
  const basePlaceholder = residentZone.querySelector('option') ? residentZone.querySelector('option').outerHTML : '<option value="">Select barangay zone (optional)</option>';
  residentZone.innerHTML = basePlaceholder;

  const zones = read(DB.zones) || [];
  zones.forEach(z => {
    const opt = document.createElement('option');
    opt.value = z.id;
    opt.textContent = z.name;
    residentZone.appendChild(opt);
  });

  // If there's a saved residentZone in localStorage, preselect
  const savedZone = localStorage.getItem('residentZone');
  if (savedZone) residentZone.value = savedZone;
})();

// -------------------------
// One-tap Report Submission
// -------------------------
if (oneTapBtn) {
  oneTapBtn.addEventListener('click', async () => {
    if (residentFeedback) residentFeedback.textContent = 'Capturing location — allow location access...';
    oneTapBtn.disabled = true;

    const mediaFile = document.getElementById("incident-media")?.files?.[0] || null;

    try {
      const pos = await getCurrentPosition();
      saveReport(pos.coords.latitude, pos.coords.longitude, mediaFile);
      if (residentFeedback) residentFeedback.textContent = 'Report submitted! DRRMC will be notified.';
    } catch (e) {
      // fallback: save without coords
      saveReport(null, null, mediaFile);
      if (residentFeedback) residentFeedback.textContent = 'Location unavailable. Report saved without GPS.';
    } finally {
      oneTapBtn.disabled = false;
      if (incidentDesc) incidentDesc.value = '';
      if (document.getElementById("incident-media")) document.getElementById("incident-media").value = "";
      renderReports();
      renderResidentMap();
    }
  });
}

// -------------------------
// Save Report
// -------------------------
function saveReport(lat, lng, media = null) {
  const r = {
    id: 'R' + Date.now(),
    name: residentName?.value || 'Anonymous',
    phone: residentPhone?.value || '',
    incidentType: incidentType?.value || 'Other',
    description: incidentDesc?.value || '',
    lat: lat ?? null,
    lng: lng ?? null,
    zone: residentZone?.value || '',
    status: 'pending',
    timestamp: new Date().toISOString(),
    media: media ? URL.createObjectURL(media) : null,
    submittedBy: "me"
  };

  // Save resident’s chosen zone to localStorage (ID)
  if (r.zone) localStorage.setItem("residentZone", r.zone);

  const arr = read(DB.reports) || [];
  arr.push(r);
  write(DB.reports, arr);
}

// -------------------------
// Render Active Reports
// -------------------------
function renderReports() {
  if (!reportsList) return;
  const arr = read(DB.reports) || [];
  reportsList.innerHTML = '';

  if (!arr.length) {
    reportsList.innerHTML = '<p>No active reports.</p>';
    return;
  }

  // newest first
  arr.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  arr.forEach(r => {
    const reporter = r.name || 'Anonymous';
    const time = fmtDateSafe(r.timestamp) || 'Unknown time';
    const zone = r.zone || 'Unzoned';
    const status = r.status || 'pending';
    const type = r.incidentType || 'Unknown';

    let mediaHtml = '';
    if (r.media) {
      if (/\.(mp4|webm|ogg)$/i.test(r.media)) {
        mediaHtml = `<video src="${r.media}" controls width="160"></video>`;
      } else {
        mediaHtml = `<img src="${r.media}" alt="media" style="max-width:160px;display:block;margin-top:6px;border-radius:6px;">`;
      }
    }

    const card = document.createElement('div');
    card.className = 'report-item';
    card.innerHTML = `
      <strong>${type}</strong> — <small>${zone}</small><br>
      <div class="report-meta">${time} • ${reporter}</div>
      <div>Status: <em>${status}</em></div>
      <div>${escapeHtml(r.description || '')}</div>
      ${mediaHtml}
    `;
    reportsList.appendChild(card);
  });
}

// small helper to avoid accidental HTML injection from descriptions
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// -------------------------
// Render Responded (History)
// -------------------------
function renderHistory() {
  if (!historyList) return;
  const arr = read(DB.history) || [];
  historyList.innerHTML = '';

  if (!arr.length) {
    historyList.innerHTML = '<p>No responded reports yet.</p>';
    return;
  }

  // sort newest first using best available time
  arr.sort((a, b) => {
    const ta = new Date(b.resolvedTime || b.dispatchTime || b.timestamp || b.actionTime || 0);
    const tb = new Date(a.resolvedTime || a.dispatchTime || a.timestamp || a.actionTime || 0);
    return ta - tb;
  });

  arr.forEach(r => {
    const reporter = r.name || r.reporter || 'Anonymous';
    const zone = r.zone || 'Unzoned';
    const type = r.incidentType || 'Unknown';
    const status = r.status || r.action || 'unknown';

    const dispatchAt = fmtDateSafe(r.dispatchTime);
    const resolvedAt = fmtDateSafe(r.resolvedTime);
    const createdAt = fmtDateSafe(r.timestamp);
    const actedAt = fmtDateSafe(r.actionTime);
    const timeToShow = resolvedAt || dispatchAt || actedAt || createdAt || 'Unknown time';

    const allocatedText = r.allocation
      ? `<div style="margin-top:6px;"><em>Allocated: ${r.allocation.qty} × ${escapeHtml(r.allocation.itemName || r.allocation.itemId || '')}</em></div>`
      : '';

    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div><strong>${type}</strong> — <small>${zone}</small></div>
      <div class="report-meta">${escapeHtml(reporter)} • ${timeToShow}</div>
      <div>Status: <span style="font-weight:600">${escapeHtml(status)}</span></div>
      ${dispatchAt ? `<div style="color:#f59e0b">Dispatched: ${dispatchAt}</div>` : ''}
      ${resolvedAt ? `<div style="color:#10b981">Resolved: ${resolvedAt}</div>` : ''}
      ${allocatedText}
      <div style="margin-top:6px;">${escapeHtml(r.description || '')}</div>
    `;
    historyList.appendChild(div);
  });
}

// -------------------------
// Notifications rendering & toast
// -------------------------
function renderResidentNotifications() {
  const container = document.getElementById("resident-notifs");
  if (!container) return;

  const list = read(DB.notifications) || [];
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = "<p>No notifications yet.</p>";
    return;
  }

  list.sort((a, b) => new Date(b.sentTime) - new Date(a.sentTime))
    .forEach(n => {
      const div = document.createElement("div");
      div.className = "resident-notif";
      div.innerHTML = `
        <strong>${fmtDateSafe(n.sentTime) || ''}</strong><br/>
        ${escapeHtml(n.message)}<br/>
        <small>${n.zone || "All Zones"} • Channels:
          ${n.channels?.sms ? "SMS " : ""}${n.channels?.push ? "Push " : ""}
        </small>
      `;
      container.appendChild(div);
    });
}

let lastNotifId = null;
function checkForNewNotifications() {
  const list = read(DB.notifications) || [];
  if (!list.length) return;
  const latest = list[list.length - 1];
  if (latest.id !== lastNotifId) {
    lastNotifId = latest.id;
    showToast(latest.message || 'New notification');
    renderResidentNotifications();
  }
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// -------------------------
// Map for Residents (robust)
// -------------------------
let residentMap = null;
let reportMarkers = []; // track markers so we can clear them reliably
let youMarker = null;

(function initResidentMap() {
  const mapEl = document.getElementById("resident-map");
  if (!mapEl) return;

  residentMap = L.map(mapEl).setView([10.7, 122.56], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(residentMap);

  // add "you are here" marker (if available)
  getCurrentPosition().then(pos => {
    if (!residentMap) return;
    youMarker = L.marker([pos.coords.latitude, pos.coords.longitude])
      .addTo(residentMap)
      .bindPopup("You are here");
  }).catch(()=>{/* ignore position errors */});

  // initial render
  renderResidentMap();
})();

function renderResidentMap() {
  if (!residentMap) return;

  // remove only tracked report markers
  reportMarkers.forEach(m => residentMap.removeLayer(m));
  reportMarkers = [];

  const all = read(DB.reports) || [];
  const savedZone = localStorage.getItem("residentZone") || ''; // saved selected zone ID
  const filter = (mapZoneFilterEl && mapZoneFilterEl.value) ? mapZoneFilterEl.value : (localStorage.getItem('mapZoneFilter') || 'all');

  // if user chose "myzone" but no saved zone, fallback to all
  const filtered = (filter === "myzone" && savedZone)
    ? all.filter(r => r.zone === savedZone)
    : all;

  filtered.forEach(r => {
    if (r.lat == null || r.lng == null) return;

    const icon = L.icon({
      iconUrl: r.submittedBy === "me" ? "my-report.png" : "others-report.png",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -25]
    });

    let mediaHtml = '';
    if (r.media) {
      if (/\.(mp4|webm|ogg)$/i.test(r.media)) {
        mediaHtml = `<video src="${r.media}" controls width="200"></video>`;
      } else {
        mediaHtml = `<img src="${r.media}" width="200" style="margin-top:5px;border-radius:8px;display:block;max-width:95%"/>`;
      }
    }

    const popup = `
      <b>${escapeHtml(r.incidentType || 'Unknown')}</b><br>
      ${escapeHtml(r.description || '')}<br>
      Status: ${escapeHtml(r.status || '')}<br>
      ${r.submittedBy === "me" ? "<em>(My Report)</em><br>" : ""}
      ${mediaHtml}
    `;

    const marker = L.marker([r.lat, r.lng], { icon }).bindPopup(popup);
    marker.addTo(residentMap);
    reportMarkers.push(marker);
  });

  // fit bounds if there are markers
  if (reportMarkers.length > 0) {
    const group = L.featureGroup(reportMarkers);
    residentMap.fitBounds(group.getBounds().pad(0.2));
    if (residentMap.getZoom() > 16) residentMap.setZoom(16);
  }
}

// -------------------------
// Map controls wiring & persist map filter choice
// -------------------------
if (mapZoneFilterEl) {
  // restore saved filter if present
  const savedFilter = localStorage.getItem('mapZoneFilter');
  if (savedFilter) mapZoneFilterEl.value = savedFilter;

  mapZoneFilterEl.addEventListener('change', () => {
    localStorage.setItem('mapZoneFilter', mapZoneFilterEl.value);
    renderResidentMap();
  });
}

if (refreshMapBtn) {
  refreshMapBtn.addEventListener('click', renderResidentMap);
}

// -------------------------
// Extra Controls: clear/export history (use common helpers if available)
// -------------------------
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm("Are you sure you want to clear all history?")) return;
    // if clearHistory() helper exists, call it, otherwise directly clear DB.history
    if (typeof clearHistory === 'function') {
      clearHistory();
    } else {
      write(DB.history, []);
    }
    renderHistory();
  });
}

if (exportHistoryBtn) {
  exportHistoryBtn.addEventListener('click', () => {
    if (typeof exportHistoryCSV === 'function') {
      exportHistoryCSV("resident_history");
    } else {
      // fallback CSV export of DB.history
      const arr = read(DB.history) || [];
      if (!arr.length) { alert("No history to export"); return; }
      const header = ["id","incidentType","description","zone","status","name","phone","timestamp","dispatchTime","resolvedTime"];
      const rows = arr.map(r => [
        r.id || '',
        r.incidentType || '',
        (r.description || '').replace(/\n/g,' '),
        r.zone || '',
        r.status || '',
        r.name || '',
        r.phone || '',
        r.timestamp || '',
        r.dispatchTime || '',
        r.resolvedTime || ''
      ]);
      const csv = [header.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resident_history.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });
}


// -------------------------
// Clear Notifications (Resident)
// -------------------------
const clearNotifsBtn = document.getElementById("clear-notifs-resident");
if (clearNotifsBtn) {
  clearNotifsBtn.addEventListener("click", () => {
    if (!confirm("Are you sure you want to clear all notifications?")) return;
    write(DB.notifications, []); // wipe notifications in storage
    renderResidentNotifications(); // re-render empty state
  });
}

// -------------------------
// Utilities
// -------------------------
function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 8000 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// -------------------------
// Init (initial render + polling)
// -------------------------
renderReports();
renderHistory();
renderResidentNotifications();
setInterval(() => {
  try {
    renderReports();
    renderHistory();
    renderResidentNotifications();
    checkForNewNotifications();
  } catch (e) {
    // non-fatal, keep polling
    console.warn("Resident auto-refresh error:", e);
  }
}, 3000);
