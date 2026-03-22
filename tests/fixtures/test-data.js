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
  car1: { plate: 'A123456', make: 'Toyota', model: 'Corolla', color: 'Blanco' },
  car2: { plate: 'B789012', make: 'Honda', model: 'Civic', color: 'Negro' },
  car3: { plate: 'C345678', make: 'Hyundai', model: 'Tucson', color: 'Gris' },
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
  business_name: 'ParkingPro Test',
  business_rnc: '000-000000-0',
  business_address: 'Av. Test #123',
  business_phone: '809-000-0000',
  currency: 'DOP',
  tax_rate: '0.18',
};
