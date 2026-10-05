import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Spinner } from '../ui/Feedback.jsx';

/** Route guard: redirects to /login when signed out. */
export function RequireAuth() {
  const { user, loading, setupRequired } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={setupRequired ? '/setup' : '/login'} replace state={{ from: location }} />;
  return <Outlet />;
}

/** Route guard for a permission; renders a notice instead of the page when denied. */
export function RequirePermission({ permission, children }) {
  const { can, user } = useAuth();
  if (!can(permission)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Your role (<strong>{user?.role}</strong>) does not have access to this page.
      </div>
    );
  }
  return children ?? <Outlet />;
}

/** Inline guard: renders children only when permitted. */
export function Can({ permission, children, fallback = null }) {
  const { can } = useAuth();
  return can(permission) ? children : fallback;
}
