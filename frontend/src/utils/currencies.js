/**
 * Supported currencies — single source of truth for the frontend.
 * The codes MUST match SUPPORTED_CURRENCIES in the backend settings
 * model (backend/src/models/settingsModel.js): the Settings base
 * currency is validated against that list, and every code here is
 * covered by the FX rate provider (open.er-api.com).
 */

export const CURRENCIES = [
  { code: 'JPY', label: 'Japanese Yen (JPY, ¥)', symbol: '¥' },
  { code: 'USD', label: 'US Dollar (USD, $)', symbol: '$' },
  { code: 'EUR', label: 'Euro (EUR, €)', symbol: '€' },
  { code: 'GBP', label: 'British Pound (GBP, £)', symbol: '£' },
  { code: 'NPR', label: 'Nepalese Rupee (NPR, Rs)', symbol: 'Rs' },
  { code: 'INR', label: 'Indian Rupee (INR, ₹)', symbol: '₹' },
  { code: 'AUD', label: 'Australian Dollar (AUD, $)', symbol: '$' },
  { code: 'CAD', label: 'Canadian Dollar (CAD, $)', symbol: '$' },
  { code: 'KRW', label: 'South Korean Won (KRW, ₩)', symbol: '₩' },
  { code: 'CNY', label: 'Chinese Yuan (CNY, ¥)', symbol: '¥' },
  { code: 'TWD', label: 'Taiwan Dollar (TWD, NT$)', symbol: 'NT$' },
  { code: 'HKD', label: 'Hong Kong Dollar (HKD, HK$)', symbol: 'HK$' },
  { code: 'SGD', label: 'Singapore Dollar (SGD, S$)', symbol: 'S$' },
  { code: 'THB', label: 'Thai Baht (THB, ฿)', symbol: '฿' },
  { code: 'VND', label: 'Vietnamese Dong (VND, ₫)', symbol: '₫' },
  { code: 'PHP', label: 'Philippine Peso (PHP, ₱)', symbol: '₱' },
  { code: 'IDR', label: 'Indonesian Rupiah (IDR, Rp)', symbol: 'Rp' },
  { code: 'MYR', label: 'Malaysian Ringgit (MYR, RM)', symbol: 'RM' },
  { code: 'AED', label: 'UAE Dirham (AED)', symbol: 'AED ' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)', symbol: 'SAR ' },
  { code: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF ' },
  { code: 'NZD', label: 'New Zealand Dollar (NZD, $)', symbol: '$' },
  { code: 'ZAR', label: 'South African Rand (ZAR, R)', symbol: 'R' },
  { code: 'BRL', label: 'Brazilian Real (BRL, R$)', symbol: 'R$' },
  { code: 'MXN', label: 'Mexican Peso (MXN, $)', symbol: '$' },
  { code: 'TRY', label: 'Turkish Lira (TRY, ₺)', symbol: '₺' },
  { code: 'SEK', label: 'Swedish Krona (SEK, kr)', symbol: 'kr' },
  { code: 'NOK', label: 'Norwegian Krone (NOK, kr)', symbol: 'kr' },
  { code: 'DKK', label: 'Danish Krone (DKK, kr)', symbol: 'kr' },
  { code: 'PLN', label: 'Polish Zloty (PLN, zł)', symbol: 'zł' },
];

export const currencyByCode = (code) => CURRENCIES.find((c) => c.code === code) || null;

/**
 * Formats an amount ENTERED in the given currency (e.g. a $20 airport
 * purchase) using the platform's own currency rules — correct symbol
 * and decimal places per currency (JPY/KRW/VND get 0, most others 2).
 */
export function formatEntered(amount, code) {
  const num = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(num);
  } catch {
    const entry = currencyByCode(code);
    return `${entry ? entry.symbol : ''}${num.toLocaleString('en-US')}`;
  }
}
