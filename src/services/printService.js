// Thermal printer utilities for parking tickets, receipts, and cash register reports
// Generates HTML formatted for 80mm/58mm thermal printers via window.print()

const PARKING_NAME = 'ParkingPro';
const PARKING_ADDRESS = 'Santo Domingo, Rep. Dominicana';
const PARKING_RNC = 'RNC: 000-000000-0';
const PARKING_PHONE = 'Tel: (809) 000-0000';

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=350,height=600');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ParkingPro</title>
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

// Print entry ticket with QR code
export function printEntryTicket({ plate, entryTime, type, planName, sessionId, qrUrl }) {
  const time = new Date(entryTime).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const qrSrc = qrUrl || `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(sessionId || plate)}&size=300x300`;

  openPrintWindow(`
    <div class="center mb">
      <div class="bold big">${PARKING_NAME}</div>
      <div class="small">${PARKING_ADDRESS}</div>
      <div class="small">${PARKING_PHONE}</div>
    </div>
    <div class="line"></div>
    <div class="center bold mt">TICKET DE ENTRADA</div>
    <div class="line"></div>
    <div class="center mt mb">
      <div class="plate">${plate}</div>
    </div>
    <img class="qr" src="${qrSrc}" alt="QR" />
    <div class="line"></div>
    <div class="row"><span>Fecha/Hora:</span><span class="bold">${time}</span></div>
    <div class="row"><span>Tipo:</span><span>${type === 'subscriber' ? 'Suscriptor' : 'Por Hora'}</span></div>
    ${planName ? `<div class="row"><span>Plan:</span><span>${planName}</span></div>` : ''}
    ${sessionId ? `<div class="row mt"><span class="small">ID: ${sessionId.substring(0, 8)}</span></div>` : ''}
    <div class="line"></div>
    <div class="center small mt">Conserve este ticket para la salida</div>
    <div class="center small">Tarifa por hora segun plan vigente</div>
    <div class="center small mt mb">${PARKING_NAME} - Gracias por su visita</div>
  `);
}

