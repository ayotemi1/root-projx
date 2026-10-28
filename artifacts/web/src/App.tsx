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
import FeedPage from "@/pages/feed";
import DiscoverPage from "@/pages/discover";
import HelpPage from "@/pages/help";
import AccountPage from "@/pages/account";
import OrgProfilePage from "@/pages/org-profile";
import OrgCampaignsPage from "@/pages/org-campaigns";
import OrgUpdatesPage from "@/pages/org-updates";
import OrgVolunteerPage from "@/pages/org-volunteer";
import OrgAboutPage from "@/pages/org-about";
import OrgDashboardPage from "@/pages/org-dashboard";
import DonatePage from "@/pages/donate";
import DonateSuccessPage from "@/pages/donate-success";
import DashboardPage from "@/pages/dashboard";
import { AdminOrganisationAccess } from "@/components/admin-organisation-access";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import RegisterPage from "@/pages/register";
import ShopPage from "@/pages/shop";
import ShopSuccessPage from "@/pages/shop-success";
import ShopCancelPage from "@/pages/shop-cancel";
import AboutPage from "@/pages/about";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import SupportPage from "@/pages/support";
import OnboardingPage from "@/pages/onboarding";
import AdminLoginPage from "@/pages/admin-login";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import SupporterProfilePage from "@/pages/supporter-profile";
import CampaignLandingPage from "@/pages/campaign-landing";
import CampaignPreviewPage from "@/pages/campaign-preview";

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

function ApprovedOrganisationRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.accountType !== "organisation" || user.approvalStatus !== "approved") {
    const declined = user?.approvalStatus === "declined";
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center" data-testid="status-organisation-review">
        <h1 className="text-3xl font-bold">
          {declined ? "Your application was not approved" : "Your application is under review"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {declined
            ? "Your account remains available, but organisation tools are locked. Check your email for details or contact the Root ProjX team if you have questions."
            : "Your account is ready, but organisation tools remain locked until the Root ProjX team approves your application. We’ll email you with an update within 5 business days."}
        </p>
      </div>
    );
  }
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

      {/* Campaign Landing page — standalone */}
      <Route path="/campaign/preview/:orgId/:campId">
        {() => <ApprovedOrganisationRoute component={CampaignPreviewPage} />}
      </Route>
      <Route path="/campaign/:organisationSlug/:campaignSlug" component={CampaignLandingPage} />
      <Route path="/campaigns/:organisationSlug/:campaignSlug" component={CampaignLandingPage} />
      <Route path="/campaigns/:publicId" component={CampaignLandingPage} />

      {/* Org onboarding — standalone questionnaire */}
      <Route path="/onboarding" component={OnboardingPage} />

      {/* Admin — standalone, no navbar/footer */}
      <Route path="/admin/organisations/:id/manage" component={DashboardPage} />
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminPage} />

      {/* All other pages — wrapped in navbar + footer */}
      <Route>
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1">
            <Switch>
              <Route path="/feed" component={FeedPage} />
              <Route path="/discover" component={DiscoverPage} />
              <Route path="/shop/success" component={ShopSuccessPage} />
              <Route path="/shop/cancel" component={ShopCancelPage} />
              <Route path="/shop" component={ShopPage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="/support" component={SupportPage} />
              <Route path="/terms" component={TermsPage} />
              <Route path="/help" component={HelpPage} />
              <Route path="/account">
                {() => <ProtectedRoute component={AccountPage} />}
              </Route>
              <Route path="/org-dashboard">
                {() => <ApprovedOrganisationRoute component={OrgDashboardPage} />}
              </Route>
              <Route path="/organisations/:id/campaigns" component={OrgCampaignsPage} />
              <Route path="/organisations/:id/updates" component={OrgUpdatesPage} />
              <Route path="/organisations/:id/volunteer" component={OrgVolunteerPage} />
              <Route path="/organisations/:id/about" component={OrgAboutPage} />
              <Route path="/organisations/:id" component={OrgProfilePage} />
              <Route path="/supporters/:publicId" component={SupporterProfilePage} />
              <Route path="/donate/success" component={DonateSuccessPage} />
              <Route path="/donate/:orgId" component={DonatePage} />
              <Route path="/dashboard">
                {() => <ApprovedOrganisationRoute component={DashboardPage} />}
              </Route>
              <Route path="/login">
                {() => <AuthRoute component={LoginPage} />}
              </Route>
              <Route path="/forgot-password" component={ForgotPasswordPage} />
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
              <AdminOrganisationAccess><AppRoutes /></AdminOrganisationAccess>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
