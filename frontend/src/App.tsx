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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/network" element={<NetworkIntelligence />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/firs" element={<FIRs />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/data-import" element={<DataImport />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
