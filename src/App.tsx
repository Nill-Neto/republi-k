import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Expenses from "./pages/Expenses";
import Payments from "./pages/Payments";
import RecurringExpenses from "./pages/RecurringExpenses";
import Invites from "./pages/Invites";
import GroupSettings from "./pages/GroupSettings";
import AuditLog from "./pages/AuditLog";
import Inventory from "./pages/Inventory";
import ShoppingLists from "./pages/ShoppingLists";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Bulletin from "./pages/Bulletin";
import HouseRules from "./pages/HouseRules";
import Polls from "./pages/Polls";
import CreditCards from "./pages/CreditCards";
import PersonalDashboard from "./pages/PersonalDashboard";
import Bills from "./pages/Bills";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/invite" element={<AcceptInvite />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard key="dashboard-general" />} />
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
              <Route path="/personal/dashboard" element={<PersonalDashboard />} />
              <Route path="/personal/financas" element={<Dashboard />} />
              <Route path="/personal/cards" element={<CreditCards />} />
              <Route path="/personal/bills" element={<Bills />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
