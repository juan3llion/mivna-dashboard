import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://awocsqhjcsmetezjqibo.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b2NzcWhqY3NtZXRlempxaWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTY2NTAsImV4cCI6MjA2NTQ5MjY1MH0.57F0zg0lWpKLJ6N8vEpHLSUIkvcOXV5bF7O06AWrjXw';

// Single instance of the external Supabase client
// This is separate from the Lovable Cloud Supabase client used for auth
export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
