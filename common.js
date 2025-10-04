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

// ------------------------------
// Versioned Seeding
// ------------------------------
const ZONES_VERSION = "v2";      // bump this when barangay list changes
const INVENTORY_VERSION = "v1";  // bump this when default inventory changes

function seedZones() {
  const barangays = [
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
  ];
  write(DB.zones, barangays);
}

function seedInventory() {
  const items = [
    { id: 'I1', name: 'Rice 5kg', qty: 50 },
    { id: 'I2', name: 'Bottled Water (500ml)', qty: 200 },
    { id: 'I3', name: 'Blankets', qty: 80 }
  ];
  write(DB.inventory, items);
}

// Run seeding with version checks
if (localStorage.getItem("zones_version") !== ZONES_VERSION) {
  seedZones();
  localStorage.setItem("zones_version", ZONES_VERSION);
}

if (localStorage.getItem("inventory_version") !== INVENTORY_VERSION) {
  seedInventory();
  localStorage.setItem("inventory_version", INVENTORY_VERSION);
}

// Initialize history if empty
if (!read(DB.history).length) {
  write(DB.history, []);
}
