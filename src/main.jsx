import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Auto-recover from stale lazy chunks after a redeploy. When a dynamic import
// fails (old build references a chunk hash that no longer exists), Vite fires
// `vite:preloadError`. Reload once to pull the fresh index.html + current chunks.
// Guarded with sessionStorage so we never loop on a genuine, persistent failure.
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_FLAG = 'pp:chunkReloadAttempted';
  if (!sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.setItem(RELOAD_FLAG, '1');
    event.preventDefault();
    window.location.reload();
  }
});
// Clear the guard once the app has loaded successfully so a future stale-chunk
// event can still trigger one reload.
window.addEventListener('load', () => {
  sessionStorage.removeItem('pp:chunkReloadAttempted');
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
