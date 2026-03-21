import { rpc } from './supabaseClient';

// Helper to get token
const getToken = () => localStorage.getItem('pp_token') || '';

// Wrap RPC result to match existing { data: { ... } } format used by AuthContext
const wrap = (result) => ({ data: result });

// Auth
export const authAPI = {
  login: async ({ email, password }) => {
    const result = await rpc('authenticate', { p_email: email, p_password: password });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  register: async (formData) => {
    const result = await rpc('register_user', {
      p_email: formData.email,
      p_phone: formData.phone,
      p_password: formData.password,
      p_first_name: formData.firstName || null,
      p_last_name: formData.lastName || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  me: async () => {
    const result = await rpc('get_current_user_info', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  logout: async () => {
    const result = await rpc('do_logout', { p_token: getToken() });
    return wrap(result);
  },
};

// Customers
export const customersAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_customers', {
      p_token: getToken(),
      p_search: params?.search || null,
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (id) => {
    const result = await rpc('get_customer', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_customer', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (id, data) => {
    const result = await rpc('update_customer', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  delete: async (id) => {
    const result = await rpc('delete_customer', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  history: async (id) => {
    const result = await rpc('get_customer_history', { p_token: getToken(), p_customer_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Vehicles
export const vehiclesAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_vehicles', {
      p_token: getToken(),
      p_search: params?.search || null,
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (id) => {
    const result = await rpc('get_vehicle', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_vehicle', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (id, data) => {
    const result = await rpc('update_vehicle', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  delete: async (id) => {
    const result = await rpc('delete_vehicle', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  findByPlate: async (plate) => {
    const result = await rpc('find_vehicle_by_plate', { p_token: getToken(), p_plate: plate });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Plans
export const plansAPI = {
  list: async () => {
    const result = await rpc('list_plans', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (id) => {
    const result = await rpc('get_plan', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_plan', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (id, data) => {
    const result = await rpc('update_plan', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  delete: async (id) => {
    const result = await rpc('delete_plan', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  occupancy: async (id) => {
    const result = await rpc('get_plan_occupancy', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  getHourlyRates: async (planId) => {
    const result = await rpc('get_hourly_rates', { p_token: getToken(), p_plan_id: planId });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  updateHourlyRates: async (planId, rates) => {
    const result = await rpc('update_hourly_rates', { p_token: getToken(), p_plan_id: planId, p_rates: rates });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  calculateHourly: async (data) => {
    const result = await rpc('calculate_hourly', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Subscriptions
export const subscriptionsAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_subscriptions', {
      p_token: getToken(),
      p_status: params?.status || null,
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (id) => {
    const result = await rpc('get_subscription', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_subscription', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (id, data) => {
    const result = await rpc('update_subscription', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  cancel: async (id, reason) => {
    const result = await rpc('cancel_subscription', { p_token: getToken(), p_id: id, p_reason: reason });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  suspend: async (id) => {
    const result = await rpc('suspend_subscription', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  reactivate: async (id) => {
    const result = await rpc('reactivate_subscription', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  qr: async (id) => {
    const result = await rpc('get_subscription_qr', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Access Control
export const accessAPI = {
  validate: async (data) => {
    const result = await rpc('validate_access', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  entry: async (data) => {
    const result = await rpc('register_entry', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  exit: async (data) => {
    const result = await rpc('register_exit', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  history: async (params = {}) => {
    const result = await rpc('access_history', {
      p_token: getToken(),
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  activeSessions: async () => {
    const result = await rpc('list_active_sessions', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  sessionByPlate: async (plate) => {
    const result = await rpc('session_by_plate', { p_token: getToken(), p_plate: plate });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  endSession: async (id) => {
    const result = await rpc('end_session', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  sessionPayment: async (id, data) => {
    const result = await rpc('session_payment', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  calculateFee: async (data) => {
    const result = await rpc('calculate_parking_fee', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  processPayment: async (data) => {
    const result = await rpc('process_parking_payment', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  validateExit: async (data) => {
    const result = await rpc('validate_exit', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  gateVerify: async (data) => {
    const result = await rpc('gate_verify', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Payments
export const paymentsAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_payments', {
      p_token: getToken(),
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (id) => {
    const result = await rpc('get_payment', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_payment', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  refund: async (id, reason) => {
    const result = await rpc('refund_payment', { p_token: getToken(), p_id: id, p_reason: reason });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Reports (all via Supabase RPC)
export const reportsAPI = {
  dashboard: async () => {
    const result = await rpc('get_dashboard_stats', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  activeVehicles: async () => {
    const result = await rpc('list_active_sessions', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  executiveSummary: async () => {
    const result = await rpc('report_executive_summary', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  revenue: async (params = {}) => {
    const result = await rpc('report_revenue', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null,
      p_group_by: params.groupBy || 'day'
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  revenueByOperator: async (params = {}) => {
    const result = await rpc('report_revenue_by_operator', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  cashReconciliation: async (params = {}) => {
    const result = await rpc('report_cash_reconciliation', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  customers: async (params = {}) => {
    const result = await rpc('report_customers', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  occupancy: async (params = {}) => {
    const result = await rpc('report_occupancy', {
      p_token: getToken(),
      p_period: params.period || 'week',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  sessions: async (params = {}) => {
    const result = await rpc('report_sessions', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  invoicesReport: async (params = {}) => {
    const result = await rpc('report_invoices', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  incidents: async (params = {}) => {
    const result = await rpc('report_invoices', {
      p_token: getToken(),
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  occupancyByHour: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    const qs = query.toString();
    return apiFetch(`/api/v1/reports/occupancy-by-hour${qs ? `?${qs}` : ''}`);
  },
  revenueByMethod: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    const qs = query.toString();
    return apiFetch(`/api/v1/reports/revenue-by-method${qs ? `?${qs}` : ''}`);
  },
  topCustomers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString();
    return apiFetch(`/api/v1/reports/top-customers${qs ? `?${qs}` : ''}`);
  },
  revenueDaily: async (params = {}) => {
    const result = await apiFetch('/api/v1/reports/revenue-daily?' + new URLSearchParams({ days: params.days || 7 }));
    return wrap(result);
  },
  todaySummary: async () => {
    const result = await apiFetch('/api/v1/reports/today-summary');
    return wrap(result);
  },
  exportData: async (type, params = {}) => {
    const result = await rpc('report_export_csv', {
      p_token: getToken(),
      p_type: type,
      p_period: params.period || 'month',
      p_from: params.from || null,
      p_to: params.to || null
    });
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  exportCsv: async (type, params = {}) => {
    const data = await reportsAPI.exportData(type, params);
    const headers = data.headers;
    const rows = data.rows || [];
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvContent = [headers.join(','), ...rows.map(row => headers.map(h => escapeCsv(row[h])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${data.filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },
  exportXls: async (type, params = {}) => {
    const XLSX = await import('xlsx');
    const data = await reportsAPI.exportData(type, params);
    const headers = data.headers;
    const rows = data.rows || [];
    const aoa = [headers, ...rows.map(row => headers.map(h => row[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[headers[i]] ?? '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `${data.filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  },
  exportPdf: async (type, params = {}, title = 'Reporte') => {
    const data = await reportsAPI.exportData(type, params);
    const headers = data.headers;
    const rows = data.rows || [];
    const generatedAt = new Date().toLocaleString('es-DO');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>
      @media print { body { margin: 0; } @page { size: landscape; margin: 1cm; } }
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; }
      h1 { text-align: center; color: #333; font-size: 18px; margin-bottom: 4px; }
      .meta { text-align: center; color: #666; margin-bottom: 12px; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #4472C4; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
      tr:nth-child(even) { background: #f8f9fa; }
    </style></head><body>
    <h1>${title}</h1>
    <div class="meta">Generado: ${generatedAt} | Registros: ${rows.length}</div>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => '<tr>' + headers.map(h => `<td>${row[h] ?? ''}</td>`).join('') + '</tr>').join('')}</tbody></table>
    </body></html>`;
    return { html, title, rowCount: rows.length, generatedAt };
  },
};

// Settings
export const settingsAPI = {
  list: async () => {
    const result = await rpc('list_settings', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (key) => {
    const result = await rpc('get_setting', { p_token: getToken(), p_key: key });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (key, value) => {
    const result = await rpc('update_setting', { p_token: getToken(), p_key: key, p_value: value });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// System Reset
export const systemAPI = {
  resetPreview: async () => {
    const result = await rpc('reset_data_preview', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  resetData: async (confirmationCode) => {
    const result = await rpc('reset_operational_data', { p_token: getToken(), p_confirmation_code: confirmationCode });
    if (!result.success) throw new Error(result.error);
    return result;
  },
};

// Cash Registers
export const cashAPI = {
  open: async (data) => {
    const result = await rpc('open_cash_register', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  active: async () => {
    const result = await rpc('get_active_register', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  close: async (id, data) => {
    const result = await rpc('close_cash_register', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  approve: async (id, data) => {
    const result = await rpc('approve_cash_register', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  transactions: async (id) => {
    const result = await rpc('get_register_transactions', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  history: async (params = {}) => {
    const result = await rpc('cash_register_history', { p_token: getToken(), p_limit: params?.limit || 50 });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  limits: async () => {
    const result = await rpc('get_cash_limits', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Operators
export const operatorsAPI = {
  list: async () => {
    const result = await rpc('list_operators', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_operator', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Invoices
export const invoicesAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_invoices', { p_token: getToken(), p_limit: params?.limit || 50 });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  get: async (id) => {
    const result = await rpc('get_invoice', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  stats: async (params = {}) => {
    const result = await rpc('invoice_stats', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  fromPayment: async (paymentId) => {
    const result = await rpc('create_invoice_from_payment', { p_token: getToken(), p_payment_id: paymentId });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Audit Log
export const auditAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_audit_logs', { p_token: getToken(), p_limit: params?.limit || 50 });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  actions: async () => {
    const result = await rpc('list_audit_actions', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Expenses (Gastos - feeds DGII 606)
export const expensesAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_expenses', {
      p_token: getToken(),
      p_from_date: params?.fromDate || null,
      p_to_date: params?.toDate || null,
      p_category: params?.category || null,
      p_status: params?.status || 'active',
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_expense', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (id, data) => {
    const result = await rpc('update_expense', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  delete: async (id) => {
    const result = await rpc('delete_expense', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  stats: async (params = {}) => {
    const result = await rpc('expense_stats', {
      p_token: getToken(),
      p_from_date: params?.fromDate || null,
      p_to_date: params?.toDate || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Fiscal Reports (DGII 606/607)
export const fiscalAPI = {
  generate607: async (params = {}) => {
    const result = await rpc('generate_607_report', {
      p_token: getToken(),
      p_period: params?.period || null,
      p_from_date: params?.fromDate || null,
      p_to_date: params?.toDate || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  generate606: async (params = {}) => {
    const result = await rpc('generate_606_report', {
      p_token: getToken(),
      p_period: params?.period || null,
      p_from_date: params?.fromDate || null,
      p_to_date: params?.toDate || null
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// DGII RNC Registry (Base de datos de contribuyentes)
export const dgiiAPI = {
  validateRnc: async (rnc) => {
    const result = await rpc('dgii_validate_rnc', { p_token: getToken(), p_rnc: rnc });
    return result;
  },
  searchRnc: async (query, limit = 20) => {
    const result = await rpc('dgii_search_rnc', { p_token: getToken(), p_query: query, p_limit: limit });
    return result;
  },
  stats: async () => {
    const result = await rpc('dgii_rnc_stats', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  importBatch: async (records) => {
    const result = await rpc('dgii_import_rnc_batch', { p_token: getToken(), p_records: records });
    return result;
  },
  logImport: async (data) => {
    const result = await rpc('dgii_log_import', {
      p_token: getToken(),
      p_records_imported: data.recordsImported,
      p_records_updated: data.recordsUpdated || 0,
      p_records_total: data.recordsTotal,
      p_source: data.source || 'dgii_file',
      p_duration_ms: data.durationMs || 0,
    });
    return result;
  },
};

// NCF (Comprobantes Fiscales) Management
export const ncfAPI = {
  listSequences: async () => {
    const result = await rpc('list_ncf_sequences', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  updateSequence: async (id, data) => {
    const result = await rpc('update_ncf_sequence', {
      p_token: getToken(),
      p_id: id,
      p_range_from: data.rangeFrom ?? null,
      p_range_to: data.rangeTo ?? null,
      p_alert_threshold: data.alertThreshold ?? null,
      p_is_active: data.isActive ?? null,
      p_authorized_date: data.authorizedDate || null,
      p_expiration_date: data.expirationDate || null,
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  assignToInvoice: async (invoiceId, ncfType = '02') => {
    const result = await rpc('assign_ncf_to_invoice', {
      p_token: getToken(),
      p_invoice_id: invoiceId,
      p_ncf_type: ncfType,
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Notifications
export const notificationsAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_notifications', {
      p_token: getToken(),
      p_channel: params?.channel || null,
      p_status: params?.status || null,
      p_from_date: params?.fromDate || null,
      p_to_date: params?.toDate || null,
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0,
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  stats: async () => {
    const result = await rpc('notification_stats', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  send: async (data) => {
    const result = await rpc('send_notification', {
      p_token: getToken(),
      p_channel: data.channel,
      p_recipient: data.recipient,
      p_subject: data.subject || null,
      p_body: data.body || null,
      p_type: data.type || 'manual',
      p_template_id: data.templateId || null,
      p_template_data: data.templateData || null,
      p_customer_id: data.customerId || null,
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Incidents
export const incidentsAPI = {
  list: async (params = {}) => {
    const result = await rpc('list_incidents', {
      p_token: getToken(),
      p_status: params?.status || null,
      p_severity: params?.severity || null,
      p_type: params?.type || null,
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0,
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_incident', {
      p_token: getToken(),
      p_type: data.type,
      p_title: data.title,
      p_description: data.description || null,
      p_severity: data.severity || 'medium',
      p_vehicle_plate: data.vehiclePlate || null,
      p_subscription_id: data.subscriptionId || null,
      p_photos: data.photos || null,
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  resolve: async (id, data = {}) => {
    const result = await rpc('resolve_incident', {
      p_token: getToken(),
      p_id: id,
      p_resolution_notes: data.notes || null,
      p_status: data.status || 'resolved',
    });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// REST helper for Express backend routes (not Supabase RPC)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || res.statusText);
  return wrap(json);
};

// User Management (RPC)
export const usersAPI = {
  list: async () => {
    const result = await rpc('list_system_users', { p_token: getToken() });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  create: async (data) => {
    const result = await rpc('create_system_user', { p_token: getToken(), p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  update: async (id, data) => {
    const result = await rpc('update_system_user', { p_token: getToken(), p_id: id, p_data: data });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  delete: async (id) => {
    const result = await rpc('update_system_user', { p_token: getToken(), p_id: id, p_data: { status: 'inactive' } });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
  resetPassword: async (id, newPassword) => {
    const result = await rpc('reset_user_password', { p_token: getToken(), p_id: id, p_new_password: newPassword });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// RFID Cards (all via REST API)
export const rfidAPI = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.cardType) query.set('cardType', params.cardType);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);
    const qs = query.toString();
    return apiFetch(`/api/v1/rfid/cards${qs ? `?${qs}` : ''}`);
  },
  poolStats: async () => apiFetch('/api/v1/rfid/cards/pool-stats'),
  get: async (id) => apiFetch(`/api/v1/rfid/cards/${id}`),
  register: async (data) => apiFetch('/api/v1/rfid/cards', {
    method: 'POST',
    body: JSON.stringify({ cardUid: data.cardUid, cardType: data.cardType, label: data.label || null }),
  }),
  assignPermanent: async (cardId, subscriptionId) => apiFetch(`/api/v1/rfid/cards/${cardId}/assign-permanent`, {
    method: 'POST',
    body: JSON.stringify({ subscriptionId }),
  }),
  assignTemporary: async (cardId, vehiclePlate) => apiFetch(`/api/v1/rfid/cards/${cardId}/assign-temporary`, {
    method: 'POST',
    body: JSON.stringify({ vehiclePlate }),
  }),
  returnCard: async (cardId) => apiFetch(`/api/v1/rfid/cards/${cardId}/return`, { method: 'POST' }),
  reportLost: async (cardId) => apiFetch(`/api/v1/rfid/cards/${cardId}/report-lost`, { method: 'POST' }),
  disable: async (cardId) => apiFetch(`/api/v1/rfid/cards/${cardId}/disable`, { method: 'POST' }),
  enable: async (cardId) => apiFetch(`/api/v1/rfid/cards/${cardId}/enable`, { method: 'POST' }),
  resolve: async (cardUid) => apiFetch(`/api/v1/rfid/resolve/${cardUid}`),
  listByCustomer: async (customerId) => apiFetch(`/api/v1/rfid/cards/by-customer/${customerId}`),
  listBySubscription: async (subscriptionId) => apiFetch(`/api/v1/rfid/cards/by-subscription/${subscriptionId}`),
};

// ZKTeco Devices
export const devicesAPI = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.location) query.set('location', params.location);
    const qs = query.toString();
    return apiFetch(`/api/v1/zkteco/devices${qs ? `?${qs}` : ''}`);
  },
  get: async (serial) => apiFetch(`/api/v1/zkteco/devices/${serial}`),
  create: async (data) =>
    apiFetch('/api/v1/zkteco/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: async (serial, data) =>
    apiFetch(`/api/v1/zkteco/devices/${serial}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (serial) =>
    apiFetch(`/api/v1/zkteco/devices/${serial}`, { method: 'DELETE' }),
  openBarrier: async (serial) =>
    apiFetch(`/api/v1/zkteco/devices/${serial}/open`, { method: 'POST' }),
  closeBarrier: async (serial) =>
    apiFetch(`/api/v1/zkteco/devices/${serial}/close`, { method: 'POST' }),
  requestCardRead: async (serial) =>
    apiFetch(`/api/v1/zkteco/devices/${serial}/read-card`, { method: 'POST' }),
  stopReading: async (serial) =>
    apiFetch(`/api/v1/zkteco/devices/${serial}/stop-reading`, { method: 'POST' }),
  readers: async () => apiFetch('/api/v1/zkteco/readers'),
  stats: async () => apiFetch('/api/v1/zkteco/stats'),
  events: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.serial_number) query.set('serial_number', params.serial_number);
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString();
    return apiFetch(`/api/v1/zkteco/events${qs ? `?${qs}` : ''}`);
  },
};

// Terminals
export const terminalsAPI = {
  list: async () => apiFetch('/api/v1/terminals'),
  create: async (data) => apiFetch('/api/v1/terminals', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id, data) => apiFetch(`/api/v1/terminals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id) => apiFetch(`/api/v1/terminals/${id}`, { method: 'DELETE' }),
  heartbeat: async (code) => apiFetch(`/api/v1/terminals/${code}/heartbeat`, { method: 'POST' }),
  stats: async () => apiFetch('/api/v1/terminals/stats'),
};

// Default export for backward compatibility
export default { interceptors: { request: { use: () => {} }, response: { use: () => {} } } };
