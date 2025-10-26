// Shared DOM helpers for the clients module

export function getEl(id) {
  if (typeof window.getEl === "function") return window.getEl(id);
  return document.getElementById(id);
}

export function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

export function showDialog(message, options) {
  if (typeof window.showDialog === "function") {
    window.showDialog(message, options);
    return true;
  }
  return false;
}
