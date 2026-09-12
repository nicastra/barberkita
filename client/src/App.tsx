import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { Scissors } from 'lucide-react';

import { getSession, type AuthUser } from '@/api/auth';
import { Badge } from '@/components/ui/badge';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { ShopSwitcher } from '@/components/shared/ShopSwitcher';
import { ScopedShopRoute } from '@/components/shared/ScopedShopRoute';
import { AuthPanel } from '@/features/auth/AuthPanel';
import { SystemStatus } from '@/features/system/SystemStatus';
import { HomePage } from '@/pages/HomePage';
import { OwnerAdminPage } from '@/pages/OwnerAdminPage';
import { SignInPage } from '@/pages/SignInPage';
import { SchedulingPage } from '@/pages/SchedulingPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { PublicBookingPage } from '@/pages/PublicBookingPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProviderDashboardPage } from '@/pages/ProviderDashboardPage';
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
  const scopedSlug = location.pathname.match(/^\/(?:app|s)\/([^/]+)/)?.[1];
  const workspacePath = scopedSlug ? `/app/${scopedSlug}` : null;
  const isPublicBookingPage = location.pathname.startsWith('/s/');
  const isDashboardPage = location.pathname.endsWith('/dashboard');
  const isProviderPage = location.pathname.startsWith('/provider');

  return (
    <div className="bg-background text-foreground min-h-screen">
      <a
        href="#main-content"
        className="bg-background text-foreground focus:ring-ring fixed left-3 top-3 z-50 -translate-y-20 rounded-md px-4 py-2 text-sm font-medium shadow focus:translate-y-0 focus:outline-none focus:ring-2"
      >
        Skip to main content
      </a>
      <header className="border-border/80 bg-background/90 border-b backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl shadow-sm">
              <Scissors className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold tracking-tight">
                CukurPro
              </span>
              <span className="text-muted-foreground block text-xs">
                {isProviderPage ? 'Provider console' : 'Shop workspace'}
              </span>
            </span>
          </NavLink>
          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap items-center justify-end gap-3"
          >
            {isProviderPage ? (
              <NavLink
                to="/"
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Back to workspace
              </NavLink>
            ) : (
              <>
                {scopedSlug && (
                  <NavLink
                    to={`/s/${scopedSlug}`}
                    className={({ isActive }) =>
                      `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Book online
                  </NavLink>
                )}
                {user && <ShopSwitcher />}
                {user && workspacePath && (
                  <NavLink
                    to={`${workspacePath}/dashboard`}
                    className={({ isActive }) =>
                      `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Dashboard
                  </NavLink>
                )}
                {user && workspacePath && (
                  <NavLink
                    to={`${workspacePath}/bookings`}
                    className={({ isActive }) =>
                      `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Appointments
                  </NavLink>
                )}
                {user && workspacePath && (
                  <NavLink
                    to={`${workspacePath}/checkout`}
                    className={({ isActive }) =>
                      `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                    }
                  >
                    Checkout
                  </NavLink>
                )}
                {user?.role === 'owner' && workspacePath && (
                  <>
                    <NavLink
                      to={`${workspacePath}/schedule`}
                      className={({ isActive }) =>
                        `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                      }
                    >
                      Schedule
                    </NavLink>
                    <NavLink
                      to={`${workspacePath}/admin`}
                      className={({ isActive }) =>
                        `text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`
                      }
                    >
                      Administration
                    </NavLink>
                  </>
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
              </>
            )}
            {!isProviderPage && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                Phase 6 · Reporting
              </Badge>
            )}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-5 py-10 focus:outline-none sm:px-8 sm:py-16"
      >
        <div
          className={
            isPublicBookingPage || isProviderPage
              ? 'mx-auto max-w-3xl'
              : isDashboardPage
                ? 'block'
                : 'grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-12'
          }
        >
          <div>
            <Outlet />
          </div>
          {!isPublicBookingPage && !isDashboardPage && !isProviderPage && (
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
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getSession()
      .then((response) => {
        if (active) setUser(response.user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSessionReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

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
          <Route path="s/:shopSlug" element={<PublicBookingPage />} />
          <Route element={<ProtectedRoute user={user} ready={sessionReady} />}>
            <Route path="provider" element={<ProviderDashboardPage />} />
          </Route>
          <Route element={<ProtectedRoute user={user} ready={sessionReady} />}>
            <Route
              path="app/:shopSlug"
              element={
                user ? (
                  <ScopedShopRoute
                    user={user}
                    onUserChange={handleUserChange}
                  />
                ) : null
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="checkout" element={<CheckoutPage user={user} />} />
              <Route
                element={
                  <ProtectedRoute user={user} ready={sessionReady} ownerOnly />
                }
              >
                <Route path="admin" element={<OwnerAdminPage user={user} />} />
                <Route path="schedule" element={<SchedulingPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
