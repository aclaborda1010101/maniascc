const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Strip emoji characters that render as □ in PDF fonts
 */
function stripEmoji(text: string): string {
  return text
    // Remove common emoji ranges
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    // Remove specific symbols that appear as boxes
    .replace(/[📄📊🏢🔍📋🤝🏗️🍔🛍️⚡💡🎯🔑✅❌⚠️🚀📈📉💰🏠🏬🔥⭐🎪🏪🛒🍕🍟🍔☕🥤🍻🎉🔧⚙️📌📍🗺️🏆🎯💎🌟✨🔶🔷▶️◀️🔲🔳▪️▫️◽◾⬛⬜🟥🟧🟨🟩🟦🟪🟫☑️✔️❗❓‼️⁉️]/gu, '')
    // Clean up leftover whitespace
    .replace(/^\s+/gm, (m) => m.replace(/  +/g, ' '))
    .trim();
}

function markdownToHtml(md: string): string {
  // Pre-process: strip emojis
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
    // Bullet lists (including * prefix)
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
    const cleaned = match.replace(/<br\/>/g, '');
    const isNumbered = cleaned.includes('class="numbered"');
    const tag = isNumbered ? 'ol' : 'ul';
    const cleanedItems = cleaned.replace(/ class="numbered"/g, '');
    return `<${tag}>${cleanedItems}</${tag}>`;
  });

  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>(\s*<br\/>)*\s*<blockquote>/g, '<br/>');

  return html;
}

function extractHeadings(md: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  const lines = md.split('\n');
  for (const line of lines) {
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

  // Add IDs to section headings
  let contentWithIds = contentHtml;
  for (const h of headings) {
    const tag = h.level === 1 ? 'h1' : h.level === 2 ? 'h2' : 'h3';
    // Match the heading tag with or without the stripped emoji text
    const escapedText = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${tag}>([^<]*${escapedText}[^<]*)</${tag}>`);
    contentWithIds = contentWithIds.replace(regex, `<${tag} id="${h.id}">$1</${tag}>`);
  }

  // Build TOC - only ## headings (sections)
  const tocHeadings = headings.filter(h => h.level === 2);
  const tocItems = tocHeadings
    .map((h, i) => {
      return `<div class="toc-item">
        <span class="toc-num">${i + 1}.</span>
        <span class="toc-text">${h.text}</span>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${stripEmoji(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1e293b;
    font-size: 10.5pt;
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
    top: 0; left: 0; right: 0;
    height: 5px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1);
  }
  .cover-brand {
    font-size: 12pt;
    font-weight: 600;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: #6366f1;
    margin-bottom: 50px;
  }
  .cover-line {
    width: 60px;
    height: 2px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    margin: 24px auto;
    border-radius: 2px;
  }
  .cover-title {
    font-size: 28pt;
    font-weight: 800;
    line-height: 1.2;
    color: #1e293b;
    max-width: 480px;
  }
  .cover-meta {
    margin-top: 40px;
  }
  .cover-badge {
    display: inline-block;
    background: #6366f1;
    color: white;
    font-size: 7.5pt;
    padding: 3px 12px;
    border-radius: 3px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .cover-date {
    font-size: 10pt;
    color: #64748b;
  }
  .cover-footer {
    position: absolute;
    bottom: 40px;
    font-size: 7.5pt;
    color: #94a3b8;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  /* ─── TOC PAGE ─── */
  .toc-page {
    page-break-after: always;
    padding: 50px 60px;
  }
  .toc-title {
    font-size: 16pt;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 6px;
  }
  .toc-separator {
    width: 40px;
    height: 2px;
    background: #6366f1;
    margin-bottom: 24px;
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    padding: 8px 0;
    font-size: 10pt;
    border-bottom: 1px solid #f1f5f9;
  }
  .toc-item:last-child { border-bottom: none; }
  .toc-num {
    width: 28px;
    color: #6366f1;
    font-weight: 600;
    flex-shrink: 0;
  }
  .toc-text {
    flex: 1;
    color: #334155;
  }

  /* ─── CONTENT ─── */
  .content {
    padding: 0 60px;
  }
  .content p {
    margin: 8px 0;
    text-align: justify;
    orphans: 3;
    widows: 3;
  }
  .content h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #1e293b;
    margin: 28px 0 12px;
    page-break-after: avoid;
  }
  .content h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #1e293b;
    margin: 28px 0 10px;
    padding-top: 16px;
    padding-bottom: 5px;
    border-bottom: 2px solid #6366f1;
    page-break-after: avoid;
  }
  .content h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #334155;
    margin: 20px 0 6px;
    page-break-after: avoid;
  }
  .content h4 {
    font-size: 10pt;
    font-weight: 600;
    color: #475569;
    margin: 14px 0 4px;
  }
  .content ul, .content ol {
    margin: 6px 0 6px 22px;
    padding: 0;
  }
  .content li {
    margin: 3px 0;
    line-height: 1.6;
  }
  .content strong {
    font-weight: 700;
    color: #0f172a;
  }
  .content em {
    font-style: italic;
    color: #334155;
  }
  .content hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 18px 0;
  }
  .content blockquote {
    border-left: 3px solid #6366f1;
    padding: 8px 16px;
    margin: 12px 0;
    background: #f8fafc;
    color: #475569;
    font-style: italic;
  }
  .content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  .content th {
    background: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    color: #334155;
  }
  .content td {
    padding: 5px 10px;
    border: 1px solid #e2e8f0;
  }
  .content tr:nth-child(even) td {
    background: #fafbfc;
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-brand">F&amp;G Real Estate</div>
  <div class="cover-line"></div>
  <div class="cover-title">${stripEmoji(title)}</div>
  <div class="cover-line"></div>
  <div class="cover-meta">
    <div class="cover-badge">${stripEmoji(modeLabel)}</div>
    <div class="cover-date">${date}</div>
  </div>
  <div class="cover-footer">Documento confidencial</div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="toc-page">
  <div class="toc-title">&Iacute;ndice</div>
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
          top: "15mm",
          bottom: "20mm",
          left: "0mm",
          right: "0mm",
        },
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: `<div style="width:100%;text-align:center;font-size:7px;color:#94a3b8;font-family:Inter,system-ui,sans-serif;padding:0 30px;display:flex;justify-content:space-between;">
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

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stripEmoji(title).replace(/[^a-zA-Z0-9áéíóúñü ]/gi, '_')}.pdf"`,
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
