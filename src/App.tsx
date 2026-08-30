import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import JudgeDashboard from './pages/JudgeDashboard'; // <-- 1. Importa el componente
import OrganizerDashboard from './pages/OrganizerDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/juez" element={<JudgeDashboard />} />

        <Route path="/organizador" element={<OrganizerDashboard />} />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}