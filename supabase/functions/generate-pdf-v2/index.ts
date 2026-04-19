// generate-pdf-v2 — Mirmidons Retail templates (6 modes)
// Renders structured FORGE JSON into editorial-grade HTML and exports PDF via html2pdf.app

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ForgeMode = "dossier_operador" | "presentacion_comercial" | "borrador_contrato" | "plan_estrategico" | "informe_war_room" | "email_comunicacion";

// ════════════════════════════════════════════════════════════════════
// MIRMIDONS DESIGN TOKENS (ported from assets/tokens.css)
// ════════════════════════════════════════════════════════════════════

const MIRMIDONS_TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --navy-900:#050F22; --navy-800:#0B1E3F; --navy-700:#142B55; --navy-600:#23406E;
  --navy-100:#E6EAF1; --navy-050:#F1F4F9;
  --gold-700:#8A6E38; --gold-600:#B8924A; --gold-500:#C9A961; --gold-200:#E8D9B3; --gold-050:#F6EFDD;
  --bone-100:#F4EFE6; --bone-200:#EDE5D4; --bone-300:#DDD2BA;
  --ink-900:#0E0E10; --ink-700:#2A2A2E; --ink-500:#4A4A4A; --ink-400:#6B6B6B;
  --ink-300:#8A8A8A; --ink-200:#B8B8B8; --ink-100:#DCDCDC; --ink-050:#EFEFEF;
  --paper:#FFFFFF;
  --sem-green:#2F6B3E; --sem-green-bg:#E6F0E9;
  --sem-amber:#C89838; --sem-amber-bg:#FBF2DE;
  --sem-red:#A93226;   --sem-red-bg:#F7E3E0;
  --sem-blue:#1F4E79;  --sem-blue-bg:#E3ECF5;
  --serif:'Playfair Display', Georgia, serif;
  --sans:'Inter', Helvetica, Arial, sans-serif;
  --mono:'JetBrains Mono', Consolas, monospace;
}

* { margin:0; padding:0; box-sizing:border-box; }
html, body { background:#d4ccbd; font-family:var(--sans); color:var(--ink-900); -webkit-font-smoothing:antialiased; }
body.print-mode { background:#FFFFFF; padding:0; }

/* ═══ A4 vertical document ═══ */
.doc-a4 { max-width: 794px; margin: 40px auto; box-shadow: 0 6px 40px rgba(0,0,0,0.15); background:var(--paper); }
.page { width:794px; min-height:1123px; background:var(--paper); display:flex; flex-direction:column; position:relative; overflow:hidden; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.page-body { flex:1; padding: 28px 56px 24px; }
.page.bone { background: var(--bone-100); }
.page.navy { background: var(--navy-900); color: var(--bone-100); }

/* Header / footer for inner pages */
.hdr {
  display:flex; justify-content:space-between; align-items:center;
  padding: 22px 56px 12px;
  font-family: var(--sans); font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-400);
}
.hdr .brand { color: var(--navy-900); font-weight:700; letter-spacing:0.28em; display:flex; align-items:center; gap:10px; }
.hdr .brand .mk { width:14px; height:14px; border:1.5px solid var(--navy-900); position:relative; }
.hdr .brand .mk::after { content:""; position:absolute; inset:3px; background:var(--gold-600); }
.hdr .doc-ref { font-family: var(--mono); letter-spacing: 0.1em; font-size: 7.5pt; color: var(--ink-400); }

.ftr {
  margin: 0 56px; display:flex; justify-content:space-between; align-items:center;
  padding: 14px 0 22px; font-family: var(--sans); font-size: 7pt; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-400); border-top:1px solid var(--ink-100);
}
.ftr .pagenum { font-family: var(--mono); color: var(--navy-900); font-weight:600; letter-spacing:0.08em; }

/* Section marker */
.sec-mark { display:flex; align-items:baseline; gap:14px; margin-bottom:8px; }
.sec-mark .num { font-family: var(--mono); font-size:8pt; letter-spacing:0.2em; color: var(--gold-600); text-transform: uppercase; }
.sec-mark .bar { flex:1; height:1px; background: var(--ink-200); }
.sec-title {
  font-family: var(--serif); font-weight:500; font-size: 26pt; line-height:1.05; letter-spacing:-0.01em; color: var(--navy-900);
  margin: 0 0 24px;
}
.sec-title .accent, .sec-title em { color: var(--gold-600); font-style: italic; font-weight: 400; }

/* Typography */
.eyebrow { font-family: var(--sans); font-size:8.5pt; font-weight:600; letter-spacing:0.22em; text-transform:uppercase; color: var(--gold-700); }
.lead { font-family: var(--serif); font-style: italic; font-size:13pt; line-height:1.5; color: var(--ink-700); }
p.body, .body p { font-size: 9.5pt; line-height: 1.6; color: var(--ink-700); margin: 0 0 11px; }
.dropcap::first-letter { font-family: var(--serif); font-weight:500; font-size: 38pt; line-height:0.85; float:left; padding: 4px 8px 0 0; color: var(--gold-600); }

/* Tables editorial */
.tbl { width:100%; border-collapse:collapse; font-size:9pt; font-variant-numeric: tabular-nums; }
.tbl thead th {
  text-align:left; font-family:var(--sans); font-weight:600; font-size:7.5pt; letter-spacing:0.14em;
  text-transform:uppercase; color:var(--ink-500); padding:10px 12px 8px;
  border-bottom: 1.5px solid var(--navy-900); white-space:nowrap;
}
.tbl tbody td { padding:10px 12px; border-bottom:1px solid var(--ink-100); vertical-align:top; color:var(--ink-700); }
.tbl tbody tr:last-child td { border-bottom: 1px solid var(--navy-900); }
.tbl td.num, .tbl th.num { text-align:right; font-variant-numeric: tabular-nums; }
.tbl td.strong { color: var(--navy-900); font-weight:600; }
.tbl.compact tbody td, .tbl.compact thead th { padding:6px 10px; }
.tbl.zebra tbody tr:nth-child(even) td { background: var(--bone-100); }

/* Pills */
.pill { display:inline-flex; align-items:center; gap:6px; font-family:var(--sans); font-size:7.5pt; font-weight:600;
  letter-spacing:0.1em; text-transform:uppercase; padding:3px 8px; border-radius:2px; background:var(--ink-050);
  color: var(--ink-700); white-space: nowrap; }
.pill .dot { width:6px; height:6px; border-radius:50%; background: currentColor; }
.pill.green { background: var(--sem-green-bg); color: var(--sem-green); }
.pill.amber { background: var(--sem-amber-bg); color: var(--sem-amber); }
.pill.red   { background: var(--sem-red-bg);   color: var(--sem-red); }
.pill.blue  { background: var(--sem-blue-bg);  color: var(--sem-blue); }
.pill.navy  { background: var(--navy-900);      color: var(--bone-100); }
.pill.gold  { background: var(--gold-050);     color: var(--gold-700); }
.pill.outline { background:transparent; border:1px solid var(--ink-200); color: var(--ink-700); }

/* KPI block */
.kpi { padding:14px 16px; border-left:2px solid var(--gold-600); background: var(--bone-100); }
.kpi .lbl { font-family:var(--sans); font-size:7pt; font-weight:600; letter-spacing:0.16em; color:var(--ink-500); text-transform:uppercase; }
.kpi .val { font-family:var(--serif); font-weight:500; font-size:28pt; line-height:1; color:var(--navy-900); margin:6px 0 4px; font-variant-numeric:tabular-nums; letter-spacing:-0.01em; }
.kpi .sub { font-size:8pt; color:var(--ink-500); line-height:1.35; }

/* Strip */
.strip { display:grid; grid-template-columns: repeat(4, 1fr); gap:0; margin: 18px 0 22px;
  border-top:1.5px solid var(--navy-900); border-bottom:1.5px solid var(--navy-900); }
.strip .cell { padding:14px 16px; border-right:1px solid var(--ink-100); }
.strip .cell:last-child { border-right:none; }
.strip .cell .lbl { font-family:var(--mono); font-size:7pt; letter-spacing:0.14em; color:var(--ink-400); text-transform:uppercase; }
.strip .cell .val { font-family:var(--serif); font-weight:500; font-size:22pt; line-height:1; color:var(--navy-900); margin:6px 0 2px; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; }
.strip .cell .sub { font-size:7.5pt; color:var(--ink-500); line-height:1.3; }

/* Recommendation banner */
.reco-banner {
  margin-top: 22px; padding: 18px 20px;
  border-top: 1.5px solid var(--navy-900); border-bottom: 1.5px solid var(--navy-900);
  background: var(--bone-100);
  display: grid; grid-template-columns: 100px 1fr; gap: 18px;
}
.reco-banner .tag { font-family: var(--mono); font-size:7.5pt; letter-spacing:0.18em; color: var(--gold-700); text-transform:uppercase; font-weight:600; line-height:1.4; }
.reco-banner .text { font-family: var(--serif); font-size:11.5pt; line-height:1.45; color: var(--navy-900); }
.reco-banner .text strong { color: var(--navy-900); font-weight:600; font-style:normal; }

/* KV row (perfil) */
.perfil-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 0 48px; }
.kv-row { display:grid; grid-template-columns: 44% 56%; padding:10px 0; border-bottom:1px solid var(--ink-100); }
.kv-row .k { font-family:var(--sans); font-size:7pt; font-weight:600; letter-spacing:0.14em; color:var(--ink-500); text-transform:uppercase; }
.kv-row .v { font-size:9pt; color: var(--ink-900); line-height:1.4; }

