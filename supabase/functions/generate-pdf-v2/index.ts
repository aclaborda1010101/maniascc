// generate-pdf-v2 — 6 plantillas HTML profesionales por modo
// Recibe JSON estructurado del agente FORGE y produce PDF A4 vía html2pdf.app

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ForgeMode = "dossier_operador" | "presentacion_comercial" | "borrador_contrato" | "plan_estrategico" | "informe_war_room" | "email_comunicacion";

// ════════════════════════════════════════════════════════════════════
// CSS BASE COMPARTIDO
// ════════════════════════════════════════════════════════════════════

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');`;

const BASE_CSS = `
${FONT_IMPORT}
:root {
  --navy: #0A1E3D;
  --navy-deep: #061429;
  --navy-light: #1A3A5C;
  --gold: #B8860B;
  --gold-light: #D4A84B;
  --gold-soft: #F5E9C8;
  --text: #1E293B;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
  --border: #E2E8F0;
  --border-strong: #CBD5E1;
  --bg-subtle: #F8FAFC;
  --bg-warm: #FAF8F2;
  --green: #15803D;
  --amber: #B45309;
  --red: #B91C1C;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--text);
  font-size: 10.5pt;
  line-height: 1.65;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.serif { font-family: 'Playfair Display', Georgia, serif; }
.mono { font-family: 'JetBrains Mono', monospace; }

/* ═══ COVER UNIVERSAL ═══ */
.cover {
  page-break-after: always;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28mm 22mm;
}
.cover-rule-top { height: 6px; background: var(--navy); margin: -28mm -22mm 0; }
.cover-rule-gold { width: 60px; height: 3px; background: var(--gold); margin: 32px 0 24px; }
.cover-brand {
  margin-top: 36px;
  font-size: 9.5pt;
  font-weight: 700;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: var(--navy);
}
.cover-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 30pt;
  font-weight: 700;
  line-height: 1.15;
  color: var(--navy);
  margin-top: auto;
}
.cover-subtitle {
  font-size: 13pt;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 18px;
  max-width: 80%;
}
.cover-tagline {
  margin-top: 24px;
  font-size: 10pt;
  font-style: italic;
  color: var(--text-muted);
  max-width: 70%;
}
.cover-meta {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-top: 36px;
  border-top: 1px solid var(--border);
}
.cover-badge {
  display: inline-block;
  background: var(--navy);
  color: white;
  font-size: 7.5pt;
  padding: 5px 14px;
  font-weight: 600;
  letter-spacing: 2.5px;
  text-transform: uppercase;
}
.cover-date {
  font-size: 9pt;
  color: var(--text-secondary);
  font-weight: 500;
}
.cover-footer-confidential {
  position: absolute;
  bottom: 14mm;
  left: 22mm;
  right: 22mm;
  text-align: center;
  font-size: 7pt;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
}

/* ═══ PAGE / SECTION ═══ */
.page { padding: 12mm 22mm; }
.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }

.section-eyebrow {
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 8px;
}
.section-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 22pt;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.2;
  margin-bottom: 6px;
}
.section-rule { width: 50px; height: 2px; background: var(--navy); margin: 16px 0 24px; }

h2.block-title {
  font-family: 'Inter', sans-serif;
  font-size: 13pt;
  font-weight: 700;
  color: var(--navy);
  margin: 28px 0 10px;
  padding-left: 12px;
  border-left: 4px solid var(--navy);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  page-break-after: avoid;
}
h3.sub-title {
  font-size: 11pt;
  font-weight: 700;
  color: var(--navy-light);
  margin: 18px 0 8px;
  page-break-after: avoid;
}

p { margin: 8px 0; text-align: justify; }
ul, ol { margin: 8px 0 8px 20px; }
li { margin: 4px 0; }

/* ═══ KPI GRID ═══ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 18px 0 26px;
  page-break-inside: avoid;
}
.kpi {
  border: 1px solid var(--border);
  border-top: 3px solid var(--gold);
  padding: 14px 12px 12px;
  background: white;
}
.kpi-label {
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.kpi-value {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 22pt;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.1;
}
.kpi-unit {
  font-size: 10pt;
  color: var(--text-secondary);
  margin-left: 4px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
}
.kpi-caption {
  font-size: 8pt;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.35;
}

/* ═══ TABLES ═══ */
table.data {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 9pt;
  page-break-inside: avoid;
}
table.data th {
  background: var(--navy);
  color: white;
  text-align: left;
  padding: 9px 10px;
  font-weight: 600;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}
table.data td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
table.data tr:nth-child(even) td { background: var(--bg-subtle); }
table.data caption {
  caption-side: bottom;
  text-align: left;
  font-size: 8pt;
  font-style: italic;
  color: var(--text-muted);
  padding-top: 6px;
}

/* ═══ CALLOUTS ═══ */
.callout {
  border-left: 4px solid var(--navy);
  background: var(--bg-subtle);
  padding: 12px 14px;
  margin: 10px 0;
  page-break-inside: avoid;
}
.callout-title {
  font-weight: 700;
  color: var(--navy);
  font-size: 10pt;
  margin-bottom: 4px;
}
.callout-body { font-size: 9.5pt; color: var(--text); }
.callout.warning { border-left-color: var(--amber); background: #FEF3C7; }
.callout.warning .callout-title { color: var(--amber); }
.callout.critical, .callout.high { border-left-color: var(--red); background: #FEE2E2; }
.callout.critical .callout-title, .callout.high .callout-title { color: var(--red); }
.callout.medium { border-left-color: var(--amber); background: #FFFBEB; }
.callout.low, .callout.info { border-left-color: var(--navy-light); }

/* ═══ DEFINITION LIST ═══ */
dl.def {
  display: grid;
  grid-template-columns: 32% 68%;
  gap: 6px 16px;
  margin: 14px 0;
  font-size: 9.5pt;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
dl.def dt {
  font-weight: 600;
  color: var(--navy);
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0;
  border-bottom: 1px dotted var(--border);
}
dl.def dd {
  color: var(--text);
  padding: 4px 0;
  border-bottom: 1px dotted var(--border);
}

/* ═══ DAFO 2x2 ═══ */
.dafo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 18px 0;
  page-break-inside: avoid;
}
.dafo-cell {
  border: 1px solid var(--border);
  padding: 14px;
  min-height: 140px;
}
.dafo-cell h4 {
  font-size: 9pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid;
}
.dafo-fortalezas { background: #F0FDF4; }
.dafo-fortalezas h4 { color: var(--green); border-color: var(--green); }
.dafo-debilidades { background: #FEF2F2; }
.dafo-debilidades h4 { color: var(--red); border-color: var(--red); }
.dafo-oportunidades { background: #EFF6FF; }
.dafo-oportunidades h4 { color: var(--navy); border-color: var(--navy); }
.dafo-amenazas { background: #FFFBEB; }
.dafo-amenazas h4 { color: var(--amber); border-color: var(--amber); }
.dafo-cell ul { margin-left: 16px; font-size: 9pt; }
.dafo-cell li { margin: 5px 0; line-height: 1.4; }

/* ═══ TIMELINE ═══ */
.timeline {
  margin: 18px 0;
  border-left: 2px solid var(--navy);
  padding-left: 18px;
}
.timeline-item {
  position: relative;
  margin-bottom: 14px;
  page-break-inside: avoid;
}
.timeline-item::before {
  content: '';
  position: absolute;
  left: -23px; top: 4px;
  width: 8px; height: 8px;
  background: var(--gold);
  border-radius: 50%;
}
.timeline-trim {
  font-size: 8.5pt;
  font-weight: 700;
  color: var(--gold);
  text-transform: uppercase;
  letter-spacing: 1.5px;
}
.timeline-hito {
  font-size: 10pt;
  color: var(--text);
  margin: 2px 0;
}
.timeline-deps {
  font-size: 8.5pt;
  color: var(--text-muted);
  font-style: italic;
}

/* ═══ SEMÁFOROS ═══ */
.semaforos {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 14px 0;
}
.semaforo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  background: white;
  page-break-inside: avoid;
}
.semaforo-dot {
  width: 12px; height: 12px; border-radius: 50%;
  flex-shrink: 0;
}
.semaforo-dot.verde { background: var(--green); box-shadow: 0 0 0 3px #DCFCE7; }
.semaforo-dot.ambar { background: var(--amber); box-shadow: 0 0 0 3px #FEF3C7; }
.semaforo-dot.rojo { background: var(--red); box-shadow: 0 0 0 3px #FEE2E2; }
.semaforo-text { font-size: 9pt; }
.semaforo-text strong { display: block; font-size: 9.5pt; color: var(--navy); }

/* ═══ TENANT MIX BAR ═══ */
.mix-bar {
  height: 28px;
  display: flex;
  margin: 16px 0 8px;
  border-radius: 2px;
  overflow: hidden;
  page-break-inside: avoid;
}
.mix-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 8pt;
  font-weight: 600;
}
.mix-legend {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 14px;
  margin-bottom: 14px;
  font-size: 9pt;
}
.mix-legend-item { display: flex; align-items: center; gap: 8px; }
.mix-legend-dot { width: 10px; height: 10px; flex-shrink: 0; }

/* ═══ CONTACT CARD ═══ */
.contact-card {
  margin-top: 32px;
  padding: 18px 20px;
  background: var(--navy);
  color: white;
  page-break-inside: avoid;
}
.contact-card .label {
  font-size: 8pt; letter-spacing: 2.5px; text-transform: uppercase;
  color: var(--gold-light); font-weight: 600; margin-bottom: 10px;
}
.contact-card .name {
  font-family: 'Playfair Display', serif;
  font-size: 16pt; font-weight: 700; margin-bottom: 2px;
}
.contact-card .role { font-size: 10pt; color: #CBD5E1; margin-bottom: 12px; }
.contact-card .meta { font-size: 9.5pt; line-height: 1.7; }

/* ═══ CONTRATO ═══ */
.contract-section {
  margin: 22px 0;
  page-break-inside: avoid;
}
.contract-clausula-num {
  font-family: 'Playfair Display', serif;
  font-size: 11pt;
  font-weight: 700;
  color: var(--navy);
  letter-spacing: 1px;
}
.contract-clausula-titulo {
  font-size: 10.5pt;
  font-weight: 700;
  color: var(--navy);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.contract-apartado {
  margin: 6px 0;
  padding-left: 22px;
  text-indent: -22px;
  font-size: 10pt;
  text-align: justify;
}
.contract-apartado strong { font-weight: 700; }
.partes-block {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 18px 0 24px;
}
.parte-card {
  border: 1px solid var(--border);
  padding: 14px;
  font-size: 9.5pt;
}
.parte-card .parte-tipo {
  font-size: 8pt; letter-spacing: 2px; text-transform: uppercase;
  color: var(--gold); font-weight: 700; margin-bottom: 8px;
}
.parte-card strong { display: block; color: var(--navy); font-size: 11pt; margin-bottom: 6px; }
.parte-card .parte-row { margin: 3px 0; }
.parte-card .parte-row span { color: var(--text-muted); display: inline-block; min-width: 95px; }

/* ═══ HIGHLIGHT GRID (presentación) ═══ */
.highlights-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 18px 0;
}
.highlight-card {
  border: 1px solid var(--border);
  padding: 14px;
  background: white;
  page-break-inside: avoid;
}
.highlight-icon {
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--gold);
  margin-bottom: 6px;
}
.highlight-title {
  font-weight: 700;
  font-size: 10.5pt;
  color: var(--navy);
  margin-bottom: 4px;
}
.highlight-body { font-size: 9.5pt; line-height: 1.5; }

/* Hero image en presentación */
.hero-image-wrap {
  margin: -28mm -22mm 32px;
  height: 280px;
  overflow: hidden;
  position: relative;
}
.hero-image-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-image-wrap::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(10,30,61,0.1) 0%, rgba(10,30,61,0.4) 100%);
}

/* ═══ EMAIL ═══ */
.email-frame {
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid var(--border);
  background: white;
}
.email-header {
  padding: 16px 22px;
  border-bottom: 2px solid var(--gold);
  background: var(--bg-subtle);
}
.email-from { font-weight: 600; font-size: 10pt; color: var(--navy); }
.email-subject {
  font-family: 'Playfair Display', serif;
  font-size: 16pt;
  font-weight: 700;
  color: var(--navy);
  margin-top: 4px;
}
.email-preheader { font-size: 9pt; color: var(--text-muted); margin-top: 4px; }
.email-body { padding: 24px 22px; font-size: 10.5pt; line-height: 1.7; }
.email-body p { margin: 12px 0; }
.email-signature {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  font-size: 9.5pt;
  line-height: 1.6;
}
.email-signature strong { color: var(--navy); }
`;

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function esc(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  if (!text) return "";
  return text.split(/\n\n+/).map((p) => `<p>${esc(p.trim())}</p>`).join("");
}

