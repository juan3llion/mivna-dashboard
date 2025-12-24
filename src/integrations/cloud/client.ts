import { createClient } from '@supabase/supabase-js';

// Lovable Cloud auth client - uses environment variables
// This is the ONLY client that should handle authentication
const CLOUD_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CLOUD_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloudSupabase = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
