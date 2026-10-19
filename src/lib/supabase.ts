import { createClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from './supabaseConfig';

export { fail, guard, isConfigured, NotConfiguredError } from './supabaseConfig';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
