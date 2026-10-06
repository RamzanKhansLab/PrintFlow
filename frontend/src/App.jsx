import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout, AdminLayout, RequireAuth } from "./layouts/Layout";
import { HomePage, GuidePage, NotFoundPage } from "./pages/PublicPages";
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
import { InventoryPage, UsersPage, AuditPage } from "./pages/ManagementPages";

function LegacyRequestLink() {
  const { id } = useParams();
  return <Navigate to={`/requests/${id}`} replace />;
}
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="services" element={<Navigate to="/guide" replace />} />
        <Route path="login" element={<AuthPage key="login" />} />
        <Route path="register" element={<AuthPage key="register" register />} />
        <Route element={<RequireAuth />}>
          <Route path="print" element={<PrintPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="requests" element={<OrdersPage />} />
          <Route path="requests/:id" element={<OrderPage />} />
          <Route path="orders" element={<Navigate to="/requests" replace />} />
          <Route path="orders/:id" element={<LegacyRequestLink />} />
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
