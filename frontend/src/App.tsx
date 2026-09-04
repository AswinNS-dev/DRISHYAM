import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NetworkIntelligence from "./pages/NetworkIntelligence";
import Entities from "./pages/Entities";
import Cases from "./pages/Cases";
import DataImport from "./pages/DataImport";
import Alerts from "./pages/Alerts";

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
          <Route path="/data-import" element={<DataImport />} />
          <Route path="/alerts" element={<Alerts />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
