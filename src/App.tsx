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
import NotFound from "./pages/NotFound";

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

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/recurring" element={<RecurringExpenses />} />
              <Route path="/members" element={<Members />} />
              <Route path="/invites" element={<Invites />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/shopping" element={<ShoppingLists />} />
              <Route path="/settings" element={<GroupSettings />} />
              <Route path="/audit-log" element={<AuditLog />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
