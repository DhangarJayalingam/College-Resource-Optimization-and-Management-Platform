import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout } from './layout/AppLayout';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { BookingApprovalPage } from './pages/BookingApprovalPage';
import { BookingHistoryPage } from './pages/BookingHistoryPage';
import { BookingPage } from './pages/BookingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DepartmentDetailPage } from './pages/DepartmentDetailPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { LabOpsPage } from './pages/LabOpsPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimetablePage } from './pages/TimetablePage';
import { UserManagementPage } from './pages/UserManagementPage';
import { clearStoredToken, isAuthenticated, setStoredToken } from './utils/auth';

function ProtectedLayout() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

function PublicLogin() {
  if (isAuthenticated()) {
    return <Navigate to="/app" replace />;
  }
  return <LoginPage />;
}

function PublicHome() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenId = params.get('tokenId');
    const token = params.get('token');
    const error = params.get('error');

    if (tokenId) {
      // Fetch the actual token using the tokenId (new secure approach)
      fetch(`http://localhost:8080/api/v1/auth/oauth2/token/${tokenId}`)
        .then(res => res.json())
        .then(data => {
          if (data.data && data.data.token) {
            setStoredToken(data.data.token);
            window.location.href = '/app';
          } else {
            throw new Error('No token received');
          }
        })
        .catch(err => {
          clearStoredToken();
          window.location.href = '/login?error=' + encodeURIComponent(err.message);
        });
    } else if (token) {
      // Legacy support for old token in URL parameter
      setStoredToken(token);
      window.location.href = '/app';
    } else if (error) {
      clearStoredToken();
      window.location.href = '/login?error=' + encodeURIComponent(error);
    } else if (isAuthenticated()) {
      window.location.href = '/app';
    }
  }, [location]);

  if (isAuthenticated()) {
    return <Navigate to="/app" replace />;
  }

  return <LandingPage />;
}

function OAuthCallbackHandler() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenId = params.get('tokenId');
    const error = params.get('error');

    if (tokenId) {
      // Fetch the actual token using the tokenId
      fetch(`http://localhost:8080/api/v1/auth/oauth2/token/${tokenId}`)
        .then(res => res.json())
        .then(data => {
          if (data.data && data.data.token) {
            setStoredToken(data.data.token);
            window.location.href = '/app';
          } else {
            throw new Error('No token received');
          }
        })
        .catch(err => {
          clearStoredToken();
          window.location.href = '/login?error=' + encodeURIComponent(err.message);
        });
    } else if (error) {
      clearStoredToken();
      window.location.href = '/login?error=' + encodeURIComponent(error);
    }
  }, [location]);

  return <div>Processing OAuth callback...</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<PublicLogin />} />
      <Route path="/oauth-callback" element={<OAuthCallbackHandler />} />
      <Route path="/app" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="bookings" element={<BookingPage />} />
        <Route path="bookings/approvals" element={<BookingApprovalPage />} />
        <Route path="bookings/history" element={<BookingHistoryPage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="ai-assistant" element={<AiAssistantPage />} />
        <Route path="lab-ops" element={<LabOpsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="departments/:id" element={<DepartmentDetailPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