function kpiGrid(kpis: any[]): string {
  if (!Array.isArray(kpis) || kpis.length === 0) return "";
  return `<div class="kpi-grid">${kpis.map(k => `
    <div class="kpi">
      <div class="kpi-label">${esc(k.label)}</div>
      <div class="kpi-value">${esc(k.value)}${k.unit ? `<span class="kpi-unit">${esc(k.unit)}</span>` : ""}</div>
      <div class="kpi-caption">${esc(k.caption || "")}</div>
    </div>`).join("")}</div>`;
}

function dataTable(t: any): string {
  if (!t || !t.headers || !t.rows) return "";
  return `<table class="data">
    <thead><tr>${t.headers.map((h: string) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r: string[]) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    ${t.caption ? `<caption>${esc(t.caption)}</caption>` : ""}
  </table>`;
}

function callouts(arr: any[], cls: string = ""): string {
  if (!Array.isArray(arr)) return "";
  return arr.map(c => `
    <div class="callout ${esc(c.severity || cls)}">
      <div class="callout-title">${esc(c.title)}</div>
      <div class="callout-body">${esc(c.body)}</div>
    </div>`).join("");
}

function coverBlock(cover: any, modeLabel: string, date: string): string {
  return `<div class="cover">
    <div class="cover-rule-top"></div>
    <div class="cover-brand">F&amp;G Real Estate</div>
    <div class="cover-rule-gold"></div>
    <div class="cover-title">${esc(cover.title)}</div>
    <div class="cover-subtitle">${esc(cover.subtitle)}</div>
    ${cover.tagline ? `<div class="cover-tagline">${esc(cover.tagline)}</div>` : ""}
    <div class="cover-meta">
      <div class="cover-badge">${esc(modeLabel)}</div>
      <div class="cover-date">${esc(date)}</div>
    </div>
    <div class="cover-footer-confidential">Documento confidencial · F&amp;G Real Estate</div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// RENDERERS POR MODO
// ════════════════════════════════════════════════════════════════════

function renderDossier(d: any, modeLabel: string, date: string): string {
  return `${coverBlock(d.cover, modeLabel, date)}
<div class="page">
  <div class="section-eyebrow">Resumen ejecutivo</div>
  <div class="section-title">Síntesis del operador</div>
  <div class="section-rule"></div>
  ${paragraphs(d.executive_summary)}
  ${kpiGrid(d.kpis)}

  <h2 class="block-title">Perfil corporativo</h2>
  <dl class="def">${(d.profile?.items || []).map((i: any) => `<dt>${esc(i.term)}</dt><dd>${esc(i.definition)}</dd>`).join("")}</dl>

  <h2 class="block-title">Histórico de operaciones</h2>
  ${dataTable(d.history_table)}

  <h2 class="block-title">Palancas de negociación</h2>
  ${callouts(d.negotiation_levers, "info")}

  <h2 class="block-title">Riesgos identificados</h2>
  ${callouts(d.risks)}

  <h2 class="block-title">Recomendaciones</h2>
  ${(d.recommendations || []).map((r: any) => `
    <div class="callout ${r.priority === 'alta' ? 'high' : r.priority === 'media' ? 'medium' : 'low'}">
      <div class="callout-title">[Prioridad ${esc(r.priority)}] ${esc(r.action)}</div>
      <div class="callout-body">${esc(r.rationale)}</div>
    </div>`).join("")}

  <h2 class="block-title">Fuentes y referencias</h2>
  <ul>${(d.appendix?.sources || []).map((s: string) => `<li>${esc(s)}</li>`).join("")}</ul>
</div>`;
}

function renderPresentacion(d: any, modeLabel: string, date: string, heroImageDataUrl?: string): string {
  const colors = ["#0A1E3D", "#B8860B", "#1A3A5C", "#D4A84B", "#475569", "#15803D", "#B45309"];
  const mix = d.tenant_mix || [];
  const total = mix.reduce((acc: number, m: any) => acc + (Number(m.share_pct) || 0), 0) || 100;

  return `${coverBlock(d.cover, modeLabel, date)}
<div class="page">
  ${heroImageDataUrl ? `<div class="hero-image-wrap"><img src="${heroImageDataUrl}" alt=""/></div>` : ""}
  <div class="section-eyebrow">Resumen ejecutivo</div>
  <div class="section-title">Una oportunidad diferencial</div>
  <div class="section-rule"></div>
  ${paragraphs(d.executive_summary)}
  ${kpiGrid(d.kpis)}

  <h2 class="block-title">${esc(d.market_section?.title || "Mercado")}</h2>
  ${paragraphs(d.market_section?.body || "")}

  <h2 class="block-title">Tenant mix propuesto</h2>
  <div class="mix-bar">
    ${mix.map((m: any, i: number) => {
      const pct = (Number(m.share_pct) || 0) / total * 100;
      return `<div class="mix-segment" style="width:${pct}%;background:${colors[i % colors.length]}">${pct.toFixed(0)}%</div>`;
    }).join("")}
  </div>
  <div class="mix-legend">
    ${mix.map((m: any, i: number) => `
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background:${colors[i % colors.length]}"></span>
        <span><strong>${esc(m.sector)}</strong> · ${esc(m.brands)}</span>
      </div>`).join("")}
  </div>

  <h2 class="block-title">Proyección financiera</h2>
  ${dataTable(d.financial_projection)}

  <h2 class="block-title">Highlights</h2>
  <div class="highlights-grid">
    ${(d.highlights || []).map((h: any) => `
      <div class="highlight-card">
        <div class="highlight-icon">${esc(h.icon || "·")}</div>
        <div class="highlight-title">${esc(h.title)}</div>
        <div class="highlight-body">${esc(h.body)}</div>
      </div>`).join("")}
  </div>

  <h2 class="block-title">Próximos pasos</h2>
  <ol style="padding-left:24px">
    ${(d.next_steps || []).map((s: any) => `<li style="margin:10px 0"><strong>${esc(s.title)}.</strong> ${esc(s.body)}</li>`).join("")}
  </ol>

  <div class="contact-card">
    <div class="label">Contacto comercial</div>
    <div class="name">${esc(d.contact_block?.name)}</div>
    <div class="role">${esc(d.contact_block?.role)}</div>
    <div class="meta">${esc(d.contact_block?.email)} · ${esc(d.contact_block?.phone)}</div>
  </div>
</div>`;
}

function renderContrato(d: any, modeLabel: string, date: string): string {
  const arr = d.partes?.arrendador || {};
  const arrt = d.partes?.arrendatario || {};
  return `${coverBlock(d.cover, modeLabel, date)}
<div class="page">
  <div class="section-eyebrow">Partes contratantes</div>
  <div class="section-title">Comparecientes</div>
  <div class="section-rule"></div>
  <div class="partes-block">
    <div class="parte-card">
      <div class="parte-tipo">Arrendador</div>
      <strong>${esc(arr.nombre)}</strong>
      <div class="parte-row"><span>NIF/CIF:</span> ${esc(arr.nif)}</div>
      <div class="parte-row"><span>Domicilio:</span> ${esc(arr.domicilio)}</div>
      ${arr.representante ? `<div class="parte-row"><span>Representante:</span> ${esc(arr.representante)}</div>` : ""}
    </div>
    <div class="parte-card">
      <div class="parte-tipo">Arrendatario</div>
      <strong>${esc(arrt.nombre)}</strong>
      <div class="parte-row"><span>NIF/CIF:</span> ${esc(arrt.nif)}</div>
      <div class="parte-row"><span>Domicilio:</span> ${esc(arrt.domicilio)}</div>
      ${arrt.representante ? `<div class="parte-row"><span>Representante:</span> ${esc(arrt.representante)}</div>` : ""}
    </div>
  </div>

  <h2 class="block-title">Exponen</h2>
  ${(d.expone || []).map((e: string, i: number) => `
    <p style="margin:10px 0"><strong>${["I", "II", "III", "IV", "V", "VI", "VII"][i] || (i+1)}.</strong> ${esc(e)}</p>`).join("")}

  <h2 class="block-title">Cláusulas</h2>
  ${(d.clausulas || []).map((cl: any) => `
    <div class="contract-section">
      <div class="contract-clausula-num">CLÁUSULA ${esc(cl.numero)}</div>
      <div class="contract-clausula-titulo">${esc(cl.titulo)}</div>
      ${(cl.apartados || []).map((ap: any) => `
        <p class="contract-apartado"><strong>${esc(ap.letra)}</strong> ${esc(ap.texto)}</p>`).join("")}
    </div>`).join("")}

  ${(d.anexos && d.anexos.length) ? `
    <h2 class="block-title">Anexos</h2>
    <ul>${d.anexos.map((a: any) => `<li><strong>${esc(a.titulo)}.</strong> ${esc(a.descripcion)}</li>`).join("")}</ul>
  ` : ""}

  <div class="callout warning" style="margin-top:32px">
    <div class="callout-title">Aviso legal</div>
    <div class="callout-body">${esc(d.footer_disclaimer)}</div>
  </div>
</div>`;
}

function renderPlan(d: any, modeLabel: string, date: string): string {
  return `${coverBlock(d.cover, modeLabel, date)}
<div class="page">
  <div class="section-eyebrow">Resumen ejecutivo</div>
  <div class="section-title">Visión y ambición</div>
  <div class="section-rule"></div>
  ${paragraphs(d.executive_summary)}
  ${kpiGrid(d.diagnostico_kpis)}

  <h2 class="block-title">Análisis DAFO</h2>
  <div class="dafo">
    <div class="dafo-cell dafo-fortalezas"><h4>Fortalezas</h4><ul>${(d.dafo?.fortalezas || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="dafo-cell dafo-debilidades"><h4>Debilidades</h4><ul>${(d.dafo?.debilidades || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="dafo-cell dafo-oportunidades"><h4>Oportunidades</h4><ul>${(d.dafo?.oportunidades || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="dafo-cell dafo-amenazas"><h4>Amenazas</h4><ul>${(d.dafo?.amenazas || []).map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></div>
  </div>

  <h2 class="block-title">Objetivos estratégicos</h2>
  ${(d.objetivos || []).map((o: any) => `
    <div class="callout info">
      <div class="callout-title">${esc(o.titulo)} · <span style="font-weight:500;color:var(--gold)">${esc(o.kpi_objetivo)}</span></div>
      <div class="callout-body">${esc(o.descripcion)}</div>
    </div>`).join("")}

  <h2 class="block-title">Iniciativas</h2>
  <table class="data">
    <thead><tr><th>Iniciativa</th><th>Responsable</th><th>Horizonte</th><th>Inversión</th><th>Impacto</th></tr></thead>
    <tbody>${(d.iniciativas || []).map((i: any) => `
      <tr>
        <td><strong>${esc(i.nombre)}</strong><br/><span style="font-size:8.5pt;color:var(--text-secondary)">${esc(i.descripcion)}</span></td>
        <td>${esc(i.responsable)}</td>
        <td>${esc(i.horizonte)}</td>
        <td>${esc(i.inversion_estimada)}</td>
        <td>${esc(i.impacto_estimado)}</td>
      </tr>`).join("")}</tbody>
  </table>

  <h2 class="block-title">Roadmap</h2>
  <div class="timeline">
    ${(d.roadmap || []).map((r: any) => `
      <div class="timeline-item">
        <div class="timeline-trim">${esc(r.trimestre)}</div>
        <div class="timeline-hito">${esc(r.hito)}</div>
        ${r.dependencias ? `<div class="timeline-deps">Dependencias: ${esc(r.dependencias)}</div>` : ""}
      </div>`).join("")}
  </div>

  <h2 class="block-title">Proyección financiera</h2>
  ${dataTable(d.proyeccion_financiera)}

  <h2 class="block-title">Riesgos y mitigación</h2>
  ${(d.riesgos || []).map((r: any) => `
    <div class="callout ${esc(r.severity)}">
      <div class="callout-title">${esc(r.title)}</div>
      <div class="callout-body">${esc(r.body)}<br/><em style="color:var(--text-secondary)">Mitigación: ${esc(r.mitigation)}</em></div>
    </div>`).join("")}

  <h2 class="block-title">Recomendación al comité</h2>
  <div class="callout high" style="border-left-color:var(--gold);background:var(--gold-soft)">
    <div class="callout-title" style="color:var(--navy)">Decisión solicitada</div>
    <div class="callout-body">${esc(d.recomendacion_comite)}</div>
  </div>
</div>`;
}

function renderWarRoom(d: any, modeLabel: string, date: string): string {
  return `${coverBlock(d.cover, modeLabel, date)}
<div class="page">
  <div class="section-eyebrow">Estado semanal</div>
  <div class="section-title">Resumen ejecutivo</div>
  <div class="section-rule"></div>
  ${paragraphs(d.resumen_ejecutivo)}
  ${kpiGrid(d.kpis_principales)}

  <h2 class="block-title">Cuadro de mando</h2>
  <div class="semaforos">
    ${(d.semaforos || []).map((s: any) => `
      <div class="semaforo">
        <div class="semaforo-dot ${esc(s.estado)}"></div>
        <div class="semaforo-text"><strong>${esc(s.nombre)}</strong>${esc(s.comentario)}</div>
      </div>`).join("")}
  </div>

  <h2 class="block-title">Operaciones activas</h2>
  ${dataTable(d.operaciones_activas)}

  <h2 class="block-title">Alertas</h2>
  ${(d.alertas || []).map((a: any) => `
    <div class="callout ${esc(a.severity)}">
      <div class="callout-title">${esc(a.title)} · <span style="font-weight:500">Owner: ${esc(a.owner)} · ${esc(a.due_date)}</span></div>
      <div class="callout-body">${esc(a.body)}</div>
    </div>`).join("")}

  <h2 class="block-title">Oportunidades detectadas</h2>
  ${callouts(d.oportunidades, "info")}

  <h2 class="block-title">Decisiones pendientes</h2>
  ${(d.decisiones_pendientes || []).map((dc: any) => `
    <div class="callout medium">
      <div class="callout-title">${esc(dc.tema)} · <em style="color:var(--text-secondary);font-weight:500">Deadline: ${esc(dc.deadline)}</em></div>
      <div class="callout-body">
        <strong>Opciones:</strong>
        <ul>${(dc.opciones || []).map((o: string) => `<li>${esc(o)}</li>`).join("")}</ul>
        <strong>Recomendación:</strong> ${esc(dc.recomendacion)}
      </div>
    </div>`).join("")}

  <h2 class="block-title">Próximas acciones</h2>
  <table class="data">
    <thead><tr><th>Acción</th><th>Owner</th><th>Fecha</th></tr></thead>
    <tbody>${(d.proximas_acciones || []).map((a: any) => `
      <tr><td>${esc(a.accion)}</td><td>${esc(a.owner)}</td><td>${esc(a.fecha)}</td></tr>`).join("")}</tbody>
  </table>
</div>`;
}

function renderEmail(d: any, modeLabel: string, date: string): string {
  const sig = d.signature || {};
  return `<div class="page" style="background:var(--bg-warm);min-height:100vh;padding:30mm 22mm">
  <div class="email-frame">
    <div class="email-header">
      <div class="email-from">F&amp;G Real Estate · ${esc(sig.email)}</div>
      <div class="email-subject">${esc(d.subject)}</div>
      <div class="email-preheader">${esc(d.preheader)}</div>
    </div>
    <div class="email-body">
      <p>${esc(d.greeting)}</p>
      ${(d.body_paragraphs || []).map((p: string) => `<p>${esc(p)}</p>`).join("")}
      <div class="email-signature">
        <strong>${esc(sig.name)}</strong><br/>
        ${esc(sig.role)} · ${esc(sig.company)}<br/>
        ${esc(sig.phone)} · ${esc(sig.email)}
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:18px;font-size:8pt;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase">
    Tono: ${esc(d.tone)} · Generado ${esc(date)}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════
// MASTER RENDERER
// ════════════════════════════════════════════════════════════════════

function renderTemplate(mode: ForgeMode, data: any, modeLabel: string, date: string, heroImage?: string): string {
  let body = "";
  switch (mode) {
    case "dossier_operador": body = renderDossier(data, modeLabel, date); break;
    case "presentacion_comercial": body = renderPresentacion(data, modeLabel, date, heroImage); break;
    case "borrador_contrato": body = renderContrato(data, modeLabel, date); break;
    case "plan_estrategico": body = renderPlan(data, modeLabel, date); break;
    case "informe_war_room": body = renderWarRoom(data, modeLabel, date); break;
    case "email_comunicacion": body = renderEmail(data, modeLabel, date); break;
    default: body = `<div class="page"><p>Modo no soportado</p></div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(data.cover?.title || modeLabel)}</title>
<style>${BASE_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { mode, data, mode_label, date, hero_image, output } = await req.json() as {
      mode: ForgeMode;
      data: any;
      mode_label?: string;
      date?: string;
      hero_image?: string;
      output?: "pdf" | "html";
    };

    if (!mode || !data) {
      return new Response(JSON.stringify({ error: "mode and data are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modeLabel = mode_label || "Documento";
    const docDate = date || new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
    const fullHtml = renderTemplate(mode, data, modeLabel, docDate, hero_image);

    // Si piden HTML directo (preview), devuélvelo
    if (output === "html") {
      return new Response(fullHtml, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Email no genera PDF
    if (mode === "email_comunicacion") {
      return new Response(JSON.stringify({ error: "El modo email no genera PDF. Usa output=html para preview." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("HTML2PDF_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "HTML2PDF_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isLandscape = mode === "presentacion_comercial";

    const pdfResp = await fetch("https://api.html2pdf.app/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authentication": apiKey },
      body: JSON.stringify({
        html: fullHtml,
        apiKey,
        format: "A4",
        landscape: isLandscape,
        margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: `<div style="width:100%;font-size:7px;color:#94A3B8;font-family:Inter,sans-serif;padding:0 22px;display:flex;justify-content:space-between;border-top:1px solid #E2E8F0;padding-top:6px;">
          <span>F&amp;G Real Estate · ${esc(modeLabel)}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      }),
    });

    if (!pdfResp.ok) {
      const t = await pdfResp.text();
      console.error("html2pdf error:", pdfResp.status, t);
      return new Response(JSON.stringify({ error: `PDF generation failed: ${pdfResp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = await pdfResp.arrayBuffer();
    const cleanTitle = String(data.cover?.title || modeLabel).replace(/[^a-zA-Z0-9áéíóúñü ]/gi, "_").slice(0, 60);

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${cleanTitle}.pdf"`,
      },
    });
  } catch (err) {
    console.error("generate-pdf-v2 error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
