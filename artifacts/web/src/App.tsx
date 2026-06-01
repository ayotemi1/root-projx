import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SplashScreen from "@/components/SplashScreen";
import LandingPage from "@/pages/landing";
import HomePage from "@/pages/home";
import DiscoverPage from "@/pages/discover";
import HelpPage from "@/pages/help";
import AccountPage from "@/pages/account";
import OrgProfilePage from "@/pages/org-profile";
import OrgCampaignsPage from "@/pages/org-campaigns";
import OrgUpdatesPage from "@/pages/org-updates";
import DonatePage from "@/pages/donate";
import DonateSuccessPage from "@/pages/donate-success";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ShopPage from "@/pages/shop";
import ShopSuccessPage from "@/pages/shop-success";
import ShopCancelPage from "@/pages/shop-cancel";
import AboutPage from "@/pages/about";
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
  if (isAuthenticated) return <Redirect to="/feed" />;
  return <Component />;
}

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) return <SplashScreen />;

  return (
    <Switch>
      {/* Landing page — no navbar or footer */}
      <Route path="/" component={LandingPage} />

      {/* All other pages — wrapped in navbar + footer */}
      <Route>
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1">
            <Switch>
              <Route path="/feed" component={HomePage} />
              <Route path="/discover" component={DiscoverPage} />
              <Route path="/shop/success" component={ShopSuccessPage} />
              <Route path="/shop/cancel" component={ShopCancelPage} />
              <Route path="/shop" component={ShopPage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/help" component={HelpPage} />
              <Route path="/account">
                {() => <ProtectedRoute component={AccountPage} />}
              </Route>
              <Route path="/organisations/:id/campaigns" component={OrgCampaignsPage} />
              <Route path="/organisations/:id/updates" component={OrgUpdatesPage} />
              <Route path="/organisations/:id" component={OrgProfilePage} />
              <Route path="/donate/success" component={DonateSuccessPage} />
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
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
