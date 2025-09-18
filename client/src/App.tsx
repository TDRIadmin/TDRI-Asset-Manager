import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import RoadAssets from "@/pages/RoadAssets";
import Maintenance from "@/pages/Maintenance";
import Policies from "@/pages/Policies";
import DeteriorationModels from "@/pages/DeteriorationModels";
import BudgetPlanning from "@/pages/BudgetPlanning";
import MapView from "@/pages/MapView";
import ImportExport from "@/pages/ImportExport";
import AuditLogs from "@/pages/AuditLogs";
import AssetInventory from "@/pages/AssetInventory";
import UserManagement from "@/pages/UserManagement";
import MoistureHotspots from "@/pages/MoistureHotspots";
import AuthPage from "@/pages/AuthPage";
import { useState, useEffect } from "react";
import { TenantProvider } from "@/hooks/use-tenant";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { user, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // If not authenticated, show auth page
  if (!user) {
    return <AuthPage />;
  }

  // User is authenticated, show main app
  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden bg-neutral-bg text-neutral-text">
        {/* Sidebar */}
        <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

        {/* Mobile header */}
        <div className="md:hidden w-full bg-white shadow-md fixed top-0 z-40">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-semibold text-primary">TDRIPlanner</h1>
            <button 
              className="text-neutral-text focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto pt-0 md:pt-0 pb-16 md:pb-0 mt-16 md:mt-0">
          <Toaster />
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/road-assets" component={RoadAssets} />
            <Route path="/maintenance" component={Maintenance} />
            <Route path="/policies" component={Policies} />
            <Route path="/deterioration-models" component={DeteriorationModels} />
            <Route path="/budget-planning" component={BudgetPlanning} />
            <Route path="/map-view" component={MapView} />
            <Route path="/moisture-hotspots" component={MoistureHotspots} />
            <Route path="/import-export" component={ImportExport} />
            <Route path="/audit-logs" component={AuditLogs} />
            <Route path="/asset-inventory" component={AssetInventory} />
            <Route path="/user-management" component={UserManagement} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </TenantProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
