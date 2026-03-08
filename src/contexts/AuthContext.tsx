import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  phone: string | null;
  onboarding_completed: boolean;
}

interface GroupMembership {
  group_id: string;
  role: "admin" | "morador";
  group_name: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  membership: GroupMembership | null;
  loading: boolean;
  isAdmin: boolean;
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    membership: null,
    loading: true,
    isAdmin: false,
  });

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data;
  };

  const fetchMembership = async (userId: string): Promise<GroupMembership | null> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, group_id, groups:group_id(name)")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return null;

    const groupData = data.groups as unknown as { name: string } | null;
    return {
      group_id: data.group_id,
      role: data.role as "admin" | "morador",
      group_name: groupData?.name ?? "",
    };
  };

  const ensureProfile = async (user: User): Promise<Profile> => {
    let profile = await fetchProfile(user.id);
    if (!profile) {
      const meta = user.user_metadata;
      const newProfile = {
        id: user.id,
        full_name: meta?.full_name || meta?.name || "",
        email: user.email || "",
        avatar_url: meta?.avatar_url || meta?.picture || "",
      };
      await supabase.from("profiles").insert(newProfile);
      profile = await fetchProfile(user.id);
    }
    return profile!;
  };

  const loadUserData = async (user: User) => {
    try {
      const [profile, membership] = await Promise.all([
        ensureProfile(user),
        fetchMembership(user.id),
      ]);

      setState((prev) => ({
        ...prev,
        profile,
        membership,
        isAdmin: membership?.role === "admin",
        loading: false,
      }));
    } catch (error) {
      console.error("Erro ao carregar dados do usuário", error);
      setState((prev) => ({
        ...prev,
        profile: null,
        membership: null,
        isAdmin: false,
        loading: false,
      }));
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        setState((prev) => ({ ...prev, user, session }));

        if (user) {
          setTimeout(() => {
            void loadUserData(user);
          }, 0);
        } else {
          setState({
            user: null,
            session: null,
            profile: null,
            membership: null,
            loading: false,
            isAdmin: false,
          });
        }
      }
    );

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const user = session?.user ?? null;
        setState((prev) => ({ ...prev, user, session }));
        if (user) {
          void loadUserData(user);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch((error) => {
        console.error("Erro ao recuperar sessão", error);
        setState((prev) => ({ ...prev, loading: false }));
      });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectPath = window.location.pathname + window.location.search;
    const redirectTo = `${window.location.origin}${redirectPath}`;
    const inIframe = window.self !== window.top;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error("Não foi possível iniciar o login com Google.");

    if (inIframe) {
      window.open(data.url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.assign(data.url);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));
    }
  };

  const refreshMembership = async () => {
    if (state.user) {
      const membership = await fetchMembership(state.user.id);
      setState((prev) => ({
        ...prev,
        membership,
        isAdmin: membership?.role === "admin",
      }));
    }
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signInWithGoogle, signOut, refreshProfile, refreshMembership }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}