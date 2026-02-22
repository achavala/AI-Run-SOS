import prisma from '../db';

export async function runReport(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PST INTELLIGENCE REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  // Raw email stats
  const totalEmails = await prisma.rawEmailMessage.count();
  const processedEmails = await prisma.rawEmailMessage.count({ where: { processed: true } });
  const totalAttachments = await prisma.rawEmailAttachment.count();

  console.log(`📧 Raw Emails:       ${totalEmails.toLocaleString()} (${processedEmails.toLocaleString()} processed)`);
  console.log(`📎 Attachments:      ${totalAttachments.toLocaleString()}`);

  // Batch breakdown
  const batches = await prisma.rawEmailMessage.groupBy({
    by: ['pstBatch'],
    _count: { _all: true },
  });
  for (const b of batches) {
    console.log(`   └─ ${b.pstBatch}: ${b._count._all.toLocaleString()} emails`);
  }

  // Vendor companies
  const vendorCount = await prisma.extractedVendorCompany.count();
  const topVendors = await prisma.extractedVendorCompany.findMany({
    orderBy: { emailCount: 'desc' },
    take: 30,
    select: { name: true, domain: true, emailCount: true, lastSeenAt: true },
  });

  console.log(`\n🏢 Vendor Companies: ${vendorCount.toLocaleString()}`);
  if (topVendors.length > 0) {
    console.log('\n   Top 30 Vendors by Email Volume:');
    console.log('   ─────────────────────────────────────────────────');
    for (const v of topVendors) {
      const lastSeen = v.lastSeenAt ? v.lastSeenAt.toISOString().split('T')[0] : 'unknown';
      console.log(`   ${(v.name ?? v.domain).padEnd(35)} ${String(v.emailCount).padStart(6)} emails  (last: ${lastSeen})`);
    }
  }

  // Vendor contacts
  const contactCount = await prisma.extractedVendorContact.count();
  const contactsWithPhone = await prisma.extractedVendorContact.count({ where: { phone: { not: null } } });
  const contactsWithLinkedIn = await prisma.extractedVendorContact.count({ where: { linkedIn: { not: null } } });

  const topContacts = await prisma.extractedVendorContact.findMany({
    orderBy: { emailCount: 'desc' },
    take: 30,
    include: { vendorCompany: { select: { name: true, domain: true } } },
  });

  console.log(`\n👤 Recruiter Contacts: ${contactCount.toLocaleString()}`);
  console.log(`   With phone:    ${contactsWithPhone.toLocaleString()}`);
  console.log(`   With LinkedIn: ${contactsWithLinkedIn.toLocaleString()}`);

  if (topContacts.length > 0) {
    console.log('\n   Top 30 Recruiter Contacts:');
    console.log('   ─────────────────────────────────────────────────');
    for (const c of topContacts) {
      const company = c.vendorCompany?.name ?? c.vendorCompany?.domain ?? 'unknown';
      const phone = c.phone ? ` | ${c.phone}` : '';
      console.log(`   ${(c.name ?? c.email).padEnd(30)} ${company.padEnd(25)} ${String(c.emailCount).padStart(5)} emails${phone}`);
    }
  }

  // Consultants
  const consultantCount = await prisma.extractedConsultant.count();
  const consultantsWithResume = await prisma.extractedResumeVersion.groupBy({
    by: ['consultantId'],
    _count: { _all: true },
  });
  const resumeCount = await prisma.extractedResumeVersion.count();

  console.log(`\n🧑‍💻 Consultants Found: ${consultantCount.toLocaleString()}`);
  console.log(`   With resumes:  ${consultantsWithResume.length.toLocaleString()}`);
  console.log(`   Total resumes: ${resumeCount.toLocaleString()}`);

  // Skills distribution
  const allConsultants = await prisma.extractedConsultant.findMany({
    select: { primarySkills: true },
  });

  const skillCounts: Record<string, number> = {};
  for (const c of allConsultants) {
    for (const skill of c.primarySkills) {
      const s = skill.toLowerCase();
      skillCounts[s] = (skillCounts[s] ?? 0) + 1;
    }
  }

  const sortedSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  if (sortedSkills.length > 0) {
    console.log('\n   Top 40 Skills (across consultants):');
    console.log('   ─────────────────────────────────────────────────');
    for (const [skill, count] of sortedSkills) {
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`   ${skill.padEnd(20)} ${String(count).padStart(5)}  ${bar}`);
    }
  }

  // Req signals
  const reqCount = await prisma.vendorReqSignal.count();
  const reqsWithRate = await prisma.vendorReqSignal.count({ where: { rateText: { not: null } } });

  console.log(`\n📋 Job Req Signals: ${reqCount.toLocaleString()}`);
  console.log(`   With rate info: ${reqsWithRate.toLocaleString()}`);

  // Employment type distribution
  const empTypes = await prisma.vendorReqSignal.groupBy({
    by: ['employmentType'],
    _count: { _all: true },
    orderBy: { _count: { employmentType: 'desc' } },
  });

  if (empTypes.length > 0) {
    console.log('\n   By Employment Type:');
    for (const t of empTypes) {
      console.log(`   ${(t.employmentType ?? 'UNKNOWN').padEnd(15)} ${t._count._all}`);
    }
  }

  // Recent req signals
  const recentReqs = await prisma.vendorReqSignal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: {
      vendorCompany: { select: { name: true } },
      vendorContact: { select: { name: true, email: true } },
    },
  });

  if (recentReqs.length > 0) {
    console.log('\n   Recent 15 Job Req Signals:');
    console.log('   ─────────────────────────────────────────────────');
    for (const r of recentReqs) {
      const vendor = r.vendorCompany?.name ?? 'unknown';
      const contact = r.vendorContact?.name ?? r.vendorContact?.email ?? '';
      const rate = r.rateText ? ` | ${r.rateText}` : '';
      const type = r.employmentType ? ` [${r.employmentType}]` : '';
      console.log(`   ${(r.title ?? 'untitled').substring(0, 40).padEnd(42)} ${vendor.padEnd(20)} ${contact.padEnd(20)}${type}${rate}`);
    }
  }

  // Extraction facts
  const factCount = await prisma.extractionFact.count();
  console.log(`\n🔗 Evidence Facts:  ${factCount.toLocaleString()}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  END REPORT');
  console.log('═══════════════════════════════════════════════════════\n');
}