/* Palancas / risks / recommendations */
.palancas { display:grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.palanca { padding:16px 0; border-top:1px solid var(--navy-900); display:grid; grid-template-columns: 24px 1fr; gap:12px; page-break-inside: avoid; }
.palanca .idx { font-family:var(--mono); font-size:9pt; color: var(--gold-600); font-weight:600; letter-spacing:0.08em; }
.palanca h4 { font-family:var(--sans); font-weight:700; font-size:9.5pt; color:var(--navy-900); margin:0 0 6px; text-transform:uppercase; letter-spacing:0.06em; }
.palanca p { font-size:8.5pt; line-height:1.5; color:var(--ink-700); margin:0; }

.riesgo {
  display:grid; grid-template-columns: 110px 1fr 90px; gap:18px;
  padding:16px 0; border-bottom:1px solid var(--ink-100); align-items:start; page-break-inside: avoid;
}
.riesgo .sev { display:flex; flex-direction:column; gap:6px; }
.riesgo .sev .pill { align-self:flex-start; }
.riesgo .sev .score { font-family:var(--mono); font-size:7pt; color:var(--ink-400); letter-spacing:0.1em; }
.riesgo h4 { margin:0 0 6px; font-family:var(--sans); font-size:10pt; font-weight:700; color: var(--navy-900); }
.riesgo p { margin:0; font-size:8.5pt; line-height:1.5; color: var(--ink-700); }
.riesgo .impact { text-align:right; font-family:var(--mono); font-size:7pt; letter-spacing:0.1em; color:var(--ink-500); text-transform:uppercase; line-height:1.5; }
.riesgo .impact strong { display:block; font-family:var(--serif); font-size:16pt; color:var(--navy-900); font-weight:500; letter-spacing:0; text-transform:none; margin-top:2px; }

.reco { display:grid; grid-template-columns: 90px 28px 1fr; gap:14px; padding:16px 0; border-bottom:1px solid var(--ink-100); align-items:start; page-break-inside: avoid; }
.reco:first-child { border-top:1.5px solid var(--navy-900); }
.reco .rnum { font-family:var(--mono); font-size:18pt; color: var(--gold-600); font-weight:500; line-height:1; padding-top:2px; }
.reco h4 { margin:0 0 6px; font-family:var(--serif); font-size:13pt; font-weight:500; color:var(--navy-900); line-height:1.3; letter-spacing:-0.005em; }
.reco p { margin:0; font-size:8.5pt; line-height:1.5; color: var(--ink-700); }

.sources { margin-top: 24px; padding-top: 18px; border-top: 1.5px solid var(--navy-900); }
.sources h4 { font-family: var(--sans); font-weight:700; font-size:8.5pt; letter-spacing:0.16em; text-transform:uppercase; color: var(--navy-900); margin: 0 0 12px; }
.sources ol { margin:0; padding: 0 0 0 18px; font-size:8pt; color: var(--ink-500); line-height:1.7; }

/* ═══ Cover (vertical doc) ═══ */
.cover.navy-cover { background: var(--navy-900); color: var(--bone-100); }
.cover.navy-cover .page-body { padding: 64px 56px 48px; display:flex; flex-direction:column; }
.cover.bone-cover { background: var(--bone-100); }
.cover.bone-cover .page-body { padding: 64px 56px 48px; display:flex; flex-direction:column; gap: 40px; }
.cover .brand-line { display:flex; justify-content:space-between; align-items:center; font-family:var(--sans); font-size:8pt; letter-spacing:0.24em; text-transform:uppercase; padding-bottom: 18px; border-bottom: 1px solid rgba(184,146,74,0.4); }
.cover.navy-cover .brand-line { color: rgba(244,239,230,0.55); }
.cover.bone-cover .brand-line { color: var(--ink-500); border-bottom: 1.5px solid var(--navy-900); }
.cover .brand-line .brand { font-weight:700; letter-spacing:0.32em; display:flex; align-items:center; gap:12px; }
.cover.navy-cover .brand-line .brand { color: var(--bone-100); }
.cover.bone-cover .brand-line .brand { color: var(--navy-900); }
.cover .brand-line .brand .mk { width:18px; height:18px; border:1.5px solid currentColor; position:relative; }
.cover .brand-line .brand .mk::after { content:""; position:absolute; inset:3px; background:var(--gold-600); }
.cover .corner-code { position:absolute; top:32px; right:56px; font-family:var(--mono); font-size:8pt; color:var(--gold-500); letter-spacing:0.14em; }
.cover .doctype-stack { margin-top: 60px; }
.cover .t-eyebrow { font-family:var(--mono); font-size:9pt; letter-spacing:0.32em; color: var(--gold-500); text-transform:uppercase; }
.cover.bone-cover .t-eyebrow { color: var(--gold-700); }
.cover h1.cover-h1 {
  font-family: var(--serif); font-weight:500;
  font-size: 56pt; line-height: 0.98; letter-spacing:-0.02em;
  margin: 28px 0 0;
}
.cover.navy-cover h1.cover-h1 { color: var(--bone-100); }
.cover.bone-cover h1.cover-h1 { color: var(--navy-900); }
.cover h1.cover-h1 em { font-style: italic; color: var(--gold-500); font-weight:400; }
.cover.bone-cover h1.cover-h1 em { color: var(--gold-600); }
.cover .lede { max-width: 540px; margin-top: 28px; font-family: var(--serif); font-style: italic; font-size: 13pt; line-height: 1.45; }
.cover.navy-cover .lede { color: rgba(244,239,230,0.8); }
.cover.bone-cover .lede { color: var(--ink-700); }
.cover .footer-meta { margin-top: auto; display:grid; grid-template-columns: repeat(4, 1fr); gap: 28px; padding-top: 36px; border-top: 1px solid rgba(184,146,74,0.3); }
.cover.bone-cover .footer-meta { border-top: 1px solid var(--ink-200); }
.cover .footer-meta .k { font-family: var(--mono); font-size:7pt; letter-spacing:0.18em; text-transform:uppercase; }
.cover.navy-cover .footer-meta .k { color: rgba(244,239,230,0.5); }
.cover.bone-cover .footer-meta .k { color: var(--ink-500); }
.cover .footer-meta .v { font-family: var(--sans); font-size: 9.5pt; margin-top: 6px; font-weight:500; }
.cover.navy-cover .footer-meta .v { color: var(--bone-100); }
.cover.bone-cover .footer-meta .v { color: var(--navy-900); }

/* ═══ Deck (16:9 slides) ═══ */
.deck-wrap { width: 100vw; min-height: 100vh; background:#0a0a0a; padding: 24px 0; }
.deck-stage { display:flex; flex-direction:column; align-items:center; gap: 24px; }
.slide { width: 1280px; height: 720px; background: var(--paper); position: relative; overflow: hidden; padding: 48px 72px; box-sizing: border-box; box-shadow: 0 8px 32px rgba(0,0,0,0.3); page-break-after: always; }
.slide:last-child { page-break-after: auto; }
.slide.cover-slide { background: var(--navy-900); color: var(--bone-100); display: flex; flex-direction: column; justify-content: center; }
.slide.close-slide { background: var(--navy-900); color: var(--bone-100); display: flex; flex-direction: column; justify-content: center; }

.s-hdr { position: absolute; top: 36px; left: 72px; right: 72px; display: flex; justify-content: space-between; align-items: center; font-family: var(--sans); font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--ink-400); padding-bottom: 14px; }
.s-hdr .brand { color: var(--navy-900); font-weight: 700; letter-spacing: 0.32em; display: flex; align-items: center; gap: 12px; }
.s-hdr .brand .mk { width: 18px; height: 18px; border: 2px solid var(--navy-900); position: relative; }
.s-hdr .brand .mk::after { content:""; position:absolute; inset:4px; background: var(--gold-600); }
.slide.cover-slide .s-hdr, .slide.close-slide .s-hdr { color: rgba(244,239,230,0.55); }
.slide.cover-slide .s-hdr .brand, .slide.close-slide .s-hdr .brand { color: var(--bone-100); }
.slide.cover-slide .s-hdr .brand .mk, .slide.close-slide .s-hdr .brand .mk { border-color: var(--bone-100); }

.s-ftr { position: absolute; bottom: 28px; left: 72px; right: 72px; display:flex; justify-content:space-between; align-items:center; font-family:var(--sans); font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color: var(--ink-400); border-top:1px solid var(--ink-100); padding-top: 14px; }
.s-ftr .pg { font-family:var(--mono); color:var(--navy-900); font-weight:600; }
.slide.cover-slide .s-ftr, .slide.close-slide .s-ftr { color: rgba(244,239,230,0.5); border-top-color: rgba(184,146,74,0.3); }
.slide.cover-slide .s-ftr .pg, .slide.close-slide .s-ftr .pg { color: var(--gold-500); }

.eyebrow-xl { font-family: var(--mono); font-size: 11px; letter-spacing: 0.28em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; }
h1.slide-display { font-family: var(--serif); font-weight: 500; font-size: 88pt; line-height: 0.95; letter-spacing: -0.02em; color: var(--navy-900); margin: 0; }
h1.slide-display em { font-style: italic; color: var(--gold-600); font-weight: 400; }
.slide.cover-slide h1.slide-display, .slide.close-slide h1.slide-display { color: var(--bone-100); font-size: 72pt; }
.slide.cover-slide h1.slide-display em, .slide.close-slide h1.slide-display em { color: var(--gold-500); }
h2.slide-sec { font-family: var(--serif); font-weight: 500; font-size: 44pt; line-height: 1.02; letter-spacing: -0.015em; color: var(--navy-900); margin: 0; }
h2.slide-sec em { font-style: italic; color: var(--gold-600); font-weight: 400; }

.slide-lede { font-family: var(--serif); font-style: italic; font-size: 18pt; line-height: 1.35; color: rgba(244,239,230,0.75); max-width: 900px; margin-top: 28px; }
.slide.cover-slide .meta-strip, .slide.close-slide .meta-strip { margin-top: 64px; padding-top: 24px; border-top:1px solid rgba(184,146,74,0.3); display:grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
.slide.cover-slide .meta-strip .k, .slide.close-slide .meta-strip .k { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; color: rgba(244,239,230,0.5); text-transform: uppercase; }
.slide.cover-slide .meta-strip .v, .slide.close-slide .meta-strip .v { font-size: 13px; color: var(--bone-100); margin-top: 6px; font-weight: 500; }

/* Stat XL for slides */
.stat-xl { padding: 18px 20px; border-left: 3px solid var(--gold-600); background: var(--bone-100); }
.stat-xl .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; color: var(--ink-500); text-transform: uppercase; font-weight: 600; }
.stat-xl .val { font-family: var(--serif); font-weight: 500; font-size: 38pt; line-height: 1; color: var(--navy-900); margin: 10px 0 4px; letter-spacing: -0.015em; font-variant-numeric: tabular-nums; }
.stat-xl .sub { font-size: 11px; color: var(--ink-500); line-height: 1.4; }

/* DAFO grid (slides) */
.dafo-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 1px; background: var(--ink-100); margin-top: 56px; height: 480px; border: 1px solid var(--ink-100); }
.dafo-cell { background: var(--paper); padding: 22px 26px; display: flex; flex-direction: column; gap: 10px; }
.dafo-cell.fort { background: var(--bone-100); }
.dafo-cell.amen { background: #F7E3E0; }
.dafo-cell.opor { background: var(--gold-050); }
.dafo-cell.debi { background: #EDE5D4; }
.dafo-cell .head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid var(--navy-900); padding-bottom: 10px; }
.dafo-cell .head h3 { font-family: var(--serif); font-weight: 500; font-size: 22pt; color: var(--navy-900); margin: 0; }
.dafo-cell .head .let { font-family: var(--mono); font-size: 11px; letter-spacing: 0.2em; color: var(--gold-700); font-weight: 600; }
.dafo-cell ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.dafo-cell li { font-size: 11pt; line-height: 1.4; color: var(--ink-700); padding-left: 14px; position: relative; }
.dafo-cell li::before { content: "—"; position: absolute; left: 0; color: var(--gold-700); font-weight: 600; }

/* Pillars (plan estratégico) */
.pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 56px; height: 480px; }
.pillar { background: var(--bone-100); padding: 28px 20px 20px; display: flex; flex-direction: column; gap: 12px; border-top: 4px solid var(--navy-800); }
.pillar:nth-child(2) { border-top-color: var(--gold-600); }
.pillar:nth-child(3) { border-top-color: var(--navy-600); }
.pillar:nth-child(4) { border-top-color: var(--gold-500); }
.pillar .n { font-family: var(--mono); font-size: 10px; color: var(--gold-700); letter-spacing: 0.2em; font-weight: 600; }
.pillar h3 { font-family: var(--serif); font-weight: 500; font-size: 22pt; line-height: 1.08; color: var(--navy-900); margin: 0; letter-spacing: -0.01em; }
.pillar h3 em { font-style: italic; color: var(--gold-700); font-weight: 400; }
.pillar p.desc { font-size: 11pt; line-height: 1.45; color: var(--ink-700); margin: 0; }
.pillar .kpis { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--ink-200); display: flex; flex-direction: column; gap: 6px; font-size: 10pt; }
.pillar .kpis .r { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.pillar .kpis .r .k { color: var(--ink-500); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; font-family: var(--mono); }
.pillar .kpis .r .v { font-family: var(--mono); color: var(--navy-900); font-weight: 700; }

/* ═══ War Room (dark dashboard) ═══ */
.wr {
  --wr-bg:#05080F; --wr-panel:#0D1526; --wr-panel-2:#0A1120;
  --wr-border:#1C2940; --wr-ink:#E8E1D2; --wr-ink-dim:#8692AB;
  --wr-gold:#D4A95C; --wr-green:#4FB369; --wr-amber:#E8A93C;
  --wr-red:#D1483F; --wr-blue:#5A8AB8;
  background: var(--wr-bg); color: var(--wr-ink); padding: 28px; min-height: 100vh;
  font-family: var(--sans);
}
.wr .topbar { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--wr-border); margin-bottom: 18px; }
.wr .topbar .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; font-size: 11px; }
.wr .topbar .brand .mk { width: 16px; height: 16px; border: 1.5px solid var(--wr-ink); position: relative; }
.wr .topbar .brand .mk::after { content:""; position: absolute; inset: 3px; background: var(--wr-gold); }
.wr .topbar .title { font-family: var(--serif); font-weight: 500; font-size: 19px; color: var(--wr-ink); }
.wr .topbar .title em { font-style: italic; color: var(--wr-gold); }
.wr .topbar .title .sub { display: block; font-family: var(--mono); font-size: 9px; color: var(--wr-ink-dim); letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px; }
.wr .topbar .live { font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--wr-gold); }

