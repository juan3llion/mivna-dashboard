import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { cloudSupabase } from '@/integrations/cloud/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if URL contains OAuth or callback parameters that Supabase needs to process
const hasAuthParams = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('access_token') ||
    hash.includes('refresh_token') ||
    search.includes('code=') ||
    search.includes('installation_id=')
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = cloudSupabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Use setTimeout to defer state update and avoid deadlocks
        setTimeout(() => setLoading(false), 0);
      }
    );

    // THEN check for existing session
    cloudSupabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Only stop loading if there are NO auth params in URL
      // If there ARE auth params, wait for onAuthStateChange to fire
      if (!hasAuthParams()) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await cloudSupabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
