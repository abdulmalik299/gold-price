// Optional Supabase config.
// IMPORTANT: For security, do NOT commit a service role key.
// Put your ANON key here if you want cross-device history storage.

window.AURUM_CONFIG = {
  SUPABASE_URL: "https://ypdpopphenmbtivdtlip.supabase.co",
  SUPABASE_ANON_KEY: "", // <-- paste your anon public key here (Project Settings → API)
  SUPABASE_TABLE: "gold_prices",
  // Data policy
  STORE_ONLY_ON_CHANGE: true,
  NOISE_THRESHOLD_USD: 0.10,  // ignore changes smaller than this (worker enforces too)
  MAX_LOCAL_POINTS: 4000
};
