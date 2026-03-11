import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackgroundPathsLayer } from "@/components/ui/background-paths";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";

import Login from "./pages/Login";

const Index = lazy(() => import("./pages/Index"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Members = lazy(() => import("./pages/Members"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Payments = lazy(() => import("./pages/Payments"));
const RecurringExpenses = lazy(() => import("./pages/RecurringExpenses"));
const Invites = lazy(() => import("./pages/Invites"));
const GroupSettings = lazy(() => import("./pages/GroupSettings"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Inventory = lazy(() => import("./pages/Inventory"));
const ShoppingLists = lazy(() => import("./pages/ShoppingLists"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Bulletin = lazy(() => import("./pages/Bulletin"));
const HouseRules = lazy(() => import("./pages/HouseRules"));
const Polls = lazy(() => import("./pages/Polls"));
const NewGroup = lazy(() => import("./pages/NewGroup"));
const Admin = lazy(() => import("./pages/Admin"));
const SidebarDemoPage = lazy(() => import("./pages/SidebarDemoPage"));
const BackgroundPathsDemoPage = lazy(() => import("./pages/BackgroundPathsDemoPage"));

const queryClient = new QueryClient();

const AppShell = () => {
  const { pathname } = useLocation();
  const showGlobalBackground = pathname !== "/background-paths-demo";

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-neutral-950">
      {showGlobalBackground && <BackgroundPathsLayer />}
      <div className="relative z-10">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/invite" element={<AcceptInvite />} />
            <Route path="/sidebar-demo" element={<SidebarDemoPage />} />
            <Route path="/background-paths-demo" element={<BackgroundPathsDemoPage />} />

            {/* Authenticated routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard key="dashboard-general" />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/recurring" element={<RecurringExpenses />} />
              <Route path="/members" element={<Members />} />
              <Route path="/invites" element={<Invites />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/shopping" element={<ShoppingLists />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<GroupSettings />} />
              <Route path="/bulletin" element={<Bulletin />} />
              <Route path="/rules" element={<HouseRules />} />
              <Route path="/polls" element={<Polls />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/groups/new" element={<NewGroup />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;