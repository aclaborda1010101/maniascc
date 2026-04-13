const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[📄📊🏢🔍📋🤝🏗️🍔🛍️⚡💡🎯🔑✅❌⚠️🚀📈📉💰🏠🏬🔥⭐🎪🏪🛒🍕🍟🍔☕🥤🍻🎉🔧⚙️📌📍🗺️🏆🎯💎🌟✨🔶🔷▶️◀️🔲🔳▪️▫️◽◾⬛⬜🟥🟧🟨🟩🟦🟪🟫☑️✔️❗❓‼️⁉️]/gu, '')
    .replace(/^\s+/gm, (m) => m.replace(/  +/g, ' '))
    .trim();
}

function markdownToHtml(md: string): string {
  let cleaned = stripEmoji(md);

  let html = cleaned
    // Tables
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
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^[*\-•] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="numbered">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap consecutive <li> in <ul> or <ol>
  html = html.replace(/(<li[^>]*>.*?<\/li>(\s*<br\/>)?)+/g, (match) => {
    const c = match.replace(/<br\/>/g, '');
    const isNumbered = c.includes('class="numbered"');
    const tag = isNumbered ? 'ol' : 'ul';
    const items = c.replace(/ class="numbered"/g, '');
    return `<${tag}>${items}</${tag}>`;
  });

  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>(\s*<br\/>)*\s*<blockquote>/g, '<br/>');

  return html;
}

