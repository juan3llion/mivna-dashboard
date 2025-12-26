import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import RepoDetails from "@/pages/RepoDetails";
import NotFound from "@/pages/NotFound";
import AuthCallback from "@/pages/AuthCallback";
import RootRedirect from "@/pages/RootRedirect";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Root dispatcher */}
          <Route path="/" element={<RootRedirect />} />

          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Home />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repo/:id"
            element={
              <ProtectedRoute>
                <RepoDetails />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
