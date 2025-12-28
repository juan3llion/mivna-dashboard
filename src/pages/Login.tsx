import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, LayoutGrid, Github } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes("access_token") || search.includes("code=") || search.includes("installation_id=")) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const handleGitHubLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          scopes: "repo",
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error("Login Error:", error);
        toast.error("Failed to connect with GitHub");
      }
    } catch (error) {
      console.error("Login Error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-background-dark">
      {/* Background Image with Blur Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=2070')",
        }}
      >
        <div className="absolute inset-0 bg-[#101622]/80 backdrop-blur-sm" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        {/* Glassmorphism Card - ArchGen Design System */}
        <div className="w-full max-w-md bg-[#1a1a1e]/90 backdrop-blur-xl rounded-xl border border-[#232f48] p-8 shadow-2xl">
          {/* Icon - Using Lucide LayoutGrid instead of Material Symbols */}
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20">
              <LayoutGrid className="h-7 w-7 text-primary" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground text-center mb-2 font-space-grotesk">Welcome to MIVNA</h1>

          {/* Subtitle */}
          <p className="text-[#92a4c9] text-center mb-8 font-noto-sans">Sign in with GitHub to get started</p>

          {/* GitHub OAuth Button */}
          <button
            type="button"
            onClick={handleGitHubLogin}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg 
                       bg-[#24292e] hover:bg-[#2f363d]
                       text-foreground font-semibold font-space-grotesk
                       border border-[#232f48]
                       transition-all disabled:opacity-50 
                       flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Github className="h-5 w-5" />}
            Continue with GitHub
          </button>

          {/* Beta Notice */}
          <p className="text-center text-[#92a4c9]/60 text-xs mt-6 font-noto-sans">No credit card required for Beta</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-[#92a4c9] text-sm space-x-4 font-noto-sans">
        <a href="#" className="hover:text-foreground transition-colors">
          Privacy
        </a>
        <a href="#" className="hover:text-foreground transition-colors">
          Terms
        </a>
        <a href="#" className="hover:text-foreground transition-colors">
          Contact
        </a>
      </footer>
    </div>
  );
};

export default Login;
