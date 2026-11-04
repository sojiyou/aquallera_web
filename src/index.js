import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import BUILD_VERSION from './version';
import { register as registerSW } from './serviceWorkerRegistration';

const VERSION_RELOAD_KEY = 'aquallera:version-reload';

// Reload at most once per target version. Without this guard a mismatch
// between version.json and the bundled version (e.g. a forgotten bump) would
// reload the page forever.
const reloadIfOutdated = (data) => {
  if (!data || data.version === BUILD_VERSION) return;
  try {
    if (window.sessionStorage.getItem(VERSION_RELOAD_KEY) === data.version) {
      return;
    }
    window.sessionStorage.setItem(VERSION_RELOAD_KEY, data.version);
  } catch (e) {
    // sessionStorage unavailable: fall through to a single reload attempt
  }
  window.location.href =
    window.location.href.split('?')[0] + '?v=' + Date.now();
};

(async () => {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`);
    const data = await res.json();
    reloadIfOutdated(data);
  } catch (e) {
    // if version.json unreachable, just load normally
  }
})();

registerSW({
  onUpdate: () => {
    window.location.reload();
  },
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredPrompt = e;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

window.addEventListener('pageshow', async (e) => {
  if (e.persisted) {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      const data = await res.json();
      reloadIfOutdated(data);
    } catch (err) {}
  }
});

reportWebVitals();
