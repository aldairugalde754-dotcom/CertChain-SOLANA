import "./polyfills"; // Debe ir ANTES que cualquier otra librería
import React from "react";
import ReactDOM from "react-dom/client";
import "@solana/wallet-adapter-react-ui/styles.css";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { SolanaAppProvider } from "./SolanaProvider";
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicVerifyView from './views/PublicVerifyView'
import TraceabilityView from './views/TraceabilityView'
import VerifyRedirect from './views/VerifyRedirect'
import { ErrorBoundary } from './components/ErrorBoundary'

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SolanaAppProvider>
            <AuthProvider>
              <Routes>
                <Route path="/traceability/:assetId" element={<TraceabilityView />} />
                <Route path="/traceability" element={<TraceabilityView />} />
                <Route path="/verify/:assetId" element={<VerifyRedirect />} />
                <Route path="/verify" element={<PublicVerifyView />} />
                <Route path="/*" element={<App />} />
              </Routes>
            </AuthProvider>
          </SolanaAppProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}