import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { App } from './App';
import { GrowthStoreProvider } from './store/GrowthStore';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

// Vite sets BASE_URL from the --base build flag, so the same source works both
// at the dev-server root and under a GitHub Pages project subpath.
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={routerBase}>
      <GrowthStoreProvider>
        <App />
      </GrowthStoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