// Print payment receipt
export function printPaymentReceipt({ receipt, showQr = true }) {
  const r = receipt;
  const entryTime = new Date(r.entryTime).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const exitTime = new Date(r.exitTime || r.paidAt).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(r.code || r.invoiceNumber)}&size=300x300`;
  const method = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }[r.paymentMethod] || r.paymentMethod;

  openPrintWindow(`
    <div class="center mb">
      <div class="bold big">${PARKING_NAME}</div>
      <div class="small">${PARKING_ADDRESS}</div>
      <div class="small">${PARKING_RNC}</div>
      <div class="small">${PARKING_PHONE}</div>
    </div>
    <div class="line"></div>
    <div class="center bold">RECIBO DE PAGO</div>
    ${r.invoiceNumber ? `<div class="center small">Factura: ${r.invoiceNumber}</div>` : ''}
    ${r.ncf ? `<div class="center small">NCF: ${r.ncf}</div>` : ''}
    <div class="line"></div>
    <div class="row"><span>Placa:</span><span class="bold">${r.plateNumber}</span></div>
    <div class="row"><span>Entrada:</span><span>${entryTime}</span></div>
    <div class="row"><span>Salida:</span><span>${exitTime}</span></div>
    <div class="row"><span>Duracion:</span><span>${r.hours}h</span></div>
    <div class="row"><span>Metodo:</span><span>${method}</span></div>
    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>RD$ ${parseFloat(r.subtotal).toFixed(2)}</span></div>
    <div class="row"><span>ITBIS (18%):</span><span>RD$ ${parseFloat(r.tax).toFixed(2)}</span></div>
    <div class="row bold big mt"><span>TOTAL:</span><span>RD$ ${parseFloat(r.total).toFixed(2)}</span></div>
    <div class="line"></div>
    ${showQr ? `<img class="qr" src="${qrSrc}" alt="QR" />` : ''}
    ${r.code ? `<div class="center small">Codigo: ${r.code}</div>` : ''}
    <div class="center small mt">Presente este recibo para salir</div>
    <div class="center small mt mb">Gracias por su preferencia</div>
  `);
}

// Print cash register close report
export function printCashReport({ register, transactions, operatorName }) {
  const opened = new Date(register.opened_at).toLocaleString('es-DO');
  const closed = new Date(register.closed_at || new Date()).toLocaleString('es-DO');
  const payments = transactions.filter(t => t.type === 'payment' && t.direction === 'in');
  const refunds = transactions.filter(t => t.type === 'refund');
  const totalIn = transactions.filter(t => t.direction === 'in').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = transactions.filter(t => t.direction === 'out').reduce((s, t) => s + parseFloat(t.amount), 0);

  const txRows = transactions.map(t => {
    const time = new Date(t.created_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    const sign = t.direction === 'in' ? '+' : '-';
    return `<div class="row small"><span>${time} ${t.description || t.type}</span><span>${sign}RD$${parseFloat(t.amount).toFixed(2)}</span></div>`;
  }).join('');

  const diff = parseFloat(register.difference || 0);
  const diffColor = diff === 0 ? '' : diff > 0 ? '(+)' : '(-)';

  openPrintWindow(`
    <div class="center mb">
      <div class="bold big">${PARKING_NAME}</div>
      <div class="small">${PARKING_ADDRESS}</div>
    </div>
    <div class="line"></div>
    <div class="center bold">CIERRE DE CAJA</div>
    <div class="center small">${register.name || 'Caja Principal'}</div>
    <div class="line"></div>
    <div class="row"><span>Operador:</span><span>${operatorName || 'N/A'}</span></div>
    <div class="row"><span>Apertura:</span><span>${opened}</span></div>
    <div class="row"><span>Cierre:</span><span>${closed}</span></div>
    <div class="line"></div>
    <div class="bold mt mb">RESUMEN</div>
    <div class="row"><span>Fondo inicial:</span><span>RD$ ${parseFloat(register.opening_balance).toFixed(2)}</span></div>
    <div class="row"><span>Cobros (${payments.length}):</span><span>RD$ ${totalIn.toFixed(2)}</span></div>
    <div class="row"><span>Reembolsos (${refunds.length}):</span><span>RD$ ${totalOut.toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="row bold"><span>Saldo esperado:</span><span>RD$ ${parseFloat(register.expected_balance || (totalIn - totalOut)).toFixed(2)}</span></div>
    <div class="row bold"><span>Saldo contado:</span><span>RD$ ${parseFloat(register.counted_balance || 0).toFixed(2)}</span></div>
    <div class="row bold"><span>Diferencia ${diffColor}:</span><span>RD$ ${Math.abs(diff).toFixed(2)}</span></div>
    ${Math.abs(diff) > 200 ? '<div class="center bold mt">** REQUIERE APROBACION **</div>' : ''}
    <div class="line"></div>
    <div class="bold mt mb">DETALLE DE MOVIMIENTOS</div>
    ${txRows}
    <div class="line"></div>
    <div class="center small mt">Total transacciones: ${transactions.length}</div>
    <div class="center small mt mb">Impreso: ${new Date().toLocaleString('es-DO')}</div>
  `);
}

// Print daily summary report
export function printDailySummary({ date, stats }) {
  const d = new Date(date || new Date()).toLocaleDateString('es-DO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  openPrintWindow(`
    <div class="center mb">
      <div class="bold big">${PARKING_NAME}</div>
    </div>
    <div class="line"></div>
    <div class="center bold">REPORTE DIARIO</div>
    <div class="center small">${d}</div>
    <div class="line"></div>
    <div class="row"><span>Vehiculos atendidos:</span><span class="bold">${stats.totalVehicles || 0}</span></div>
    <div class="row"><span>Suscriptores:</span><span>${stats.subscribers || 0}</span></div>
    <div class="row"><span>Por hora:</span><span>${stats.hourly || 0}</span></div>
    <div class="row"><span>Ocupacion actual:</span><span>${stats.occupancyRate || 0}%</span></div>
    <div class="line"></div>
    <div class="row"><span>Ingresos efectivo:</span><span>RD$ ${(stats.cashRevenue || 0).toFixed(2)}</span></div>
    <div class="row"><span>Ingresos tarjeta:</span><span>RD$ ${(stats.cardRevenue || 0).toFixed(2)}</span></div>
    <div class="row bold big"><span>Total dia:</span><span>RD$ ${(stats.totalRevenue || 0).toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="center small mt mb">Generado: ${new Date().toLocaleString('es-DO')}</div>
  `);
}
