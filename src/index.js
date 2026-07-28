import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import BUILD_VERSION from './version';
import { register as registerSW } from './serviceWorkerRegistration';

(async () => {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`);
    const data = await res.json();
    if (data.version !== BUILD_VERSION) {
      window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
    }
  } catch (e) {
    // if version.json unreachable, just load normally
  }
})();

registerSW({
  onUpdate: () => {
    window.location.reload();
  },
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
      if (data.version !== BUILD_VERSION) {
        window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
      }
    } catch (err) {}
  }
});

reportWebVitals();
