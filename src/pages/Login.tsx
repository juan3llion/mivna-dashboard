import { useEffect, useState } from "react";
import { cloudSupabase } from "@/integrations/cloud/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^a-zA-Z0-9]/, "Must contain a special character");

const emailSchema = z.string().email("Please enter a valid email address");

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const checkSession = async () => {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('access_token') || search.includes('code=') || search.includes('installation_id=')) {
        return;
      }
      
      const { data: { session } } = await cloudSupabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    if (isSignUp) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    } else if (password.length < 1) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { error } = await cloudSupabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Error signing in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { error } = await cloudSupabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        if (error.message.includes("User already registered")) {
          toast.error("An account with this email already exists");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Account created! You can now sign in.");
        setIsSignUp(false);
        setPassword("");
      }
    } catch (error: any) {
      toast.error(error.message || "Error creating account");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      handleSignUp();
    } else {
      handleSignIn();
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image with Blur Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=2070')" 
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        {/* Glassmorphism Card */}
        <div className="w-full max-w-md bg-background/10 dark:bg-background/80 backdrop-blur-xl rounded-2xl border border-border/20 p-8 shadow-2xl">
          
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <span className="material-symbols-outlined text-5xl text-foreground/90">
              grid_view
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground text-center mb-2 font-space-grotesk">
            {isSignUp ? "Create Account" : "Welcome to Mivna"}
          </h1>
          
          {/* Subtitle */}
          <p className="text-muted-foreground text-center mb-8 font-noto-sans">
            {isSignUp 
              ? "Join us to start scanning architectures" 
              : "Architectural scanning and importing for modern spatial design."}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5 font-noto-sans">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-border/30 
                           text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 
                           focus:ring-primary/50 focus:border-transparent transition-all font-noto-sans"
              />
              {errors.email && (
                <p className="text-destructive text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5 font-noto-sans">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg bg-black/30 border border-border/30 
                             text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 
                             focus:ring-primary/50 focus:border-transparent transition-all pr-10 font-noto-sans"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm mt-1">{errors.password}</p>
              )}
              {isSignUp && !errors.password && (
                <p className="text-muted-foreground text-xs mt-1">
                  Min 8 chars with lowercase, uppercase, number, and special character
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-primary hover:bg-primary/90
                         text-primary-foreground font-semibold font-space-grotesk
                         transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          {/* Toggle Sign In / Sign Up */}
          <p className="text-center text-muted-foreground mt-6 text-sm font-noto-sans">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button 
              type="button"
              onClick={() => { 
                setIsSignUp(!isSignUp); 
                setErrors({}); 
                setPassword(""); 
              }}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>

          {/* Beta Notice */}
          <p className="text-center text-muted-foreground/60 text-xs mt-6 font-noto-sans">
            No credit card required for Beta
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-muted-foreground text-sm space-x-4 font-noto-sans">
        <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
        <a href="#" className="hover:text-foreground transition-colors">Terms</a>
        <a href="#" className="hover:text-foreground transition-colors">Contact</a>
      </footer>
    </div>
  );
};

export default Login;
