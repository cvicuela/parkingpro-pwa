# ParkingPro PWA

Progressive Web App version of ParkingPro. Shares the same codebase as parkingpro-app with full PWA support including offline capabilities and installability.

## Setup

```bash
npm install
npm run dev     # Development
npm run build   # Production build
```

## Environment Variables

```
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

## PWA Features

- Service worker with cache-first strategy for static assets
- IndexedDB offline queue for access events and payments
- Automatic sync when connection is restored
- Installable as standalone app via manifest.json
