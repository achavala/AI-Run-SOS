import puppeteer from 'puppeteer';
import { resolve } from 'path';

const htmlFile = process.argv[2] || 'AI-RUN-SOS-Solutions-Guide-styled.html';
const pdfFile = htmlFile.replace('-styled.html', '.pdf').replace('.html', '.pdf');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const filePath = resolve(htmlFile);
await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

await page.pdf({
  path: pdfFile,
  format: 'A4',
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:7pt; color:#9ca3af; width:100%; text-align:center; padding:0 15mm;">AI-RUN SOS — Solutions Architecture Guide</div>',
  footerTemplate: '<div style="font-size:7pt; color:#9ca3af; width:100%; text-align:center; padding:0 15mm;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Confidential</div>',
});

await browser.close();
console.log(`PDF generated: ${pdfFile}`);
