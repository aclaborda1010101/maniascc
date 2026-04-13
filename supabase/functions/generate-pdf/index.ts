const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function markdownToHtml(md: string): string {
  let html = md
    // Tables - convert markdown tables to HTML
    .replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean);
      const headerHtml = headers.map((h: string) => `<th>${h}</th>`).join('');
      const rows = bodyRows.trim().split('\n').map((row: string) => {
        const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
        return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
      }).join('');
      return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="section-heading">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="numbered">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>(\s*<br\/>)?)+/g, (match) => {
    const cleaned = match.replace(/<br\/>/g, '');
    const isNumbered = cleaned.includes('class="numbered"');
    const tag = isNumbered ? 'ol' : 'ul';
    const cleanedItems = cleaned.replace(/ class="numbered"/g, '');
    return `<${tag}>${cleanedItems}</${tag}>`;
  });

  return html;
}

function extractHeadings(md: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  const lines = md.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,3}) (.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, '').replace(/\*/g, '');
      const id = text.toLowerCase().replace(/[^a-záéíóúñü0-9]+/gi, '-').replace(/^-|-$/g, '');
      headings.push({ level, text, id });
    }
  }
  return headings;
}

function buildFullHtml(title: string, contentMd: string, modeLabel: string, date: string): string {
  const headings = extractHeadings(contentMd);
  const contentHtml = markdownToHtml(contentMd);

  // Add IDs to section headings in content
  let contentWithIds = contentHtml;
  for (const h of headings) {
    const tag = h.level === 1 ? 'h1' : h.level === 2 ? 'h2' : 'h3';
    const classAttr = h.level === 2 ? ' class="section-heading"' : '';
    contentWithIds = contentWithIds.replace(
      `<${tag}${classAttr}>${h.text}</${tag}>`,
      `<${tag}${classAttr} id="${h.id}">${h.text}</${tag}>`
    );
  }

  // Build TOC
  const tocItems = headings
    .filter(h => h.level <= 2)
    .map((h, i) => {
      const indent = h.level === 1 ? '' : 'padding-left: 20px;';
      const weight = h.level === 1 ? 'font-weight: 700;' : '';
      return `<div class="toc-item" style="${indent}${weight}">
        <span class="toc-num">${i + 1}.</span>
        <span class="toc-text">${h.text}</span>
        <span class="toc-dots"></span>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1a1a2e;
    font-size: 11pt;
    line-height: 1.7;
  }

  /* ─── COVER PAGE ─── */
  .cover {
    page-break-after: always;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 60px 80px;
    position: relative;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1);
  }
  .cover-brand {
    font-size: 13pt;
    font-weight: 600;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #6366f1;
    margin-bottom: 60px;
  }
  .cover-line {
    width: 80px;
    height: 3px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    margin: 30px auto;
    border-radius: 2px;
  }
  .cover-title {
    font-size: 32pt;
    font-weight: 800;
    line-height: 1.2;
    color: #1a1a2e;
    margin-bottom: 8px;
    max-width: 500px;
  }
  .cover-meta {
    margin-top: 50px;
    font-size: 10pt;
    color: #64748b;
  }
  .cover-badge {
    display: inline-block;
    background: #6366f1;
    color: white;
    font-size: 8pt;
    padding: 4px 14px;
    border-radius: 4px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .cover-date {
    font-size: 11pt;
    color: #475569;
    font-weight: 400;
  }
  .cover-footer {
    position: absolute;
    bottom: 40px;
    font-size: 8pt;
    color: #94a3b8;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  /* ─── TOC PAGE ─── */
  .toc-page {
    page-break-after: always;
    padding: 60px 70px;
  }
  .toc-page h2 {
    font-size: 18pt;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 8px;
  }
  .toc-separator {
    width: 50px;
    height: 3px;
    background: #6366f1;
    margin-bottom: 30px;
    border-radius: 2px;
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    padding: 6px 0;
    font-size: 10.5pt;
    border-bottom: 1px dotted #e2e8f0;
  }
  .toc-num {
    width: 30px;
    color: #6366f1;
    font-weight: 600;
    flex-shrink: 0;
  }
  .toc-text { flex: 1; }

  /* ─── CONTENT PAGES ─── */
  .content {
    padding: 0 70px;
  }
  .content p {
    margin: 10px 0;
    text-align: justify;
  }
  .content h1 {
    font-size: 18pt;
    font-weight: 800;
    color: #1a1a2e;
    margin: 36px 0 14px;
    page-break-after: avoid;
  }
  .content h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #1a1a2e;
    margin: 30px 0 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #6366f1;
    page-break-before: always;
    page-break-after: avoid;
  }
  .content h2:first-of-type {
    page-break-before: avoid;
  }
  .content h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #334155;
    margin: 22px 0 8px;
    page-break-after: avoid;
  }
  .content h4 {
    font-size: 11pt;
    font-weight: 600;
    color: #475569;
    margin: 16px 0 6px;
  }
  .content ul, .content ol {
    margin: 10px 0 10px 24px;
    padding: 0;
  }
  .content li {
    margin: 4px 0;
    line-height: 1.6;
  }
  .content strong {
    font-weight: 700;
    color: #1e293b;
  }
  .content hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 24px 0;
  }
  .content table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 10pt;
  }
  .content th {
    background: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
  }
  .content td {
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
  }
  .content tr:nth-child(even) td {
    background: #f8fafc;
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-brand">F&G Real Estate</div>
  <div class="cover-line"></div>
  <div class="cover-title">${title}</div>
  <div class="cover-line"></div>
  <div class="cover-meta">
    <div class="cover-badge">${modeLabel}</div>
    <div class="cover-date">${date}</div>
  </div>
  <div class="cover-footer">Documento confidencial</div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="toc-page">
  <h2>Índice</h2>
  <div class="toc-separator"></div>
  ${tocItems || '<p style="color:#94a3b8;font-style:italic;">Sin secciones detectadas</p>'}
</div>

<!-- CONTENT -->
<div class="content">
  <p>${contentWithIds}</p>
</div>

</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, content_markdown, mode_label, date } = await req.json();

    if (!content_markdown || !title) {
      return new Response(
        JSON.stringify({ error: "title and content_markdown are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("HTML2PDF_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "HTML2PDF_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modeLabel = mode_label || "Informe";
    const docDate = date || new Date().toLocaleDateString("es-ES", {
      year: "numeric", month: "long", day: "numeric"
    });

    const fullHtml = buildFullHtml(title, content_markdown, modeLabel, docDate);

    // Call html2pdf.app API
    const pdfResponse = await fetch("https://api.html2pdf.app/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authentication": apiKey,
      },
      body: JSON.stringify({
        html: fullHtml,
        apiKey,
        format: "A4",
        margin: {
          top: "20mm",
          bottom: "25mm",
          left: "0mm",
          right: "0mm",
        },
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: `<div style="width:100%;text-align:center;font-size:8px;color:#94a3b8;font-family:Inter,sans-serif;padding:0 40px;">
          <span>F&G Real Estate — Generado por AVA</span>
          <span style="float:right;">Pág. <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>`,
      }),
    });

    if (!pdfResponse.ok) {
      const errText = await pdfResponse.text();
      console.error("html2pdf.app error:", pdfResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `PDF generation failed: ${pdfResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${title.replace(/[^a-zA-Z0-9áéíóúñü ]/gi, '_')}.pdf"`,
      },
    });
  } catch (err) {
    console.error("generate-pdf error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
