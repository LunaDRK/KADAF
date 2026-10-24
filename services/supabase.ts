import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// llaves de Supabase
const supabaseUrl = '';
const supabaseAnonKey = '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});