// Common helpers for both dashboard & resident

const DB = {
  reports: 'bs_reports_v1',
  zones: 'bs_zones_v1',
  inventory: 'bs_inventory_v1',
  notifications: 'bs_notifications_v1',
  history: 'bs_history_v1'
};

function read(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// Seed default zones and inventory

if (!read(DB.zones).length) {
  write(DB.zones, [
    { id: 'B01', name: 'Aurora-del Pilar', polygon: null },
    { id: 'B02', name: 'Bacay', polygon: null },
    { id: 'B03', name: 'Bacong', polygon: null },
    { id: 'B04', name: 'Balabag', polygon: null },
    { id: 'B05', name: 'Balud', polygon: null },
    { id: 'B06', name: 'Bantud', polygon: null },
    { id: 'B07', name: 'Bantud Fabrica', polygon: null },
    { id: 'B08', name: 'Baras', polygon: null },
    { id: 'B09', name: 'Barasan', polygon: null },
    { id: 'B10', name: 'Basa-Mabini Bonifacio', polygon: null },
    { id: 'B11', name: 'Bolilao', polygon: null },
    { id: 'B12', name: 'Buenaflor Embarkadero', polygon: null },
    { id: 'B13', name: 'Burgos-Regidor', polygon: null },
    { id: 'B14', name: 'Calao', polygon: null },
    { id: 'B15', name: 'Cali', polygon: null },
    { id: 'B16', name: 'Cansilayan', polygon: null },
    { id: 'B17', name: 'Capaliz', polygon: null },
    { id: 'B18', name: 'Cayos', polygon: null },
    { id: 'B19', name: 'Compayan', polygon: null },
    { id: 'B20', name: 'Dacutan', polygon: null },
    { id: 'B21', name: 'Ermita', polygon: null },
    { id: 'B22', name: 'Ilaya 1st', polygon: null },
    { id: 'B23', name: 'Ilaya 2nd', polygon: null },
    { id: 'B24', name: 'Ilaya 3rd', polygon: null },
    { id: 'B25', name: 'Jardin', polygon: null },
    { id: 'B26', name: 'Lacturan', polygon: null },
    { id: 'B27', name: 'Lopez Jaena-Rizal', polygon: null },
    { id: 'B28', name: 'Managuit', polygon: null },
    { id: 'B29', name: 'Maquina', polygon: null },
    { id: 'B30', name: 'Nanding Lopez', polygon: null },
    { id: 'B31', name: 'Pagdugue', polygon: null },
    { id: 'B32', name: 'Paloc Bigque', polygon: null },
    { id: 'B33', name: 'Paloc Sool', polygon: null },
    { id: 'B34', name: 'Patlad', polygon: null },
    { id: 'B35', name: 'Pd Monfort North', polygon: null },
    { id: 'B36', name: 'Pd Monfort South', polygon: null },
    { id: 'B37', name: 'Pulao', polygon: null },
    { id: 'B38', name: 'Rosario', polygon: null },
    { id: 'B39', name: 'Sapao', polygon: null },
    { id: 'B40', name: 'Sulangan', polygon: null },
    { id: 'B41', name: 'Tabucan', polygon: null },
    { id: 'B42', name: 'Talusan', polygon: null },
    { id: 'B43', name: 'Tambobo', polygon: null },
    { id: 'B44', name: 'Tamboilan', polygon: null },
    { id: 'B45', name: 'Victorias', polygon: null }
  ]);
}


if (!read(DB.inventory).length) {
  write(DB.inventory, [
    { id: 'I1', name: 'Rice 5kg', qty: 50 },
    { id: 'I2', name: 'Bottled Water (500ml)', qty: 200 },
    { id: 'I3', name: 'Blankets', qty: 80 }
  ]);
}

// Initialize history if empty
if (!read(DB.history).length) {
  write(DB.history, []);
}

/* ------------------------------
   HISTORY HELPERS
--------------------------------*/

// Add to history with auto-trim
function addToHistory(entry, limit = 100) {
  let history = read(DB.history);
  history.push(entry);

  // Trim if over limit (keep latest N)
  if (history.length > limit) {
    history = history.slice(history.length - limit);
  }

  write(DB.history, history);
}

// Clear all history
function clearHistory() {
  write(DB.history, []);
}

// Export history as CSV with timestamped filename
function exportHistoryCSV(prefix = "history") {
  const history = read(DB.history);
  if (!history.length) {
    alert("No history to export.");
    return;
  }

  // Define CSV headers
  const headers = ["ID","Name","Phone","Incident Type","Description","Zone","Lat","Lng","Status","Action","Action Time"];
  
  // Build rows
  const rows = history.map(h => [
    h.id, h.name, h.phone, h.incidentType, 
    h.description, h.zone, h.lat, h.lng, 
    h.status, h.action, h.actionTime
  ]);

  // Convert to CSV string
  const csvContent = [headers, ...rows]
    .map(r => r.map(x => `"${x || ""}"`).join(","))
    .join("\n");

  // Timestamped filename (YYYY-MM-DD_HHMMSS)
  const now = new Date();
  const timestamp = now.toISOString().slice(0,19).replace(/[:T]/g,"-");
  const filename = `${prefix}_${timestamp}.csv`;

  // Download as file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
