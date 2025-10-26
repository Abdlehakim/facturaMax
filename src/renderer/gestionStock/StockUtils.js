// Shared DOM and formatting helpers for the stock module

export function getEl(id) {
  if (typeof window.getEl === "function") return window.getEl(id);
  return document.getElementById(id);
}

export function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

export function formatMoney(value, currency = "TND") {
  try {
    return new Intl.NumberFormat("fr-TN", { style: "currency", currency }).format(Number(value) || 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

export function showDialog(message, options) {
  if (typeof window.showDialog === "function") {
    window.showDialog(message, options);
    return true;
  }
  return false;
}
