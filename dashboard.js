// DRRMC Dashboard logic
// Depends on common.js

const reportsList = document.getElementById('reports-list');
const filterZone = document.getElementById('filter-zone');
const filterStatus = document.getElementById('filter-status');
const notifZone = document.getElementById('notif-zone');
const notifMessage = document.getElementById('notif-message');
const notifLog = document.getElementById('notif-log');
const sendNotifBtn = document.getElementById('send-notif');
const notifSms = document.getElementById('notif-sms');
const notifPush = document.getElementById('notif-push');

// History controls
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-dashboard');
const exportHistoryBtn = document.getElementById('export-history-dashboard');

// Add a search bar dynamically
const historySearch = document.createElement("input");
historySearch.type = "text";
historySearch.placeholder = "Search history...";
historySearch.style = "width:100%; margin:8px 0; padding:6px; border:1px solid #ccc; border-radius:5px;";
if (historyList && historyList.parentNode) {
  historyList.parentNode.insertBefore(historySearch, historyList);
}

// Allocation modal
const allocConfirm = document.getElementById('alloc-confirm');
const allocClose = document.getElementById('alloc-close');
const allocReportInfo = document.getElementById('alloc-report-info');
const allocMessage = document.getElementById('alloc-message');

let currentAllocReportId = null;

// -------------------------
// Map
// -------------------------
let map;
const mapEl = document.getElementById('map');
if (mapEl) {
  map = L.map(mapEl).setView([10.7, 122.56], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}
let reportMarkers = {};

// -------------------------
// Populate Zones
// -------------------------
(function populateZones() {
  const zones = read(DB.zones);
  [filterZone, notifZone].forEach(sel => {
    if (!sel) return;
    const curr = sel.value;
    sel.innerHTML = '<option value="">All Zones</option>';
    zones.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.name;
      sel.appendChild(opt);
    });
    sel.value = curr || '';
  });
})();

