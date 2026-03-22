/**
 * Shared test data for ParkingPro E2E tests
 */
export const testUsers = {
  admin: {
    email: 'admin@parkingpro.com',
    password: 'Admin123!',
    role: 'super_admin',
  },
  operator: {
    email: 'operator@parkingpro.com',
    password: 'Operator123!',
    role: 'operator',
  },
};

export const testVehicles = {
  car1: { plate: 'SIN-MN0VVV39.I', make: 'Toyota', model: 'Corolla', color: 'Blanco' },
  car2: { plate: 'SIN-MN0VVV40.I', make: 'Honda', model: 'Civic', color: 'Negro' },
  car3: { plate: 'SIN-MN0VVV41.I', make: 'Hyundai', model: 'Tucson', color: 'Gris' },
};

export const testCustomers = {
  individual: {
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    email: 'carlos@email.com',
    phone: '809-555-0001',
    type: 'individual',
  },
  company: {
    firstName: 'Tech',
    lastName: 'Solutions',
    email: 'info@techsolutions.com',
    phone: '809-555-0003',
    type: 'company',
    rnc: '123456789',
  },
};

export const testSettings = {
  business_name: 'Parqueo Santomé, SRL',
  business_rnc: '1-31-12345-6',
  business_address: 'Av. Test #123',
  business_phone: '809-000-0000',
  currency: 'DOP',
  tax_rate: '0.18',
};

export const testPlans = {
  diurno:   { name: 'Diurno',   price: 12000 },
  nocturno: { name: 'Nocturno', price: 8000  },
  h24:      { name: '24h',      price: 20000 },
  porHora:  { name: 'Por Hora', price: 70    },
};
