import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './lib/ctx';
import './styles.css';

// Daftarkan service worker supaya aplikasi bisa dipasang di layar utama.
const inApk = ['appassets.androidplatform.net', '127.0.0.1', 'localhost'].includes(location.hostname);
if ('serviceWorker' in navigator && import.meta.env.PROD && !inApk) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
