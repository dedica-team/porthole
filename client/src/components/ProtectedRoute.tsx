import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/mapStore';

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionLoading = useAuthStore((s) => s.sessionLoading);
  const sessionResolved = useAuthStore((s) => s.sessionResolved);

  if (sessionLoading || !sessionResolved) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground text-sm">
        Checking session…
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
}

