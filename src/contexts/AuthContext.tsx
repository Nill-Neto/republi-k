import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type SetStateAction,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  avatar_url: string;
  phone: string | null;
  onboarding_completed: boolean;
}

export interface GroupMembership {
  group_id: string;
  role: "admin" | "morador";
  group_name: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  memberships: GroupMembership[];
  activeGroupId: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  /** Active group membership (derived from activeGroupId) */
  membership: GroupMembership | null;
  isAdmin: boolean;
  setActiveGroupId: (groupId: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const ACTIVE_GROUP_KEY = "republi-k-active-group";

const AuthContext = createContext<AuthContextType | undefined>(undefined);


const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const isMountedRef = useRef(true);
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    memberships: [],
    activeGroupId: localStorage.getItem(ACTIVE_GROUP_KEY),
    loading: true,
  });

  const safeSetState = useCallback((updater: SetStateAction<AuthState>) => {
    if (!isMountedRef.current) return;
    setState(updater);
  }, []);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data;
  };

  const fetchMemberships = async (userId: string): Promise<GroupMembership[]> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, group_id, groups:group_id(name)")
      .eq("user_id", userId);

    if (!data || data.length === 0) return [];

    return data.map((row) => {
      const groupData = row.groups as unknown as { name: string } | null;
      return {
        group_id: row.group_id,
        role: row.role as "admin" | "morador",
        group_name: groupData?.name ?? "",
      };
    });
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
      const [profileResult, membershipsResult] = await Promise.allSettled([
        withTimeout(ensureProfile(user), 10000, "Tempo limite ao carregar perfil"),
        withTimeout(fetchMemberships(user.id), 10000, "Tempo limite ao carregar grupos"),
      ]);

      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const memberships = membershipsResult.status === "fulfilled" ? membershipsResult.value : [];

      if (profileResult.status === "rejected") {
        console.error("Erro ao carregar perfil", profileResult.reason);
      }

      if (membershipsResult.status === "rejected") {
        console.error("Erro ao carregar grupos", membershipsResult.reason);
      }

      safeSetState((prev) => {
        // Auto-select active group: stored preference → first membership
        let activeGroupId = prev.activeGroupId;
        const validIds = memberships.map((m) => m.group_id);
        if (!activeGroupId || !validIds.includes(activeGroupId)) {
          activeGroupId = validIds[0] ?? null;
        }
        if (activeGroupId) {
          localStorage.setItem(ACTIVE_GROUP_KEY, activeGroupId);
        }

        return {
          ...prev,
          profile,
          memberships,
          activeGroupId,
          loading: false,
        };
      });
    } catch (error) {
      console.error("Erro ao carregar dados do usuário", error);
      safeSetState((prev) => ({
        ...prev,
        profile: null,
        memberships: [],
        loading: false,
      }));
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null;
        safeSetState((prev) => ({ ...prev, user, session, loading: !!user }));

        if (user) {
          void loadUserData(user);
        } else {
          localStorage.removeItem(ACTIVE_GROUP_KEY);
          safeSetState({
            user: null,
            session: null,
            profile: null,
            memberships: [],
            activeGroupId: null,
            loading: false,
          });
        }
      }
    );

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const user = session?.user ?? null;
        safeSetState((prev) => ({ ...prev, user, session, loading: !!user }));
        if (user) {
          void loadUserData(user);
        } else {
          safeSetState((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch((error) => {
        console.error("Erro ao recuperar sessão", error);
        safeSetState((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [safeSetState]);

  const setActiveGroupId = useCallback((groupId: string) => {
    localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
    setState((prev) => ({ ...prev, activeGroupId: groupId }));
  }, []);

  const signInWithGoogle = async () => {
    const redirectPath = window.location.pathname + window.location.search;
    const redirectTo = `${window.location.origin}${redirectPath}`;
    const inIframe = window.self !== window.top;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
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
    localStorage.removeItem(ACTIVE_GROUP_KEY);
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
      const memberships = await fetchMemberships(state.user.id);
      setState((prev) => {
        let activeGroupId = prev.activeGroupId;
        const validIds = memberships.map((m) => m.group_id);
        if (!activeGroupId || !validIds.includes(activeGroupId)) {
          activeGroupId = validIds[0] ?? null;
        }
        if (activeGroupId) {
          localStorage.setItem(ACTIVE_GROUP_KEY, activeGroupId);
        }
        return { ...prev, memberships, activeGroupId };
      });
    }
  };

  // Derived values
  const membership = state.memberships.find((m) => m.group_id === state.activeGroupId) ?? null;
  const isAdmin = membership?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        ...state,
        membership,
        isAdmin,
        setActiveGroupId,
        signInWithGoogle,
        signOut,
        refreshProfile,
        refreshMembership,
      }}
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
