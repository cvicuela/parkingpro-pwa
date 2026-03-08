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
  cancel: async (id) => {
    const result = await rpc('cancel_subscription', { p_token: getToken(), p_id: id });
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
  refund: async (id) => {
    const result = await rpc('refund_payment', { p_token: getToken(), p_id: id });
    if (!result.success) throw new Error(result.error);
    return wrap(result);
  },
};

// Reports
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

// Default export for backward compatibility
export default { interceptors: { request: { use: () => {} }, response: { use: () => {} } } };
