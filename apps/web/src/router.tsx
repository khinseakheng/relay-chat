import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { WorkspaceRequiredRoute } from './components/WorkspaceRequiredRoute';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);

const ContactsPage = lazy(() =>
  import('./pages/ContactsPage').then((module) => ({ default: module.ContactsPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const InboxPage = lazy(() => import('./pages/InboxPage').then((module) => ({ default: module.InboxPage })));
const WidgetsPage = lazy(() =>
  import('./pages/WidgetsPage').then((module) => ({ default: module.WidgetsPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const InvitePage = lazy(() =>
  import('./pages/InvitePage').then((module) => ({ default: module.InvitePage })),
);
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })),
);
const TeamPage = lazy(() => import('./pages/TeamPage').then((module) => ({ default: module.TeamPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const WorkspacesPage = lazy(() =>
  import('./pages/WorkspacesPage').then((module) => ({ default: module.WorkspacesPage })),
);
const AdministrationPage = lazy(() =>
  import('./pages/AdministrationPage').then((module) => ({ default: module.AdministrationPage })),
);
const DeveloperDocsPage = lazy(() =>
  import('./pages/DeveloperDocsPage').then((module) => ({ default: module.DeveloperDocsPage })),
);

const load = (page: ReactNode) => (
  <Suspense
    fallback={
      <div className="grid h-screen flex-1 place-items-center bg-slate-50 text-sm text-slate-400">
        Loading Relay…
      </div>
    }
  >
    {page}
  </Suspense>
);

export const router = createBrowserRouter([
  { path: '/', element: load(<LandingPage />) },
  { path: '/login', element: load(<LoginPage />) },
  { path: '/register', element: load(<RegisterPage />) },
  { path: '/invite/:token', element: load(<InvitePage />) },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/workspaces', element: load(<WorkspacesPage />) },
      {
        element: <WorkspaceRequiredRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: load(<DashboardPage />) },
              { path: '/onboarding', element: load(<OnboardingPage />) },
              { path: '/inbox', element: load(<InboxPage />) },
              { path: '/inbox/:conversationId', element: load(<InboxPage />) },
              { path: '/contacts', element: load(<ContactsPage />) },
              { path: '/install', element: <Navigate to="/widgets" replace /> },
              { path: '/widgets', element: load(<WidgetsPage />) },
              { path: '/widgets/:widgetId/:tab', element: load(<WidgetsPage />) },
              { path: '/settings', element: load(<SettingsPage />) },
              { path: '/team', element: load(<TeamPage />) },
              { path: '/administration', element: load(<AdministrationPage />) },
              { path: '/docs', element: load(<DeveloperDocsPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
