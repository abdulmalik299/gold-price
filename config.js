// Optional Supabase config.
// IMPORTANT: For security, do NOT commit a service role key.
// Put your ANON key here if you want cross-device history storage.

window.AURUM_CONFIG = {
  SUPABASE_URL: "https://ypdpopphenmbtivdtlip.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwZHBvcHBoZW5tYnRpdmR0bGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTg1NzAsImV4cCI6MjA4NTY3NDU3MH0.mZCaMiqmZSBDCNXTNQCkfl0-uHv3ozHRvVmhEvi3WeQ", // <-- paste your anon public key here (Project Settings → API)
  SUPABASE_TABLE: "gold_prices",
  // Data policy
  STORE_ONLY_ON_CHANGE: true,
  NOISE_THRESHOLD_USD: 0.01,  // ignore changes smaller than this (worker enforces too)
  MAX_LOCAL_POINTS: 4000
};