// -------------------------
// Render Reports
// -------------------------
function renderReports() {
  const all = read(DB.reports);
  const zoneFilter = filterZone.value;
  const statusFilter = filterStatus.value;
  reportsList.innerHTML = '';

  // Remove old markers
  Object.values(reportMarkers).forEach(m => map.removeLayer(m));
  reportMarkers = {};

  // Apply filters
  const filtered = all.filter(r => {
    if (zoneFilter && r.zone !== zoneFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Render each report
  filtered.forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${r.incidentType}</strong> — ${r.zone || 'Unzoned'}
        <div class="report-meta">${new Date(r.timestamp).toLocaleString()} • ${r.name}</div>
        <div>${r.description || ''}</div>
      </div>
      <div class="report-actions">
        <button class="btn view" onclick="focusReport('${r.id}')">View</button>
        <select onchange="updateStatus('${r.id}', this.value)">
          <option value="pending" ${r.status==="pending"?"selected":""}>Pending</option>
          <option value="dispatched" ${r.status==="dispatched"?"selected":""}>Dispatched</option>
          <option value="resolved" ${r.status==="resolved"?"selected":""}>Resolved</option>
        </select>
      </div>
    `;
    reportsList.appendChild(li);

    // Add marker if lat/lng available
    if (r.lat && r.lng) {
      let iconUrl;
      switch (r.incidentType) {
        case "Fire": iconUrl = "fire.png"; break;
        case "Flood": iconUrl = "flood.png"; break;
        case "Accident": iconUrl = "accident.png"; break;
        case "Medical": iconUrl = "medical.png"; break;
        default: iconUrl = "default.png";
      }

      const customIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30]
      });

      const marker = L.marker([r.lat, r.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`<b>${r.incidentType}</b><br>${r.description}<br>${r.name}<br>${r.phone}`);

      reportMarkers[r.id] = marker;
    }
  });

  // ✅ Auto-zoom to all markers after rendering
  if (Object.keys(reportMarkers).length > 0) {
    const group = L.featureGroup(Object.values(reportMarkers));
    map.fitBounds(group.getBounds().pad(0.2));

    // Ensure minimum zoom (don’t zoom in too far when only one marker)
    if (map.getZoom() > 16) {
      map.setZoom(16);
    }
  }

  // Refresh analytics
  renderAnalytics();

}

function focusReport(id) {
  const marker = reportMarkers[id];
  if (marker) {
    map.setView(marker.getLatLng(), 16);
    marker.openPopup();
  } else {
    alert("No location data available for this report.");
  }
}

// -------------------------
// Report → History handling
// -------------------------
function updateStatus(id, newStatus) {
  let reports = read(DB.reports);
  let history = read(DB.history);
  const idx = reports.findIndex(r => r.id === id);

  if (idx !== -1) {
    const report = reports[idx];

    if (newStatus === "dispatched") {
      report.status = "dispatched";
      write(DB.reports, reports);

      let h = history.find(h => h.id === report.id);
      if (!h) {
        history.push({
          ...report,
          status: "dispatched",
          dispatchTime: new Date().toISOString()
        });
      } else {
        h.status = "dispatched";
        h.dispatchTime = new Date().toISOString();
      }
      write(DB.history, history);
    } 
    else if (newStatus === "resolved") {
      reports.splice(idx, 1);
      write(DB.reports, reports);

      let h = history.find(h => h.id === report.id);
      if (!h) {
        history.push({
          ...report,
          status: "resolved",
          resolvedTime: new Date().toISOString()
        });
      } else {
        h.status = "resolved";
        h.resolvedTime = new Date().toISOString();
      }
      write(DB.history, history);
    } 
    else {
      report.status = newStatus;
      write(DB.reports, reports);
    }

    renderReports();
    renderHistory();
  }
}


// -------------------------
// Notifications
// -------------------------
sendNotifBtn.addEventListener('click', () => {
  const msg = notifMessage.value.trim();
  if (!msg) return;
  const notif = {
    id: 'N' + Date.now(),
    message: msg,
    zone: notifZone ? notifZone.value : '',
    channels: { sms: notifSms.checked, push: notifPush.checked },
    sentTime: new Date().toISOString()
  };
  const list = read(DB.notifications);
  list.push(notif);
  write(DB.notifications, list);
  logNotification(notif);
  notifMessage.value = '';
});

// -------------------------
// Allocation
// -------------------------
function openAllocModal(id) {
  currentAllocReportId = id;
  const r = read(DB.reports).find(x => x.id === id);
  allocReportInfo.textContent = `${r.incidentType} — ${r.description || ''}`;
  allocMessage.textContent = '';
  allocQty.value = 1;
  allocModal.classList.remove('hidden');
}
allocClose.addEventListener('click', () => allocModal.classList.add('hidden'));

// -------------------------
// History (with search + badges + icons)
// -------------------------
function renderHistory() {
  historyList.innerHTML = '';
  const arr = read(DB.history).sort((a, b) => 
    new Date(b.resolvedTime || b.dispatchTime) - new Date(a.resolvedTime || a.dispatchTime)
  );

  // Apply search filter
  const searchTerm = historySearch.value.toLowerCase();
  const filtered = arr.filter(r => 
    r.incidentType.toLowerCase().includes(searchTerm) ||
    (r.description && r.description.toLowerCase().includes(searchTerm)) ||
    (r.zone && r.zone.toLowerCase().includes(searchTerm)) ||
    (r.name && r.name.toLowerCase().includes(searchTerm))
  );

  if (!filtered.length) {
    historyList.innerHTML = "<p>No matching history found.</p>";
    return;
  }

  filtered.forEach(r => {
    const div = document.createElement('div');
    div.className = 'history-item';

    // Incident type icons
    let typeIcon = "🚨";
    switch (r.incidentType) {
      case "Fire": typeIcon = "🔥"; break;
      case "Flood": typeIcon = "🌊"; break;
      case "Accident": typeIcon = "🚗"; break;
      case "Medical": typeIcon = "🚑"; break;
    }

    const allocatedText = r.allocation 
      ? `<br/><em>Allocated: ${r.allocation.qty} × ${r.allocation.itemName || r.allocation.itemId}</em>` 
      : '';

    // Status badge
    let badge = "";
    if (r.status === "dispatched") {
      badge = `<span style="background:#f59e0b; color:white; padding:2px 6px; border-radius:6px; font-size:12px; margin-left:6px;">Dispatched</span>`;
    }
    if (r.status === "resolved") {
      badge = `<span style="background:#10b981; color:white; padding:2px 6px; border-radius:6px; font-size:12px; margin-left:6px;">Resolved</span>`;
    }

    // Time info
    let timeInfo = "";
    if (r.dispatchTime) timeInfo += `<br/><span style="color:#f59e0b;">🚑 Dispatched at ${new Date(r.dispatchTime).toLocaleString()}</span>`;
    if (r.resolvedTime) timeInfo += `<br/><span style="color:#10b981;">✅ Resolved at ${new Date(r.resolvedTime).toLocaleString()}</span>`;

    div.innerHTML = `
      ${typeIcon} <strong>${r.incidentType}</strong> ${badge} — ${r.description || ''}<br/>
      <small>${r.name}</small>
      ${timeInfo}
      ${allocatedText}
    `;
    historyList.appendChild(div);
  });
}

// Re-render history when search is typed
historySearch.addEventListener("input", renderHistory);

 // -------------------------
// Analytics (Charts)
// -------------------------
let incidentChart, zoneChart, timeChart;
let analyticsSource = "reports"; // default = Active

// Listen for toggle change
document.querySelectorAll("input[name='analytics-source']").forEach(radio => {
  radio.addEventListener("change", e => {
    analyticsSource = e.target.value;

    // Update section heading
    document.getElementById("analytics-title").textContent =
      analyticsSource === "history"
        ? "📊 Incident Analytics (History)"
        : "📊 Incident Analytics (Active)";

    renderAnalytics();
  });
});

// Helper: choose data source (with filters)
function getAnalyticsData() {
  let data = analyticsSource === "history" ? read(DB.history) : read(DB.reports);

  const zoneFilter = filterZone.value;
  const statusFilter = filterStatus.value;

  return data.filter(r => {
    if (zoneFilter && r.zone !== zoneFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });
}


// Helper: dynamic chart title
function getAnalyticsLabel(base) {
  return analyticsSource === "history"
    ? `${base} (History)`
    : `${base} (Active)`;
}

// Incident Types Pie
function renderIncidentChart() {
  const all = getAnalyticsData();
  const counts = {};
  all.forEach(r => counts[r.incidentType] = (counts[r.incidentType] || 0) + 1);

  if (incidentChart) incidentChart.destroy();
  incidentChart = new Chart(document.getElementById("incidentChart"), {
    type: "pie",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ["#e11d48","#f59e0b","#10b981","#3b82f6","#9333ea"]
      }]
    },
    options: { plugins: { title: { display: true, text: getAnalyticsLabel("Incident Types") } } }
  });
}

// Zone Reports Bar
function renderZoneChart() {
  const all = getAnalyticsData();
  const counts = {};
  all.forEach(r => counts[r.zone || "Unzoned"] = (counts[r.zone || "Unzoned"] || 0) + 1);

  if (zoneChart) zoneChart.destroy();
  zoneChart = new Chart(document.getElementById("zoneChart"), {
    type: "bar",
    data: {
      labels: Object.keys(counts),
      datasets: [{ label: "Reports", data: Object.values(counts), backgroundColor: "#0ea5e9" }]
    },
    options: {
      plugins: { title: { display: true, text: getAnalyticsLabel("Reports by Zone") } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Reports Over Time Line
function renderTimeChart() {
  const all = getAnalyticsData();
  const counts = {};
  all.forEach(r => {
    const day = new Date(r.timestamp).toLocaleDateString();
    counts[day] = (counts[day] || 0) + 1;
  });

  if (timeChart) timeChart.destroy();
  timeChart = new Chart(document.getElementById("timeChart"), {
    type: "line",
    data: {
      labels: Object.keys(counts),
      datasets: [{ label: "Reports Over Time", data: Object.values(counts), borderColor: "#22c55e", fill: false }]
    },
    options: { plugins: { title: { display: true, text: getAnalyticsLabel("Reports Trend") } } }
  });
}

// Wrapper
function renderAnalytics() {
  renderIncidentChart();
  renderZoneChart();
  renderTimeChart();
}


// -------------------------
// Reset Map View Button
// -------------------------
const resetMapBtn = document.getElementById("reset-map");
if (resetMapBtn) {
  resetMapBtn.addEventListener("click", () => {
    if (Object.keys(reportMarkers).length > 0) {
      const group = L.featureGroup(Object.values(reportMarkers));
      map.fitBounds(group.getBounds().pad(0.2));
      if (map.getZoom() > 16) {
        map.setZoom(16);
      }
    } else {
      // Default view if no reports
      map.setView([10.7, 122.56], 13);
    }
  });
}

// -------------------------
// Init
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderReports();
   renderHistory();
  renderAnalytics(); // ✅ show charts on page load
});

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all history?")) {
      write(DB.history, []); // clear localStorage history
      renderHistory();       // re-render empty list
    }
  });
}

function logNotification(notif) {
  const div = document.createElement("div");
  div.className = "notif-entry";
  div.innerHTML = `
    <strong>${notif.zone || "All Zones"}</strong>: ${notif.message}
    <br><small>${new Date(notif.sentTime).toLocaleString()}</small>
    <span style="color:gray;"> [${notif.channels.sms ? "SMS" : ""}${notif.channels.push ? " In-App" : ""}]</span>
  `;
  notifLog.prepend(div);
}

const clearNotifsBtn = document.getElementById("clear-notifs-dashboard");
if (clearNotifsBtn) {
  clearNotifsBtn.addEventListener("click", () => {
    notifLog.innerHTML = "";
    write(DB.notifications, []); // clear stored notifications
  });
}

 
