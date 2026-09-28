import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { FeedbackProvider } from './components/ui/feedback';
import './index.css';
import { StoreProvider } from './store/StoreContext';
import { handleResetQueryParam } from './store/storage';

handleResetQueryParam();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename is "/" locally and "/<repo>" on GitHub Pages (from vite.config.ts `base`). */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <StoreProvider>
        <AuthProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </AuthProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
