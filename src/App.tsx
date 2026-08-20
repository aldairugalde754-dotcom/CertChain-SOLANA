import { useState, useEffect } from "react";
import Landing from "./views/Landing";
import {
  Sidebar,
  type ClientView,
  type CompanyView,
  type AppView,
} from "./components/Shared";
import {
  ClientMarketplace,
  ClientAuctions,
  ClientHistory,
  ClientWallet,
  ClientTransfer,
} from "./views/ClientViews";
import TraceabilityView from './views/TraceabilityView'
import {
  CompanyCertify,
  CompanyAuctionDash,
  CompanyMarketDash,
} from "./views/CompanyViews";
import InventoryView from "./views/InventoryView";
import TransferView from "./views/TransferView";

export default function App() {
  const [appView, setAppView] = useState<AppView>("landing");
  const [role, setRole] = useState<"client" | "company" | null>(null);
  const [user, setUser] = useState<any>(null); // Almacena los datos del usuario logueado
  const [clientView, setClientView] = useState<ClientView>("marketplace");
  const [companyView, setCompanyView] = useState<CompanyView>("certify");

  // 1. Verificar si ya existe una sesión guardada al cargar/recargar la página
  useEffect(() => {
    const savedUser = localStorage.getItem("certchain_user");
    const savedToken = localStorage.getItem("certchain_token");

    if (savedUser && savedToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        const activeRole = parsedUser.role === "company" ? "company" : "client";
        
        setUser(parsedUser);
        setRole(activeRole);
        setAppView(activeRole);
      } catch (e) {
        console.error("Error al parsear el usuario guardado:", e);
        handleLogout();
      }
    }
  }, []);

  // 2. Transición cuando el usuario inicia sesión o se registra en Landing.tsx
  const handleEnter = (r: "client" | "company", userData?: any) => {
    setRole(r);
    setAppView(r);
    if (userData) {
      setUser(userData);
    }
  };

  // 3. Cerrar sesión y limpiar LocalStorage
  const handleLogout = () => {
    localStorage.removeItem("certchain_token");
    localStorage.removeItem("certchain_user");
    setUser(null);
    setRole(null);
    setAppView("landing");
    setClientView("marketplace");
    setCompanyView("certify");
  };

  // Si la vista activa es landing, renderizar Landing
  if (appView === "landing") {
    return <Landing onEnter={handleEnter} />;
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--background)",
      }}
    >
      <Sidebar
        role={role!}
        user={user} // Opcional: puedes pasarlo para mostrar el correo/empresa en el Sidebar
        activeView={role === "client" ? clientView : companyView}
        onNavigate={(v) => {
          if (role === "client") setClientView(v as ClientView);
          else setCompanyView(v as CompanyView);
        }}
        onLogout={handleLogout}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {role === "client" && (
          <>
            {clientView === "marketplace" && <ClientMarketplace user={user} />}
            {clientView === "auctions" && <ClientAuctions user={user} />}
            {clientView === "history" && <TraceabilityView />}
            {clientView === "wallet" && <ClientWallet user={user} />}
            {clientView === "transfer" && <ClientTransfer user={user} />}
          </>
        )}
        {role === "company" && (
          <>
            {companyView === "certify" && <CompanyCertify user={user} />}
            {companyView === "auction-dash" && <CompanyAuctionDash user={user} />}
            {companyView === "market-dash" && <CompanyMarketDash user={user} />}
            {companyView === "inventory" && <InventoryView user={user} />}
            {companyView === "transfer-cert" && <TransferView user={user} />}
          </>
        )}
      </main>
    </div>
  );
}