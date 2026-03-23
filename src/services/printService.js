// Thermal printer utilities for parking tickets, receipts, and cash register reports
// Generates HTML formatted for 80mm/58mm thermal printers
// Supports: preview mode (returns HTML) and direct print (opens popup)
// QR codes generated locally via 'qrcode' library (works offline)

import QRCode from 'qrcode';
import timeService from './timeService';

// Load company info from settings stored in localStorage (populated by ConfigPage)
function getCompanyInfo() {
  try {
    const settings = JSON.parse(localStorage.getItem('pp_settings') || '{}');
    return {
      name: settings.business_name || settings.parking_name || 'ParkingPro',
      address: settings.business_address || 'Santo Domingo, Rep. Dominicana',
      rnc: settings.business_rnc || '',
      phone: settings.business_phone || '',
    };
  } catch {
    return { name: 'ParkingPro', address: 'Santo Domingo, Rep. Dominicana', rnc: '', phone: '' };
  }
}

// Formatted header lines
function companyHeader() {
  const c = getCompanyInfo();
  let html = `<div class="bold big">${escapeHtml(c.name)}</div>`;
  html += `<div class="small">${escapeHtml(c.address)}</div>`;
  if (c.rnc) html += `<div class="small">RNC: ${escapeHtml(c.rnc)}</div>`;
  if (c.phone) html += `<div class="small">Tel: ${escapeHtml(c.phone)}</div>`;
  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Generate QR as data URL (base64 PNG) - works offline
async function qrDataUrl(data, size = 300) {
  try {
    return await QRCode.toDataURL(String(data), { width: size, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    return '';
  }
}

function openPrintWindow(html, title = 'ParkingPro') {
  const w = window.open('', '_blank', 'width=350,height=600');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 18px; }
  .small { font-size: 10px; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
  .plate { font-size: 24px; font-weight: bold; letter-spacing: 2px; }
  .qr { width: 160px; height: 160px; margin: 8px auto; display: block; }
  .mt { margin-top: 8px; }
  .mb { margin-bottom: 8px; }
  @media print { body { width: 80mm; } }
</style></head><body>${html}
<script>setTimeout(()=>{window.print();setTimeout(()=>window.close(),500)},400)</script>
</body></html>`);
  w.document.close();
}

// ─── HTML GENERATORS (for preview) ───

export async function generateEntryTicketHTML({ plate, entryTime, type, planName, planType, basePrice, customerName, sessionId, verificationCode, qrUrl }) {
  const time = new Date(entryTime).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Santo_Domingo'
  });
  const qrSrc = qrUrl || await qrDataUrl(sessionId || plate);

  return `
    <div class="center mb">
      ${companyHeader()}
    </div>
    <div class="line"></div>
    <div class="center bold mt">TICKET DE ENTRADA</div>
    <div class="line"></div>
    <div class="center mt mb">
      <div class="plate">${escapeHtml(plate)}</div>
    </div>
    <img class="qr" src="${escapeHtml(qrSrc)}" alt="QR" />
    ${verificationCode ? `<div class="center bold big mt">Ticket # ${escapeHtml(verificationCode)}</div>` : ''}
    <div class="line"></div>
    <div class="row"><span>Fecha/Hora:</span><span class="bold">${escapeHtml(time)}</span></div>
    <div class="row"><span>Tipo:</span><span>${type === 'subscriber' ? 'Suscriptor' : 'Por Hora'}</span></div>
    ${planName ? `<div class="row"><span>Plan:</span><span class="bold">${escapeHtml(planName)}</span></div>` : ''}
    ${basePrice ? `<div class="row"><span>Tarifa Base:</span><span>RD$ ${parseFloat(basePrice).toFixed(2)}</span></div>` : ''}
    ${customerName ? `<div class="row"><span>Cliente:</span><span>${escapeHtml(customerName)}</span></div>` : ''}
    ${sessionId ? `<div class="row mt"><span class="small">ID: ${escapeHtml(sessionId.substring(0, 8))}</span></div>` : ''}
    <div class="line"></div>
    <div class="center small mt">Conserve este ticket para la salida</div>
    <div class="center small">${planName ? escapeHtml(planName) : 'Tarifa segun plan vigente'}</div>
    <div class="center small mt mb">${escapeHtml(getCompanyInfo().name)} - Gracias por su visita</div>
  `;
}

export async function generatePaymentReceiptHTML({ receipt, showQr = true }) {
  const r = receipt;
  const entryTime = new Date(r.entryTime).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' });
  const exitTime = new Date(r.exitTime || r.paidAt).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' });
  const qrSrc = showQr ? await qrDataUrl(r.code || r.invoiceNumber) : '';
  const method = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }[r.paymentMethod] || r.paymentMethod;

  return `
    <div class="center mb">
      ${companyHeader()}
    </div>
    <div class="line"></div>
    <div class="center bold">RECIBO DE PAGO</div>
    ${r.invoiceNumber ? `<div class="center small">Factura: ${escapeHtml(r.invoiceNumber)}</div>` : ''}
    ${r.ncf ? `<div class="center small">NCF: ${escapeHtml(r.ncf)}</div>` : ''}
    <div class="line"></div>
    <div class="row"><span>Placa:</span><span class="bold">${escapeHtml(r.plateNumber)}</span></div>
    <div class="row"><span>Entrada:</span><span>${escapeHtml(entryTime)}</span></div>
    <div class="row"><span>Salida:</span><span>${escapeHtml(exitTime)}</span></div>
    <div class="row"><span>Duración:</span><span>${escapeHtml(String(r.hours))}h</span></div>
    <div class="row"><span>Método:</span><span>${escapeHtml(method)}</span></div>
    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>RD$ ${parseFloat(r.subtotal).toFixed(2)}</span></div>
    <div class="row"><span>ITBIS (18%):</span><span>RD$ ${parseFloat(r.tax).toFixed(2)}</span></div>
    <div class="row bold big mt"><span>TOTAL:</span><span>RD$ ${parseFloat(r.total).toFixed(2)}</span></div>
    <div class="line"></div>
    ${showQr && qrSrc ? `<img class="qr" src="${qrSrc}" alt="QR" />` : ''}
    ${r.code ? `<div class="center small">Codigo: ${escapeHtml(r.code)}</div>` : ''}
    <div class="center small mt">Presente este recibo para salir</div>
    <div class="center small mt mb">Gracias por su preferencia</div>
  `;
}

export function generateCashReportHTML({ register, transactions, operatorName }) {
  const opened = new Date(register.opened_at).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' });
  const closed = new Date(register.closed_at || timeService.nowISO()).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' });
  const payments = transactions.filter(t => t.type === 'payment' && t.direction === 'in');
  const refunds = transactions.filter(t => t.type === 'refund');
  const totalIn = transactions.filter(t => t.direction === 'in').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = transactions.filter(t => t.direction === 'out').reduce((s, t) => s + parseFloat(t.amount), 0);

  // Desglose por método de pago
  const expectedCash = parseFloat(register.expected_cash || 0);
  const totalCard = parseFloat(register.total_card || 0);
  const totalTransfer = parseFloat(register.total_transfer || 0);
  const hasOtherMethods = totalCard > 0 || totalTransfer > 0;

  const methodLabel = (m) => ({ cash: 'EF', card: 'TJ', transfer: 'TR' }[m] || '');

  const txRows = transactions.map(t => {
    const time = new Date(t.created_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' });
    const sign = t.direction === 'in' ? '+' : '-';
    const badge = t.payment_method && t.payment_method !== 'cash' ? ` [${methodLabel(t.payment_method)}]` : '';
    return `<div class="row small"><span>${escapeHtml(time)} ${escapeHtml(t.description || t.type)}${badge}</span><span>${sign}RD$${parseFloat(t.amount).toFixed(2)}</span></div>`;
  }).join('');

  const diff = parseFloat(register.difference || 0);
  const diffColor = diff === 0 ? '' : diff > 0 ? '(+)' : '(-)';

  return `
    <div class="center mb">
      ${companyHeader()}
    </div>
    <div class="line"></div>
    <div class="center bold">CIERRE DE CAJA</div>
    <div class="center small">${escapeHtml(register.name || 'Caja Principal')}</div>
    <div class="line"></div>
    <div class="row"><span>Operador:</span><span>${escapeHtml(operatorName || 'N/A')}</span></div>
    <div class="row"><span>Apertura:</span><span>${opened}</span></div>
    <div class="row"><span>Cierre:</span><span>${closed}</span></div>
    <div class="line"></div>
    <div class="bold mt mb">RESUMEN GENERAL</div>
    <div class="row"><span>Fondo inicial:</span><span>RD$ ${parseFloat(register.opening_balance).toFixed(2)}</span></div>
    <div class="row"><span>Cobros (${payments.length}):</span><span>RD$ ${totalIn.toFixed(2)}</span></div>
    <div class="row"><span>Reembolsos (${refunds.length}):</span><span>RD$ ${totalOut.toFixed(2)}</span></div>
    ${hasOtherMethods ? `
    <div class="line"></div>
    <div class="bold mt mb">DESGLOSE POR MÉTODO</div>
    <div class="row"><span>Efectivo:</span><span>RD$ ${expectedCash.toFixed(2)}</span></div>
    <div class="row"><span>Tarjeta:</span><span>RD$ ${totalCard.toFixed(2)}</span></div>
    <div class="row"><span>Transferencia:</span><span>RD$ ${totalTransfer.toFixed(2)}</span></div>
    ` : ''}
    <div class="line"></div>
    <div class="bold mt mb">CUADRE DE EFECTIVO</div>
    <div class="row bold"><span>Efectivo esperado:</span><span>RD$ ${expectedCash.toFixed(2)}</span></div>
    <div class="row bold"><span>Efectivo contado:</span><span>RD$ ${parseFloat(register.counted_balance || 0).toFixed(2)}</span></div>
    <div class="row bold"><span>Diferencia ${diffColor}:</span><span>RD$ ${Math.abs(diff).toFixed(2)}</span></div>
    ${Math.abs(diff) > 200 ? '<div class="center bold mt">** REQUIERE APROBACIÓN **</div>' : ''}
    <div class="line"></div>
    <div class="bold mt mb">DETALLE DE MOVIMIENTOS</div>
    ${txRows || '<div class="center small">Sin movimientos</div>'}
    <div class="line"></div>
    <div class="center small mt">Total transacciones: ${transactions.length}</div>
    <div class="center small mt mb">Impreso: ${timeService.nowFullDisplay()}</div>
  `;
}

export function generateDailySummaryHTML({ date, stats }) {
  const d = new Date(date || timeService.nowISO()).toLocaleDateString('es-DO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Santo_Domingo' });

  return `
    <div class="center mb">
      ${companyHeader()}
    </div>
    <div class="line"></div>
    <div class="center bold">REPORTE DIARIO</div>
    <div class="center small">${d}</div>
    <div class="line"></div>
    <div class="row"><span>Vehículos atendidos:</span><span class="bold">${stats.totalVehicles || 0}</span></div>
    <div class="row"><span>Suscriptores:</span><span>${stats.subscribers || 0}</span></div>
    <div class="row"><span>Por hora:</span><span>${stats.hourly || 0}</span></div>
    <div class="row"><span>Ocupación actual:</span><span>${stats.occupancyRate || 0}%</span></div>
    <div class="line"></div>
    <div class="row"><span>Ingresos efectivo:</span><span>RD$ ${(stats.cashRevenue || 0).toFixed(2)}</span></div>
    <div class="row"><span>Ingresos tarjeta:</span><span>RD$ ${(stats.cardRevenue || 0).toFixed(2)}</span></div>
    <div class="row bold big"><span>Total dia:</span><span>RD$ ${(stats.totalRevenue || 0).toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="center small mt mb">Generado: ${timeService.nowFullDisplay()}</div>
  `;
}

// ─── DIRECT PRINT FUNCTIONS (backwards compatible) ───

export async function printEntryTicket(data) {
  const html = await generateEntryTicketHTML(data);
  openPrintWindow(html, 'Ticket de Entrada');
}

export async function printPaymentReceipt(data) {
  const html = await generatePaymentReceiptHTML(data);
  openPrintWindow(html, 'Recibo de Pago');
}

export function printCashReport(data) {
  openPrintWindow(generateCashReportHTML(data), 'Cierre de Caja');
}

export function printDailySummary(data) {
  openPrintWindow(generateDailySummaryHTML(data), 'Reporte Diario');
}

// ─── PRINTER MANAGEMENT ───

const PRINTERS_KEY = 'pp_printers';
const DEFAULT_PRINTER_KEY = 'pp_default_printer';

export function getPrinters() {
  try {
    return JSON.parse(localStorage.getItem(PRINTERS_KEY) || '[]');
  } catch { return []; }
}

export function savePrinters(printers) {
  localStorage.setItem(PRINTERS_KEY, JSON.stringify(printers));
}

export function getDefaultPrinter() {
  return localStorage.getItem(DEFAULT_PRINTER_KEY) || null;
}

export function setDefaultPrinter(printerId) {
  if (printerId) {
    localStorage.setItem(DEFAULT_PRINTER_KEY, printerId);
  } else {
    localStorage.removeItem(DEFAULT_PRINTER_KEY);
  }
}

export function addPrinter(printer) {
  const printers = getPrinters();
  const newPrinter = {
    id: `printer_${Date.now()}`,
    name: printer.name || 'Impresora',
    type: printer.type || 'thermal',
    paperSize: printer.paperSize || '80mm',
    location: printer.location || '',
    isDefault: printer.isDefault || printers.length === 0,
    createdAt: new Date().toISOString(),
  };
  printers.push(newPrinter);
  savePrinters(printers);
  if (newPrinter.isDefault) setDefaultPrinter(newPrinter.id);
  return newPrinter;
}

export function removePrinter(printerId) {
  let printers = getPrinters();
  printers = printers.filter(p => p.id !== printerId);
  savePrinters(printers);
  if (getDefaultPrinter() === printerId) {
    setDefaultPrinter(printers[0]?.id || null);
  }
}

export function updatePrinter(printerId, updates) {
  const printers = getPrinters();
  const idx = printers.findIndex(p => p.id === printerId);
  if (idx >= 0) {
    printers[idx] = { ...printers[idx], ...updates };
    savePrinters(printers);
    if (updates.isDefault) setDefaultPrinter(printerId);
  }
}
