

## Plan: Fix PDF margin and layout issues

### Issues identified
1. **TOC stuck to top**: `.toc-page` has no top padding — content starts at the very top edge
2. **Cover title too large**: At `30pt`, long titles like "MASTERPLAN ESTRATÉGICO INTEGRAL: LA MILLA DE ARGANDA" overflow
3. **Content stuck to top of pages**: API `top` margin is only `15mm` — headings that land at page tops appear cramped
4. **Metrics section splits across pages**: Tables/sections need stronger page-break protection

### Changes to `supabase/functions/generate-pdf/index.ts`

1. **API top margin**: Change from `15mm` → `20mm` so all pages have breathing room at the top
2. **TOC page**: Add `padding-top: 10mm` to `.toc-page` 
3. **Cover title**: Reduce from `30pt` → `22pt`, increase `max-width` to `600px`
4. **Content h2**: Add `padding-top: 8px` so when it lands at a page top it doesn't feel glued to the edge
5. **Stronger page-break rules**: Add `page-break-inside: avoid` to `.content h2 + *` (element after heading stays with it), and wrap each `##` section in a div with `page-break-inside: avoid` for short sections

### Single file change
- `supabase/functions/generate-pdf/index.ts` — CSS adjustments + API margin fix

