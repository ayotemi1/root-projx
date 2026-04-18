import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DiscoverPage from "@/pages/discover";
import FeedPage from "@/pages/feed";
import HelpPage from "@/pages/help";
import AccountPage from "@/pages/account";
import OrgProfilePage from "@/pages/org-profile";
import DonatePage from "@/pages/donate";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/" />;
  return <Component />;
}

function AppRoutes() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={DiscoverPage} />
          <Route path="/feed" component={FeedPage} />
          <Route path="/help" component={HelpPage} />
          <Route path="/account">
            {() => <ProtectedRoute component={AccountPage} />}
          </Route>
          <Route path="/organisations/:id" component={OrgProfilePage} />
          <Route path="/donate/:orgId" component={DonatePage} />
          <Route path="/dashboard">
            {() => <ProtectedRoute component={DashboardPage} />}
          </Route>
          <Route path="/login">
            {() => <AuthRoute component={LoginPage} />}
          </Route>
          <Route path="/register">
            {() => <AuthRoute component={RegisterPage} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
