import { ingestEmails } from './ingest/ingest-emails';
import { importSpreadsheets } from './ingest/import-spreadsheets';
import { extractVendors } from './extract/vendor-extractor';
import { extractReqSignals } from './extract/req-signal-extractor';
import { extractConsultants } from './extract/consultant-extractor';
import { runReport } from './extract/report';
import prisma from './db';

const PST_BATCHES: Array<{ name: string; dir: string }> = [
  { name: 'likhith', dir: '/Users/chavala/AI-RUN-SOS/pst_out/likhith' },
  { name: 'vijay', dir: '/Users/chavala/AI-RUN-SOS/pst_out/vijay' },
];

async function main() {
  const command = process.argv[2] ?? 'all';

  console.log(`\n🚀 PST Ingest Pipeline — command: ${command}\n`);
  const startTime = Date.now();

  try {
    if (command === 'ingest' || command === 'all') {
      console.log('──── Phase 1: Ingesting EML files ────');
      for (const batch of PST_BATCHES) {
        console.log(`\n📂 Processing batch: ${batch.name} (${batch.dir})`);
        const result = await ingestEmails(batch.name, batch.dir);
        console.log(`   ✓ ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors} errors / ${result.total} total`);
      }
    }

    if (command === 'extract' || command === 'all') {
      console.log('\n──── Phase 2: Extracting vendors + contacts ────');
      const vendorResult = await extractVendors();
      console.log(`   ✓ ${vendorResult.companies} companies, ${vendorResult.contacts} contacts`);

      console.log('\n──── Phase 3: Extracting job req signals ────');
      const reqResult = await extractReqSignals();
      console.log(`   ✓ ${reqResult.signals} req signals`);

      console.log('\n──── Phase 4: Extracting consultants from resumes ────');
      const consultantResult = await extractConsultants();
      console.log(`   ✓ ${consultantResult.consultants} consultants, ${consultantResult.resumes} resumes`);
    }

    if (command === 'spreadsheets') {
      console.log('\n──── Importing spreadsheet consultant data ────');
      const ssResult = await importSpreadsheets([
        '/Users/chavala/Downloads/Data (1).xlsx',
        '/Users/chavala/Downloads/Data (2).xlsx',
      ]);
      console.log(`   ✓ ${ssResult.inserted} new, ${ssResult.updated} updated, ${ssResult.skipped} skipped / ${ssResult.total} total`);
    }

    if (command === 'report' || command === 'all') {
      await runReport();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Pipeline complete in ${elapsed}s\n`);
  } catch (err) {
    console.error('Pipeline failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
