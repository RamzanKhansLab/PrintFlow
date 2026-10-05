import { Navigate, Route, Routes } from "react-router-dom";
import { Layout, AdminLayout, RequireAuth } from "./layouts/Layout";
import {
  HomePage,
  ServicesPage,
  PricingPage,
  NotFoundPage,
} from "./pages/PublicPages";
import { AuthPage, AccountPage } from "./pages/AuthPages";
import { PrintPage } from "./pages/PrintPage";
import { OrdersPage, OrderPage, TrackPage } from "./pages/OrderPages";
import {
  DashboardPage,
  QueuePage,
  PrintersPage,
  StationPage,
  JobsPage,
} from "./pages/WorkspacePages";
import { DsaPage } from "./pages/DsaPage";
import {
  InventoryPage,
  PricingAdminPage,
  UsersPage,
  AuditPage,
} from "./pages/ManagementPages";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="login" element={<AuthPage key="login" />} />
        <Route path="register" element={<AuthPage key="register" register />} />
        <Route element={<RequireAuth />}>
          <Route path="print" element={<PrintPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route element={<RequireAuth staff />}>
          <Route path="station/:printerId" element={<StationPage />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="printers" element={<PrintersPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="dsa" element={<DsaPage />} />
            <Route element={<RequireAuth admin />}>
              <Route path="pricing" element={<PricingAdminPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="audit" element={<AuditPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
