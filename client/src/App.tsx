import { useCallback, useState } from 'react';
import { NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { Scissors } from 'lucide-react';

import type { AuthUser } from '@/api/auth';
import { Badge } from '@/components/ui/badge';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { AuthPanel } from '@/features/auth/AuthPanel';
import { SystemStatus } from '@/features/system/SystemStatus';
import { HomePage } from '@/pages/HomePage';
import { OwnerAdminPage } from '@/pages/OwnerAdminPage';
import { SignInPage } from '@/pages/SignInPage';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function NotFoundPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Page not found</CardTitle>
        <CardDescription>
          The workspace page you requested does not exist.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

interface AppLayoutProps {
  user: AuthUser | null;
  onUserChange: (user: AuthUser | null) => void;
  onSessionResolved: () => void;
}

function AppLayout({ user, onUserChange, onSessionResolved }: AppLayoutProps) {
  const location = useLocation();
  const isSignInPage = location.pathname === '/sign-in';

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border/80 bg-background/90 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl shadow-sm">
              <Scissors className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold tracking-tight">
                CukurPro
              </span>
              <span className="text-muted-foreground block text-xs">
                Shop workspace
              </span>
            </span>
          </NavLink>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-3"
          >
            {user?.role === 'owner' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                }
              >
                Administration
              </NavLink>
            )}
            {!user && (
              <NavLink
                to="/sign-in"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                }
              >
                Sign in
              </NavLink>
            )}
            <Badge variant="outline" className="hidden sm:inline-flex">
              Phase 1 · Shop setup
            </Badge>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-12">
          <div>
            <Outlet />
          </div>
          <aside className="lg:sticky lg:top-8">
            <SystemStatus />
            {!isSignInPage && (
              <div className="mt-6">
                <AuthPanel
                  onUserChange={onUserChange}
                  onSessionResolved={onSessionResolved}
                />
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const handleUserChange = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
  }, []);
  const handleSessionResolved = useCallback(() => {
    setSessionReady(true);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppLayout
              user={user}
              onUserChange={handleUserChange}
              onSessionResolved={handleSessionResolved}
            />
          }
        >
          <Route index element={<HomePage />} />
          <Route
            path="sign-in"
            element={
              <SignInPage
                onUserChange={handleUserChange}
                onSessionResolved={handleSessionResolved}
              />
            }
          />
          <Route
            element={
              <ProtectedRoute user={user} ready={sessionReady} ownerOnly />
            }
          >
            <Route path="admin" element={<OwnerAdminPage user={user} />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