.wr .strip-wr { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.wr .strip-wr .cell { background: var(--wr-panel); border: 1px solid var(--wr-border); padding: 14px 16px; position: relative; }
.wr .strip-wr .cell::before { content:""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--wr-gold); }
.wr .strip-wr .cell.alert::before { background: var(--wr-red); }
.wr .strip-wr .cell.ok::before { background: var(--wr-green); }
.wr .strip-wr .cell .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em; color: var(--wr-ink-dim); text-transform: uppercase; font-weight: 600; }
.wr .strip-wr .cell .val { font-family: var(--serif); font-weight: 500; font-size: 26pt; line-height: 1; color: var(--wr-ink); margin: 8px 0 4px; font-variant-numeric: tabular-nums; }
.wr .strip-wr .cell .sub { font-family: var(--mono); font-size: 9.5px; color: var(--wr-ink-dim); }

.wr .panel { background: var(--wr-panel); border: 1px solid var(--wr-border); padding: 16px 18px; margin-bottom: 12px; }
.wr .panel .phead { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--wr-border); margin-bottom: 12px; }
.wr .panel .phead .pname { font-family: var(--mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--wr-gold); font-weight: 700; }
.wr .panel .phead .pmeta { font-family: var(--mono); font-size: 9px; color: var(--wr-ink-dim); text-transform: uppercase; letter-spacing: 0.14em; }
.wr table { width: 100%; border-collapse: collapse; }
.wr table th, .wr table td { padding: 8px 10px; text-align: left; font-size: 11px; border-bottom: 1px solid var(--wr-border); color: var(--wr-ink); }
.wr table th { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--wr-ink-dim); }
.wr table td.num { text-align: right; font-family: var(--mono); }

.wr .alert-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 10px 12px; background: var(--wr-panel-2); border-left: 2px solid var(--wr-red); font-size: 11px; align-items: start; margin-bottom: 6px; }
.wr .alert-row.amber { border-left-color: var(--wr-amber); }
.wr .alert-row.warning { border-left-color: var(--wr-amber); }
.wr .alert-row.info { border-left-color: var(--wr-blue); }
.wr .alert-row.ok { border-left-color: var(--wr-green); }
.wr .alert-row .msg { line-height: 1.4; color: var(--wr-ink); }
.wr .alert-row .msg strong { color: var(--wr-gold); }
.wr .alert-row .sev { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; padding: 2px 6px; border: 1px solid currentColor; }
.wr .alert-row .sev.critical { color: var(--wr-red); }
.wr .alert-row .sev.warning { color: var(--wr-amber); }
.wr .alert-row .sev.info { color: var(--wr-blue); }
.wr .alert-row .sev.ok { color: var(--wr-green); }

.wr .semaforo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.wr .semaforo-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--wr-panel-2); border: 1px solid var(--wr-border); font-size: 11px; }
.wr .semaforo-row .dot-sem { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.wr .semaforo-row .dot-sem.verde { background: var(--wr-green); box-shadow: 0 0 8px var(--wr-green); }
.wr .semaforo-row .dot-sem.ambar { background: var(--wr-amber); box-shadow: 0 0 8px var(--wr-amber); }
.wr .semaforo-row .dot-sem.rojo { background: var(--wr-red); box-shadow: 0 0 8px var(--wr-red); }
.wr .semaforo-row strong { color: var(--wr-ink); display: block; font-size: 11px; }
.wr .semaforo-row span { color: var(--wr-ink-dim); }

.wr .wrfooter { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--wr-border); display: flex; justify-content: space-between; font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; color: var(--wr-ink-dim); text-transform: uppercase; }

/* ═══ Email ═══ */
.email-stack { max-width: 680px; margin: 32px auto; padding: 0 16px; display: flex; flex-direction: column; gap: 20px; }
.email-card { background: var(--paper); box-shadow: 0 6px 30px rgba(0,0,0,0.10); }
.email-head { padding: 16px 36px; border-bottom: 1px solid var(--ink-100); background: var(--bone-100); display: flex; justify-content: space-between; align-items: center; }
.email-head .brand { display: flex; align-items: center; gap: 10px; font-family: var(--sans); font-weight: 700; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--navy-900); }
.email-head .brand .mk { width: 14px; height: 14px; border: 1.5px solid var(--navy-900); position: relative; }
.email-head .brand .mk::after { content:""; position: absolute; inset: 3px; background: var(--gold-600); }
.email-head .meta { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; color: var(--ink-400); text-transform: uppercase; }

.envelope { padding: 22px 36px; border-bottom: 1px solid var(--ink-100); display: grid; grid-template-columns: 80px 1fr auto; row-gap: 8px; column-gap: 16px; align-items: baseline; font-size: 12px; }
.envelope .k { font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; color: var(--ink-400); text-transform: uppercase; font-weight: 600; }
.envelope .v { color: var(--ink-900); }
.envelope .v strong { color: var(--navy-900); font-weight: 600; }
.envelope .tag { display: inline-block; padding: 2px 8px; font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; background: var(--gold-050); color: var(--gold-700); border: 1px solid var(--gold-500); }
.envelope .tag.red { background: rgba(169,50,38,0.08); color: var(--sem-red); border-color: var(--sem-red); }

.subject-block { padding: 24px 36px 6px; }
.subject-block .ref { font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-bottom: 10px; }
.subject-block h1 { font-family: var(--serif); font-weight: 500; font-size: 24pt; line-height: 1.2; color: var(--navy-900); margin: 0; letter-spacing: -0.01em; }
.subject-block h1 em { font-style: italic; color: var(--gold-600); font-weight: 400; }

.email-body { padding: 18px 36px 32px; font-size: 13px; line-height: 1.65; color: var(--ink-700); }
.email-body p { margin: 0 0 14px; }
.email-body p.lead-mail { font-family: var(--serif); font-style: italic; font-size: 15pt; line-height: 1.55; color: var(--navy-800); padding-bottom: 16px; border-bottom: 1px solid var(--ink-100); margin-bottom: 20px; }
.email-body strong { color: var(--navy-900); font-weight: 600; }

.pullbox { background: var(--bone-100); border-left: 2px solid var(--gold-600); padding: 18px 22px; margin: 18px 0; display: grid; grid-template-columns: 100px 1fr; gap: 18px; align-items: start; }
.pullbox .lbl { font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em; color: var(--gold-700); text-transform: uppercase; font-weight: 700; line-height: 1.4; }
.pullbox .txt { font-family: var(--serif); font-size: 14pt; line-height: 1.5; color: var(--navy-900); }

