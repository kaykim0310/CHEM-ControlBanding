import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqpznokilhzrhmwehxfu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcHpub2tpbGh6cmhtd2VoeGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0Nzc1NTAsImV4cCI6MjA3NTA1MzU1MH0.5hFOISI0JWj6eF231vpwEYbbbEqDPe_5KN4eD3HVkRo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
