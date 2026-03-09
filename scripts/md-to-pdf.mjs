import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Step 1: Convert MD to styled HTML via pandoc
const mdFile = process.argv[2] || 'AI-RUN-SOS-Solutions-Guide.md';
const pdfFile = mdFile.replace('.md', '.pdf');
const htmlFile = mdFile.replace('.md', '-styled.html');

const css = `
<style>
  @page { size: A4; margin: 20mm 15mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt; line-height: 1.5; color: #1f2937; max-width: 100%; }
  h1 { color: #1e3a5f; border-bottom: 3px solid #1e3a5f; padding-bottom: 8px; font-size: 22pt; page-break-before: always; margin-top: 40px; }
  h1:first-of-type { page-break-before: auto; }
  h2 { color: #1e3a5f; font-size: 16pt; margin-top: 30px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
  h3 { color: #374151; font-size: 12pt; margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9pt; }
  th { background: #1e3a5f; color: white; padding: 6px 10px; text-align: left; font-weight: 600; }
  td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 9pt; font-family: 'SF Mono', Monaco, Consolas, monospace; }
  pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; font-size: 8.5pt; overflow-x: auto; line-height: 1.4; }
  pre code { background: none; color: inherit; padding: 0; }
  blockquote { border-left: 4px solid #6366f1; margin: 12px 0; padding: 8px 16px; background: #eef2ff; }
  hr { border: none; border-top: 2px solid #d1d5db; margin: 30px 0; }
  .title-page { text-align: center; padding-top: 200px; }
  #TOC { page-break-after: always; }
  #TOC ul { list-style: none; padding-left: 20px; }
  #TOC li { margin: 4px 0; }
  #TOC a { text-decoration: none; color: #1e3a5f; }
</style>
`;

// Generate HTML with pandoc
execSync(
  `pandoc "${mdFile}" -o "${htmlFile}" --standalone --toc --toc-depth=3 --metadata title="AI-RUN SOS — Solutions Architecture Guide"`,
  { stdio: 'inherit' }
);

// Inject CSS into the HTML
let html = readFileSync(htmlFile, 'utf8');
html = html.replace('</head>', css + '</head>');

// Add cover page
const coverPage = `
<div style="text-align:center; padding-top:180px; page-break-after:always;">
  <div style="font-size:14pt; color:#6366f1; font-weight:600; letter-spacing:3px; text-transform:uppercase;">Cloud Resources Inc.</div>
  <h1 style="font-size:32pt; color:#1e3a5f; border:none; margin:30px 0 10px; page-break-before:auto;">AI-RUN SOS</h1>
  <div style="font-size:18pt; color:#374151; margin-bottom:40px;">Solutions Architecture Guide</div>
  <hr style="width:60%; margin:0 auto; border-top:3px solid #6366f1;">
  <div style="margin-top:40px; font-size:11pt; color:#6b7280;">
    <p>Version 2.0 | March 2026</p>
    <p>Classification: Confidential — Internal + Authorized Partners</p>
    <p style="margin-top:30px;">Prepared for: Technical Architects, Implementation Specialists,<br>Executive Leadership, and Finance Department</p>
  </div>
</div>
`;

html = html.replace('<body>', '<body>' + coverPage);

import { writeFileSync } from 'fs';
writeFileSync(htmlFile, html);

console.log(`Styled HTML written to ${htmlFile}`);
console.log(`Open in browser and print to PDF, or use: open ${htmlFile}`);