.cta-row { display: flex; gap: 12px; margin: 20px 0 8px; }
.btn-primary, .btn-secondary { display: inline-block; padding: 11px 20px; font-family: var(--sans); font-weight: 600; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; }
.btn-primary { background: var(--navy-900); color: var(--bone-100); }
.btn-secondary { background: transparent; color: var(--navy-900); border: 1.5px solid var(--navy-900); }

.email-signature { margin-top: 28px; padding-top: 22px; border-top: 1.5px solid var(--navy-900); display: grid; grid-template-columns: auto 1fr; gap: 22px; align-items: start; }
.email-signature .avatar { width: 50px; height: 50px; background: var(--navy-900); color: var(--bone-100); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 18pt; }
.email-signature .info .name { font-family: var(--serif); font-size: 14pt; font-weight: 500; color: var(--navy-900); }
.email-signature .info .role { font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-top: 4px; }
.email-signature .info .contact { font-size: 11px; color: var(--ink-500); margin-top: 12px; line-height: 1.6; }
.email-signature .info .contact strong { color: var(--navy-900); font-weight: 600; }

.disclaimer { margin-top: 14px; padding: 12px 18px; background: #EFEAE0; font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--ink-400); line-height: 1.7; text-transform: uppercase; }

.mini-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin: 18px 0; border-top: 1.5px solid var(--navy-900); border-bottom: 1.5px solid var(--navy-900); }
.mini-strip .c { padding: 14px 16px; border-right: 1px solid var(--ink-100); }
.mini-strip .c:last-child { border-right: none; }
.mini-strip .c .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; color: var(--ink-400); text-transform: uppercase; font-weight: 600; }
.mini-strip .c .val { font-family: var(--serif); font-weight: 500; font-size: 18pt; line-height: 1; color: var(--navy-900); margin: 6px 0 2px; letter-spacing: -0.01em; }
.mini-strip .c .sub { font-size: 10px; color: var(--ink-500); line-height: 1.4; }

@media print {
  body { background: white !important; padding: 0 !important; }
  .doc-a4 { box-shadow: none !important; max-width: none !important; margin: 0 !important; }
  .deck-wrap { background: white !important; padding: 0 !important; }
  .slide { box-shadow: none !important; }
  .no-print { display: none !important; }
}
`;

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function esc(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(text: string, cls = ""): string {
  if (!text) return "";
  return text.split(/\n\n+/).map((p, i) => `<p class="${cls}${cls && i === 0 ? " first" : ""}">${esc(p.trim())}</p>`).join("");
}

function nav(label: string, total: number, current: number): string {
  const totalStr = String(total).padStart(2, "0");
  const curStr = String(current).padStart(2, "0");
  return `<span>${esc(label)}</span><span class="pagenum">${curStr} / ${totalStr}</span>`;
}

function refCode(prefix: string, year: string, n = "0001"): string {
  return `MR · ${prefix} · ${year} · ${n}`;
}

function buildHdr(refLabel: string): string {
  return `<div class="hdr">
    <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
    <div class="doc-ref">${esc(refLabel)}</div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 01 · DOSSIER DE OPERADOR  (A4 vertical · 5 páginas)
// ════════════════════════════════════════════════════════════════════

function renderDossier(d: any, modeLabel: string, date: string): string {
  const cover = d.cover || {};
  const asset = d.asset || {};
  const operator = d.operator || {};
  const ref = d.refCode || refCode("DO", new Date().getFullYear().toString());
  const refShort = ref.replace(/ · /g, "-");
  const total = 5;

  const profileItems = (d.profile?.items || []).slice(0, 12);
  const half = Math.ceil(profileItems.length / 2);

  const coverPage = `
  <section class="page cover navy-cover">
    <div class="corner-code">${esc(ref)}</div>
    <div class="page-body">
      <div class="brand-line">
        <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
        <div>Dossier de Operador · ${esc(date)}</div>
      </div>
      <div class="doctype-stack">
        <div class="t-eyebrow">Dossier Estratégico de Operador</div>
        <h1 class="cover-h1">${esc(cover.title || operator.name || "[Operador]")}<br/><em>— ${esc(cover.tagline || "análisis de implantación")}</em></h1>
        <div class="lede">${esc(cover.subtitle || "Viabilidad, palancas de negociación y recomendación comercial.")}</div>
      </div>
      <div class="footer-meta">
        <div><div class="k">Activo objetivo</div><div class="v">${esc(asset.name || "[A definir]")}</div></div>
        <div><div class="k">Sector</div><div class="v">${esc(operator.category || operator.sector || "Retail")}</div></div>
        <div><div class="k">Fecha de emisión</div><div class="v">${esc(date)}</div></div>
        <div><div class="k">Clasificación</div><div class="v">Confidencial</div></div>
      </div>
    </div>
  </section>`;

  const execPage = `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ 01 / Resumen Ejecutivo</span><span class="bar"></span></div>
      <h2 class="sec-title">Síntesis del <span class="accent">operador</span></h2>
      <div style="display:grid; grid-template-columns: 2.2fr 1fr; gap: 40px;">
        <div class="body">${paragraphs(d.executive_summary || "", "dropcap")}</div>
        <div style="display:flex; flex-direction:column; gap: 14px;">
          ${(d.kpis || []).slice(0, 4).map((k: any) => `
            <div class="kpi">
              <div class="lbl">${esc(k.label)}</div>
              <div class="val">${esc(k.value)}${k.unit ? ` <span style="font-size:13pt; color:var(--ink-500); font-family:var(--sans); font-weight:500;">${esc(k.unit)}</span>` : ""}</div>
              <div class="sub">${esc(k.caption || "")}</div>
            </div>`).join("")}
        </div>
      </div>
      ${(d.recommendations || [])[0] ? `
        <div class="reco-banner">
          <div class="tag">Recomendación<br/>comercial</div>
          <div class="text">${esc(d.recommendations[0].action)} <strong>${esc(d.recommendations[0].rationale)}</strong></div>
        </div>` : ""}
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, 2)}</div>
  </section>`;

  const profilePage = `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ 02 / Perfil Corporativo</span><span class="bar"></span></div>
      <h2 class="sec-title">Ficha de <span class="accent">identidad</span></h2>
      <div class="perfil-grid">
        <div>${profileItems.slice(0, half).map((it: any) => `
          <div class="kv-row"><div class="k">${esc(it.term)}</div><div class="v">${esc(it.definition)}</div></div>`).join("")}</div>
        <div>${profileItems.slice(half).map((it: any) => `
          <div class="kv-row"><div class="k">${esc(it.term)}</div><div class="v">${esc(it.definition)}</div></div>`).join("")}</div>
      </div>
      <div style="margin-top: 36px;">
        <div class="sec-mark"><span class="num">§ 02.1 / Histórico de operaciones</span><span class="bar"></span></div>
        ${renderTable(d.history_table)}
      </div>
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, 3)}</div>
  </section>`;

  const palancasPage = `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ 03 / Palancas de Negociación</span><span class="bar"></span></div>
      <h2 class="sec-title">Puntos de <span class="accent">presión</span> y contrapartidas</h2>
      <p class="lead" style="max-width:640px; margin-bottom: 24px;">Factores accionables identificados. Jerarquizados por impacto sobre el NPV del contrato.</p>
      <div class="palancas">
        ${(d.negotiation_levers || []).slice(0, 6).map((p: any, i: number) => `
          <div class="palanca">
            <div class="idx">${String(i + 1).padStart(2, "0")}</div>
            <div>
              <h4>${esc(p.title)}</h4>
              <p>${esc(p.body)}</p>
            </div>
          </div>`).join("")}
      </div>
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, 4)}</div>
  </section>`;

  const sevMap: Record<string, string> = { high: "red", medium: "amber", low: "green", critical: "red", warning: "amber", info: "blue" };
  const sevLabel: Record<string, string> = { high: "Alto", medium: "Medio", low: "Bajo", critical: "Crítico", warning: "Medio", info: "Bajo" };

  const riesgosRecosPage = `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ 04 / Riesgos &amp; Recomendaciones</span><span class="bar"></span></div>
      <h2 class="sec-title">Exposición y <span class="accent">decisión</span></h2>

      <div style="margin-bottom: 28px;">
        ${(d.risks || []).slice(0, 5).map((r: any) => {
          const sevKey = (r.severity || "medium").toLowerCase();
          return `
          <div class="riesgo">
            <div class="sev">
              <span class="pill ${sevMap[sevKey] || "amber"}"><span class="dot"></span>${esc(sevLabel[sevKey] || "Medio")}</span>
            </div>
            <div>
              <h4>${esc(r.title)}</h4>
              <p>${esc(r.body)}</p>
            </div>
            <div class="impact">Severidad<br/><strong>${esc(sevLabel[sevKey] || "Medio")}</strong></div>
          </div>`;
        }).join("")}
      </div>

      <div class="sec-mark"><span class="num">§ 05 / Recomendaciones priorizadas</span><span class="bar"></span></div>
      <div>
        ${(d.recommendations || []).slice(0, 5).map((r: any, i: number) => `
          <div class="reco">
            <div class="rnum">${String(i + 1).padStart(2, "0")}</div>
            <div><span class="pill ${r.priority === 'alta' ? 'red' : r.priority === 'media' ? 'amber' : 'green'}"><span class="dot"></span>${esc(r.priority)}</span></div>
            <div>
              <h4>${esc(r.action)}</h4>
              <p>${esc(r.rationale)}</p>
            </div>
          </div>`).join("")}
      </div>

      ${(d.appendix?.sources?.length) ? `
        <div class="sources">
          <h4>Fuentes &amp; referencias</h4>
          <ol>${(d.appendix.sources || []).map((s: string) => `<li>${esc(s)}</li>`).join("")}</ol>
        </div>` : ""}
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, 5)}</div>
  </section>`;

  return `<div class="doc-a4">${coverPage}${execPage}${profilePage}${palancasPage}${riesgosRecosPage}</div>`;
}

