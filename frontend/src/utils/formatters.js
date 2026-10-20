/**
 * Financial formatters and math utilities
 */
export const money = (value) => 
  new Intl.NumberFormat('ja-JP', { 
    style: 'currency', 
    currency: 'JPY', 
    maximumFractionDigits: 0 
  }).format(value || 0);

export const goalPercent = (goal) => 
  Math.min(100, Math.round(((goal?.saved || 0) / (goal?.target || 1)) * 100));

export const sum = (items, key) => 
  items.reduce((total, item) => total + Number(item[key] || 0), 0);
