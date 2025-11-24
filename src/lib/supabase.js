 import { createClient } from "@supabase/supabase-js";
 const supabaseUrl = "https://owlpzwjmtnlyfydzrulw.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bHB6d2ptdG5seWZ5ZHpydWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMDgzNjcsImV4cCI6MjA3OTU4NDM2N30.JVLWFEqnQNTQbAR6wiBavPH74-ZmD8iVmY25QMnqb3M";
 export const supabase = createClient(supabaseUrl, supabaseAnonKey)
