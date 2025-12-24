import { createClient } from '@supabase/supabase-js';

// HARDCODED credentials for external repository database
// This bypasses environment variable caching issues
const EXTERNAL_SUPABASE_URL = 'https://awocsqhjcsmetezjqibo.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b2NzcWhqY3NtZXRlempxaWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTM0NTQsImV4cCI6MjA4MDMyOTQ1NH0.L_Cu8KqsqPLGNqzTDHnrIUmSoILwsNvXa5YVV6V9FVI';

// Single instance of the external Supabase client for REPOSITORY DATA ONLY
// Auth is DISABLED to prevent GoTrue conflicts with the main auth client
export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
