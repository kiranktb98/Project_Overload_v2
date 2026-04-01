import { renderClaritectLogoImage } from "./brand";

export function renderScheduledReportsPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Scheduled reports</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");
      :root{--ink:#F5F3FF;--ink-soft:#D7CFE6;--ink-muted:#9D90BC;--line:rgba(107,92,138,.28);--panel:rgba(24,18,39,.92);--accent:#6C3AED;--accent-2:#EC4899;--accent-3:#EC4899;--success:#7ff0d5;--danger:#fca5a5;--shadow:0 24px 60px rgba(1,8,28,.44)}
      *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family: Inter, "Sohne", "Suisse Intl", sans-serif;color:var(--ink);background:radial-gradient(circle at 14% 10%,rgba(108,58,237,.22),transparent 24%),radial-gradient(circle at 88% 8%,rgba(236,72,153,.15),transparent 26%),linear-gradient(180deg,#0F0B1A 0%,#130F20 44%,#161122 100%)}
      body::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(to right,rgba(107,92,138,.08) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(circle at 50% 45%,rgba(0,0,0,.86),transparent 92%)}
      .page{padding:14px}.layout{display:grid;grid-template-columns:212px 1fr;min-height:calc(100vh - 28px);gap:14px}
      .platform-panel,.content-shell{border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow);overflow:hidden}
      .platform-panel{position:relative;background:linear-gradient(180deg,rgba(20, 15, 34, 0.98),rgba(17, 12, 28, 0.98));padding:16px 15px 14px;display:flex;flex-direction:column}
      .platform-brand{display:flex;align-items:center;gap:10px;padding:8px 6px 14px;margin-bottom:10px;border-bottom:1px solid rgba(107,92,138,.24)}
      .platform-brand-badge{width:56px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .platform-brand-badge img{width:100%;height:100%;display:block;object-fit:contain;filter:drop-shadow(0 8px 20px rgba(118,93,255,.22))}
      .platform-brand strong{display:block;font-size:.78rem;letter-spacing:.09em;text-transform:uppercase}.platform-brand span{display:block;margin-top:2px;font-family: Inter, "Sohne", "Suisse Intl", sans-serif;font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-muted)}
      .platform-section{margin:16px 8px 8px;font-size:.58rem;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-muted)}
      .platform-nav{display:flex;flex-direction:column;gap:6px}.platform-link{display:flex;align-items:center;gap:8px;padding:11px 12px;border-radius:14px;color:#E1DAF4;text-decoration:none;border:1px solid rgba(107,92,138,.14);font-size:.84rem;font-weight:600}.platform-link svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.platform-link.active{background:rgba(108,58,237,.92);border-color:rgba(245,243,255,.22);color:#f3f8ff}
      .platform-footer{margin-top:auto;display:flex;flex-direction:column;gap:10px}.platform-user,.platform-support{display:flex;align-items:center;gap:10px;border:1px solid rgba(107,92,138,.22);border-radius:16px;padding:11px 12px;background:rgba(28, 21, 45, 0.82)}.platform-user-avatar{width:28px;height:28px;border-radius:11px;display:grid;place-items:center;border:1px solid rgba(108, 58, 237, 0.34);color:#E1DAF4;background:rgba(46, 28, 76, 0.92)}.platform-user small{display:block;color:#9D90BC;font-size:.63rem;text-transform:uppercase;letter-spacing:.12em}.platform-user strong{display:block;margin-top:2px;font-size:.81rem}.platform-support{justify-content:space-between;background:rgba(24, 18, 39, 0.84)}.platform-support span{color:var(--ink-soft);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}.platform-support form{margin:0}.logout-btn{border:1px solid rgba(107,92,138,.28);border-radius:12px;background:rgba(34, 25, 56, 0.94);color:#F5F3FF;padding:7px 10px;font-family: Inter, "Sohne", "Suisse Intl", sans-serif;font-size:.64rem;cursor:pointer}
      .content-shell{background:linear-gradient(180deg,rgba(20,15,34,.98),rgba(17,12,28,.99))}.workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(360px,1fr);gap:16px;padding:18px;align-items:start}
      .surface{border:1px solid var(--line);border-radius:24px;background:linear-gradient(180deg,rgba(31,21,49,.92),rgba(24,18,39,.92));overflow:hidden}.surface-header{display:flex;justify-content:space-between;gap:12px;padding:18px 18px 14px;border-bottom:1px solid rgba(107,92,138,.18)}.surface-header h2{margin:0;font-size:1.02rem}.surface-header p{margin:6px 0 0;color:var(--ink-soft);font-size:.84rem;line-height:1.62}
      .badge,.mini-pill,.status-pill{padding:7px 10px;border-radius:999px;font-family: Inter, "Sohne", "Suisse Intl", sans-serif;font-size:.68rem;border:1px solid rgba(107,92,138,.24);background:rgba(39, 28, 63, 0.94);color:#F5F3FF}
      .reports-grid{display:grid;grid-template-columns:repeat(3,minmax(250px,1fr));gap:14px;padding:18px}.tile{display:grid;gap:12px;text-align:left;border:1px solid rgba(107,92,138,.22);border-radius:20px;padding:16px;background:rgba(31,21,49,.88);cursor:pointer}.tile.active{border-color:rgba(236,72,153,.24);background:rgba(15,33,78,.96)}.tile h3{margin:0;font-size:.98rem;line-height:1.36;color:var(--ink)}.tile-meta{display:flex;flex-wrap:wrap;gap:8px}.tile-meta .mini-pill:last-child{white-space:normal;line-height:1.4}
      .tile-stats,.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.stat,.detail-row,.detail-card,.empty-state,.question-plan,.run-item{padding:12px 13px;border-radius:16px;background:rgba(255,255,255,.025);border:1px solid rgba(107,92,138,.16);min-width:0}.detail-card,.empty-state{background:var(--panel)}.empty-state{margin:18px;border-style:dashed}.empty-state h3,.detail-card h3{margin:0 0 10px;font-size:.96rem}.empty-state p,.detail-card p,.question-body p{margin:0;color:var(--ink-soft);line-height:1.62}
      .stat span,.detail-row span{display:block;font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-muted)}.stat strong,.detail-row strong{display:block;margin-top:6px;font-size:.88rem;line-height:1.38;color:var(--ink);overflow-wrap:anywhere}
      .detail-surface[data-status="active"]{border-color:rgba(110,214,194,.26)}.detail-surface[data-status="paused"]{border-color:rgba(244,195,122,.22)}.detail-surface[data-status="failed"]{border-color:rgba(245,156,156,.24)}
      .detail-body{padding:18px;display:grid;gap:14px;min-height:520px;align-content:start}.question-list,.run-list{display:flex;flex-direction:column;gap:10px}
      .question-plan{padding:0;overflow:hidden}.question-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;background:transparent;border:0;color:var(--ink);text-align:left;cursor:pointer;font:inherit}.question-toggle strong{margin:0;font-size:.84rem;line-height:1.45;color:var(--ink)}.question-chevron{color:var(--ink-soft);font-size:.9rem;transition:transform .16s ease}.question-plan[data-collapsed="false"] .question-chevron{transform:rotate(180deg)}.question-body{display:grid;gap:8px;padding:0 15px 15px;border-top:1px solid rgba(107,92,138,.16)}.question-plan[data-collapsed="true"] .question-body{display:none}
      .run-item{display:flex;align-items:center;justify-content:space-between;gap:12px}.run-copy strong{display:block;font-size:.82rem;color:var(--ink)}.run-copy span{display:block;margin-top:5px;color:var(--ink-soft);font-size:.75rem}.run-actions{display:flex;align-items:center;gap:8px}
      .status-mark{display:inline-flex;align-items:center;justify-content:center;min-width:1.05rem;min-height:1.05rem;font-size:1rem;line-height:1;font-weight:800}.status-positive .status-mark,.status-pill.active{color:var(--success)}.status-negative .status-mark,.status-pill.failed{color:var(--danger)}.status-neutral .status-mark,.status-pill.paused,.status-pill.neutral{color:#D7CFE6}
      .open-btn,.toggle-btn{appearance:none;border:1px solid rgba(107,92,138,.28);border-radius:12px;background:rgba(108,58,237,.92);color:#fff;padding:9px 12px;font-weight:700;cursor:pointer}.toggle-btn{background:rgba(34, 25, 56, 0.94);color:#F5F3FF}.toggle-btn.pause{color:#ffd8a8;border-color:rgba(255,196,122,.22);background:rgba(61,40,11,.54)}.toggle-btn.activate{color:var(--success);border-color:rgba(141,240,218,.18);background:rgba(18, 50, 41, 0.46)}.mono{font-family: Inter, "Sohne", "Suisse Intl", sans-serif;align-items:flex-start}.run-actions{width:100%;justify-content:space-between}}
      @media (max-width:640px){.page{padding:10px}.reports-grid{grid-template-columns:1fr}}
      [data-theme="light"]{--ink:#1A1533;--ink-soft:#3D2E6B;--ink-muted:#6B5B9E;--line:rgba(107,92,138,.22);--shadow:0 24px 60px rgba(80,60,120,.14);--shadow-soft:0 12px 32px rgba(80,60,120,.10)}
      [data-theme="light"] body{background:radial-gradient(circle at 14% 10%,rgba(108,58,237,.07),transparent 28%),radial-gradient(circle at 88% 8%,rgba(236,72,153,.05),transparent 28%),linear-gradient(180deg,#F4F1FF 0%,#EDE8FF 44%,#E8E2FF 100%);color:#1A1533}
      [data-theme="light"] body::before{background-image:linear-gradient(to right,rgba(107,92,138,.12) 1px,transparent 1px);mask-image:radial-gradient(circle at 50% 45%,rgba(0,0,0,.5),transparent 88%)}
      [data-theme="light"] body::after{opacity:.12}
      [data-theme="light"] .platform-panel{background:linear-gradient(180deg,rgba(244,241,255,.98),rgba(237,232,255,.98));border-color:rgba(107,92,138,.18)}
      [data-theme="light"] .platform-brand{border-bottom-color:rgba(107,92,138,.18)}
      [data-theme="light"] .platform-link{color:#2D1F56;background:rgba(244,241,255,.5);border-color:rgba(107,92,138,.18)}
      [data-theme="light"] .platform-link.active{background:rgba(108,58,237,.88);color:#F5F3FF}
      [data-theme="light"] .platform-user,[data-theme="light"] .platform-support{background:rgba(255,255,255,.88);border-color:rgba(107,92,138,.18);color:#1A1533}
      [data-theme="light"] .logout-btn{background:rgba(255,255,255,.94);border-color:rgba(107,92,138,.24);color:#1A1533}
      [data-theme="light"] .content-shell{background:linear-gradient(180deg,rgba(248,246,255,.98),rgba(242,238,255,.98))}
      [data-theme="light"] .surface{background:rgba(255,255,255,.72);border-color:rgba(107,92,138,.18)}
      [data-theme="light"] .tile{background:rgba(255,255,255,.82);border-color:rgba(107,92,138,.20);color:#1A1533}
      [data-theme="light"] .tile.active{background:rgba(235,228,255,.92)}
      [data-theme="light"] .stat,[data-theme="light"] .detail-row,[data-theme="light"] .detail-card,[data-theme="light"] .run-item{background:rgba(244,241,255,.72);border-color:rgba(107,92,138,.16)}
      [data-theme="light"] .empty-state{background:rgba(248,246,255,.96);border-color:rgba(107,92,138,.16)}
      [data-theme="light"] .badge,[data-theme="light"] .mini-pill,[data-theme="light"] .status-pill{background:rgba(255,255,255,.88);color:#3D2E6B;border-color:rgba(107,92,138,.22)}
      [data-theme="light"] .open-btn{background:rgba(108,58,237,.88)}
      [data-theme="light"] .toggle-btn{background:rgba(255,255,255,.88);color:#1A1533}
      .theme-toggle-btn{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border-radius:14px;border:1px solid rgba(107,92,138,.24);background:rgba(34,25,56,.86);color:#F5F3FF;font-family:Inter,"Sohne","Suisse Intl",sans-serif;font-size:.75rem;font-weight:600;cursor:pointer;transition:background 180ms ease,border-color 180ms ease}
      .theme-toggle-btn:hover{background:rgba(108,58,237,.14);border-color:rgba(107,92,138,.32)}
      [data-theme="light"] .theme-toggle-btn{background:rgba(255,255,255,.88);border-color:rgba(107,92,138,.24);color:#1A1533}
    </style>
    <script>(function(){try{var t=localStorage.getItem("claritect_theme_v1");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})()</script>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <aside class="platform-panel">
          <div class="platform-brand"><div class="platform-brand-badge">${renderClaritectLogoImage("platform-brand-logo")}</div><div><strong>Claritect</strong><span>Decision intelligence</span></div></div>
          <div class="platform-section">Core Platform</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/app"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat Explorer</a>
            <a class="platform-link" href="/usage"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>Usage &amp; AI</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>Data Sources</a>
            <a class="platform-link active" href="/scheduled"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M8 18h6"/></svg>Scheduled Reports</a>
            <a class="platform-link" href="/config"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Global Config</a>
          </nav>
          <div class="platform-footer">
            <div class="platform-user"><div class="platform-user-avatar">@</div><div><small>Customer workspace</small><strong>Claritect User</strong></div></div>
            <div class="platform-support"><span>Support</span><form method="POST" action="/auth/logout"><button class="logout-btn" type="submit">Sign Out</button></form></div>
            <button id="theme-toggle-btn" class="theme-toggle-btn" type="button"><span id="theme-toggle-icon">☀️</span><span id="theme-toggle-label">Light mode</span></button>
          </div>
        </aside>
        <main class="content-shell">
          <section class="workspace">
            <section class="surface">
              <div class="surface-header"><div><h2>Scheduled report types</h2><p>Each tile is one report contract with its own cadence, timezone, rerun plan, and run history.</p></div><div class="badge" id="grid-badge">0 profiles</div></div>
              <div id="reports-grid" class="reports-grid"></div>
              <div id="empty-state" class="empty-state" style="display:none;"><h3>No scheduled reports yet</h3><p>Once a report is scheduled from chat, it will appear here with its cadence, timezone, rerun instructions, and run history.</p></div>
            </section>
            <aside class="surface detail-surface" id="detail-surface" data-status="idle">
              <div class="surface-header"><div><h2 id="detail-title">Select a scheduled report</h2><p id="detail-subtitle">Pick a tile to inspect cadence, timezone, question handling, and completed runs.</p></div><div class="badge" id="detail-badge">Waiting</div></div>
              <div class="detail-body" id="detail-body"><div class="detail-card"><h3>What we show here</h3><p class="mono">Cadence, timezone, next run, per-question rerun behavior, and every completed run you can reopen in chat.</p></div></div>
            </aside>
          </section>
        </main>
      </div>
    </div>
    <script>
      const THEME_STORAGE_KEY = "claritect_theme_v1";
      const themeToggleBtnEl = document.getElementById("theme-toggle-btn");
      const themeToggleIconEl = document.getElementById("theme-toggle-icon");
      const themeToggleLabelEl = document.getElementById("theme-toggle-label");
      function applyTheme(theme) {
        if (theme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
          if (themeToggleIconEl) themeToggleIconEl.textContent = "🌙";
          if (themeToggleLabelEl) themeToggleLabelEl.textContent = "Dark mode";
        } else {
          document.documentElement.removeAttribute("data-theme");
          if (themeToggleIconEl) themeToggleIconEl.textContent = "☀️";
          if (themeToggleLabelEl) themeToggleLabelEl.textContent = "Light mode";
        }
        try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch(e) {}
      }
      applyTheme((function(){try{return localStorage.getItem(THEME_STORAGE_KEY);}catch(e){return null;}})()==="light"?"light":"dark");
      if (themeToggleBtnEl) {
        themeToggleBtnEl.addEventListener("click", function() {
          applyTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light");
        });
      }
    </script>
    <script>
      (() => {
        const gridEl=document.getElementById("reports-grid"), emptyEl=document.getElementById("empty-state"), detailTitleEl=document.getElementById("detail-title"), detailSubtitleEl=document.getElementById("detail-subtitle"), detailBadgeEl=document.getElementById("detail-badge"), detailBodyEl=document.getElementById("detail-body"), detailSurfaceEl=document.getElementById("detail-surface"), gridBadgeEl=document.getElementById("grid-badge");
        let items=[], activeContractId=null;
        const esc=(v)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\"/g,"&quot;").replace(/'/g,"&#39;");
        const rel=(iso)=>{ if(!iso) return "No runs yet"; const t=Date.parse(iso); if(!Number.isFinite(t)) return iso; const d=Math.round((Date.now()-t)/60000); if(d<1) return "just now"; if(d<60) return d+"m ago"; const h=Math.round(d/60); if(h<24) return h+"h ago"; return Math.round(h/24)+"d ago"; };
        const stamp=(iso)=>{ if(!iso) return "Run time unavailable"; const d=new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : iso; };
        const cadence=(v)=>v ? v.charAt(0).toUpperCase()+v.slice(1) : "Scheduled";
        const titleCase=(v)=>{ const raw=String(v||"").trim(); return raw ? raw.charAt(0).toUpperCase()+raw.slice(1) : ""; };
        const profileStatusVariant=(v)=>{ const raw=String(v||"").trim().toLowerCase(); if(raw==="active") return "active"; if(raw==="paused") return "paused"; if(raw==="failed") return "failed"; return "neutral"; };
        const profileStatusMark=(v)=>{ const raw=String(v||"").trim().toLowerCase(); if(raw==="active") return {symbol:"✓",label:"Active"}; if(raw==="failed") return {symbol:"✘",label:"Failed"}; if(raw==="paused") return {symbol:"•",label:"Paused"}; return {symbol:"•",label:titleCase(v||"Scheduled")||"Scheduled"}; };
        const runStatusVariant=(v)=>{ const raw=String(v||"").trim().toLowerCase(); if(raw==="succeeded"||raw==="success") return "active"; if(raw==="failed"||raw==="error") return "failed"; return "neutral"; };
        const runStatusMark=(v)=>{ const raw=String(v||"").trim().toLowerCase(); if(raw==="succeeded"||raw==="success") return {symbol:"✓",label:"Succeeded"}; if(raw==="failed"||raw==="error") return {symbol:"✘",label:"Failed"}; return {symbol:"•",label:titleCase(v||"Scheduled")||"Scheduled"}; };
        const describeCron=(value)=>{ const raw=String(value||"").trim(); if(!raw) return "Schedule pending"; const parts=raw.split(" ").filter(Boolean); if(parts.length<5) return raw; const [minute,hour,dayOfMonth,month,dayOfWeek]=parts; const isDigits=(x)=>/^[0-9]+$/.test(String(x||"")); if(minute==="0"&&isDigits(hour)&&isDigits(dayOfMonth)&&month==="*"&&dayOfWeek==="*") return "Every month on day "+dayOfMonth+" at "+String(Number(hour)).padStart(2,"0")+":00"; if(minute==="0"&&isDigits(hour)&&dayOfMonth==="*"&&month==="*"&&isDigits(dayOfWeek)){ const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]; return "Every "+(names[Number(dayOfWeek)]||("Day "+dayOfWeek))+" at "+String(Number(hour)).padStart(2,"0")+":00"; } return raw; };
        function updateHero(){ gridBadgeEl.textContent=items.length+" profile"+(items.length===1?"":"s"); }
        function renderGrid(){
          gridEl.innerHTML="";
          if(!items.length){ emptyEl.style.display="block"; return; }
          emptyEl.style.display="none";
          for(const item of items){
            const mark=profileStatusMark(item.status||"active"), variant=profileStatusVariant(item.status||"active");
            const statusClass=variant==="active"?"status-positive":variant==="failed"?"status-negative":"status-neutral";
            const card=document.createElement("button");
            card.type="button"; card.className="tile"+(item.contract_id===activeContractId?" active":""); card.setAttribute("data-status",variant);
            card.innerHTML="<h3>"+esc(item.report_title)+"</h3>"+'<div class="tile-meta"><span class="mini-pill">'+esc(cadence(item.frequency))+'</span><span class="mini-pill mono">'+esc(item.timezone||"UTC")+'</span><span class="mini-pill mono">'+esc(item.local_run_time||describeCron(item.schedule_cron))+'</span></div>'+'<div class="tile-stats"><div class="stat"><span>Questions</span><strong>'+esc(item.question_count)+'</strong></div><div class="stat"><span>Runs</span><strong>'+esc(item.run_count)+'</strong></div><div class="stat"><span>Latest</span><strong>'+esc(rel(item.latest_run_at))+'</strong></div><div class="stat '+statusClass+'"><span>Status</span><strong><span class="status-mark" aria-label="'+esc(mark.label)+'">'+esc(mark.symbol)+'</span></strong></div></div>';
            card.addEventListener("click",()=>{ activeContractId=item.contract_id; renderGrid(); void loadDetail(item.contract_id); });
            gridEl.appendChild(card);
          }
        }
        async function loadList(){
          gridEl.innerHTML='<div class="detail-card">Loading scheduled reports...</div>';
          const response=await fetch("/api/scheduled-reports"); const payload=await response.json();
          items=Array.isArray(payload.items)?payload.items:[];
          updateHero(); renderGrid();
          if(items.length>0){ activeContractId=items[0].contract_id; renderGrid(); await loadDetail(items[0].contract_id); }
        }
        async function loadDetail(contractId){
          detailTitleEl.textContent="Loading scheduled report"; detailSubtitleEl.textContent="Fetching cadence, question plan, and run history."; detailBadgeEl.textContent="Loading"; detailSurfaceEl.setAttribute("data-status","idle"); detailBodyEl.innerHTML='<div class="detail-card">Loading details...</div>';
          const response=await fetch("/api/scheduled-reports/"+encodeURIComponent(contractId)); const payload=await response.json();
          if(!response.ok){ detailTitleEl.textContent="Scheduled report unavailable"; detailSubtitleEl.textContent=payload&&payload.message?payload.message:"Unable to load this schedule."; detailBadgeEl.textContent="Error"; detailBodyEl.innerHTML=""; return; }
          const profile=payload.profile||{}, runs=Array.isArray(payload.runs)?payload.runs:[], questions=Array.isArray(profile.question_execution_plan)?profile.question_execution_plan:[], profileStatus=String(profile.status||"active"), variant=profileStatusVariant(profileStatus), statusMark=profileStatusMark(profileStatus);
          detailSurfaceEl.setAttribute("data-status",variant); detailTitleEl.textContent=profile.report_title||"Scheduled report"; detailSubtitleEl.textContent=(profile.local_run_time||describeCron(profile.schedule_cron))+" in "+(profile.timezone||"UTC")+(payload.next_run_at?" • Next run "+stamp(payload.next_run_at):""); detailBadgeEl.textContent=statusMark.label;
          const questionsHtml=questions.length?questions.map((entry)=>'<div class="question-plan" data-collapsed="true"><button class="question-toggle" type="button"><strong>Q'+esc(entry.question_number)+": "+esc(entry.question_text)+'</strong><span class="question-chevron">▾</span></button><div class="question-body"><p><span class="mono">Current scope:</span> '+esc(entry.current_scope_summary)+'</p><p><span class="mono">Next run:</span> '+esc(entry.next_run_behavior)+'</p></div></div>').join(""):'<div class="question-plan"><p>No per-question rerun notes were stored yet.</p></div>';
          const runsHtml=runs.length?runs.map((run)=>{ const mark=runStatusMark(run.status||"scheduled"), runVariant=runStatusVariant(run.status||"scheduled"); return '<div class="run-item"><div class="run-copy"><strong>'+esc(stamp(run.finished_at||run.started_at))+'</strong><span class="mono">Run '+esc(run.run_id)+" • "+esc(run.trigger||"manual")+'</span></div><div class="run-actions"><span class="status-pill '+esc(runVariant)+'"><span class="status-mark" aria-label="'+esc(mark.label)+'">'+esc(mark.symbol)+'</span></span><button class="open-btn" type="button" data-run-id="'+esc(run.run_id)+'">Open in chat</button></div></div>'; }).join(""):'<div class="question-plan"><p>No completed runs yet. The cadence is saved and waiting for its first execution window.</p></div>';
          const toggleLabel=profileStatus==="active"?"Pause report":"Activate report", toggleClass=profileStatus==="active"?"pause":"activate", localRunTime=profile.local_run_time||"09:00";
          detailBodyEl.innerHTML='<div class="detail-card"><h3>Schedule summary</h3><div class="detail-grid"><div class="detail-row"><span>Cadence</span><strong>'+esc(cadence(profile.frequency))+'</strong></div><div class="detail-row"><span>Timezone</span><strong class="mono">'+esc(profile.timezone||"UTC")+'</strong></div><div class="detail-row"><span>Local run time</span><strong class="mono">'+esc(localRunTime)+'</strong></div><div class="detail-row"><span>Next run</span><strong>'+esc(payload.next_run_at?stamp(payload.next_run_at):"Paused")+'</strong></div><div class="detail-row"><span>Schedule</span><strong>'+esc(describeCron(profile.schedule_cron))+'</strong></div><div class="detail-row"><span>Windowing</span><strong>'+esc(profile.windowing_instructions||"Reuse current rolling logic")+'</strong></div></div><div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="toggle-btn '+esc(toggleClass)+'" type="button" id="schedule-status-toggle">'+esc(toggleLabel)+'</button></div></div><div class="detail-card"><h3>Question handling on future runs</h3><div class="question-list">'+questionsHtml+'</div></div><div class="detail-card"><h3>Completed runs</h3><div class="run-list">'+runsHtml+'</div></div>';
          const toggleButton=detailBodyEl.querySelector("#schedule-status-toggle");
          if(toggleButton){ toggleButton.addEventListener("click",async()=>{ toggleButton.disabled=true; const nextStatus=profileStatus==="active"?"paused":"active"; const toggleResponse=await fetch("/api/scheduled-reports/"+encodeURIComponent(contractId)+"/status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({status:nextStatus})}); if(!toggleResponse.ok){ toggleButton.disabled=false; return; } await loadList(); }); }
          detailBodyEl.querySelectorAll(".question-toggle").forEach((button)=>{ button.addEventListener("click",()=>{ const parent=button.closest(".question-plan"); if(!parent) return; const collapsed=parent.getAttribute("data-collapsed")==="true"; parent.setAttribute("data-collapsed",collapsed?"false":"true"); }); });
          detailBodyEl.querySelectorAll("[data-run-id]").forEach((button)=>{ button.addEventListener("click",()=>{ const runId=button.getAttribute("data-run-id"); if(!runId) return; window.location.href="/app?scheduled_run_id="+encodeURIComponent(runId); }); });
        }
        void loadList().catch((error)=>{ console.error(error); items=[]; updateHero(); gridEl.innerHTML=""; emptyEl.style.display="block"; detailSurfaceEl.setAttribute("data-status","idle"); detailTitleEl.textContent="Could not load scheduled reports"; detailSubtitleEl.textContent="Please refresh the page once the API is available."; detailBadgeEl.textContent="Error"; });
      })();
    </script>
  </body>
</html>`;
}
