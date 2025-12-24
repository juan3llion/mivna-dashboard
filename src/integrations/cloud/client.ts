import { createClient } from '@supabase/supabase-js';

// HARDCODED Lovable Cloud credentials for authentication
// This bypasses environment variable caching issues
const CLOUD_SUPABASE_URL = 'https://ipoeckdsktrkvnyjjcoc.supabase.co';
const CLOUD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwb2Vja2Rza3Rya3ZueWpqY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Njg0NjksImV4cCI6MjA4MDM0NDQ2OX0.Q8z-B-JJyyYVoLywZXVpyPZnNlcviCeVIFu3S12aMos';

export const cloudSupabase = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