function renderTable(t: any): string {
  if (!t || !t.headers || !t.rows) return "";
  return `<table class="tbl compact zebra">
    <thead><tr>${t.headers.map((h: string) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${(t.rows || []).map((r: string[]) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'strong' : ''}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

// ════════════════════════════════════════════════════════════════════
// 02 · PRESENTACIÓN COMERCIAL  (Deck 16:9 · 6 slides)
// ════════════════════════════════════════════════════════════════════

function renderPresentacion(d: any, modeLabel: string, date: string, heroImg?: string): string {
  const cover = d.cover || {};
  const asset = d.asset || {};
  const ref = d.refCode || refCode("TC", new Date().getFullYear().toString());
  const total = 6;

  const slideHdr = (title: string) => `
    <div class="s-hdr">
      <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
      <div>${esc(title)}</div>
    </div>`;
  const slideFtr = (n: number) => `
    <div class="s-ftr"><span>Mirmidons Retail · Documento confidencial</span><span class="pg">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>`;

  const coverSlide = `
  <section class="slide cover-slide">
    ${slideHdr(`Presentación Comercial · ${date}`)}
    <div style="position: relative; z-index: 2; padding: 80px 0 40px;">
      <div class="eyebrow-xl" style="color: var(--gold-500);">Teaser · activo retail</div>
      <h1 class="slide-display" style="margin-top: 24px;">${esc(cover.title || asset.name || "[Activo]")}<br/><em>— ${esc(cover.tagline || "oportunidad")}</em></h1>
      <div class="slide-lede">${esc(cover.subtitle || "Activo retail con tenant mix contrastado y demanda demostrada.")}</div>
    </div>
    ${heroImg ? `<div style="position:absolute; top:0; right:0; width:50%; height:100%; background: url('${heroImg}') center/cover; opacity: 0.35;"></div>` : ""}
    <div style="position: relative; z-index: 2;">
      <div class="meta-strip">
        <div><div class="k">Ubicación</div><div class="v">${esc(asset.city || "[Ciudad]")}</div></div>
        <div><div class="k">GLA total</div><div class="v">${esc(asset.gla || "[m²]")}</div></div>
        <div><div class="k">Tipología</div><div class="v">${esc(asset.typology || "Centro comercial")}</div></div>
        <div><div class="k">Emisión</div><div class="v">${esc(date)}</div></div>
      </div>
    </div>
    ${slideFtr(1)}
  </section>`;

  const execSlide = `
  <section class="slide">
    ${slideHdr(`Presentación Comercial · ${esc(asset.name || cover.title || "")}`)}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 01 · Resumen ejecutivo</div>
      <h2 class="slide-sec" style="margin-top: 12px;">La <em>oportunidad</em> en cifras</h2>
    </div>
    <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap: 56px; margin-top: 36px; height: 380px;">
      <div style="font-size: 14px; line-height: 1.6; color: var(--ink-700);">${paragraphs(d.executive_summary || "", "dropcap")}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-content: start;">
        ${(d.kpis || []).slice(0, 4).map((k: any) => `
          <div class="stat-xl">
            <div class="lbl">${esc(k.label)}</div>
            <div class="val">${esc(k.value)}</div>
            <div class="sub">${esc(k.caption || "")}</div>
          </div>`).join("")}
      </div>
    </div>
    ${slideFtr(2)}
  </section>`;

  const colors = ["#0B1E3F", "#B8924A", "#23406E", "#C9A961", "#8A6E38", "#DDD2BA"];
  const mix = d.tenant_mix || [];
  const totalShare = mix.reduce((a: number, m: any) => a + (Number(m.share_pct) || 0), 0) || 100;

  const mixSlide = `
  <section class="slide">
    ${slideHdr(`Presentación Comercial · ${esc(asset.name || "")}`)}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 02 · Tenant Mix</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Composición <em>propuesta</em></h2>
    </div>
    <div style="display:grid; grid-template-columns: 1.1fr 1.4fr; gap: 56px; margin-top: 36px;">
      <div style="display: flex; flex-direction: column; gap: 0;">
        ${mix.slice(0, 8).map((m: any, i: number) => {
          const pct = ((Number(m.share_pct) || 0) / totalShare * 100);
          return `
          <div style="display: grid; grid-template-columns: 30px 1fr 80px 50px; align-items:center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--ink-100); font-size: 13px;">
            <div style="font-family: var(--mono); font-size: 11px; color: var(--gold-700); font-weight: 600;">${String(i + 1).padStart(2, "0")}</div>
            <div>
              <div style="color: var(--navy-900); font-weight: 600; font-size: 14px;">${esc(m.sector)}</div>
              <div style="font-family: var(--mono); font-size: 9px; color: var(--ink-400); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px;">${esc(m.brands)}</div>
            </div>
            <div style="position: relative; height: 7px; background: var(--ink-050);">
              <div style="position: absolute; inset: 0 auto 0 0; background: ${colors[i % colors.length]}; width: ${Math.min(pct * 2, 100)}%;"></div>
            </div>
            <div style="text-align: right; font-family: var(--mono); color: var(--navy-900); font-weight: 600; font-size: 12px;">${pct.toFixed(0)}%</div>
          </div>`;
        }).join("")}
      </div>
      <div style="background: var(--bone-100); padding: 32px; border-left: 1px solid var(--ink-100);">
        <div style="font-family: var(--sans); font-weight: 700; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--navy-900); margin-bottom: 20px;">Distribución por categoría</div>
        ${renderDonutSvg(mix, colors)}
      </div>
    </div>
    ${slideFtr(3)}
  </section>`;

  const projSlide = `
  <section class="slide">
    ${slideHdr(`Presentación Comercial · ${esc(asset.name || "")}`)}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 03 · Proyecciones financieras</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Plan a <em>5 años</em></h2>
    </div>
    <div style="margin-top: 36px;">${renderTable(d.financial_projection)}</div>
    <div style="margin-top: 28px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
      ${(d.highlights || []).slice(0, 4).map((h: any) => `
        <div style="background: var(--bone-100); padding: 18px 22px; border-left: 3px solid var(--gold-600);">
          <div class="eyebrow" style="font-size: 9px; letter-spacing: 0.18em; margin-bottom: 6px;">${esc(h.icon || "·")}</div>
          <div style="font-family: var(--serif); font-weight: 500; font-size: 18pt; color: var(--navy-900); margin-bottom: 6px; line-height: 1.15;">${esc(h.title)}</div>
          <div style="font-size: 11px; line-height: 1.5; color: var(--ink-700);">${esc(h.body)}</div>
        </div>`).join("")}
    </div>
    ${slideFtr(4)}
  </section>`;

  const marketSlide = `
  <section class="slide">
    ${slideHdr(`Presentación Comercial · ${esc(asset.name || "")}`)}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 04 · ${esc(d.market_section?.title || "Mercado")}</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Cuenca de <em>oportunidad</em></h2>
    </div>
    <div style="margin-top: 36px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 56px;">
      <div style="font-size: 14px; line-height: 1.6; color: var(--ink-700);">${paragraphs(d.market_section?.body || "")}</div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${(d.kpis || []).slice(0, 3).map((k: any) => `
          <div class="stat-xl">
            <div class="lbl">${esc(k.label)}</div>
            <div class="val">${esc(k.value)}</div>
            <div class="sub">${esc(k.caption || "")}</div>
          </div>`).join("")}
      </div>
    </div>
    ${slideFtr(5)}
  </section>`;

  const closeSlide = `
  <section class="slide close-slide">
    ${slideHdr(`Presentación Comercial · ${esc(asset.name || "")}`)}
    <div class="eyebrow-xl" style="color: var(--gold-500); padding-top: 60px;">Próximos pasos</div>
    <h1 class="slide-display" style="margin-top: 20px;">Conversemos sobre<br/><em>el encaje.</em></h1>
    <div style="font-family: var(--serif); font-style: italic; font-size: 16pt; color: rgba(244,239,230,0.7); max-width: 900px; margin-top: 28px;">${esc((d.next_steps || []).map((s: any) => s.title).slice(0, 3).join(" · ") || "Material complementario disponible bajo NDA.")}</div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 56px; padding-top: 28px; border-top: 1px solid rgba(184,146,74,0.3);">
      <div><div style="font-family: var(--mono); font-size: 10px; color: var(--gold-500); letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; margin-bottom: 10px;">Contacto</div><div style="font-family: var(--serif); font-size: 18pt; color: var(--bone-100);">${esc(d.contact_block?.name || "—")}</div><div style="font-family: var(--mono); font-size: 11px; color: rgba(244,239,230,0.85); margin-top: 4px;">${esc(d.contact_block?.role || "")}</div></div>
      <div><div style="font-family: var(--mono); font-size: 10px; color: var(--gold-500); letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; margin-bottom: 10px;">Teléfono</div><div style="font-family: var(--mono); font-size: 13px; color: var(--bone-100);">${esc(d.contact_block?.phone || "")}</div></div>
      <div><div style="font-family: var(--mono); font-size: 10px; color: var(--gold-500); letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; margin-bottom: 10px;">Email</div><div style="font-family: var(--mono); font-size: 13px; color: var(--bone-100);">${esc(d.contact_block?.email || "")}</div></div>
    </div>
    ${slideFtr(6)}
  </section>`;

  return `<div class="deck-wrap"><div class="deck-stage">${coverSlide}${execSlide}${mixSlide}${projSlide}${marketSlide}${closeSlide}</div></div>`;
}

function renderDonutSvg(mix: any[], colors: string[]): string {
  const total = mix.reduce((a, m) => a + (Number(m.share_pct) || 0), 0) || 100;
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = mix.slice(0, 6).map((m: any, i: number) => {
    const pct = (Number(m.share_pct) || 0) / total;
    const len = pct * c;
    const arc = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="32" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 100 100)"/>`;
    offset += len;
    return arc;
  }).join("");

  const legend = mix.slice(0, 6).map((m: any, i: number) => `
    <div style="display: grid; grid-template-columns: 14px 1fr 50px; gap: 10px; align-items: center; font-size: 11px; padding: 6px 0; border-bottom: 1px solid var(--ink-100);">
      <span style="width:14px; height:14px; background:${colors[i % colors.length]};"></span>
      <span style="color: var(--navy-900); font-weight: 500;">${esc(m.sector)}</span>
      <span style="font-family: var(--mono); color: var(--navy-900); font-weight: 600; font-size: 11px; text-align: right;">${((Number(m.share_pct) || 0) / total * 100).toFixed(0)}%</span>
    </div>`).join("");

  return `<div style="display: flex; gap: 28px; align-items: center;">
    <svg viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="${r}" fill="none" stroke="#F4EFE6" stroke-width="32"/>
      ${arcs}
      <text x="100" y="98" text-anchor="middle" font-family="Playfair Display" font-size="18" fill="#0B1E3F" font-weight="500">${mix.length}</text>
      <text x="100" y="114" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#8A8A8A" letter-spacing="2">SECTORES</text>
    </svg>
    <div style="flex: 1;">${legend}</div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 03 · BORRADOR CONTRATO  (A4 vertical · 5 páginas)
// ════════════════════════════════════════════════════════════════════

function renderContrato(d: any, modeLabel: string, date: string): string {
  const cover = d.cover || {};
  const partes = d.partes || {};
  const ar = partes.arrendador || {};
  const at = partes.arrendatario || {};
  const ref = d.refCode || refCode("BC", new Date().getFullYear().toString());
  const refShort = ref.replace(/ · /g, "-");
  const total = 5;

  const coverPage = `
  <section class="page cover bone-cover">
    <div class="page-body">
      <div class="brand-line">
        <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
        <div>Borrador · Uso jurídico · Confidencial</div>
      </div>
      <div>
        <div class="t-eyebrow" style="color: var(--gold-700);">Borrador de contrato · arrendamiento</div>
        <h1 class="cover-h1" style="margin-top: 24px;">${esc(cover.title || "Contrato de arrendamiento")}<br/><em>— ${esc(cover.tagline || "uso distinto de vivienda")}</em></h1>
        <div class="lede" style="margin-top: 28px; color: var(--ink-700);">${esc(cover.subtitle || "Documento sujeto a revisión jurídica de ambas partes.")}</div>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 40px 1fr; gap: 20px; margin-top: 24px; align-items:stretch;">
        <div style="padding: 20px; border: 1px solid var(--ink-200); background: var(--paper);">
          <div style="font-family: var(--mono); font-size: 8pt; letter-spacing: 0.2em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-bottom: 10px;">Arrendador</div>
          <div style="font-family: var(--serif); font-weight: 500; font-size: 15pt; line-height: 1.1; color: var(--navy-900);">${esc(ar.nombre || "[Sociedad Propietaria]")}</div>
          <div style="font-family: var(--mono); font-size: 8.5pt; color: var(--ink-500); margin-top: 8px; line-height: 1.5;">CIF · ${esc(ar.nif || "[—]")}<br/>Domicilio · ${esc(ar.domicilio || "[—]")}<br/>Representante · ${esc(ar.representante || "[—]")}</div>
        </div>
        <div style="display:flex; align-items:center; justify-content:center; font-family: var(--serif); font-size: 24pt; color: var(--gold-600); font-style: italic;">&amp;</div>
        <div style="padding: 20px; border: 1px solid var(--ink-200); background: var(--paper);">
          <div style="font-family: var(--mono); font-size: 8pt; letter-spacing: 0.2em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-bottom: 10px;">Arrendatario</div>
          <div style="font-family: var(--serif); font-weight: 500; font-size: 15pt; line-height: 1.1; color: var(--navy-900);">${esc(at.nombre || "[Operador]")}</div>
          <div style="font-family: var(--mono); font-size: 8.5pt; color: var(--ink-500); margin-top: 8px; line-height: 1.5;">CIF · ${esc(at.nif || "[—]")}<br/>Domicilio · ${esc(at.domicilio || "[—]")}<br/>Representante · ${esc(at.representante || "[—]")}</div>
        </div>
      </div>
      <div class="footer-meta" style="border-top: 1px solid var(--ink-200);">
        <div><div class="k">Fecha</div><div class="v">${esc(date)}</div></div>
        <div><div class="k">Referencia</div><div class="v" style="font-family: var(--mono); font-size: 9pt;">${esc(refShort)}</div></div>
        <div><div class="k">Cláusulas</div><div class="v">${(d.clausulas || []).length}</div></div>
        <div><div class="k">Anexos</div><div class="v">${(d.anexos || []).length}</div></div>
      </div>
    </div>
  </section>`;

  // Group clauses across pages: ~5 cláusulas por página
  const clauses = d.clausulas || [];
  const groups: any[][] = [];
  for (let i = 0; i < clauses.length; i += 5) groups.push(clauses.slice(i, i + 5));
  if (groups.length === 0) groups.push([]);

  // Page 2: Reunidos / Exponen
  const exponePage = `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ I / Reunidos</span><span class="bar"></span></div>
      <h2 class="sec-title">Reunidos &amp; <span class="accent">exponen</span></h2>
      <p class="body" style="font-size: 9.5pt; line-height: 1.65;">En el lugar y la fecha indicados, comparecen <strong>${esc(ar.nombre || "[ARRENDADOR]")}</strong> (en lo sucesivo, el «Arrendador»), y <strong>${esc(at.nombre || "[ARRENDATARIO]")}</strong> (en lo sucesivo, el «Arrendatario»).</p>
      <div style="background: var(--bone-100); border-left: 2px solid var(--gold-600); padding: 18px 22px; margin: 18px 0; font-size: 9.5pt; line-height: 1.55; color: var(--ink-700);">
        <strong style="color: var(--navy-900); font-family: var(--sans); font-weight: 700; letter-spacing: 0.08em; font-size: 8pt; text-transform: uppercase;">Ambas partes manifiestan</strong><br/><br/>
        ${(d.expone || []).map((e: string, i: number) => `<strong>${["I", "II", "III", "IV", "V", "VI", "VII"][i] || (i + 1)}.</strong> ${esc(e)}<br/><br/>`).join("")}
      </div>
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, 2)}</div>
  </section>`;

  const clausulasPages = groups.map((group, gi) => `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ ${["II", "III", "IV", "V", "VI"][gi] || (gi + 2)} / Cláusulas</span><span class="bar"></span></div>
      <h2 class="sec-title">${gi === 0 ? `Cláusulas` : `Cláusulas <span class="accent">(cont.)</span>`}</h2>
      ${group.map((cl: any) => `
        <div style="margin-bottom: 18px; page-break-inside: avoid;">
          <div style="font-family: var(--sans); font-weight: 700; font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; color: var(--navy-900); margin-bottom: 8px; display: flex; align-items: baseline; gap: 10px;">
            <span style="font-family: var(--mono); color: var(--gold-600); font-weight: 500;">CLÁUSULA ${esc(cl.numero)}</span>
            <span>·</span>
            <span>${esc(cl.titulo)}</span>
          </div>
          ${(cl.apartados || []).map((ap: any) => `
            <p style="margin: 0 0 8px; font-size: 9.5pt; line-height: 1.6; color: var(--ink-700); text-align: justify;">
              <strong style="color: var(--navy-900);">${esc(ap.letra)}</strong> ${esc(ap.texto)}
            </p>`).join("")}
        </div>`).join("")}
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, gi + 3)}</div>
  </section>`).join("");

  const firmaPage = `
  <section class="page">
    ${buildHdr(refShort)}
    <div class="page-body">
      <div class="sec-mark"><span class="num">§ Final / Firma</span><span class="bar"></span></div>
      <h2 class="sec-title">Y en prueba <span class="accent">de conformidad</span></h2>
      <p class="body" style="font-size: 10pt; line-height: 1.65; color: var(--ink-700); max-width: 620px;">Las partes firman el presente contrato por duplicado ejemplar y a un solo efecto, en el lugar y fecha indicados en el encabezamiento.</p>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px;">
        <div style="border-top: 1.5px solid var(--navy-900); padding-top: 14px;">
          <div style="font-family: var(--mono); font-size: 8pt; letter-spacing: 0.18em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Por el arrendador</div>
          <div style="font-family: var(--serif); font-size: 13pt; color: var(--navy-900); margin-bottom: 6px;">${esc(ar.representante || "[Nombre Apellidos]")}</div>
          <div style="font-size: 8.5pt; color: var(--ink-500); margin-bottom: 40px; line-height: 1.4;">En representación de<br/>${esc(ar.nombre || "[Sociedad]")}</div>
          <div style="border-bottom: 1px solid var(--ink-300); margin-bottom: 6px; height: 1px;">&nbsp;</div>
          <div style="font-family: var(--mono); font-size: 7.5pt; letter-spacing: 0.14em; color: var(--ink-400); text-transform: uppercase;">Firma &amp; sello</div>
        </div>
        <div style="border-top: 1.5px solid var(--navy-900); padding-top: 14px;">
          <div style="font-family: var(--mono); font-size: 8pt; letter-spacing: 0.18em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">Por el arrendatario</div>
          <div style="font-family: var(--serif); font-size: 13pt; color: var(--navy-900); margin-bottom: 6px;">${esc(at.representante || "[Nombre Apellidos]")}</div>
          <div style="font-size: 8.5pt; color: var(--ink-500); margin-bottom: 40px; line-height: 1.4;">En representación de<br/>${esc(at.nombre || "[Operador]")}</div>
          <div style="border-bottom: 1px solid var(--ink-300); margin-bottom: 6px; height: 1px;">&nbsp;</div>
          <div style="font-family: var(--mono); font-size: 7.5pt; letter-spacing: 0.14em; color: var(--ink-400); text-transform: uppercase;">Firma &amp; sello</div>
        </div>
      </div>

      ${(d.anexos && d.anexos.length) ? `
        <div style="margin-top: 36px; padding-top: 18px; border-top: 1.5px solid var(--navy-900);">
          <div style="font-family: var(--mono); font-size: 8pt; letter-spacing: 0.18em; color: var(--gold-700); text-transform: uppercase; font-weight: 600; margin-bottom: 12px;">Anexos que forman parte inseparable del contrato</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 36px; font-size: 9pt;">
            ${(d.anexos || []).map((a: any, i: number) => `<div><span style="display: inline-block; font-family: var(--mono); font-size: 7.5pt; letter-spacing: 0.12em; color: var(--gold-700); background: var(--gold-050); padding: 2px 6px; text-transform: uppercase; font-weight: 600;">Anexo ${i + 1}</span> &nbsp; ${esc(a.titulo)} — <em style="color: var(--ink-500);">${esc(a.descripcion)}</em></div>`).join("")}
          </div>
        </div>` : ""}

      <div style="margin-top: 24px; padding: 14px 18px; background: var(--bone-100); border-left: 2px solid var(--gold-600); font-size: 9pt; color: var(--ink-700); line-height: 1.5;">
        ${esc(d.footer_disclaimer || "El presente documento constituye un BORRADOR ORIENTATIVO. No tiene carácter vinculante hasta su revisión por asesoría jurídica y firma de las partes.")}
      </div>
    </div>
    <div class="ftr">${nav("Mirmidons Retail · Documento confidencial", total, total)}</div>
  </section>`;

  return `<div class="doc-a4">${coverPage}${exponePage}${clausulasPages}${firmaPage}</div>`;
}

// ════════════════════════════════════════════════════════════════════
// 04 · PLAN ESTRATÉGICO (Deck 16:9 · 7 slides)
// ════════════════════════════════════════════════════════════════════

function renderPlan(d: any, modeLabel: string, date: string): string {
  const cover = d.cover || {};
  const ref = d.refCode || refCode("PE", new Date().getFullYear().toString());
  const total = 7;

  const slideHdr = (title: string) => `
    <div class="s-hdr">
      <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
      <div>${esc(title)}</div>
    </div>`;
  const slideFtr = (n: number) => `
    <div class="s-ftr"><span>Confidencial · Mirmidons Retail</span><span class="pg">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>`;

  const coverSlide = `
  <section class="slide cover-slide">
    ${slideHdr(`Plan estratégico · ${date}`)}
    <div style="padding-top: 60px;">
      <div class="eyebrow-xl" style="color: var(--gold-500);">Plan estratégico · horizonte 24 meses</div>
      <h1 class="slide-display" style="margin-top: 20px;">${esc(cover.title || "Plan estratégico")}<br/><em>${esc(cover.tagline || "")}</em></h1>
      <div class="slide-lede">${esc(cover.subtitle || "Diagnóstico, pilares de actuación, hoja de ruta y modelo financiero.")}</div>
    </div>
    <div class="meta-strip">
      <div><div class="k">Cliente</div><div class="v">[Propietario]</div></div>
      <div><div class="k">Horizonte</div><div class="v">24 meses</div></div>
      <div><div class="k">Iniciativas</div><div class="v">${(d.iniciativas || []).length}</div></div>
      <div><div class="k">Emisión</div><div class="v">${esc(date)}</div></div>
    </div>
    ${slideFtr(1)}
  </section>`;

  const execSlide = `
  <section class="slide">
    ${slideHdr("Plan estratégico")}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 01 · Resumen ejecutivo</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Visión &amp; <em>ambición</em></h2>
    </div>
    <div style="margin-top: 36px; display: grid; grid-template-columns: 1.3fr 1fr; gap: 56px; height: 380px;">
      <div style="font-size: 14px; line-height: 1.6; color: var(--ink-700);">${paragraphs(d.executive_summary || "", "dropcap")}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-content: start;">
        ${(d.diagnostico_kpis || []).slice(0, 4).map((k: any) => `
          <div class="stat-xl">
            <div class="lbl">${esc(k.label)}</div>
            <div class="val" style="font-size: 32pt;">${esc(k.value)}</div>
            <div class="sub">${esc(k.caption || "")}</div>
          </div>`).join("")}
      </div>
    </div>
    ${slideFtr(2)}
  </section>`;

  const dafoSlide = `
  <section class="slide">
    ${slideHdr("Plan estratégico")}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 02 · DAFO</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Matriz <em>estratégica</em></h2>
    </div>
    <div class="dafo-grid">
      <div class="dafo-cell fort"><div class="head"><h3>Fortalezas</h3><span class="let">F</span></div><ul>${(d.dafo?.fortalezas || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="dafo-cell debi"><div class="head"><h3>Debilidades</h3><span class="let">D</span></div><ul>${(d.dafo?.debilidades || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="dafo-cell opor"><div class="head"><h3>Oportunidades</h3><span class="let">O</span></div><ul>${(d.dafo?.oportunidades || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="dafo-cell amen"><div class="head"><h3>Amenazas</h3><span class="let">A</span></div><ul>${(d.dafo?.amenazas || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    </div>
    ${slideFtr(3)}
  </section>`;

  const objetivosSlide = `
  <section class="slide">
    ${slideHdr("Plan estratégico")}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 03 · Objetivos SMART</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Resultados <em>medibles</em></h2>
    </div>
    <div style="margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      ${(d.objetivos || []).slice(0, 6).map((o: any, i: number) => `
        <div style="background: var(--bone-100); padding: 22px 24px; border-left: 3px solid var(--gold-600);">
          <div style="font-family: var(--mono); font-size: 10px; color: var(--gold-700); letter-spacing: 0.2em; font-weight: 600;">OBJ ${String(i + 1).padStart(2, "0")}</div>
          <div style="font-family: var(--serif); font-size: 18pt; color: var(--navy-900); margin: 10px 0; line-height: 1.15;">${esc(o.titulo)}</div>
          <div style="font-family: var(--mono); font-size: 11px; color: var(--gold-700); margin-bottom: 10px;">${esc(o.kpi_objetivo)}</div>
          <div style="font-size: 12px; line-height: 1.5; color: var(--ink-700);">${esc(o.descripcion)}</div>
        </div>`).join("")}
    </div>
    ${slideFtr(4)}
  </section>`;

  const pillarsSlide = `
  <section class="slide">
    ${slideHdr("Plan estratégico")}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 04 · Pilares estratégicos</div>
      <h2 class="slide-sec" style="margin-top: 12px;">${(d.iniciativas || []).length} <em>palancas</em></h2>
    </div>
    <div class="pillars">
      ${(d.iniciativas || []).slice(0, 4).map((it: any, i: number) => `
        <div class="pillar">
          <div class="n">PILAR ${String(i + 1).padStart(2, "0")}</div>
          <h3>${esc(it.nombre)}</h3>
          <p class="desc">${esc(it.descripcion)}</p>
          <div class="kpis">
            <div class="r"><div class="k">Responsable</div><div class="v">${esc(it.responsable)}</div></div>
            <div class="r"><div class="k">Horizonte</div><div class="v">${esc(it.horizonte)}</div></div>
            <div class="r"><div class="k">Inversión</div><div class="v">${esc(it.inversion_estimada)}</div></div>
          </div>
        </div>`).join("")}
    </div>
    ${slideFtr(5)}
  </section>`;

  const roadmapSlide = `
  <section class="slide">
    ${slideHdr("Plan estratégico")}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 05 · Roadmap</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Hoja <em>de ruta</em></h2>
    </div>
    <div style="margin-top: 32px;">
      <table class="tbl compact zebra" style="font-size: 11pt;">
        <thead><tr><th>Trimestre</th><th>Hito</th><th>Dependencias</th></tr></thead>
        <tbody>
          ${(d.roadmap || []).slice(0, 10).map((r: any) => `
            <tr><td class="strong">${esc(r.trimestre)}</td><td>${esc(r.hito)}</td><td><em style="color: var(--ink-500);">${esc(r.dependencias || "—")}</em></td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${slideFtr(6)}
  </section>`;

  const finSlide = `
  <section class="slide">
    ${slideHdr("Plan estratégico")}
    <div style="margin-top: 56px;">
      <div class="eyebrow-xl">§ 06 · Modelo financiero</div>
      <h2 class="slide-sec" style="margin-top: 12px;">Proyección <em>5 años</em></h2>
    </div>
    <div style="margin-top: 36px; display: grid; grid-template-columns: 1.3fr 1fr; gap: 56px;">
      <div>${renderTable(d.proyeccion_financiera)}</div>
      <div style="background: var(--bone-100); padding: 24px; border-left: 3px solid var(--gold-600);">
        <div class="eyebrow-xl" style="font-size: 11px;">Recomendación al comité</div>
        <div style="font-family: var(--serif); font-size: 17pt; line-height: 1.4; color: var(--navy-900); margin-top: 16px; font-style: italic;">"${esc(d.recomendacion_comite || "")}"</div>
      </div>
    </div>
    ${slideFtr(7)}
  </section>`;

  return `<div class="deck-wrap"><div class="deck-stage">${coverSlide}${execSlide}${dafoSlide}${objetivosSlide}${pillarsSlide}${roadmapSlide}${finSlide}</div></div>`;
}

// ════════════════════════════════════════════════════════════════════
// 05 · INFORME WAR ROOM (dashboard oscuro)
// ════════════════════════════════════════════════════════════════════

function renderWarRoom(d: any, modeLabel: string, date: string): string {
  const cover = d.cover || {};
  const ref = d.refCode || refCode("WR", new Date().getFullYear().toString());

  const sevClassMap: Record<string, string> = { critical: "critical", warning: "warning", info: "info" };

  return `<div class="wr">
    <div class="topbar">
      <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
      <div class="title">War Room <em>· ${esc(cover.subtitle || "control operativo")}</em><span class="sub">${esc(cover.title || "Tablero ejecutivo")} · ${esc(date)}</span></div>
      <div class="live">REF · ${esc(ref.replace(/ · /g, "-"))}</div>
    </div>

    <div class="strip-wr">
      ${(d.kpis_principales || []).slice(0, 4).map((k: any, i: number) => `
        <div class="cell ${i === 0 ? "ok" : i === 2 ? "alert" : ""}">
          <div class="lbl">${esc(k.label)}</div>
          <div class="val">${esc(k.value)}${k.unit ? ` ${esc(k.unit)}` : ""}</div>
          <div class="sub">${esc(k.caption || "")}</div>
        </div>`).join("")}
    </div>

    <div class="panel">
      <div class="phead">
        <div class="pname">§ 01 · Resumen ejecutivo</div>
        <div class="pmeta">${esc(date)}</div>
      </div>
      <div style="font-size: 12px; line-height: 1.6; color: var(--wr-ink);">
        ${(d.resumen_ejecutivo || "").split(/\n\n+/).map((p: string) => `<p style="margin: 0 0 10px;">${esc(p)}</p>`).join("")}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px;">
      <div class="panel">
        <div class="phead">
          <div class="pname">§ 02 · Operaciones activas</div>
          <div class="pmeta">${(d.operaciones_activas?.rows || []).length} ops</div>
        </div>
        <table>
          <thead><tr>${(d.operaciones_activas?.headers || []).map((h: string) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${(d.operaciones_activas?.rows || []).slice(0, 12).map((r: string[]) => `<tr>${r.map((c, i) => `<td class="${i >= r.length - 2 ? 'num' : ''}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>

      <div class="panel">
        <div class="phead">
          <div class="pname">§ 03 · Cuadro de mando</div>
          <div class="pmeta">${(d.semaforos || []).length} indicadores</div>
        </div>
        <div class="semaforo-grid">
          ${(d.semaforos || []).slice(0, 8).map((s: any) => `
            <div class="semaforo-row">
              <div class="dot-sem ${esc(s.estado)}"></div>
              <div><strong>${esc(s.nombre)}</strong><span>${esc(s.comentario)}</span></div>
            </div>`).join("")}
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px;">
      <div class="phead">
        <div class="pname">§ 04 · Alertas operativas</div>
        <div class="pmeta">${(d.alertas || []).length} alertas</div>
      </div>
      ${(d.alertas || []).map((a: any) => `
        <div class="alert-row ${sevClassMap[a.severity] || "warning"}">
          <div class="msg"><strong>${esc(a.title)}</strong> — ${esc(a.body)} <em style="color: var(--wr-ink-dim); display: block; margin-top: 4px; font-size: 10px;">Owner: ${esc(a.owner)} · Due: ${esc(a.due_date)}</em></div>
          <div class="sev ${esc(a.severity)}">${esc(a.severity)}</div>
        </div>`).join("")}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
      <div class="panel">
        <div class="phead"><div class="pname">§ 05 · Oportunidades detectadas</div><div class="pmeta">${(d.oportunidades || []).length}</div></div>
        ${(d.oportunidades || []).map((o: any) => `
          <div class="alert-row info"><div class="msg"><strong>${esc(o.title)}</strong> — ${esc(o.body)}</div><div class="sev info">OPP</div></div>`).join("")}
      </div>
      <div class="panel">
        <div class="phead"><div class="pname">§ 06 · Decisiones pendientes</div><div class="pmeta">${(d.decisiones_pendientes || []).length}</div></div>
        ${(d.decisiones_pendientes || []).map((dec: any) => `
          <div class="alert-row warning">
            <div class="msg">
              <strong>${esc(dec.tema)}</strong>
              <em style="color: var(--wr-ink-dim); display: block; margin-top: 4px; font-size: 10px;">Recomendación: ${esc(dec.recomendacion)} · Deadline: ${esc(dec.deadline)}</em>
            </div>
            <div class="sev warning">P2</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="panel" style="margin-top: 12px;">
      <div class="phead"><div class="pname">§ 07 · Próximas acciones</div><div class="pmeta">${(d.proximas_acciones || []).length} acciones</div></div>
      <table>
        <thead><tr><th>Acción</th><th>Owner</th><th>Fecha</th></tr></thead>
        <tbody>${(d.proximas_acciones || []).map((a: any) => `<tr><td>${esc(a.accion)}</td><td>${esc(a.owner)}</td><td class="num">${esc(a.fecha)}</td></tr>`).join("")}</tbody>
      </table>
    </div>

    <div class="wrfooter">
      <span>Mirmidons Retail · War Room · uso interno</span>
      <span style="color: var(--wr-gold);">★ Clasificación · Restringido</span>
      <span>Motor · AVA · ${esc(date)}</span>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 06 · EMAIL · 3 variantes (teaser / negociacion / cierre)
// ════════════════════════════════════════════════════════════════════

function renderEmail(d: any, modeLabel: string, date: string): string {
  const variant = d.emailVariant || d.variant || "teaser"; // teaser | negociacion | cierre
  const ref = d.refCode || refCode(variant === "cierre" ? "CL" : variant === "negociacion" ? "NG" : "AP", new Date().getFullYear().toString());
  const sig = d.signature || {};
  const variantMeta: Record<string, { tag: string; tagCls: string; label: string }> = {
    teaser: { tag: "Prioridad normal", tagCls: "", label: "Apertura comercial" },
    negociacion: { tag: "Acción requerida · 72h", tagCls: "red", label: "Contrapropuesta" },
    cierre: { tag: "Confirmación", tagCls: "", label: "Confirmación de firma" },
  };
  const meta = variantMeta[variant] || variantMeta.teaser;

  return `<div class="email-stack">
    <div class="email-card">
      <div class="email-head">
        <div class="brand"><span class="mk"></span><span>Mirmidons · Retail</span></div>
        <div class="meta">${esc(ref.replace(/ · /g, "-"))} · ${esc(meta.label)}</div>
      </div>
      <div class="envelope">
        <div class="k">De</div><div class="v"><strong>${esc(sig.name || "[Remitente]")}</strong> &lt;${esc(sig.email || "[email]")}&gt;</div><div></div>
        <div class="k">Para</div><div class="v"><strong>[Destinatario]</strong></div><div></div>
        <div class="k">Fecha</div><div class="v" style="font-family: var(--mono);">${esc(date)}</div><div><span class="tag ${meta.tagCls}">${esc(meta.tag)}</span></div>
      </div>
      <div class="subject-block">
        <div class="ref">Asunto · ${esc(ref.replace(/ · /g, "-"))}</div>
        <h1>${esc(d.subject || "[Asunto del email]")}</h1>
      </div>
      <div class="email-body">
        <p class="lead-mail">${esc(d.greeting || "Estimado/a [Nombre],")} ${esc((d.body_paragraphs || [""])[0] || "")}</p>
        ${(d.body_paragraphs || []).slice(1).map((p: string) => `<p>${esc(p)}</p>`).join("")}

        ${variant === "negociacion" && d.preheader ? `
          <div class="pullbox">
            <div class="lbl">Punto<br/>clave</div>
            <div class="txt">${esc(d.preheader)}</div>
          </div>` : ""}

        <div class="cta-row">
          <a href="#" class="btn-primary">${variant === "cierre" ? "Acceder al contrato" : variant === "negociacion" ? "Programar call" : "Agendar visita"} →</a>
        </div>

        <div class="email-signature">
          <div class="avatar">MR</div>
          <div class="info">
            <div class="name">${esc(sig.name || "[Nombre]")}</div>
            <div class="role">${esc(sig.role || "")} · ${esc(sig.company || "Mirmidons Retail")}</div>
            <div class="contact"><strong>Mirmidons Retail</strong><br/>T · ${esc(sig.phone || "")}<br/>${esc(sig.email || "")}</div>
          </div>
        </div>

        <div class="disclaimer">
          Este mensaje y sus anexos contienen información confidencial. Si no es el destinatario legítimo, por favor notifique al remitente y elimínelo. Mirmidons Retail trata datos conforme al RGPD (UE) 2016/679.
        </div>
      </div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// MASTER RENDERER
// ════════════════════════════════════════════════════════════════════

function renderTemplate(mode: ForgeMode, data: any, modeLabel: string, date: string, heroImage?: string): string {
  switch (mode) {
    case "dossier_operador": return renderDossier(data, modeLabel, date);
    case "presentacion_comercial": return renderPresentacion(data, modeLabel, date, heroImage);
    case "borrador_contrato": return renderContrato(data, modeLabel, date);
    case "plan_estrategico": return renderPlan(data, modeLabel, date);
    case "informe_war_room": return renderWarRoom(data, modeLabel, date);
    case "email_comunicacion": return renderEmail(data, modeLabel, date);
    default: return `<div class="page"><div class="page-body"><h2 class="sec-title">Modo no soportado</h2></div></div>`;
  }
}

function buildHtmlDocument(mode: ForgeMode, data: any, modeLabel: string, heroImage?: string, forPrint = false): string {
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const body = renderTemplate(mode, data, modeLabel, date, heroImage);

  // Force page orientation/size at CSS level (html2pdf.app honours @page)
  const isDeck = mode === "presentacion_comercial" || mode === "plan_estrategico" || mode === "informe_war_room";
  const pageCss = forPrint
    ? (isDeck
      ? `@page { size: A4 landscape; margin: 0; }
         .slide { width: 100% !important; height: 100vh !important; box-shadow: none !important; margin: 0 !important; padding: 32px 48px !important; page-break-after: always; }
         .deck-wrap { width: 100% !important; padding: 0 !important; background: #fff !important; }
         .deck-stage { gap: 0 !important; }`
      : `@page { size: A4 portrait; margin: 0; }
         .doc-a4 { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; }
         .page { width: 100% !important; min-height: 100vh !important; }`)
    : "";

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(modeLabel)} · Mirmidons Retail</title>
<style>${MIRMIDONS_TOKENS}
${pageCss}</style>
</head>
<body class="${forPrint ? 'print-mode' : ''}">${body}</body></html>`;
}

// ════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, data, mode_label, hero_image, output } = await req.json();

    if (!mode || !data) {
      return new Response(JSON.stringify({ error: "mode and data are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildHtmlDocument(mode, data, mode_label || mode, hero_image, output === "pdf");

    // HTML preview
    if (output === "html" || !output) {
      return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
    }

    // PDF via html2pdf.app
    const HTML2PDF_KEY = Deno.env.get("HTML2PDF_API_KEY");
    if (!HTML2PDF_KEY) {
      return new Response(JSON.stringify({ error: "HTML2PDF_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decks 16:9 (presentacion + plan + war room dashboard) → landscape
    const isDeck = mode === "presentacion_comercial" || mode === "plan_estrategico" || mode === "informe_war_room";
    const isEmail = mode === "email_comunicacion";

    const pdfPayload: any = {
      html,
      apiKey: HTML2PDF_KEY,
      use_print: true,
      // Decks → landscape A4. Email/dossier/contrato → portrait.
      orientation: isDeck ? "landscape" : "portrait",
      page_size: "A4",
      margin_top: isEmail ? "0" : "0",
      margin_bottom: isEmail ? "0" : "0",
      margin_left: isEmail ? "0" : "0",
      margin_right: isEmail ? "0" : "0",
      print_background: true,
      delay: 1500,
    };

    const pdfResp = await fetch("https://api.html2pdf.app/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pdfPayload),
    });

    if (!pdfResp.ok) {
      const err = await pdfResp.text();
      console.error("html2pdf error:", err);
      return new Response(JSON.stringify({ error: `PDF service: ${pdfResp.status} ${err.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBuf = await pdfResp.arrayBuffer();
    return new Response(pdfBuf, {
      headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${mode_label || mode}.pdf"` },
    });
  } catch (e) {
    console.error("generate-pdf-v2 error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
