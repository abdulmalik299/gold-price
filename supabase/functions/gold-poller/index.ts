// supabase/functions/gold-poller/index.ts
// Purpose: Run on a schedule (Supabase Cron) to store gold history even when users are offline.
// IMPORTANT: Set these env vars in Supabase:
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_ROLE_KEY
// And create a scheduled trigger to run this function e.g. every 2 minutes.
// This function stores ONLY when price changed by >= $0.10 (noise filter).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_URL = "https://api.gold-api.com/price/XAU";
const MIN_MOVE = 0.10;

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Fetch last stored tick
  const { data: lastRows } = await supabase
    .from("gold_history")
    .select("ts, price")
    .order("ts", { ascending: false })
    .limit(1);

  const last = lastRows?.[0];
  const lastPrice = last ? Number(last.price) : null;

  // Fetch live
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) return new Response("fetch failed", { status: 502 });
  const j = await res.json();

  let price: number | null = null;
  if (typeof j === "number") price = j;
  else if (typeof j?.price === "number" || typeof j?.price === "string") price = Number(j.price);
  else if (typeof j?.data?.price === "number" || typeof j?.data?.price === "string") price = Number(j.data.price);
  else if (typeof j?.value === "number" || typeof j?.value === "string") price = Number(j.value);

  if (!Number.isFinite(price)) return new Response("bad price", { status: 500 });
  price = Number(price.toFixed(2));

  // Only store if moved enough AND changed from last
  if (lastPrice != null && Math.abs(price - lastPrice) < MIN_MOVE) {
    return new Response("no move", { status: 200 });
  }

  const ts = Date.now();
  const { error } = await supabase.from("gold_history").insert([{ ts, price }]);
  if (error) return new Response(error.message, { status: 500 });

  return new Response("ok", { status: 200 });
});
