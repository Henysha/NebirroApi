import { isDemo } from "./demo/demo-api";
import { DemoApp, DemoOverview, DemoEngineering } from "./demo/DemoApp";
import { FinancingPortalPage } from "./pages/FinancingPortalPage";
import { MerchantNetworkPage } from "./pages/MerchantNetworkPage";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter, createHashRouter } from "react-router-dom";
import { App } from "./App";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DeveloperSdkPage } from "./pages/DeveloperSdkPage";
import { LedgerPage } from "./pages/LedgerPage";
import { PartnersPage } from "./pages/PartnersPage";
import { TransfersPage } from "./pages/TransfersPage";
import { WalletsPage } from "./pages/WalletsPage";
import { WebhookEventsPage } from "./pages/WebhookEventsPage";
import { ApiKeyProvider } from "./lib/auth";
import "./styles.css";

const router = isDemo ? createHashRouter([{ path: "/", element: <DemoApp />, children: [
{ index: true, element: <DemoOverview /> },
{ path: "merchant-network", element: <MerchantNetworkPage /> },
{ path: "merchant", element: <FinancingPortalPage key="merchant" demoRole="merchant" /> },
{ path: "reviewer", element: <FinancingPortalPage key="reviewer" demoRole="reviewer" /> },
{ path: "engineering", element: <DemoEngineering /> },
{ path: "*", element: <DemoOverview /> },
]}]) : createBrowserRouter([
  { path: "/financing-portal", element: <FinancingPortalPage /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "merchant-network", element: <MerchantNetworkPage /> },
      { path: "partners", element: <PartnersPage /> },
      { path: "api-keys", element: <ApiKeysPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "wallets", element: <WalletsPage /> },
      { path: "transfers", element: <TransfersPage /> },
      { path: "ledger", element: <LedgerPage /> },
      { path: "webhooks", element: <WebhookEventsPage /> },
      { path: "sdk", element: <DeveloperSdkPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApiKeyProvider>
      <RouterProvider router={router} />
    </ApiKeyProvider>
  </React.StrictMode>,
);
