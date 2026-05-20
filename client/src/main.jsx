import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { SecurityProvider } from './components/providers/SecurityProvider';
import App from './App';
import './app/globals.css';
import { Toaster } from 'react-hot-toast';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SecurityProvider>
          <App />
          <Toaster position="top-center" />
        </SecurityProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

