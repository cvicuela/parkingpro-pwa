import { toast } from 'react-toastify';

// Map common error messages to user-friendly Spanish
const errorMap = {
  'Failed to fetch': 'Sin conexión al servidor. Verifique su internet.',
  'NetworkError': 'Error de red. Verifique su conexión.',
  'Token no proporcionado': 'Sesión expirada. Inicie sesión nuevamente.',
  'Sesión expirada o inválida': 'Su sesión ha expirado. Inicie sesión nuevamente.',
  'Token inválido': 'Sesión inválida. Inicie sesión nuevamente.',
  'Acceso denegado': 'No tiene permisos para esta acción.',
  'PGRST': 'Error del servidor. Intente nuevamente.',
};

// Get user-friendly error message
export const getErrorMessage = (error) => {
  const msg = error?.message || error?.error || String(error);

  for (const [key, value] of Object.entries(errorMap)) {
    if (msg.includes(key)) return value;
  }

  return msg || 'Ha ocurrido un error inesperado';
};

// Show error toast with appropriate styling
export const showError = (error, context = '') => {
  const msg = getErrorMessage(error);
  const prefix = context ? `${context}: ` : '';

  // Check if it's a session error
  if (msg.includes('sesión') || msg.includes('Sesión')) {
    toast.error(msg, { toastId: 'session-error', autoClose: 5000 });
    return;
  }

  toast.error(`${prefix}${msg}`);
};

// Retry wrapper for API calls
export const withRetry = async (fn, { maxRetries = 3, delay = 1000, backoff = 2, onRetry } = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error?.message || '';

      // Don't retry auth errors or validation errors
      if (msg.includes('Token') || msg.includes('Acceso') || msg.includes('sesión') || msg.includes('inválido')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt);
        if (onRetry) onRetry(attempt + 1, maxRetries, waitTime);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  throw lastError;
};

// Wrap an async function with error handling
export const safeAsync = (fn, context = '') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      showError(error, context);
      throw error;
    }
  };
};
