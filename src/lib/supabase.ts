import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ypdpopphenmbtivdtlip.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwZHBvcHBoZW5tYnRpdmR0bGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTg1NzAsImV4cCI6MjA4NTY3NDU3MH0.mZCaMiqmZSBDCNXTNQCkfl0-uHv3ozHRvVmhEvi3WeQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
