// Dominican plate validation
export const isValidPlate = (plate) => {
  if (!plate) return false;
  const p = plate.toUpperCase().trim();
  return /^[A-Z][0-9]{6}$/.test(p) ||
    /^[A-Z]{2}[0-9]{5}$/.test(p) ||
    /^[A-Z]{1,3}-?[0-9]{3,6}$/.test(p) ||
    /^SIN-[A-Z0-9]+$/.test(p);
};

// Dominican RNC (9 or 11 digits)
export const isValidRNC = (rnc) => {
  if (!rnc) return false;
  const clean = rnc.replace(/[-\s]/g, '');
  return /^[0-9]{9}$/.test(clean) || /^[0-9]{11}$/.test(clean);
};

// Dominican phone
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const clean = phone.replace(/[-\s()]/g, '');
  return /^\+?1?8[024]9[0-9]{7}$/.test(clean) || /^\+?[1-9][0-9]{7,14}$/.test(clean);
};

// Email
export const isValidEmail = (email) => {
  if (!email) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim());
};

// Sanitize plate
export const sanitizePlate = (plate) => {
  return plate.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
};

// Format RNC with dashes (xxx-xxxxxxx-x for 11 digits)
export const formatRNC = (rnc) => {
  const clean = rnc.replace(/\D/g, '');
  if (clean.length === 11) return `${clean.slice(0,3)}-${clean.slice(3,10)}-${clean.slice(10)}`;
  if (clean.length === 9) return clean;
  return rnc;
};

// Format Dominican phone
export const formatPhone = (phone) => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10 && clean.startsWith('8')) {
    return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`;
  }
  return phone;
};

// Payment amount validation
export const isValidAmount = (amount) => {
  const n = parseFloat(amount);
  return !isNaN(n) && n > 0 && n < 1000000;
};

// Validation error messages (Spanish)
export const validationMessages = {
  plate: 'Formato de placa inválido (ej: A123456)',
  rnc: 'RNC inválido (debe tener 9 u 11 dígitos)',
  phone: 'Teléfono inválido (ej: 809-555-1234)',
  email: 'Email inválido',
  amount: 'Monto inválido',
  required: (field) => `${field} es requerido`,
};