function extractHeadings(md: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  for (const line of md.split('\n')) {
    const match = line.match(/^(#{1,3}) (.+)$/);
    if (match) {
      const level = match[1].length;
      let text = match[2].replace(/\*\*/g, '').replace(/\*/g, '');
      text = stripEmoji(text).trim();
      if (!text) continue;
      const id = text.toLowerCase().replace(/[^a-záéíóúñü0-9]+/gi, '-').replace(/^-|-$/g, '');
      headings.push({ level, text, id });
    }
  }
  return headings;
}

function buildFullHtml(title: string, contentMd: string, modeLabel: string, date: string): string {
  const headings = extractHeadings(contentMd);
  const contentHtml = markdownToHtml(contentMd);

  // Add IDs to headings
  let contentWithIds = contentHtml;
  for (const h of headings) {
    const tag = h.level === 1 ? 'h1' : h.level === 2 ? 'h2' : 'h3';
    const escapedText = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${tag}>([^<]*${escapedText}[^<]*)</${tag}>`);
    contentWithIds = contentWithIds.replace(regex, `<${tag} id="${h.id}">$1</${tag}>`);
  }

  // TOC — only ## headings
  const tocHeadings = headings.filter(h => h.level === 2);
  const tocItems = tocHeadings
    .map((h, i) => {
      const cleanText = h.text.replace(/^\d+\.\s*/, '');
      return `<div class="toc-item">
        <span class="toc-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="toc-text">${cleanText}</span>
        <span class="toc-dots"></span>
      </div>`;
    })
    .join('');

  const safeTitle = stripEmoji(title);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700;800&display=swap');

  :root {
    --navy: #0A1E3D;
    --navy-light: #1A3A5C;
    --gold: #B8860B;
    --gold-light: #D4A84B;
    --text: #1E293B;
    --text-secondary: #475569;
    --text-muted: #94A3B8;
    --border: #E2E8F0;
    --bg-subtle: #F8FAFC;
    --bg-table-header: #0A1E3D;
    --bg-table-stripe: #F1F5F9;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
    color: var(--text);
    font-size: 10.5pt;
    line-height: 1.8;
  }

  /* ════════ COVER ════════ */
  .cover {
    page-break-after: always;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    position: relative;
    padding: 0 40px;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 8px;
    background: var(--navy);
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: var(--navy);
  }
  .cover-brand {
    font-family: 'Inter', sans-serif;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: var(--navy);
    margin-bottom: 48px;
  }
  .cover-rule {
    width: 80px;
    height: 1.5px;
    background: var(--gold);
    margin: 28px auto;
  }
  .cover-title {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-size: 30pt;
    font-weight: 700;
    line-height: 1.25;
    color: var(--navy);
    max-width: 500px;
  }
  .cover-meta {
    margin-top: 48px;
  }
  .cover-badge {
    display: inline-block;
    background: var(--navy);
    color: white;
    font-size: 7pt;
    padding: 4px 16px;
    border-radius: 2px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .cover-date {
    font-size: 10pt;
    color: var(--text-secondary);
    font-weight: 400;
  }
  .cover-footer {
    position: absolute;
    bottom: 28px;
    font-size: 7pt;
    color: var(--text-muted);
    letter-spacing: 3px;
    text-transform: uppercase;
    font-weight: 500;
  }

  /* ════════ TOC ════════ */
  .toc-page {
    page-break-after: always;
  }
  .toc-header {
    font-family: 'Inter', sans-serif;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--navy);
    margin-bottom: 6px;
  }
  .toc-rule {
    width: 50px;
    height: 2px;
    background: var(--navy);
    margin-bottom: 32px;
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    font-size: 10pt;
  }
  .toc-item:last-child { border-bottom: none; }
  .toc-num {
    width: 32px;
    color: var(--gold);
    font-weight: 700;
    font-size: 9pt;
    flex-shrink: 0;
  }
  .toc-text {
    flex: 1;
    color: var(--text);
    font-weight: 500;
  }
  .toc-dots {
    flex: 0 0 auto;
    width: 20px;
  }

  /* ════════ CONTENT ════════ */
  .content p {
    margin: 10px 0;
    text-align: justify;
    orphans: 3;
    widows: 3;
  }
  .content h1 {
    font-family: 'Inter', sans-serif;
    font-size: 17pt;
    font-weight: 700;
    color: var(--navy);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 36px 0 14px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--navy);
    page-break-after: avoid;
  }
  .content h2 {
    font-family: 'Inter', sans-serif;
    font-size: 13pt;
    font-weight: 700;
    color: var(--navy);
    margin: 32px 0 10px;
    padding-left: 14px;
    border-left: 4px solid var(--navy);
    page-break-after: avoid;
  }
  .content h3 {
    font-size: 11pt;
    font-weight: 600;
    color: var(--navy-light);
    margin: 22px 0 8px;
    page-break-after: avoid;
  }
  .content h4 {
    font-size: 10pt;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 16px 0 6px;
    page-break-after: avoid;
  }
  .content ul, .content ol {
    margin: 8px 0 8px 24px;
    padding: 0;
    page-break-inside: avoid;
  }
  .content li {
    margin: 4px 0;
    line-height: 1.7;
  }
  .content strong {
    font-weight: 700;
    color: #0F172A;
  }
  .content em {
    font-style: italic;
    color: var(--text-secondary);
  }
  .content hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 20px 0;
  }
  .content blockquote {
    border-left: 3px solid var(--navy);
    padding: 10px 18px;
    margin: 14px 0;
    background: var(--bg-subtle);
    color: var(--text-secondary);
    font-style: italic;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  .content table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  .content th {
    background: var(--bg-table-header);
    color: white;
    font-weight: 600;
    text-align: left;
    padding: 8px 12px;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .content td {
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .content tr:nth-child(even) td {
    background: var(--bg-table-stripe);
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-brand">F&amp;G Real Estate</div>
  <div class="cover-rule"></div>
  <div class="cover-title">${safeTitle}</div>
  <div class="cover-rule"></div>
  <div class="cover-meta">
    <div class="cover-badge">${stripEmoji(modeLabel)}</div>
    <div class="cover-date">${date}</div>
  </div>
  <div class="cover-footer">Documento confidencial</div>
</div>

<!-- TOC -->
<div class="toc-page">
  <div class="toc-header">&Iacute;ndice</div>
  <div class="toc-rule"></div>
  ${tocItems || '<p style="color:var(--text-muted);font-style:italic;">Sin secciones detectadas</p>'}
</div>

<!-- CONTENT -->
<div class="content">
  ${contentWithIds}
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
          left: "20mm",
          right: "20mm",
        },
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: `<div style="width:100%;font-size:8px;color:#94A3B8;font-family:Inter,system-ui,sans-serif;padding:0 20px;display:flex;justify-content:space-between;border-top:1px solid #E2E8F0;padding-top:8px;">
          <span>F&amp;G Real Estate</span>
          <span>P&aacute;g. <span class="pageNumber"></span> / <span class="totalPages"></span></span>
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
    const cleanTitle = stripEmoji(title).replace(/[^a-zA-Z0-9áéíóúñü ]/gi, '_');

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${cleanTitle}.pdf"`,
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
