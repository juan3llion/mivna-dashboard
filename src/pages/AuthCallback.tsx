import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener to wait for SIGNED_IN event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('AuthCallback - Auth event:', event, 'Session:', !!session);
        
        if (event === 'SIGNED_IN' && session) {
          // Successfully authenticated - redirect to dashboard
          navigate('/dashboard', { replace: true });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token was refreshed, also redirect to dashboard
          navigate('/dashboard', { replace: true });
        } else if (event === 'SIGNED_OUT') {
          // User signed out, redirect to login
          navigate('/login', { replace: true });
        }
        // For other events (INITIAL_SESSION, etc.), keep waiting
      }
    );

    // Also check for existing session (in case user is already logged in)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('AuthCallback - getSession error:', error);
        setError(error.message);
        return;
      }
      
      if (session) {
        // Already have a session, go to dashboard
        navigate('/dashboard', { replace: true });
      }
      // If no session yet, wait for onAuthStateChange to fire
    });

    // Timeout fallback - if nothing happens after 10 seconds, show error
    const timeout = setTimeout(() => {
      setError('La autenticación está tardando demasiado. Por favor, intenta de nuevo.');
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  // Show error state if something went wrong
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error de autenticación</h2>
        <p className="text-muted-foreground text-center mb-4">{error}</p>
        <button 
          onClick={() => navigate('/login', { replace: true })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Verificando autenticación...</p>
    </div>
  );
};

export default AuthCallback;
