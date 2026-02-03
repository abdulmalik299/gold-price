/* LuxGold logic.js (compact build)
   Full feature set requested: live XAU, change arrows, karats + IQD conversion,
   margin sliders, expectation, margin solver (auto-sync slider), connection status,
   clock + last-updated-on-change, advanced chart w/ zoom-pan + crosshair,
   Web Worker smoothing/noise filter, Supabase optional sync, Samsung-like calculator.
*/
(()=>{"use strict";
const API_URL="https://api.gold-api.com/price/XAU";
const SUPABASE_URL="https://ypdpopphenmbtivdtlip.supabase.co";
const OUNCE_TO_GRAM=31.1035, MITHQAL_GRAM=5;
const KARATS=[{k:24,f:1},{k:22,f:0.916},{k:21,f:0.875},{k:18,f:0.75}];
const $=id=>document.getElementById(id);
const el={
  clockLocal:$("clockLocal"), lastUpdated:$("lastUpdated"),
  conn:$("conn"), connStatus:$("connStatus"), connMeta:$("connMeta"),
  feedPill:$("feedPill"),
  liveOunce:$("liveOunce"), liveDelta:$("liveDelta"), liveMetrics:$("liveMetrics"),
  usdToIqd:$("usdToIqd"), unitLive:$("unitLive"), karatLive:$("karatLive"),
  marginLive:$("marginLive"), marginLiveLabel:$("marginLiveLabel"),
  selectedLive:$("selectedLive"), selectedLiveDelta:$("selectedLiveDelta"), selectedLiveMeta:$("selectedLiveMeta"),
  karatsList:$("karatsList"), currencyNote:$("currencyNote"),
  chartCanvas:$("chartCanvas"), chartHint:$("chartHint"),
  statHigh:$("statHigh"), statLow:$("statLow"), statVol:$("statVol"),
  exportHistory:$("exportHistory"), clearLocalHistory:$("clearLocalHistory"),
  expOunce:$("expOunce"), expUsdToIqd:$("expUsdToIqd"), expUnit:$("expUnit"), expKarat:$("expKarat"),
  expMargin:$("expMargin"), expMarginLabel:$("expMarginLabel"), expResult:$("expResult"), expHint:$("expHint"),
  solOunce:$("solOunce"), solUsdToIqd:$("solUsdToIqd"), solLocal21:$("solLocal21"), solResult:$("solResult"),
  openSettings:$("openSettings"), settingsModal:$("settingsModal"), closeSettings:$("closeSettings"),
  sbAnon:$("sbAnon"), saveSettings:$("saveSettings"), testSupabase:$("testSupabase"), settingsLog:$("settingsLog"),
  calcExpr:$("calcExpr"), calcMain:$("calcMain"), calcKeys:$("calcKeys"),
  calcHistory:$("calcHistory"), calcHistoryList:$("calcHistoryList"),
  toggleCalcHistory:$("toggleCalcHistory"), clearCalcHistory:$("clearCalcHistory"),
};
const S={
  lastOunce:null, prevOunce:null, lastChangeAt:null,
  deltas:{ ounce:null, karats:new Map(), selected:null },
  mode:{cur:"USD", rate:NaN},
  series:[], sm:[], tf:"24h",
  worker:null, chart:null,
  persistKey:"luxgold.localHistory.v1",
  solverApplied:false,
  sb:null, sbReady:false,
  calc:{expr:"", main:"0", history:[]}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const isNum=n=>Number.isFinite(n);
const parseN=v=>{const s=String(v??"").replace(/[,\s]/g,"").trim(); if(!s) return NaN; const n=Number(s); return isNum(n)?n:NaN;};
const fmt=(n,d=2)=>isNum(n)?n.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const money=(n,cur)=>!isNum(n)?"—":(cur==="IQD"?`${fmt(Math.round(n),0)} IQD`:`$ ${fmt(n,2)}`);
const nowLocal=()=>new Date().toLocaleString(undefined,{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
const tsShort=ts=>new Date(ts).toLocaleString(undefined,{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"});
const tfLabel=(ts,tf)=>{const d=new Date(ts); if(tf==="24h") return d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}); if(tf==="7d") return d.toLocaleDateString(undefined,{weekday:"short"}); if(tf==="1m") return d.toLocaleDateString(undefined,{month:"short",day:"2-digit"}); if(tf==="1y") return String(d.getFullYear()); return d.toLocaleString();};
function delta(curr,prev){ if(!isNum(curr)||!isNum(prev)||prev===0) return null; const diff=curr-prev; return {diff,pct:(diff/prev)*100}; }
function deltaTxt(d,cur){
  if(!d) return {t:"—",c:""};
  const up=d.diff>0, down=d.diff<0; const a=up?"▲":down?"▼":"•";
  const cls=up?"is-up":down?"is-down":"";
  const sign=up?"+":down?"−":"";
  const amt=cur==="IQD"?`${fmt(Math.round(Math.abs(d.diff)),0)} IQD`:`$ ${fmt(Math.abs(d.diff),2)}`;
  const pct=`${fmt(Math.abs(d.pct),2)}%`;
  return {t:`${a} ${sign}${amt} (${sign}${pct})`, c:cls};
}
function compute(ounceUsd, karat, unit, usdToIqd, marginIqd){
  const f=KARATS.find(x=>x.k===karat)?.f ?? 1;
  const grams=unit==="gram"?1:MITHQAL_GRAM;
  const baseUsd=(ounceUsd/OUNCE_TO_GRAM)*f*grams;
  const useIqd=isNum(usdToIqd)&&usdToIqd>0;
  if(!useIqd) return {v:baseUsd, cur:"USD"};
  const baseIqd=baseUsd*usdToIqd;
  const m=(isNum(marginIqd)?marginIqd:0)/(unit==="gram"?MITHQAL_GRAM:1);
  return {v:baseIqd+m, cur:"IQD"};
}
function setConn(online, meta, level){
  el.conn.classList.toggle("is-online",!!online);
  el.conn.classList.toggle("is-offline",!online);
  el.connStatus.textContent=online?"Online":"Offline";
  el.connMeta.textContent=meta|| (online?"Connected":"No internet");
  const bars=el.conn.querySelectorAll(".conn__signal span");
  const L=online?clamp(level||3,1,4):0;
  bars.forEach((b,i)=>b.style.background=(i<L)?(online?"rgba(51,209,122,.85)":"rgba(255,77,90,.85)"):"rgba(255,255,255,.18)");
}
async function measureConn(){
  const online=navigator.onLine;
  const n=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(n&&online){
    const eff=n.effectiveType||"unknown";
    const dl=n.downlink?`${n.downlink.toFixed(1)}Mb/s`:"";
    const rtt=n.rtt?`${n.rtt}ms`:"";
    let level=3;
    if(eff.includes("2g")) level=1; else if(eff.includes("3g")) level=2; else if(eff.includes("4g")) level=3; else if(eff.includes("5g")) level=4;
    if(n.downlink){ if(n.downlink<0.7) level=1; else if(n.downlink<1.6) level=2; else if(n.downlink<6) level=3; else level=4; }
    setConn(true,[eff,dl,rtt].filter(Boolean).join(" • ")||"Connected",level); return;
  }
  if(!online){ setConn(false,"No internet",0); return; }
  const t0=performance.now();
  try{ await fetch(API_URL,{cache:"no-store"}); const ms=Math.round(performance.now()-t0);
    const level=ms>1500?1:ms>900?2:ms>450?3:4;
    setConn(true,`Ping ~${ms}ms`,level);
  }catch{ setConn(false,"No internet",0); }
}
function clock(){ el.clockLocal.textContent=new Date().toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function persist(){ try{ localStorage.setItem(S.persistKey, JSON.stringify({updated:Date.now(), series:S.series})); }catch{} }
function loadLocal(){ try{ const r=localStorage.getItem(S.persistKey); if(!r) return null; const o=JSON.parse(r); return Array.isArray(o.series)?o.series:null; }catch{return null;} }
async function loadSeed(){
  try{ const res=await fetch("./chart-history.json",{cache:"no-store"}); if(res.ok){ const j=await res.json(); if(Array.isArray(j.series)&&j.series.length) return j.series; } }catch{}
  // fallback
  const out=[]; const base=2350; const now=Date.now();
  for(let i=0;i<180;i++){ const ts=now-(180-1-i)*5*60*1000; const p=+(base+Math.sin(i/10)*4+Math.cos(i/16)*2).toFixed(2); out.push({ts,price:p}); }
  return out;
}
function anonKey(){ try{return (localStorage.getItem("luxgold.sbAnon")||"").trim();}catch{return "";} }
function setAnon(k){ try{ localStorage.setItem("luxgold.sbAnon",(k||"").trim()); }catch{} }
function initSupabase(){
  el.sbAnon.value=anonKey();
  const a=anonKey(); if(!a) return;
  if(!(window.supabase&&window.supabase.createClient)) return;
  try{
    S.sb=window.supabase.createClient(SUPABASE_URL,a,{auth:{persistSession:false}});
    S.sbReady=true;
  }catch{ S.sb=null; S.sbReady=false; }
}
async function sbPull(limit=1600){
  if(!S.sbReady||!S.sb) return null;
  const {data,error}=await S.sb.from("gold_history").select("ts,price").order("ts",{ascending:false}).limit(limit);
  if(error||!data) return null;
  return data.map(r=>({ts:Number(r.ts),price:Number(r.price)})).filter(p=>isNum(p.ts)&&isNum(p.price)).sort((a,b)=>a.ts-b.ts);
}
async function sbInsert(tick){
  if(!S.sbReady||!S.sb) return;
  try{ await S.sb.from("gold_history").insert([{ts:tick.ts,price:tick.price}]); }catch{}
}
function modeFromInput(){
  const r=parseN(el.usdToIqd.value);
  if(isNum(r)&&r>0){ S.mode={cur:"IQD",rate:r}; el.currencyNote.textContent="IQD mode"; }
  else{ S.mode={cur:"USD",rate:NaN}; el.currencyNote.textContent="USD mode"; }
}
function renderLive(){
  const p=S.lastOunce;
  el.liveOunce.textContent=money(p,"USD");
  const d=delta(p,S.prevOunce);
  if(d&&d.diff!==0) S.deltas.ounce={...d,cur:"USD"};
  const dt=deltaTxt(S.deltas.ounce,"USD");
  el.liveDelta.textContent=dt.t; el.liveDelta.className="delta "+dt.c;
  const src=S.sm.length?S.sm:S.series;
  let hi=null, lo=null, vol=null;
  if(src.length){ hi=Math.max(...src.map(x=>x.price)); lo=Math.min(...src.map(x=>x.price)); vol=hi-lo; }
  const last=S.lastChangeAt?new Date(S.lastChangeAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
  el.liveMetrics.textContent=`High ${hi?("$ "+fmt(hi,2)):"—"} • Low ${lo?("$ "+fmt(lo,2)):"—"} • Vol ${vol?("$ "+fmt(vol,2)):"—"} • Last ${last}`;
}
function renderSelected(){
  const ounce=S.lastOunce;
  const k=parseInt(el.karatLive.value,10);
  const unit=el.unitLive.value;
  const m=parseN(el.marginLive.value)||0;
  const out=compute(ounce,k,unit,S.mode.rate,m);
  el.selectedLive.textContent=money(out.v,out.cur);
  if(isNum(S.prevOunce)){
    const prev=compute(S.prevOunce,k,unit,S.mode.rate,m);
    const d=delta(out.v,prev.v);
    if(d&&d.diff!==0) S.deltas.selected={...d,cur:out.cur};
  }
  const dt=deltaTxt(S.deltas.selected,out.cur);
  el.selectedLiveDelta.textContent=dt.t; el.selectedLiveDelta.className="delta "+dt.c;
  el.selectedLiveMeta.textContent=`${k}k • ${unit==="gram"?"1g":"5g"} • ${out.cur==="IQD"?"Rate "+fmt(S.mode.rate,0):"USD"} • Margin ${out.cur==="IQD"?fmt(m,0)+" IQD/mithqal":"—"}`;
}
function renderKarats(){
  const ounce=S.lastOunce; const unit=el.unitLive.value; const m=parseN(el.marginLive.value)||0;
  const useIqd=S.mode.cur==="IQD";
  el.marginLive.disabled=!useIqd;
  el.marginLiveLabel.textContent=useIqd?`${fmt(m,0)} IQD`:"— (IQD only)";
  const rows=KARATS.map(({k})=>{
    const out=compute(ounce,k,unit,S.mode.rate,m);
    const key=`${k}-${unit}-${out.cur}`;
    if(isNum(S.prevOunce)){
      const prevOut=compute(S.prevOunce,k,unit,S.mode.rate,m);
      const d=delta(out.v,prevOut.v);
      if(d&&d.diff!==0) S.deltas.karats.set(key,{...d,cur:out.cur});
    }
    const dt=deltaTxt(S.deltas.karats.get(key),out.cur);
    return `<div class="karatRow">
      <div><div class="karatRow__name">${k}k</div><div class="karatRow__sub">${unit==="gram"?"Per gram":"Per mithqal (5g)"} • Auto-sync with live</div></div>
      <div class="karatRow__right"><div class="karatRow__price">${money(out.v,out.cur)}</div><div class="karatRow__delta ${dt.c}">${dt.t}</div></div>
    </div>`;
  }).join("");
  el.karatsList.innerHTML=rows;
}
function renderExpectation(){
  const ounce=parseN(el.expOunce.value);
  const rate=parseN(el.expUsdToIqd.value);
  const k=parseInt(el.expKarat.value,10);
  const unit=el.expUnit.value;
  const m=parseN(el.expMargin.value)||0;
  el.expMarginLabel.textContent=`${fmt(m,0)} IQD`;
  if(!isNum(ounce)||ounce<=0||!isNum(rate)||rate<=0){
    el.expResult.textContent="—";
    el.expHint.textContent="Enter expected ounce + USD→IQD to compute.";
    return;
  }
  const out=compute(ounce,k,unit,rate,m);
  el.expResult.textContent=money(out.v,out.cur);
  el.expHint.textContent=`${k}k • ${unit==="gram"?"per gram":"per mithqal"} • includes margin`;
}
function renderSolver(){
  const ounce=parseN(el.solOunce.value), rate=parseN(el.solUsdToIqd.value), local21=parseN(el.solLocal21.value);
  if(!isNum(ounce)||ounce<=0||!isNum(rate)||rate<=0||!isNum(local21)||local21<=0){ el.solResult.textContent="—"; return; }
  const base=compute(ounce,21,"mithqal",rate,0);
  const margin=Math.round(local21-base.v);
  el.solResult.textContent=`${fmt(margin,0)} IQD`;
  const safe=clamp(margin,0,70000);
  if(!S.solverApplied){
    S.solverApplied=true;
    el.usdToIqd.value=String(Math.round(rate));
    modeFromInput();
    el.marginLive.value=String(safe);
    el.expMargin.value=String(safe);
    el.expUsdToIqd.value=String(Math.round(rate));
    renderAll();
  }
}
function renderAll(){ modeFromInput(); renderLive(); renderSelected(); renderKarats(); renderExpectation(); renderSolver(); }
function slice(tf,arr){
  const now=Date.now();
  const cut=tf==="24h"?now-24*3600e3:tf==="7d"?now-7*24*3600e3:tf==="1m"?now-30*24*3600e3:tf==="1y"?now-365*24*3600e3:0;
  return cut?arr.filter(p=>p.ts>=cut):arr;
}
function makeChart(){
  const ctx=el.chartCanvas.getContext("2d");
  const crosshair={id:"luxCrosshair", afterDatasetsDraw(chart){
    const act=chart.tooltip?.getActiveElements?.()||[];
    if(!act.length) return;
    const {ctx,chartArea:{top,bottom,left,right}}=chart;
    const pt=act[0].element; if(!pt) return;
    const x=pt.x,y=pt.y;
    ctx.save();
    ctx.strokeStyle="rgba(245,215,123,.35)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();
    // label
    const v=chart.data.datasets[0].data[act[0].index]?.y;
    const label=isNum(v)?`$ ${fmt(v,2)}`:"";
    if(label){
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.strokeStyle="rgba(255,255,255,.14)"; ctx.lineWidth=1;
      ctx.font="12px "+getComputedStyle(document.body).fontFamily;
      const w=ctx.measureText(label).width+20, h=24;
      const bx=clamp(x+12,left,right-w), by=clamp(y-34,top,bottom-h);
      const r=10;
      ctx.beginPath();
      ctx.moveTo(bx+r,by);
      ctx.arcTo(bx+w,by,bx+w,by+h,r);
      ctx.arcTo(bx+w,by+h,bx,by+h,r);
      ctx.arcTo(bx,by+h,bx,by,r);
      ctx.arcTo(bx,by,bx+w,by,r);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,.92)";
      ctx.fillText(label,bx+10,by+16);
    }
    ctx.restore();
  }};
  S.chart=new Chart(ctx,{
    type:"line",
    data:{labels:[],datasets:[{label:"XAU / Ounce (USD)",data:[],borderWidth:2,pointRadius:0,tension:.24,
      segment:{borderColor:(c)=>c.p1.parsed.y>=c.p0.parsed.y?"rgba(51,209,122,.85)":"rgba(255,77,90,.85)"} } ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{displayColors:false,backgroundColor:"rgba(0,0,0,.65)",borderColor:"rgba(255,255,255,.14)",borderWidth:1,
          callbacks:{
            title(items){ const i=items?.[0]?.dataIndex??0; const ts=S.chart.data.labels[i]?.__ts; return ts?tsShort(ts):""; },
            label(it){ return `$ ${fmt(it.parsed.y,2)}`; }
          }},
        zoom:{pan:{enabled:true,mode:"x"},zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:"x"},limits:{x:{minRange:10}}}
      },
      scales:{
        x:{grid:{color:"rgba(255,255,255,.06)"},ticks:{color:"rgba(255,255,255,.62)",maxTicksLimit:8}},
        y:{grid:{color:"rgba(255,255,255,.06)"},ticks:{color:"rgba(255,255,255,.62)",callback:v=>`$ ${fmt(Number(v),0)}`}}
      }
    },
    plugins:[crosshair]
  });
}
function updateChart(){
  if(!S.chart) return;
  const src=S.sm.length?S.sm:S.series;
  const sl=slice(S.tf,src);
  const labels=sl.map(p=>{const s=tfLabel(p.ts,S.tf); s.__ts=p.ts; return s;});
  const data=sl.map(p=>({x:p.ts,y:p.price}));
  S.chart.data.labels=labels;
  S.chart.data.datasets[0].data=data;
  el.chartHint.textContent=sl.length?`${sl.length.toLocaleString()} points • Updated ${S.lastChangeAt?new Date(S.lastChangeAt).toLocaleTimeString():"—"}`:"No data yet";
  S.chart.update("none");
  const s24=slice("24h",src);
  if(s24.length){
    const hi=Math.max(...s24.map(p=>p.price)), lo=Math.min(...s24.map(p=>p.price));
    el.statHigh.textContent="$ "+fmt(hi,2);
    el.statLow.textContent="$ "+fmt(lo,2);
    el.statVol.textContent="$ "+fmt(hi-lo,2);
  }
}
function startWorker(){
  try{
    S.worker=new Worker("./worker.js");
    const origHandler = async (e)=>{
      const msg=e.data||{};
      if(msg.type==="tickAccepted"&&msg.accepted){
        // optional SB insert
        await sbInsert(msg.tick);
      }
      if(msg.type==="tickAccepted"&&msg.accepted){
        S.series.push(msg.tick);
        if(S.series.length>2400) S.series.splice(0,S.series.length-2400);
        persist();
        S.worker.postMessage({type:"smooth",series:S.series,window:7,alpha:0.22});
      }
      if(msg.type==="smoothed"){
        S.sm=msg.series||[];
        updateChart();
      }
    };
    S.worker.onmessage = origHandler;
  }catch{ S.worker=null; }
}
async function fetchLive(){
  const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),5500);
  try{
    const res=await fetch(API_URL,{cache:"no-store",signal:ctl.signal});
    clearTimeout(to);
    if(!res.ok) throw 0;
    const j=await res.json();
    let p=null;
    if(typeof j==="number") p=j;
    else if(typeof j?.price==="number"||typeof j?.price==="string") p=Number(j.price);
    else if(typeof j?.data?.price==="number"||typeof j?.data?.price==="string") p=Number(j.data.price);
    else if(typeof j?.value==="number"||typeof j?.value==="string") p=Number(j.value);
    if(!isNum(p)) throw 0;
    p=+p.toFixed(2);
    el.feedPill.querySelector(".pill__text").textContent="Live feed";
    el.feedPill.style.borderColor="rgba(245,215,123,.22)";
    if(S.lastOunce==null||p!==S.lastOunce){
      S.prevOunce=S.lastOunce;
      S.lastOunce=p;
      S.lastChangeAt=Date.now();
      el.lastUpdated.textContent=nowLocal();
      if(S.worker) S.worker.postMessage({type:"tick",ts:Date.now(),price:p,minMove:0.10});
      else{ S.series.push({ts:Date.now(),price:p}); persist(); updateChart(); }
    }
    renderAll();
  }catch{
    clearTimeout(to);
    el.feedPill.querySelector(".pill__text").textContent=navigator.onLine?"Feed error":"Offline";
    el.feedPill.style.borderColor="rgba(255,77,90,.32)";
  }
}
function poll(){ fetchLive(); setInterval(fetchLive,2500); }
function bind(){
  // sanitize numeric inputs
  const nums=[el.usdToIqd,el.expOunce,el.expUsdToIqd,el.solOunce,el.solUsdToIqd,el.solLocal21];
  nums.forEach(i=>i.addEventListener("input",()=>{
    const raw=i.value;
    const clean=raw.replace(/[^\d.]/g,"").replace(/(\..*)\./g,"$1");
    if(raw!==clean) i.value=clean;
    S.solverApplied=false;
    renderAll();
  }));
  el.unitLive.addEventListener("change",renderAll);
  el.karatLive.addEventListener("change",renderAll);
  el.marginLive.addEventListener("input",()=>{ el.marginLiveLabel.textContent=`${fmt(parseN(el.marginLive.value)||0,0)} IQD`; renderAll(); });
  el.expUnit.addEventListener("change",renderAll);
  el.expKarat.addEventListener("change",renderAll);
  el.expMargin.addEventListener("input",()=>{ el.expMarginLabel.textContent=`${fmt(parseN(el.expMargin.value)||0,0)} IQD`; renderAll(); });
  document.querySelectorAll(".tf__btn").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".tf__btn").forEach(x=>x.classList.remove("is-active"));
    b.classList.add("is-active");
    S.tf=b.dataset.tf; updateChart();
  }));
  el.exportHistory.addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),series:S.series},null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download="luxgold-history.json"; a.click(); URL.revokeObjectURL(a.href);
  });
  el.clearLocalHistory.addEventListener("click",()=>{
    if(!confirm("Clear local history in this browser?")) return;
    S.series=[]; S.sm=[]; try{localStorage.removeItem(S.persistKey);}catch{}
    updateChart();
  });
  // Settings modal
  const open=(v)=>{ if(v){ el.settingsModal.removeAttribute("hidden"); document.body.style.overflow="hidden"; } else { el.settingsModal.setAttribute("hidden","true"); document.body.style.overflow=""; } };
  el.openSettings.addEventListener("click",()=>open(true));
  el.closeSettings.addEventListener("click",()=>open(false));
  el.settingsModal.addEventListener("click",(e)=>{ if(e.target?.dataset?.close) open(false); });
  el.saveSettings.addEventListener("click",()=>{ setAnon(el.sbAnon.value); initSupabase(); el.settingsLog.textContent=S.sbReady?"Saved. Supabase enabled in this browser.":"Saved. Supabase not enabled (missing/invalid key)."; });
  el.testSupabase.addEventListener("click",async()=>{
    initSupabase();
    if(!S.sbReady){ el.settingsLog.textContent="Supabase not ready. Paste anon key first."; return; }
    el.settingsLog.textContent="Testing…";
    const d=await sbPull(10);
    el.settingsLog.textContent=d?`OK. Pulled ${d.length} rows.`:"Test failed. Check anon key + table/policies.";
  });
  // Calculator
  el.toggleCalcHistory.addEventListener("click",()=>{
    const open=el.calcHistory.hasAttribute("hidden");
    open?el.calcHistory.removeAttribute("hidden"):el.calcHistory.setAttribute("hidden","true");
  });
  el.clearCalcHistory.addEventListener("click",()=>{
    if(!confirm("Clear calculator history?")) return;
    S.calc.history=[]; try{localStorage.removeItem("luxgold.calcHistory.v1");}catch{}
    renderCalcHistory();
  });
  // keyboard
  window.addEventListener("keydown",(e)=>{
    const map={"/":"÷","*":"×","-":"−","+":"+","Enter":"=","Backspace":"DEL","Delete":"AC","%":"%","(":"(",")":")",".":"."};
    if(/[0-9]/.test(e.key)) onKey(e.key);
    else if(map[e.key]) onKey(map[e.key]);
  });
}
function bootCalc(){
  const KEYS=[["C","AC","DEL","÷"],["(",")","%","×"],["7","8","9","−"],["4","5","6","+"],["1","2","3","="],["0",".","±",""]];
  el.calcKeys.innerHTML="";
  for(const row of KEYS){
    for(const k of row){
      const b=document.createElement("button");
      b.type="button";
      b.className="key "+(["÷","×","−","+","=","%"].includes(k)?"key--op":"key--muted")+(k==="="? " key--eq":"");
      b.textContent=k;
      b.addEventListener("click",()=>onKey(k));
      el.calcKeys.appendChild(b);
    }
  }
  loadCalcHistory(); renderCalcHistory(); setCalc("", "0");
}
function setCalc(expr,main){ S.calc.expr=expr; S.calc.main=main; el.calcExpr.textContent=expr||" "; el.calcMain.textContent=main||"0"; }
function pushHistory(exp,res){
  S.calc.history.unshift({ts:Date.now(),exp,res});
  S.calc.history=S.calc.history.slice(0,60);
  try{localStorage.setItem("luxgold.calcHistory.v1",JSON.stringify(S.calc.history));}catch{}
  renderCalcHistory();
}
function loadCalcHistory(){ try{ const r=localStorage.getItem("luxgold.calcHistory.v1"); if(r){ const a=JSON.parse(r); if(Array.isArray(a)) S.calc.history=a; } }catch{} }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function renderCalcHistory(){
  el.calcHistoryList.innerHTML=S.calc.history.map(h=>`<div class="hItem"><div class="hExpr">${esc(h.exp)}</div><div class="hRes">${esc(h.res)}</div></div>`).join("") || `<div class="hint">No history yet.</div>`;
}
function tokenize(s){
  const out=[]; const map={"÷":"/","×":"*","−":"-"};
  let i=0;
  while(i<s.length){
    const ch=s[i];
    if(ch===" "){i++;continue;}
    if(/[0-9.]/.test(ch)){ let j=i+1; while(j<s.length&&/[0-9.]/.test(s[j])) j++; out.push({t:"n",v:Number(s.slice(i,j))}); i=j; continue; }
    if(map[ch]){ out.push({t:"o",v:map[ch]}); i++; continue; }
    if("+-*/%".includes(ch)){ out.push({t:"o",v:ch}); i++; continue; }
    if(ch==="("||ch===")"){ out.push({t:"p",v:ch}); i++; continue; }
    i++;
  }
  // unary minus
  const fixed=[];
  for(let k=0;k<out.length;k++){
    const tok=out[k];
    if(tok.t==="o"&&tok.v==="-"&&(k===0||out[k-1].t==="o"||(out[k-1].t==="p"&&out[k-1].v==="("))){
      fixed.push({t:"n",v:0}); fixed.push(tok);
    } else fixed.push(tok);
  }
  return fixed;
}
const prec=o=>o==="%"?3:(o==="*"||o==="/")?2:(o==="+"||o==="-" )?1:0;
function toRPN(tokens){
  const out=[], st=[];
  for(const tok of tokens){
    if(tok.t==="n") out.push(tok);
    else if(tok.t==="o"){
      while(st.length){
        const top=st[st.length-1];
        if(top.t==="o"&&prec(top.v)>=prec(tok.v)) out.push(st.pop());
        else break;
      }
      st.push(tok);
    } else if(tok.t==="p"&&tok.v==="(") st.push(tok);
    else if(tok.t==="p"&&tok.v===")"){
      while(st.length && !(st[st.length-1].t==="p"&&st[st.length-1].v==="(")) out.push(st.pop());
      st.pop();
    }
  }
  while(st.length) out.push(st.pop());
  return out;
}
function evalRPN(rpn){
  const st=[];
  for(const tok of rpn){
    if(tok.t==="n") st.push(tok.v);
    else if(tok.t==="o"){
      const b=st.pop(), a=st.pop();
      if(tok.v==="+") st.push(a+b);
      else if(tok.v==="-" ) st.push(a-b);
      else if(tok.v==="*" ) st.push(a*b);
      else if(tok.v==="/" ) st.push(a/b);
      else if(tok.v==="%" ) st.push(a%b);
    }
  }
  return st.pop();
}
function evalExpr(expr){
  try{
    const t=tokenize(expr);
    if(!t.length) return "0";
    const r=evalRPN(toRPN(t));
    if(!isNum(r)) return null;
    return Number(r.toFixed(12)).toString();
  }catch{return null;}
}
function onKey(k){
  let expr=S.calc.expr||"", main=S.calc.main||"0";
  const digit=/^[0-9]$/.test(k);
  const op=["÷","×","−","+","%"].includes(k);
  if(k==="AC"){ setCalc("", "0"); return; }
  if(k==="C"){ setCalc(expr, "0"); return; }
  if(k==="DEL"){ main=main.length>1?main.slice(0,-1):"0"; setCalc(expr,main); return; }
  if(k==="±"){ if(main==="0") return; main=main.startsWith("-")?main.slice(1):("-"+main); setCalc(expr,main); return; }
  if(digit){ main=(main==="0")?k:(main+k); setCalc(expr,main); return; }
  if(k==="."){ if(!main.includes(".")) main += "."; setCalc(expr,main); return; }
  if(k==="("||k===")"){ if(main!=="0" && (expr===""||/[÷×−+%(]$/.test(expr))){ expr+=main; main="0"; } expr+=k; setCalc(expr,main); return; }
  if(op){
    if(k==="%"){ const n=parseN(main); if(isNum(n)) main=String(n/100); setCalc(expr,main); return; }
    expr += main + k; main="0"; setCalc(expr,main); return;
  }
  if(k==="="){
    const full=(expr+main).trim();
    const res=evalExpr(full);
    if(res==null){ setCalc(expr,"Error"); return; }
    pushHistory(full,res); setCalc("",res); return;
  }
}
async function boot(){
  // PWA
  if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{})); }

  clock(); setInterval(clock,1000);
  measureConn(); setInterval(measureConn,8000);
  window.addEventListener("online",measureConn); window.addEventListener("offline",measureConn);

  bootCalc();

  startWorker();

  // history
  const local=loadLocal();
  S.series=local&&local.length?local:await loadSeed();
  persist();

  makeChart();
  if(S.worker) S.worker.postMessage({type:"smooth",series:S.series,window:7,alpha:0.22});
  else updateChart();

  initSupabase();
  if(S.sbReady){
    const remote=await sbPull(1600);
    if(remote&&remote.length){
      const map=new Map();
      [...S.series,...remote].forEach(p=>map.set(p.ts,p.price));
      S.series=[...map.entries()].map(([ts,price])=>({ts:Number(ts),price:Number(price)})).sort((a,b)=>a.ts-b.ts);
      persist();
      if(S.worker) S.worker.postMessage({type:"smooth",series:S.series,window:7,alpha:0.22});
    }
  }

  bind();
  renderAll();
  poll();
}
boot();
})();