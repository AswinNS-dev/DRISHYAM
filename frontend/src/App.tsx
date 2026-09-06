import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NetworkIntelligence from "./pages/NetworkIntelligence";
import Entities from "./pages/Entities";
import Cases from "./pages/Cases";
import FIRs from "./pages/FIRs";
import Intelligence from "./pages/Intelligence";
import Timeline from "./pages/Timeline";
import Locations from "./pages/Locations";
import DataImport from "./pages/DataImport";
import Alerts from "./pages/Alerts";
import Evidence from "./pages/Evidence";
import Reports from "./pages/Reports";
import Communications from "./pages/Communications";
import Transactions from "./pages/Transactions";
import Patterns from "./pages/Patterns";
import Integrity from "./pages/Integrity";
import AuditLog from "./pages/AuditLog";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* ── INVESTIGATION ── */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/data-workspace" element={<DataImport />} />
          <Route path="/data-import" element={<DataImport />} />
          <Route path="/firs" element={<FIRs />} />

          {/* ── ANALYSIS ── */}
          <Route path="/network" element={<NetworkIntelligence />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/intelligence" element={<Intelligence />} />

          {/* ── EVIDENCE ── */}
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/integrity" element={<Integrity />} />

          {/* ── OUTPUT ── */}
          <Route path="/reports" element={<Reports />} />

          {/* ── SECURITY ── */}
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/alerts" element={<Alerts />} />

          {/* ── SYSTEM (RBAC Clearances) ── */}
          <Route
            path="/admin"
            element={
              <RequireAuth allowedRoles={["admin"]}>
                <Admin />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth allowedRoles={["admin"]}>
                <Settings />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
