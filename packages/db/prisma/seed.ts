import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Date helpers ────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function weekEnding(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log('Seeding database with comprehensive 90-day dataset...');

  // ══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════

  await prisma.$transaction([
    prisma.dailyScoreboard.deleteMany(),
    prisma.communicationEvent.deleteMany(),
    prisma.marginEvent.deleteMany(),
    prisma.trustEvent.deleteMany(),
    prisma.agentAuditLog.deleteMany(),
    prisma.complianceDocument.deleteMany(),
    prisma.immigrationCase.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.timesheet.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.rateCard.deleteMany(),
    prisma.offer.deleteMany(),
    prisma.placement.deleteMany(),
    prisma.interview.deleteMany(),
    prisma.consentRecord.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.jobReqSource.deleteMany(),
    prisma.job.deleteMany(),
    prisma.resumeVersion.deleteMany(),
    prisma.consultantWorkAuth.deleteMany(),
    prisma.consultant.deleteMany(),
    prisma.vendorContact.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.clientCompany.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // TENANT
  // ══════════════════════════════════════════════════════════════════

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Apex Staffing Solutions',
      domain: 'apex-staffing.com',
      plan: 'professional',
      settings: {
        timezone: 'America/New_York',
        currency: 'USD',
        defaultPaymentTerms: 30,
        pods: ['SWE', 'CLOUD_DEVOPS', 'DATA', 'CYBER'],
        marginTarget: 10,
      },
    },
  });
  const T = tenant.id;

  // ══════════════════════════════════════════════════════════════════
  // USERS (6)
  // ══════════════════════════════════════════════════════════════════

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const users = await Promise.all([
    prisma.user.create({ data: { tenantId: T, email: 'md@apex-staffing.com', passwordHash, firstName: 'Balu', lastName: 'Vihaan', role: 'MANAGEMENT' } }),
    prisma.user.create({ data: { tenantId: T, email: 'recruiter@apex-staffing.com', passwordHash, firstName: 'James', lastName: 'Rodriguez', role: 'RECRUITMENT' } }),
    prisma.user.create({ data: { tenantId: T, email: 'sales@apex-staffing.com', passwordHash, firstName: 'Priya', lastName: 'Patel', role: 'SALES' } }),
    prisma.user.create({ data: { tenantId: T, email: 'hr@apex-staffing.com', passwordHash, firstName: 'Michael', lastName: 'Thompson', role: 'HR' } }),
    prisma.user.create({ data: { tenantId: T, email: 'immigration@apex-staffing.com', passwordHash, firstName: 'Li', lastName: 'Wang', role: 'IMMIGRATION' } }),
    prisma.user.create({ data: { tenantId: T, email: 'accounts@apex-staffing.com', passwordHash, firstName: 'David', lastName: 'Kim', role: 'ACCOUNTS' } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // CLIENT COMPANIES (8)
  // ══════════════════════════════════════════════════════════════════

  const clients = await Promise.all([
    prisma.clientCompany.create({ data: { tenantId: T, name: 'JPMorgan Chase', industry: 'Finance', website: 'jpmorgan.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'Walmart Global Tech', industry: 'Retail', website: 'walmart.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'UnitedHealth Group', industry: 'Healthcare', website: 'uhg.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'Capital One', industry: 'Finance', website: 'capitalone.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'Deloitte Digital', industry: 'Consulting', website: 'deloitte.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'Amazon Web Services', industry: 'Technology', website: 'aws.amazon.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'Microsoft', industry: 'Technology', website: 'microsoft.com' } }),
    prisma.clientCompany.create({ data: { tenantId: T, name: 'Google Cloud', industry: 'Technology', website: 'cloud.google.com' } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // VENDORS (12) — trust scores 35–95, varied pay speed & ghost rates
  // ══════════════════════════════════════════════════════════════════

  const vendors = await Promise.all([
    /* 0 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'TechForce Global',
      contactName: 'Robert Blake', contactEmail: 'rblake@techforceglobal.com', contactPhone: '+1-555-0101',
      paymentTermsDays: 30, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 88, paySpeedDays: 22, ghostRate: 0.04, disputeFrequency: 0.02, feedbackLatencyHrs: 18,
      contacts: { create: [
        { tenantId: T, name: 'Robert Blake', email: 'rblake@techforceglobal.com', title: 'VP Staffing', isPrimary: true },
        { tenantId: T, name: 'Sarah Mills', email: 'smills@techforceglobal.com', title: 'Account Manager' },
      ] },
    } }),
    /* 1 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'InfoSys Prime',
      contactName: 'Anita Sharma', contactEmail: 'asharma@infosysprime.com', contactPhone: '+1-555-0102',
      paymentTermsDays: 45, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 74, paySpeedDays: 40, ghostRate: 0.10, disputeFrequency: 0.06, feedbackLatencyHrs: 42,
      contacts: { create: [
        { tenantId: T, name: 'Anita Sharma', email: 'asharma@infosysprime.com', title: 'Director', isPrimary: true },
      ] },
    } }),
    /* 2 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'Cognizant Direct',
      contactName: 'Mark Stevens', contactEmail: 'mstevens@cognizantdirect.com',
      paymentTermsDays: 60, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: false,
      trustScore: 56, paySpeedDays: 58, ghostRate: 0.20, disputeFrequency: 0.14, feedbackLatencyHrs: 72,
    } }),
    /* 3 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'CloudNine Solutions',
      contactName: 'Jennifer Park', contactEmail: 'jpark@cloudnine.io', contactPhone: '+1-555-0104',
      paymentTermsDays: 30, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 92, paySpeedDays: 14, ghostRate: 0.02, disputeFrequency: 0.01, feedbackLatencyHrs: 12,
      contacts: { create: [
        { tenantId: T, name: 'Jennifer Park', email: 'jpark@cloudnine.io', title: 'CEO', isPrimary: true },
      ] },
    } }),
    /* 4 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'Velocity Talent',
      contactName: 'Tom Richards', contactEmail: 'trichards@velocitytalent.com',
      paymentTermsDays: 45, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 42, paySpeedDays: 68, ghostRate: 0.28, disputeFrequency: 0.20, feedbackLatencyHrs: 96,
    } }),
    /* 5 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'NovaBridge Corp',
      contactName: 'Lisa Chen', contactEmail: 'lchen@novabridge.com',
      paymentTermsDays: 30, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 81, paySpeedDays: 30, ghostRate: 0.06, disputeFrequency: 0.04, feedbackLatencyHrs: 24,
      contacts: { create: [
        { tenantId: T, name: 'Lisa Chen', email: 'lchen@novabridge.com', title: 'Director', isPrimary: true },
      ] },
    } }),
    /* 6 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'Apex Dynamics',
      contactName: 'Daniel Wright', contactEmail: 'dwright@apexdynamics.com', contactPhone: '+1-555-0107',
      paymentTermsDays: 30, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 95, paySpeedDays: 12, ghostRate: 0.01, disputeFrequency: 0.01, feedbackLatencyHrs: 8,
      contacts: { create: [
        { tenantId: T, name: 'Daniel Wright', email: 'dwright@apexdynamics.com', title: 'VP Operations', isPrimary: true },
      ] },
    } }),
    /* 7 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'DataStream Partners',
      contactName: 'Rachel Green', contactEmail: 'rgreen@datastreampartners.com',
      paymentTermsDays: 35, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 68, paySpeedDays: 35, ghostRate: 0.12, disputeFrequency: 0.08, feedbackLatencyHrs: 36,
    } }),
    /* 8 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'CyberShield Inc',
      contactName: 'Kevin Liu', contactEmail: 'kliu@cybershield.com', contactPhone: '+1-555-0109',
      paymentTermsDays: 30, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 77, paySpeedDays: 28, ghostRate: 0.08, disputeFrequency: 0.05, feedbackLatencyHrs: 30,
      contacts: { create: [
        { tenantId: T, name: 'Kevin Liu', email: 'kliu@cybershield.com', title: 'Managing Director', isPrimary: true },
      ] },
    } }),
    /* 9 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'TalentBridge Global',
      contactName: 'Susan Miller', contactEmail: 'smiller@talentbridge.com',
      paymentTermsDays: 45, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: false,
      trustScore: 45, paySpeedDays: 55, ghostRate: 0.22, disputeFrequency: 0.16, feedbackLatencyHrs: 84,
    } }),
    /* 10 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'Summit Consulting',
      contactName: 'Brian Foster', contactEmail: 'bfoster@summitconsulting.com', contactPhone: '+1-555-0111',
      paymentTermsDays: 30, msaStatus: 'ACTIVE', w9Received: true, insuranceVerified: true,
      trustScore: 85, paySpeedDays: 20, ghostRate: 0.05, disputeFrequency: 0.03, feedbackLatencyHrs: 20,
      contacts: { create: [
        { tenantId: T, name: 'Brian Foster', email: 'bfoster@summitconsulting.com', title: 'Partner', isPrimary: true },
      ] },
    } }),
    /* 11 */ prisma.vendor.create({ data: {
      tenantId: T, companyName: 'Meridian Tech',
      contactName: 'Paul Martinez', contactEmail: 'pmartinez@meridiantech.com',
      paymentTermsDays: 60, msaStatus: 'ACTIVE', w9Received: false, insuranceVerified: false,
      trustScore: 35, paySpeedDays: 72, ghostRate: 0.32, disputeFrequency: 0.25, feedbackLatencyHrs: 120,
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // CONSULTANTS (30) — varied readiness across pods
  //   ON_ASSIGNMENT(8) | SUBMISSION_READY(10) | VERIFIED(5)
  //   DOCS_PENDING(4)  | NEW(3)
  // ══════════════════════════════════════════════════════════════════

  const consultants = await Promise.all([
    // ── ON_ASSIGNMENT (0–7) ──────────────────────────────────────
    /* 0 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Rajesh', lastName: 'Kumar', email: 'rajesh.kumar@email.com', phone: '+1-555-1001',
      skills: ['Java', 'Spring Boot', 'AWS', 'Microservices', 'Kubernetes'],
      pods: ['SWE', 'CLOUD_DEVOPS'], availableFrom: daysAgo(45), desiredRate: 95, currentRate: 85,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 90,
      consentPolicy: { autoApproveVendors: [], requireExplicitConsent: true },
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2027-06-15'), employer: 'Apex Staffing Solutions', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v2.1', fileUrl: 's3://resumes/rajesh-kumar-v2.1.pdf', fileHash: 'sha256:rk21a', isCurrent: true } },
    } }),
    /* 1 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Maria', lastName: 'Garcia', email: 'maria.garcia@email.com', phone: '+1-555-1002',
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'PostgreSQL'],
      pods: ['SWE'], availableFrom: daysAgo(60), desiredRate: 110, currentRate: 95,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 88,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.3', fileUrl: 's3://resumes/maria-garcia-v1.3.pdf', fileHash: 'sha256:mg13b', isCurrent: true } },
    } }),
    /* 2 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Emily', lastName: 'Johnson', email: 'emily.johnson@email.com', phone: '+1-555-1003',
      skills: ['DevOps', 'Terraform', 'Docker', 'CI/CD', 'Azure', 'Kubernetes'],
      pods: ['CLOUD_DEVOPS'], availableFrom: daysAgo(40), desiredRate: 125, currentRate: 110,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 93,
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v3.0', fileUrl: 's3://resumes/emily-johnson-v3.0.pdf', fileHash: 'sha256:ej30c', isCurrent: true } },
    } }),
    /* 3 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'David', lastName: 'Chen', email: 'david.chen@email.com', phone: '+1-555-1004',
      skills: ['Snowflake', 'dbt', 'Airflow', 'Python', 'Kafka'],
      pods: ['DATA'], availableFrom: daysAgo(90), desiredRate: 115, currentRate: 105,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 86,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v2.0', fileUrl: 's3://resumes/david-chen-v2.0.pdf', fileHash: 'sha256:dc20d', isCurrent: true } },
    } }),
    /* 4 — OPT expiring within 90 days (risk) */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@email.com', phone: '+1-555-1005',
      skills: ['Python', 'Spark', 'AWS', 'Data Pipeline', 'Redshift'],
      pods: ['DATA', 'CYBER'], availableFrom: daysAgo(35), desiredRate: 120, currentRate: 108,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 84,
      workAuths: { create: { tenantId: T, authType: 'OPT', expiryDate: new Date('2026-05-01'), isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.1', fileUrl: 's3://resumes/priya-sharma-v1.1.pdf', fileHash: 'sha256:ps11e', isCurrent: true } },
    } }),
    /* 5 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Li', lastName: 'Wei', email: 'li.wei@email.com', phone: '+1-555-1006',
      skills: ['Java', 'React', 'Spring Boot', 'PostgreSQL', 'Docker'],
      pods: ['SWE'], availableFrom: daysAgo(20), desiredRate: 100, currentRate: 88,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 85,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2027-03-01'), employer: 'Apex Staffing Solutions', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v2.2', fileUrl: 's3://resumes/li-wei-v2.2.pdf', fileHash: 'sha256:lw22f', isCurrent: true } },
    } }),
    /* 6 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Ahmed', lastName: 'Hassan', email: 'ahmed.hassan@email.com', phone: '+1-555-1007',
      skills: ['Kubernetes', 'AWS EKS', 'Terraform', 'Helm', 'Prometheus', 'Go'],
      pods: ['CLOUD_DEVOPS'], availableFrom: daysAgo(30), desiredRate: 130, currentRate: 115,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 91,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2027-09-01'), employer: 'Apex Staffing Solutions', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.4', fileUrl: 's3://resumes/ahmed-hassan-v1.4.pdf', fileHash: 'sha256:ah14g', isCurrent: true } },
    } }),
    /* 7 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@email.com', phone: '+1-555-1008',
      skills: ['SIEM', 'SOC', 'Splunk', 'Incident Response', 'Cloud Security'],
      pods: ['CYBER'], availableFrom: daysAgo(25), desiredRate: 108, currentRate: 95,
      readiness: 'ON_ASSIGNMENT', verificationStatus: 'VERIFIED', trustScore: 87,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/yuki-tanaka-v1.0.pdf', fileHash: 'sha256:yt10h', isCurrent: true } },
    } }),
    // ── SUBMISSION_READY (8–17) ──────────────────────────────────
    /* 8 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Anil', lastName: 'Reddy', email: 'anil.reddy@email.com', phone: '+1-555-1009',
      skills: ['Python', 'Django', 'Machine Learning', 'TensorFlow', 'AWS SageMaker'],
      pods: ['DATA'], availableFrom: daysAgo(5), desiredRate: 110,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 78,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2026-12-31'), isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/anil-reddy-v1.0.pdf', fileHash: 'sha256:ar10i', isCurrent: true } },
    } }),
    /* 9 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@email.com', phone: '+1-555-1010',
      skills: ['React', 'Next.js', 'TypeScript', 'TailwindCSS', 'Node.js'],
      pods: ['SWE'], availableFrom: daysAgo(3), desiredRate: 105, currentRate: 92,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 82,
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.2', fileUrl: 's3://resumes/sarah-williams-v1.2.pdf', fileHash: 'sha256:sw12j', isCurrent: true } },
    } }),
    /* 10 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@email.com', phone: '+1-555-1011',
      skills: ['AWS', 'GCP', 'Terraform', 'Ansible', 'Linux'],
      pods: ['CLOUD_DEVOPS'], availableFrom: daysAgo(2), desiredRate: 118,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 79,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/michael-brown-v1.0.pdf', fileHash: 'sha256:mb10k', isCurrent: true } },
    } }),
    /* 11 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Angela', lastName: 'Torres', email: 'angela.torres@email.com', phone: '+1-555-1012',
      skills: ['Penetration Testing', 'SOC', 'SIEM', 'Incident Response', 'CompTIA'],
      pods: ['CYBER'], availableFrom: daysAgo(1), desiredRate: 108,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 80,
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/angela-torres-v1.0.pdf', fileHash: 'sha256:at10l', isCurrent: true } },
    } }),
    /* 12 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@email.com', phone: '+1-555-1013',
      skills: ['Kubernetes', 'Docker', 'AWS EKS', 'Helm', 'Prometheus'],
      pods: ['CLOUD_DEVOPS'], availableFrom: daysAgo(7), desiredRate: 115,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 76,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2026-09-30'), employer: 'Previous Employer', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/vikram-singh-v1.0.pdf', fileHash: 'sha256:vs10m', isCurrent: true } },
    } }),
    /* 13 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.mendez@email.com', phone: '+1-555-1014',
      skills: ['Java', 'Spring Boot', 'React', 'PostgreSQL', 'Kafka'],
      pods: ['SWE'], availableFrom: daysAgo(4), desiredRate: 105,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 81,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.1', fileUrl: 's3://resumes/carlos-mendez-v1.1.pdf', fileHash: 'sha256:cm11n', isCurrent: true } },
    } }),
    /* 14 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Fatima', lastName: 'Al-Rashidi', email: 'fatima.rashidi@email.com', phone: '+1-555-1015',
      skills: ['Spark', 'Airflow', 'Snowflake', 'Python', 'AWS Glue'],
      pods: ['DATA'], availableFrom: daysAgo(6), desiredRate: 112,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 77,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2027-01-15'), isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/fatima-rashidi-v1.0.pdf', fileHash: 'sha256:fr10o', isCurrent: true } },
    } }),
    /* 15 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'James', lastName: "O'Brien", email: 'james.obrien@email.com', phone: '+1-555-1016',
      skills: ['Python', 'FastAPI', 'Django', 'PostgreSQL', 'Redis'],
      pods: ['SWE'], availableFrom: daysAgo(3), desiredRate: 100,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 83,
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v2.0', fileUrl: "s3://resumes/james-obrien-v2.0.pdf", fileHash: 'sha256:jo20p', isCurrent: true } },
    } }),
    /* 16 — EAD expiring within 90 days (risk) */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Nadia', lastName: 'Petrova', email: 'nadia.petrova@email.com', phone: '+1-555-1017',
      skills: ['Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins'],
      pods: ['CLOUD_DEVOPS'], availableFrom: daysAgo(5), desiredRate: 110,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 75,
      workAuths: { create: { tenantId: T, authType: 'EAD', expiryDate: new Date('2026-04-20'), isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/nadia-petrova-v1.0.pdf', fileHash: 'sha256:np10q', isCurrent: true } },
    } }),
    /* 17 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Tomoko', lastName: 'Sato', email: 'tomoko.sato@email.com', phone: '+1-555-1018',
      skills: ['Tableau', 'SQL', 'Python', 'dbt', 'Looker'],
      pods: ['DATA'], availableFrom: daysAgo(4), desiredRate: 100,
      readiness: 'SUBMISSION_READY', verificationStatus: 'VERIFIED', trustScore: 74,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2027-05-01'), isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/tomoko-sato-v1.0.pdf', fileHash: 'sha256:ts10r', isCurrent: true } },
    } }),
    // ── VERIFIED (18–22) ─────────────────────────────────────────
    /* 18 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Robert', lastName: 'Kim', email: 'robert.kim@email.com', phone: '+1-555-1019',
      skills: ['Angular', 'TypeScript', 'RxJS', 'Node.js', 'MongoDB'],
      pods: ['SWE'], desiredRate: 98,
      readiness: 'VERIFIED', verificationStatus: 'VERIFIED', trustScore: 72,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/robert-kim-v1.0.pdf', fileHash: 'sha256:rk10s', isCurrent: true } },
    } }),
    /* 19 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Elena', lastName: 'Rodriguez', email: 'elena.rodriguez@email.com', phone: '+1-555-1020',
      skills: ['SQL', 'Python', 'Tableau', 'Snowflake', 'Excel'],
      pods: ['DATA'], desiredRate: 90,
      readiness: 'VERIFIED', verificationStatus: 'VERIFIED', trustScore: 70,
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/elena-rodriguez-v1.0.pdf', fileHash: 'sha256:er10t', isCurrent: true } },
    } }),
    /* 20 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Kevin', lastName: 'Murphy', email: 'kevin.murphy@email.com', phone: '+1-555-1021',
      skills: ['CI/CD', 'Jenkins', 'GitLab', 'AWS CodePipeline', 'Bash'],
      pods: ['CLOUD_DEVOPS'], desiredRate: 105,
      readiness: 'VERIFIED', verificationStatus: 'VERIFIED', trustScore: 73,
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/kevin-murphy-v1.0.pdf', fileHash: 'sha256:km10u', isCurrent: true } },
    } }),
    /* 21 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Deepa', lastName: 'Nair', email: 'deepa.nair@email.com', phone: '+1-555-1022',
      skills: ['IAM', 'Cloud Security', 'AWS Security Hub', 'Okta', 'CyberArk'],
      pods: ['CYBER'], desiredRate: 112,
      readiness: 'VERIFIED', verificationStatus: 'VERIFIED', trustScore: 71,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2026-08-15'), isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/deepa-nair-v1.0.pdf', fileHash: 'sha256:dn10v', isCurrent: true } },
    } }),
    /* 22 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Brandon', lastName: 'Lee', email: 'brandon.lee@email.com', phone: '+1-555-1023',
      skills: ['React', 'Vue.js', 'Node.js', 'Express', 'MongoDB'],
      pods: ['SWE'], desiredRate: 95,
      readiness: 'VERIFIED', verificationStatus: 'VERIFIED', trustScore: 69,
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
      resumeVersions: { create: { tenantId: T, version: 'v1.0', fileUrl: 's3://resumes/brandon-lee-v1.0.pdf', fileHash: 'sha256:bl10w', isCurrent: true } },
    } }),
    // ── DOCS_PENDING (23–26) ─────────────────────────────────────
    /* 23 — H1B expiring within 90 days (risk) */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Suresh', lastName: 'Patel', email: 'suresh.patel@email.com', phone: '+1-555-1024',
      skills: ['SIEM', 'SOC', 'IAM', 'Cloud Security', 'Splunk'],
      pods: ['CYBER'], desiredRate: 100,
      readiness: 'DOCS_PENDING', verificationStatus: 'FLAGGED', trustScore: 45,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2026-04-15'), employer: 'Previous Corp', isCurrent: true } },
    } }),
    /* 24 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Min-Jun', lastName: 'Park', email: 'minjun.park@email.com', phone: '+1-555-1025',
      skills: ['Python', 'Pandas', 'SQL', 'Airflow', 'GCP BigQuery'],
      pods: ['DATA'], desiredRate: 95,
      readiness: 'DOCS_PENDING', verificationStatus: 'PARTIAL', trustScore: 55,
      workAuths: { create: { tenantId: T, authType: 'OPT', expiryDate: new Date('2026-06-01'), isCurrent: true } },
    } }),
    /* 25 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Grace', lastName: 'Chen', email: 'grace.chen@email.com', phone: '+1-555-1026',
      skills: ['React', 'TypeScript', 'CSS', 'Figma', 'Storybook'],
      pods: ['SWE'], desiredRate: 88,
      readiness: 'DOCS_PENDING', verificationStatus: 'PARTIAL', trustScore: 50,
      workAuths: { create: { tenantId: T, authType: 'CPT', expiryDate: new Date('2026-07-01'), isCurrent: true } },
    } }),
    /* 26 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Obi', lastName: 'Okafor', email: 'obi.okafor@email.com', phone: '+1-555-1027',
      skills: ['AWS', 'Terraform', 'Docker', 'Linux', 'Bash'],
      pods: ['CLOUD_DEVOPS'], desiredRate: 105,
      readiness: 'DOCS_PENDING', verificationStatus: 'PARTIAL', trustScore: 52,
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2026-11-01'), isCurrent: true } },
    } }),
    // ── NEW (27–29) ──────────────────────────────────────────────
    /* 27 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Ava', lastName: 'Mitchell', email: 'ava.mitchell@email.com', phone: '+1-555-1028',
      skills: ['JavaScript', 'React', 'HTML', 'CSS'],
      pods: ['SWE'],
      readiness: 'NEW', verificationStatus: 'UNVERIFIED',
      workAuths: { create: { tenantId: T, authType: 'USC', isCurrent: true } },
    } }),
    /* 28 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Ravi', lastName: 'Gupta', email: 'ravi.gupta@email.com', phone: '+1-555-1029',
      skills: ['Python', 'SQL', 'Spark'],
      pods: ['DATA'],
      readiness: 'NEW', verificationStatus: 'UNVERIFIED',
      workAuths: { create: { tenantId: T, authType: 'H1B', expiryDate: new Date('2027-02-01'), isCurrent: true } },
    } }),
    /* 29 */ prisma.consultant.create({ data: {
      tenantId: T, firstName: 'Sofia', lastName: 'Reyes', email: 'sofia.reyes@email.com', phone: '+1-555-1030',
      skills: ['SOC', 'SIEM', 'Network Security'],
      pods: ['CYBER'],
      readiness: 'NEW', verificationStatus: 'UNVERIFIED',
      workAuths: { create: { tenantId: T, authType: 'GC', isCurrent: true } },
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // JOBS (40) — 20 ACTIVE, 5 NEW, 5 FILLED, 5 ON_HOLD, 5 CANCELLED
  // Job→Vendor index map for consent record lookups:
  //   [0→v0, 1→v1, 2→v3, 3→v5, 4→v6, 5→v7, 6→v0, 7→v10, 8→v4, 9→v9,
  //    10→v3, 11→v8, 12→v0, 13→v3, 14→v5, 15→v6, 16→v10, 17→v8, 18→v7, 19→v4,
  //    20→v9, 21→v9, 22→v2, 23→v1, 24→v3, 25→v5, 26→v7, 27→v6, 28→v10, 29→v0,
  //    30→v8, 31→v11, 32→v3, 33→v4, 34→v1, 35→v0, 36→v6, 37→v8, 38→v10, 39→v5]
  // ══════════════════════════════════════════════════════════════════

  const jobs = await Promise.all([
    // ── SWE (0–11) ───────────────────────────────────────────────
    /* 0  ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[0]!.id, clientCompanyId: clients[0]!.id,
      title: 'Senior Java Developer', pod: 'SWE',
      description: 'Senior Java Developer with Spring Boot and AWS for microservices migration.',
      skills: ['Java', 'Spring Boot', 'AWS', 'Microservices'],
      location: 'Dallas, TX', locationType: 'HYBRID', rateMin: 80, rateMax: 100,
      startDate: daysAgo(45), durationMonths: 12, status: 'ACTIVE',
      closureLikelihood: 0.75, interviewSpeed: 5, rateHonesty: 0.9, freshnessScore: 0.85,
      reqSources: { create: { tenantId: T, source: 'EMAIL', rawText: 'Need Sr Java Dev for JPM migration...', sourceRef: 'email-001' } },
    } }),
    /* 1  ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[1]!.id, clientCompanyId: clients[1]!.id,
      title: 'Full Stack React/Node Developer', pod: 'SWE',
      description: 'Full Stack dev for retail platform modernization.',
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 90, rateMax: 115,
      startDate: daysAgo(30), durationMonths: 6, status: 'ACTIVE',
      closureLikelihood: 0.60, interviewSpeed: 7, rateHonesty: 0.7, freshnessScore: 0.70,
    } }),
    /* 2  ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[3]!.id, clientCompanyId: clients[3]!.id,
      title: 'React Native Mobile Developer', pod: 'SWE',
      description: 'Mobile developer for banking app features.',
      skills: ['React Native', 'TypeScript', 'iOS', 'Android'],
      location: 'McLean, VA', locationType: 'HYBRID', rateMin: 85, rateMax: 105,
      status: 'ACTIVE', closureLikelihood: 0.55, freshnessScore: 0.75,
    } }),
    /* 3  ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[5]!.id, clientCompanyId: clients[4]!.id,
      title: 'Senior Full Stack Engineer', pod: 'SWE',
      description: 'Full stack engineer for consulting platform.',
      skills: ['Java', 'React', 'Spring Boot', 'PostgreSQL'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 85, rateMax: 110,
      startDate: daysAgo(20), durationMonths: 12, status: 'ACTIVE',
      closureLikelihood: 0.70, freshnessScore: 0.80,
    } }),
    /* 4  ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[6]!.id, clientCompanyId: clients[5]!.id,
      title: 'Frontend Engineer (Angular)', pod: 'SWE',
      description: 'Angular frontend engineer for cloud console.',
      skills: ['Angular', 'TypeScript', 'RxJS', 'NgRx'],
      location: 'Seattle, WA', locationType: 'HYBRID', rateMin: 90, rateMax: 115,
      status: 'ACTIVE', closureLikelihood: 0.65, freshnessScore: 0.78,
    } }),
    /* 5  ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[7]!.id, clientCompanyId: clients[6]!.id,
      title: 'Backend Python Developer', pod: 'SWE',
      description: 'Python backend developer for API platform.',
      skills: ['Python', 'FastAPI', 'PostgreSQL', 'Redis'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 80, rateMax: 105,
      status: 'ACTIVE', closureLikelihood: 0.45, freshnessScore: 0.65,
    } }),
    /* 6  FILLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[0]!.id, clientCompanyId: clients[0]!.id,
      title: 'Java Microservices Architect', pod: 'SWE',
      description: 'Microservices architect for banking platform.',
      skills: ['Java', 'Microservices', 'Kafka', 'AWS'],
      location: 'New York, NY', locationType: 'HYBRID', rateMin: 95, rateMax: 120,
      status: 'FILLED', closureLikelihood: 1.0, freshnessScore: 0.10,
    } }),
    /* 7  NEW */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[10]!.id, clientCompanyId: clients[7]!.id,
      title: 'TypeScript Full Stack Developer', pod: 'SWE',
      description: 'Full stack TypeScript developer for cloud platform.',
      skills: ['TypeScript', 'React', 'Node.js', 'GCP'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 90, rateMax: 115,
      status: 'NEW', freshnessScore: 1.0,
    } }),
    /* 8  ON_HOLD */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[4]!.id,
      title: 'React UI Developer', pod: 'SWE',
      description: 'React developer for e-commerce redesign.',
      skills: ['React', 'CSS', 'JavaScript', 'Figma'],
      location: 'New York, NY', locationType: 'ONSITE', rateMin: 75, rateMax: 95,
      status: 'ON_HOLD', closureLikelihood: 0.15, freshnessScore: 0.15,
    } }),
    /* 9  CANCELLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[9]!.id,
      title: '.NET Backend Developer', pod: 'SWE',
      description: '.NET developer for legacy system modernization.',
      skills: ['.NET', 'C#', 'SQL Server', 'Azure'],
      location: 'Chicago, IL', locationType: 'HYBRID', rateMin: 80, rateMax: 100,
      status: 'CANCELLED', freshnessScore: 0.0,
    } }),
    /* 10 NEW */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[3]!.id, clientCompanyId: clients[3]!.id,
      title: 'Spring Boot API Developer', pod: 'SWE',
      description: 'API developer for fintech platform.',
      skills: ['Java', 'Spring Boot', 'REST', 'PostgreSQL'],
      location: 'McLean, VA', locationType: 'HYBRID', rateMin: 85, rateMax: 105,
      status: 'NEW', freshnessScore: 1.0,
    } }),
    /* 11 FILLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[8]!.id, clientCompanyId: clients[2]!.id,
      title: 'Node.js Backend Engineer', pod: 'SWE',
      description: 'Node.js engineer for healthcare data APIs.',
      skills: ['Node.js', 'TypeScript', 'Express', 'PostgreSQL'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 80, rateMax: 100,
      status: 'FILLED', closureLikelihood: 1.0, freshnessScore: 0.10,
    } }),
    // ── CLOUD_DEVOPS (12–21) ─────────────────────────────────────
    /* 12 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[0]!.id, clientCompanyId: clients[2]!.id,
      title: 'DevOps Engineer - Azure/Terraform', pod: 'CLOUD_DEVOPS',
      description: 'DevOps engineer for cloud infrastructure automation.',
      skills: ['DevOps', 'Azure', 'Terraform', 'Docker', 'Kubernetes'],
      location: 'New York, NY', locationType: 'ONSITE', rateMin: 100, rateMax: 130,
      status: 'ACTIVE', closureLikelihood: 0.85, interviewSpeed: 4, freshnessScore: 0.95,
    } }),
    /* 13 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[3]!.id, clientCompanyId: clients[0]!.id,
      title: 'AWS Cloud Architect', pod: 'CLOUD_DEVOPS',
      description: 'Cloud architect for AWS migration program.',
      skills: ['AWS', 'CloudFormation', 'Lambda', 'VPC'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 110, rateMax: 140,
      status: 'ACTIVE', closureLikelihood: 0.65, freshnessScore: 0.80,
    } }),
    /* 14 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[5]!.id, clientCompanyId: clients[4]!.id,
      title: 'SRE / Platform Engineer', pod: 'CLOUD_DEVOPS',
      description: 'Site reliability engineer for consulting platform.',
      skills: ['Kubernetes', 'Prometheus', 'Grafana', 'Go'],
      location: 'Austin, TX', locationType: 'HYBRID', rateMin: 105, rateMax: 130,
      status: 'ACTIVE', closureLikelihood: 0.40, freshnessScore: 0.60,
    } }),
    /* 15 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[6]!.id, clientCompanyId: clients[5]!.id,
      title: 'Kubernetes Platform Engineer', pod: 'CLOUD_DEVOPS',
      description: 'Platform engineer for container orchestration.',
      skills: ['Kubernetes', 'EKS', 'Helm', 'ArgoCD', 'Terraform'],
      location: 'Seattle, WA', locationType: 'HYBRID', rateMin: 110, rateMax: 140,
      startDate: daysAgo(30), durationMonths: 12, status: 'ACTIVE',
      closureLikelihood: 0.45, freshnessScore: 0.72,
    } }),
    /* 16 FILLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[10]!.id, clientCompanyId: clients[6]!.id,
      title: 'CI/CD Pipeline Engineer', pod: 'CLOUD_DEVOPS',
      description: 'CI/CD pipeline engineer for software delivery.',
      skills: ['Jenkins', 'GitLab CI', 'Docker', 'AWS CodePipeline'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 90, rateMax: 115,
      status: 'FILLED', closureLikelihood: 1.0, freshnessScore: 0.10,
    } }),
    /* 17 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[8]!.id, clientCompanyId: clients[2]!.id,
      title: 'Cloud Security Architect', pod: 'CLOUD_DEVOPS',
      description: 'Cloud security architect for healthcare infrastructure.',
      skills: ['AWS Security', 'IAM', 'VPC', 'GuardDuty'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 110, rateMax: 135,
      status: 'ACTIVE', closureLikelihood: 0.35, freshnessScore: 0.55,
    } }),
    /* 18 NEW */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[7]!.id,
      title: 'GCP Data Engineer', pod: 'CLOUD_DEVOPS',
      description: 'GCP data engineer for analytics infrastructure.',
      skills: ['GCP', 'BigQuery', 'Dataflow', 'Terraform'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 95, rateMax: 120,
      status: 'NEW', freshnessScore: 1.0,
    } }),
    /* 19 ON_HOLD */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[4]!.id,
      title: 'Azure DevOps Lead', pod: 'CLOUD_DEVOPS',
      description: 'Azure DevOps lead for enterprise migration.',
      skills: ['Azure DevOps', 'ARM Templates', 'PowerShell'],
      location: 'Dallas, TX', locationType: 'HYBRID', rateMin: 100, rateMax: 125,
      status: 'ON_HOLD', closureLikelihood: 0.10, freshnessScore: 0.20,
    } }),
    /* 20 CANCELLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[9]!.id,
      title: 'AWS Solutions Architect', pod: 'CLOUD_DEVOPS',
      description: 'Solutions architect for cloud migration.',
      skills: ['AWS', 'Architecture', 'Well-Architected'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 120, rateMax: 150,
      status: 'CANCELLED', freshnessScore: 0.0,
    } }),
    /* 21 CANCELLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[9]!.id,
      title: 'Infrastructure Automation Engineer', pod: 'CLOUD_DEVOPS',
      description: 'Infrastructure automation using Ansible and Terraform.',
      skills: ['Ansible', 'Terraform', 'Python', 'AWS'],
      location: 'Chicago, IL', locationType: 'HYBRID', rateMin: 90, rateMax: 115,
      status: 'CANCELLED', freshnessScore: 0.0,
    } }),
    // ── DATA (22–33) ─────────────────────────────────────────────
    /* 22 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[2]!.id, clientCompanyId: clients[1]!.id,
      title: 'Data Engineer - Snowflake/dbt', pod: 'DATA',
      description: 'Data engineer for analytics platform modernization.',
      skills: ['Snowflake', 'dbt', 'Airflow', 'Python'],
      location: 'Chicago, IL', locationType: 'HYBRID', rateMin: 95, rateMax: 120,
      status: 'ACTIVE', closureLikelihood: 0.55, freshnessScore: 0.60,
    } }),
    /* 23 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[1]!.id, clientCompanyId: clients[3]!.id,
      title: 'ML Engineer - NLP', pod: 'DATA',
      description: 'Machine Learning Engineer for NLP models.',
      skills: ['Python', 'PyTorch', 'NLP', 'Transformers'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 100, rateMax: 130,
      status: 'ACTIVE', closureLikelihood: 0.45, freshnessScore: 0.55,
    } }),
    /* 24 FILLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[3]!.id, clientCompanyId: clients[4]!.id,
      title: 'Data Analyst', pod: 'DATA',
      description: 'Business intelligence analyst for consulting.',
      skills: ['SQL', 'Tableau', 'Python', 'Excel'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 60, rateMax: 80,
      status: 'FILLED', closureLikelihood: 1.0, freshnessScore: 0.10,
    } }),
    /* 25 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[5]!.id, clientCompanyId: clients[6]!.id,
      title: 'Spark Data Pipeline Engineer', pod: 'DATA',
      description: 'Data pipeline engineer using Spark and Kafka.',
      skills: ['Spark', 'Kafka', 'Python', 'Airflow', 'AWS'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 100, rateMax: 125,
      status: 'ACTIVE', closureLikelihood: 0.40, freshnessScore: 0.55,
    } }),
    /* 26 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[7]!.id, clientCompanyId: clients[1]!.id,
      title: 'ETL Developer', pod: 'DATA',
      description: 'ETL developer for data warehouse migration.',
      skills: ['SQL', 'Python', 'Informatica', 'AWS Glue'],
      location: 'Chicago, IL', locationType: 'HYBRID', rateMin: 80, rateMax: 105,
      status: 'ACTIVE', closureLikelihood: 0.35, freshnessScore: 0.50,
    } }),
    /* 27 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[6]!.id, clientCompanyId: clients[5]!.id,
      title: 'Data Platform Architect', pod: 'DATA',
      description: 'Data platform architect for lakehouse architecture.',
      skills: ['Snowflake', 'Databricks', 'dbt', 'Terraform'],
      location: 'Seattle, WA', locationType: 'HYBRID', rateMin: 120, rateMax: 150,
      status: 'ACTIVE', closureLikelihood: 0.30, freshnessScore: 0.45,
    } }),
    /* 28 ON_HOLD */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[10]!.id,
      title: 'BI Analyst (Tableau)', pod: 'DATA',
      description: 'BI analyst for executive dashboards.',
      skills: ['Tableau', 'SQL', 'Python', 'Looker'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 70, rateMax: 90,
      status: 'ON_HOLD', closureLikelihood: 0.10, freshnessScore: 0.20,
    } }),
    /* 29 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[0]!.id, clientCompanyId: clients[7]!.id,
      title: 'Data Science Lead', pod: 'DATA',
      description: 'Data science lead for ML platform.',
      skills: ['Python', 'TensorFlow', 'MLOps', 'Statistics'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 115, rateMax: 140,
      status: 'ACTIVE', closureLikelihood: 0.50, freshnessScore: 0.62,
    } }),
    /* 30 NEW */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[8]!.id, clientCompanyId: clients[0]!.id,
      title: 'Kafka Streaming Engineer', pod: 'DATA',
      description: 'Kafka streaming engineer for real-time analytics.',
      skills: ['Kafka', 'Java', 'Spark Streaming', 'Flink'],
      location: 'New York, NY', locationType: 'HYBRID', rateMin: 100, rateMax: 125,
      status: 'NEW', freshnessScore: 1.0,
    } }),
    /* 31 ON_HOLD */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[11]!.id,
      title: 'Python Data Engineer', pod: 'DATA',
      description: 'Python data engineer for ETL pipelines.',
      skills: ['Python', 'Airflow', 'dbt', 'Snowflake'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 85, rateMax: 110,
      status: 'ON_HOLD', closureLikelihood: 0.10, freshnessScore: 0.15,
    } }),
    /* 32 FILLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[3]!.id, clientCompanyId: clients[3]!.id,
      title: 'ML Ops Engineer', pod: 'DATA',
      description: 'ML Ops engineer for model deployment pipeline.',
      skills: ['MLOps', 'Kubernetes', 'Python', 'MLflow'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 100, rateMax: 125,
      status: 'FILLED', closureLikelihood: 1.0, freshnessScore: 0.10,
    } }),
    /* 33 CANCELLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[4]!.id,
      title: 'Snowflake Administrator', pod: 'DATA',
      description: 'Snowflake admin for data warehouse management.',
      skills: ['Snowflake', 'SQL', 'dbt', 'Terraform'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 85, rateMax: 110,
      status: 'CANCELLED', freshnessScore: 0.0,
    } }),
    // ── CYBER (34–39) ────────────────────────────────────────────
    /* 34 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[1]!.id, clientCompanyId: clients[2]!.id,
      title: 'Security Engineer - IAM/Cloud', pod: 'CYBER',
      description: 'Security engineer for IAM and cloud security.',
      skills: ['IAM', 'Cloud Security', 'SIEM', 'SOC'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 100, rateMax: 125,
      status: 'ACTIVE', closureLikelihood: 0.70, freshnessScore: 0.88,
    } }),
    /* 35 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[0]!.id, clientCompanyId: clients[0]!.id,
      title: 'SOC Analyst L3', pod: 'CYBER',
      description: 'Senior SOC analyst for financial institution.',
      skills: ['Splunk', 'SIEM', 'Incident Response', 'Forensics'],
      location: 'New York, NY', locationType: 'ONSITE', rateMin: 90, rateMax: 115,
      status: 'ACTIVE', closureLikelihood: 0.60, freshnessScore: 0.72,
    } }),
    /* 36 ON_HOLD */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[6]!.id, clientCompanyId: clients[5]!.id,
      title: 'Penetration Tester', pod: 'CYBER',
      description: 'Penetration tester for security assessments.',
      skills: ['Pen Testing', 'Burp Suite', 'Kali', 'OWASP'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 100, rateMax: 130,
      status: 'ON_HOLD', closureLikelihood: 0.10, freshnessScore: 0.20,
    } }),
    /* 37 NEW */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[8]!.id, clientCompanyId: clients[7]!.id,
      title: 'Incident Response Lead', pod: 'CYBER',
      description: 'Incident response lead for security operations.',
      skills: ['Incident Response', 'Forensics', 'SIEM', 'SOC'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 105, rateMax: 130,
      status: 'NEW', freshnessScore: 1.0,
    } }),
    /* 38 CANCELLED */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[10]!.id,
      title: 'Cloud Security Engineer', pod: 'CYBER',
      description: 'Cloud security engineer for AWS environment.',
      skills: ['AWS Security', 'CloudTrail', 'Config', 'GuardDuty'],
      location: 'Remote', locationType: 'REMOTE', rateMin: 95, rateMax: 120,
      status: 'CANCELLED', freshnessScore: 0.0,
    } }),
    /* 39 ACTIVE */ prisma.job.create({ data: {
      tenantId: T, vendorId: vendors[5]!.id, clientCompanyId: clients[3]!.id,
      title: 'SIEM/SOC Engineer', pod: 'CYBER',
      description: 'SIEM engineer for security operations center.',
      skills: ['Splunk', 'SIEM', 'SOC', 'Python'],
      location: 'McLean, VA', locationType: 'HYBRID', rateMin: 90, rateMax: 115,
      status: 'ACTIVE', closureLikelihood: 0.55, freshnessScore: 0.68,
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // RATE CARDS (22) — 17 historical + 5 created today
  // ══════════════════════════════════════════════════════════════════

  const rateCards = await Promise.all([
    /* 0  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 95, payRate: 75, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 20, netMarginHr: 8.26, marginSafe: false, minMarginTarget: 10 } }),
    /* 1  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 110, payRate: 82, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 28, netMarginHr: 15.16, marginSafe: true, minMarginTarget: 10 } }),
    /* 2  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 125, payRate: 98, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 27, netMarginHr: 11.67, marginSafe: true, minMarginTarget: 10 } }),
    /* 3  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 115, payRate: 88, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 27, netMarginHr: 13.22, marginSafe: true, minMarginTarget: 10 } }),
    /* 4  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 120, payRate: 92, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 28, netMarginHr: 13.60, marginSafe: true, minMarginTarget: 10 } }),
    /* 5  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 100, payRate: 78, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 22, netMarginHr: 9.80, marginSafe: false, minMarginTarget: 10 } }),
    /* 6  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 105, payRate: 80, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 25, netMarginHr: 12.48, marginSafe: true, minMarginTarget: 10 } }),
    /* 7  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 130, payRate: 100, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 30, netMarginHr: 14.35, marginSafe: true, minMarginTarget: 10 } }),
    /* 8  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 108, payRate: 85, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 23, netMarginHr: 9.70, marginSafe: false, minMarginTarget: 10 } }),
    /* 9  */ prisma.rateCard.create({ data: { tenantId: T, billRate: 90, payRate: 72, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 18, netMarginHr: 6.92, marginSafe: false, minMarginTarget: 10 } }),
    /* 10 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 115, payRate: 90, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 25, netMarginHr: 10.93, marginSafe: true, minMarginTarget: 10 } }),
    /* 11 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 98, payRate: 80, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 18, netMarginHr: 5.52, marginSafe: false, minMarginTarget: 10 } }),
    /* 12 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 112, payRate: 86, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 26, netMarginHr: 12.52, marginSafe: true, minMarginTarget: 10 } }),
    /* 13 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 135, payRate: 105, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 30, netMarginHr: 13.55, marginSafe: true, minMarginTarget: 10 } }),
    /* 14 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 102, payRate: 82, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 20, netMarginHr: 7.16, marginSafe: false, minMarginTarget: 10 } }),
    /* 15 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 118, payRate: 92, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 26, netMarginHr: 11.62, marginSafe: true, minMarginTarget: 10 } }),
    /* 16 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 88, payRate: 72, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 16, netMarginHr: 4.68, marginSafe: false, minMarginTarget: 10 } }),
    // ── Today's rate cards (for margin health computation) ──
    /* 17 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 108, payRate: 82, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 26, netMarginHr: 13.16, marginSafe: true, minMarginTarget: 10, createdAt: hoursAgo(5) } }),
    /* 18 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 95, payRate: 78, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 17, netMarginHr: 4.79, marginSafe: false, minMarginTarget: 10, createdAt: hoursAgo(4) } }),
    /* 19 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 120, payRate: 90, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 30, netMarginHr: 15.90, marginSafe: true, minMarginTarget: 10, createdAt: hoursAgo(3) } }),
    /* 20 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 112, payRate: 85, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 27, netMarginHr: 13.70, marginSafe: true, minMarginTarget: 10, createdAt: hoursAgo(2) } }),
    /* 21 */ prisma.rateCard.create({ data: { tenantId: T, billRate: 128, payRate: 98, burdenPct: 8, payrollTaxPct: 7.65, grossMarginHr: 30, netMarginHr: 14.71, marginSafe: true, minMarginTarget: 10, createdAt: hoursAgo(1) } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // SUBMISSIONS (120) — realistic 90-day pipeline
  //   ACCEPTED(18) REJECTED(15) WITHDRAWN(8) INTERVIEWING(20)
  //   OFFERED(12) SUBMITTED(25) CONSENT_PENDING(12) DRAFT(8) CLOSED(2)
  //
  // Helper: mkSub(jobIdx, consultantIdx, status, createdAt, opts)
  // JV = job→vendor index for consent vendorName lookups
  // ══════════════════════════════════════════════════════════════════

  const JV = [0,1,3,5,6,7,0,10,4,9,3,8,0,3,5,6,10,8,7,4,9,9,2,1,3,5,7,6,10,0,8,11,3,4,1,0,6,8,10,5];

  type SO = { rc?: number; agent?: boolean; fb?: string; fbAt?: Date; mo?: boolean; mOk?: boolean; consent?: number; auto?: boolean };
  const mkSub = (j: number, c: number, status: string, at: Date, o: SO = {}) =>
    prisma.submission.create({ data: {
      tenantId: T, jobId: jobs[j]!.id, consultantId: consultants[c]!.id,
      status: status as any, createdAt: at, marginApproved: o.mOk !== false,
      ...(o.agent ? { submitterType: 'AGENT' as const, agentId: 'submission-agent-001' } : { submittedById: users[1]!.id, submitterType: 'USER' as const }),
      ...(o.rc !== undefined ? { rateCardId: rateCards[o.rc]!.id } : {}),
      ...(o.fb ? { vendorFeedback: o.fb, feedbackReceivedAt: o.fbAt } : {}),
      ...(o.mo ? { marginOverrideBy: users[0]!.id } : {}),
      ...(o.consent !== undefined ? { consentRecord: { create: {
        tenantId: T, consultantId: consultants[c]!.id,
        consentType: (o.auto ? 'AUTO_POLICY' : 'EXPLICIT') as any,
        vendorName: vendors[JV[j]!]!.companyName, jobTitle: jobs[j]!.title, rateSubmitted: o.consent,
      } } } : {}),
    } });

  const submissions = await Promise.all([
    // ── ACCEPTED (0–17) — these feed placements & conversion rates ──
    /* 0  */ mkSub(0, 0, 'ACCEPTED', daysAgo(45), { rc: 0, consent: 90 }),
    /* 1  */ mkSub(1, 1, 'ACCEPTED', daysAgo(60), { rc: 1, consent: 105 }),
    /* 2  */ mkSub(12, 2, 'ACCEPTED', daysAgo(40), { rc: 2, consent: 120 }),
    /* 3  */ mkSub(22, 3, 'ACCEPTED', daysAgo(85), { rc: 3, consent: 110 }),
    /* 4  */ mkSub(34, 4, 'ACCEPTED', daysAgo(35), { rc: 4, consent: 115 }),
    /* 5  */ mkSub(3, 5, 'ACCEPTED', daysAgo(20), { rc: 5, consent: 95 }),
    /* 6  */ mkSub(15, 6, 'ACCEPTED', daysAgo(30), { rc: 7, consent: 125 }),
    /* 7  */ mkSub(39, 7, 'ACCEPTED', daysAgo(25), { rc: 8, consent: 100 }),
    /* 8  */ mkSub(6, 22, 'ACCEPTED', daysAgo(120), { rc: 6, consent: 100 }),
    /* 9  */ mkSub(16, 20, 'ACCEPTED', daysAgo(100), { rc: 10, consent: 110 }),
    /* 10 */ mkSub(24, 19, 'ACCEPTED', daysAgo(110), { rc: 11, consent: 75 }),
    /* 11 */ mkSub(11, 18, 'ACCEPTED', daysAgo(130), { rc: 9, consent: 88 }),
    /* 12 — ACCEPTED TODAY (closure) */ mkSub(4, 9, 'ACCEPTED', hoursAgo(3), { rc: 17, consent: 105 }),
    /* 13 — ACCEPTED TODAY (closure) */ mkSub(23, 8, 'ACCEPTED', hoursAgo(2), { rc: 19, consent: 115 }),
    /* 14 */ mkSub(13, 10, 'ACCEPTED', daysAgo(2), { rc: 12, consent: 118 }),
    /* 15 */ mkSub(5, 15, 'ACCEPTED', daysAgo(3), { rc: 14, consent: 95 }),
    /* 16 */ mkSub(25, 14, 'ACCEPTED', daysAgo(1), { rc: 15, consent: 112 }),
    /* 17 */ mkSub(35, 11, 'ACCEPTED', daysAgo(2), { rc: 13, consent: 108 }),

    // ── REJECTED (18–32) ─────────────────────────────────────────
    /* 18 */ mkSub(0, 9, 'REJECTED', daysAgo(35), { rc: 6, fb: 'Not enough Spring Boot experience', fbAt: daysAgo(30), consent: 95 }),
    /* 19 */ mkSub(1, 13, 'REJECTED', daysAgo(30), { rc: 1, fb: 'Looking for more senior candidate', fbAt: daysAgo(25), consent: 100 }),
    /* 20 */ mkSub(12, 12, 'REJECTED', daysAgo(25), { rc: 2, fb: 'Client wanted more Azure experience', fbAt: daysAgo(20), consent: 115 }),
    /* 21 */ mkSub(2, 18, 'REJECTED', daysAgo(22), { rc: 6, fb: 'Rate too high for budget', fbAt: daysAgo(18), consent: 98 }),
    /* 22 */ mkSub(22, 17, 'REJECTED', daysAgo(20), { rc: 3, fb: 'Position filled internally', fbAt: daysAgo(15), consent: 100 }),
    /* 23 */ mkSub(14, 16, 'REJECTED', daysAgo(18), { rc: 10, fb: 'Not enough SRE experience', fbAt: daysAgo(12), consent: 110 }),
    /* 24 */ mkSub(23, 14, 'REJECTED', daysAgo(15), { rc: 3, fb: 'Client preferred onshore candidate', fbAt: daysAgo(10), consent: 108 }),
    /* 25 */ mkSub(5, 13, 'REJECTED', daysAgo(12), { rc: 14, fb: 'Failed technical assessment', fbAt: daysAgo(8), consent: 100 }),
    /* 26 */ mkSub(34, 21, 'REJECTED', daysAgo(10), { rc: 4, fb: 'Insufficient cloud security background', fbAt: daysAgo(7), consent: 112 }),
    /* 27 */ mkSub(17, 12, 'REJECTED', daysAgo(8), { rc: 8, fb: 'Client went with internal transfer', fbAt: daysAgo(6), consent: 115 }),
    /* 28 */ mkSub(29, 17, 'REJECTED', daysAgo(7), { rc: 10, fb: 'Overqualified for the role', fbAt: daysAgo(5), consent: 100 }),
    /* 29 */ mkSub(3, 9, 'REJECTED', daysAgo(6), { rc: 5, fb: 'Position already filled', fbAt: daysAgo(4), consent: 92 }),
    /* 30 */ mkSub(15, 10, 'REJECTED', daysAgo(5), { rc: 7, fb: 'Schedule conflict', fbAt: daysAgo(3), consent: 118 }),
    /* 31 */ mkSub(0, 13, 'REJECTED', daysAgo(40), { rc: 0, fb: 'Client preferred more microservices exp', fbAt: daysAgo(35), consent: 95 }),
    /* 32 */ mkSub(22, 8, 'REJECTED', daysAgo(45), { rc: 3, fb: 'Not enough Snowflake experience', fbAt: daysAgo(40), consent: 105 }),

    // ── WITHDRAWN (33–40) ────────────────────────────────────────
    /* 33 */ mkSub(4, 13, 'WITHDRAWN', daysAgo(15), { rc: 6, consent: 100 }),
    /* 34 */ mkSub(2, 15, 'WITHDRAWN', daysAgo(12), { rc: 14, consent: 95 }),
    /* 35 */ mkSub(12, 10, 'WITHDRAWN', daysAgo(10), { rc: 2, consent: 115 }),
    /* 36 */ mkSub(25, 17, 'WITHDRAWN', daysAgo(8), { rc: 15, consent: 100 }),
    /* 37 */ mkSub(34, 23, 'WITHDRAWN', daysAgo(6), { rc: 4, consent: 100 }),
    /* 38 */ mkSub(14, 22, 'WITHDRAWN', daysAgo(5), { rc: 10, consent: 95 }),
    /* 39 */ mkSub(39, 21, 'WITHDRAWN', daysAgo(4), { rc: 8, consent: 108 }),
    /* 40 */ mkSub(27, 19, 'WITHDRAWN', daysAgo(3), { rc: 10, consent: 90 }),

    // ── INTERVIEWING (41–60) ─────────────────────────────────────
    /* 41 */ mkSub(2, 8, 'INTERVIEWING', daysAgo(8), { rc: 3, consent: 108, fb: 'Strong ML background, moving to round 2', fbAt: daysAgo(4) }),
    /* 42 */ mkSub(5, 9, 'INTERVIEWING', daysAgo(7), { rc: 14, consent: 95 }),
    /* 43 */ mkSub(4, 22, 'INTERVIEWING', daysAgo(7), { rc: 6, consent: 95 }),
    /* 44 */ mkSub(0, 12, 'INTERVIEWING', daysAgo(6), { rc: 0, consent: 90 }),
    /* 45 */ mkSub(13, 16, 'INTERVIEWING', daysAgo(6), { rc: 10, consent: 110 }),
    /* 46 */ mkSub(14, 10, 'INTERVIEWING', daysAgo(5), { rc: 2, consent: 118 }),
    /* 47 */ mkSub(17, 20, 'INTERVIEWING', daysAgo(5), { rc: 8, consent: 105 }),
    /* 48 */ mkSub(22, 14, 'INTERVIEWING', daysAgo(5), { rc: 3, consent: 110 }),
    /* 49 */ mkSub(23, 17, 'INTERVIEWING', daysAgo(4), { rc: 1, consent: 100 }),
    /* 50 */ mkSub(25, 8, 'INTERVIEWING', daysAgo(4), { rc: 15, consent: 110 }),
    /* 51 */ mkSub(26, 19, 'INTERVIEWING', daysAgo(4), { rc: 5, consent: 90 }),
    /* 52 */ mkSub(27, 13, 'INTERVIEWING', daysAgo(3), { rc: 7, consent: 105 }),
    /* 53 */ mkSub(29, 8, 'INTERVIEWING', daysAgo(3), { rc: 10, consent: 110 }),
    /* 54 */ mkSub(34, 11, 'INTERVIEWING', daysAgo(3), { rc: 4, consent: 108 }),
    /* 55 */ mkSub(35, 7, 'INTERVIEWING', daysAgo(3), { rc: 0, consent: 95 }),
    /* 56 */ mkSub(39, 29, 'INTERVIEWING', daysAgo(2), { rc: 8, consent: 100 }),
    /* 57 */ mkSub(1, 15, 'INTERVIEWING', daysAgo(2), { rc: 1, consent: 100 }),
    /* 58 */ mkSub(3, 22, 'INTERVIEWING', daysAgo(2), { rc: 5, consent: 92 }),
    /* 59 */ mkSub(12, 26, 'INTERVIEWING', daysAgo(1), { rc: 2, consent: 105 }),
    /* 60 */ mkSub(15, 12, 'INTERVIEWING', daysAgo(1), { rc: 7, consent: 115 }),

    // ── OFFERED (61–72) ──────────────────────────────────────────
    /* 61 */ mkSub(0, 15, 'OFFERED', daysAgo(12), { rc: 14, consent: 95 }),
    /* 62 */ mkSub(2, 13, 'OFFERED', daysAgo(10), { rc: 6, consent: 100 }),
    /* 63 */ mkSub(5, 22, 'OFFERED', daysAgo(9), { rc: 14, consent: 92 }),
    /* 64 */ mkSub(13, 12, 'OFFERED', daysAgo(8), { rc: 2, consent: 115 }),
    /* 65 */ mkSub(17, 10, 'OFFERED', daysAgo(7), { rc: 8, consent: 118 }),
    /* 66 */ mkSub(22, 19, 'OFFERED', daysAgo(6), { rc: 3, consent: 90 }),
    /* 67 */ mkSub(26, 17, 'OFFERED', daysAgo(5), { rc: 5, consent: 100 }),
    /* 68 */ mkSub(29, 14, 'OFFERED', daysAgo(4), { rc: 10, consent: 112 }),
    /* 69 */ mkSub(34, 29, 'OFFERED', daysAgo(3), { rc: 4, consent: 100 }),
    /* 70 */ mkSub(39, 23, 'OFFERED', daysAgo(3), { rc: 8, consent: 100 }),
    /* 71 */ mkSub(27, 8, 'OFFERED', daysAgo(2), { rc: 7, consent: 110 }),
    /* 72 */ mkSub(14, 8, 'OFFERED', daysAgo(2), { rc: 10, consent: 110 }),

    // ── SUBMITTED — today (73–80) ────────────────────────────────
    /* 73 */ mkSub(0, 10, 'SUBMITTED', hoursAgo(5), { rc: 17, consent: 90 }),
    /* 74 */ mkSub(2, 11, 'SUBMITTED', hoursAgo(5), { rc: 18, consent: 105 }),
    /* 75 */ mkSub(5, 10, 'SUBMITTED', hoursAgo(4), { rc: 19, consent: 95 }),
    /* 76 */ mkSub(13, 15, 'SUBMITTED', hoursAgo(4), { rc: 20, consent: 100 }),
    /* 77 */ mkSub(22, 9, 'SUBMITTED', hoursAgo(3), { rc: 17, consent: 92 }),
    /* 78 */ mkSub(39, 11, 'SUBMITTED', hoursAgo(3), { rc: 21, consent: 108 }),
    /* 79 */ mkSub(25, 9, 'SUBMITTED', hoursAgo(2), { rc: 19, consent: 100 }),
    /* 80 */ mkSub(14, 13, 'SUBMITTED', hoursAgo(1), { rc: 20, consent: 105 }),

    // ── SUBMITTED — past 30 days (81–97) ─────────────────────────
    /* 81 */ mkSub(1, 9, 'SUBMITTED', daysAgo(3), { rc: 1, consent: 95 }),
    /* 82 */ mkSub(3, 13, 'SUBMITTED', daysAgo(5), { rc: 5, consent: 100 }),
    /* 83 */ mkSub(4, 15, 'SUBMITTED', daysAgo(7), { rc: 6, consent: 95 }),
    /* 84 */ mkSub(12, 16, 'SUBMITTED', daysAgo(8), { rc: 2, consent: 110 }),
    /* 85 */ mkSub(13, 20, 'SUBMITTED', daysAgo(10), { rc: 10, consent: 105 }),
    /* 86 */ mkSub(14, 26, 'SUBMITTED', daysAgo(12), { rc: 10, consent: 105 }),
    /* 87 */ mkSub(17, 26, 'SUBMITTED', daysAgo(14), { rc: 8, consent: 105 }),
    /* 88 */ mkSub(22, 28, 'SUBMITTED', daysAgo(15), { rc: 3, consent: 95 }),
    /* 89 */ mkSub(23, 19, 'SUBMITTED', daysAgo(18), { rc: 1, consent: 90 }),
    /* 90 */ mkSub(25, 19, 'SUBMITTED', daysAgo(20), { rc: 15, consent: 90 }),
    /* 91 */ mkSub(27, 14, 'SUBMITTED', daysAgo(22), { rc: 7, consent: 112 }),
    /* 92 */ mkSub(29, 19, 'SUBMITTED', daysAgo(24), { rc: 10, consent: 90 }),
    /* 93 */ mkSub(26, 8, 'SUBMITTED', daysAgo(25), { rc: 5, consent: 105 }),
    /* 94 */ mkSub(29, 28, 'SUBMITTED', daysAgo(26), { rc: 9, consent: 95 }),
    /* 95 */ mkSub(30, 17, 'SUBMITTED', daysAgo(27), { rc: 3, consent: 100 }),
    /* 96 */ mkSub(1, 22, 'SUBMITTED', daysAgo(28), { rc: 1, consent: 92 }),
    /* 97 */ mkSub(4, 18, 'SUBMITTED', daysAgo(30), { rc: 6, consent: 98 }),

    // ── CONSENT_PENDING (98–109) — agent auto-matches ────────────
    /* 98  */ mkSub(0, 16, 'CONSENT_PENDING', hoursAgo(6), { rc: 0, agent: true }),
    /* 99  */ mkSub(2, 9, 'CONSENT_PENDING', hoursAgo(5), { rc: 6, agent: true }),
    /* 100 */ mkSub(5, 18, 'CONSENT_PENDING', hoursAgo(5), { rc: 14, agent: true }),
    /* 101 */ mkSub(12, 20, 'CONSENT_PENDING', hoursAgo(4), { rc: 2, agent: true }),
    /* 102 */ mkSub(23, 28, 'CONSENT_PENDING', hoursAgo(4), { rc: 1, agent: true }),
    /* 103 */ mkSub(25, 28, 'CONSENT_PENDING', hoursAgo(3), { rc: 15, agent: true }),
    /* 104 */ mkSub(37, 21, 'CONSENT_PENDING', hoursAgo(3), { rc: 4, agent: true }),
    /* 105 */ mkSub(37, 29, 'CONSENT_PENDING', hoursAgo(2), { rc: 13, agent: true }),
    /* 106 */ mkSub(26, 28, 'CONSENT_PENDING', hoursAgo(2), { rc: 5, agent: true }),
    /* 107 */ mkSub(30, 14, 'CONSENT_PENDING', hoursAgo(1), { rc: 3, agent: true }),
    /* 108 */ mkSub(15, 16, 'CONSENT_PENDING', hoursAgo(1), { rc: 7, agent: true }),
    /* 109 */ mkSub(29, 24, 'CONSENT_PENDING', hoursAgo(1), { rc: 10, agent: true }),

    // ── DRAFT (110–117) ──────────────────────────────────────────
    /* 110 */ mkSub(7, 9, 'DRAFT', hoursAgo(2), {}),
    /* 111 */ mkSub(10, 15, 'DRAFT', hoursAgo(3), {}),
    /* 112 */ mkSub(18, 16, 'DRAFT', hoursAgo(4), {}),
    /* 113 */ mkSub(30, 19, 'DRAFT', hoursAgo(2), {}),
    /* 114 */ mkSub(37, 23, 'DRAFT', hoursAgo(1), {}),
    /* 115 */ mkSub(7, 13, 'DRAFT', daysAgo(1), {}),
    /* 116 */ mkSub(18, 26, 'DRAFT', daysAgo(1), {}),
    /* 117 */ mkSub(27, 17, 'DRAFT', daysAgo(1), {}),

    // ── CLOSED (118–119) ─────────────────────────────────────────
    /* 118 */ mkSub(8, 13, 'CLOSED', daysAgo(45), { rc: 16, consent: 85 }),
    /* 119 */ mkSub(19, 12, 'CLOSED', daysAgo(40), { rc: 9, consent: 90 }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // INTERVIEWS (40) — 31 COMPLETED, 5 SCHEDULED, 3 NO_SHOW, 1 CANCELLED
  // ══════════════════════════════════════════════════════════════════

  type IO = { r?: number; fb?: string; d?: number; ca?: Date };
  const mkIv = (si: number, at: Date, type: string, st: string, o: IO = {}) =>
    prisma.interview.create({ data: {
      tenantId: T, submissionId: submissions[si]!.id, scheduledAt: at,
      durationMinutes: o.d ?? 60, interviewType: type, status: st as any,
      ...(o.r !== undefined ? { rating: o.r } : {}),
      ...(o.fb ? { interviewerFeedback: o.fb } : {}),
      createdAt: o.ca ?? daysAgo(2),
    } });

  await Promise.all([
    // ── COMPLETED — active placements (subs 0–7) ────────────────
    mkIv(0, daysAgo(42), 'Technical', 'COMPLETED', { r: 4, fb: 'Strong Java skills', ca: daysAgo(44) }),
    mkIv(0, daysAgo(40), 'Managerial', 'COMPLETED', { r: 5, ca: daysAgo(42) }),
    mkIv(1, daysAgo(55), 'Technical', 'COMPLETED', { r: 4, fb: 'Excellent React/Node', ca: daysAgo(57) }),
    mkIv(1, daysAgo(52), 'Panel', 'COMPLETED', { r: 4, ca: daysAgo(54) }),
    mkIv(2, daysAgo(37), 'Technical', 'COMPLETED', { r: 5, fb: 'Outstanding DevOps skills', ca: daysAgo(39) }),
    mkIv(3, daysAgo(82), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(84) }),
    mkIv(3, daysAgo(78), 'Managerial', 'COMPLETED', { r: 5, ca: daysAgo(80) }),
    mkIv(4, daysAgo(32), 'Technical', 'COMPLETED', { r: 4, fb: 'Strong security background', ca: daysAgo(34) }),
    mkIv(5, daysAgo(17), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(19) }),
    mkIv(6, daysAgo(27), 'Technical', 'COMPLETED', { r: 5, fb: 'Kubernetes expert', ca: daysAgo(29) }),
    mkIv(6, daysAgo(24), 'Panel', 'COMPLETED', { r: 4, ca: daysAgo(26) }),
    mkIv(7, daysAgo(22), 'Technical', 'COMPLETED', { r: 4, fb: 'Solid SIEM experience', ca: daysAgo(24) }),
    // ── COMPLETED — completed placements (subs 8–11) ────────────
    mkIv(8, daysAgo(118), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(120) }),
    mkIv(8, daysAgo(115), 'Managerial', 'COMPLETED', { r: 4, ca: daysAgo(117) }),
    mkIv(9, daysAgo(98), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(100) }),
    mkIv(10, daysAgo(108), 'Technical', 'COMPLETED', { r: 3, ca: daysAgo(110) }),
    mkIv(11, daysAgo(128), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(130) }),
    mkIv(11, daysAgo(125), 'Panel', 'COMPLETED', { r: 5, ca: daysAgo(127) }),
    // ── COMPLETED — today's closures (subs 12–13) ───────────────
    mkIv(12, daysAgo(6), 'Technical', 'COMPLETED', { r: 5, fb: 'Excellent Angular skills', ca: daysAgo(8) }),
    mkIv(12, daysAgo(3), 'Managerial', 'COMPLETED', { r: 4, ca: daysAgo(5) }),
    mkIv(13, daysAgo(4), 'Technical', 'COMPLETED', { r: 5, fb: 'Strong ML/NLP background', ca: daysAgo(6) }),
    // ── COMPLETED — recent accepted (subs 14–17) ────────────────
    mkIv(14, daysAgo(4), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(6) }),
    mkIv(15, daysAgo(5), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(7) }),
    mkIv(16, daysAgo(3), 'Technical', 'COMPLETED', { r: 5, ca: daysAgo(5) }),
    mkIv(17, daysAgo(4), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(6) }),
    // ── COMPLETED — offered subs (61–66) ─────────────────────────
    mkIv(61, daysAgo(10), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(12) }),
    mkIv(62, daysAgo(8), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(10) }),
    mkIv(63, daysAgo(7), 'Panel', 'COMPLETED', { r: 5, ca: daysAgo(9) }),
    mkIv(64, daysAgo(6), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(8) }),
    mkIv(65, daysAgo(5), 'Technical', 'COMPLETED', { r: 3, fb: 'Good but not perfect fit', ca: daysAgo(7) }),
    mkIv(66, daysAgo(4), 'Technical', 'COMPLETED', { r: 4, ca: daysAgo(6) }),
    // ── SCHEDULED — today (3 for dashboard) ──────────────────────
    mkIv(41, hoursAgo(2), 'Technical Round 2', 'SCHEDULED', { ca: daysAgo(3) }),
    mkIv(42, hoursAgo(-4), 'Technical', 'SCHEDULED', { ca: daysAgo(2) }),
    mkIv(43, hoursAgo(-1), 'Managerial', 'SCHEDULED', { d: 45, ca: daysAgo(1) }),
    // ── SCHEDULED — upcoming ─────────────────────────────────────
    mkIv(44, daysAgo(-1), 'Technical', 'SCHEDULED', { ca: daysAgo(1) }),
    mkIv(45, daysAgo(-2), 'Panel', 'SCHEDULED', { d: 90, ca: daysAgo(1) }),
    // ── NO_SHOW ──────────────────────────────────────────────────
    mkIv(18, daysAgo(28), 'Technical', 'NO_SHOW', { ca: daysAgo(30) }),
    mkIv(20, daysAgo(18), 'Technical', 'NO_SHOW', { ca: daysAgo(20) }),
    mkIv(39, daysAgo(3), 'Technical', 'NO_SHOW', { ca: daysAgo(5) }),
    // ── CANCELLED ────────────────────────────────────────────────
    mkIv(33, daysAgo(14), 'Technical', 'CANCELLED', { ca: daysAgo(16) }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // OFFERS (15) — 7 ACCEPTED, 4 EXTENDED, 2 DECLINED, 2 EXPIRED
  // ══════════════════════════════════════════════════════════════════

  const offers = await Promise.all([
    // ── ACCEPTED today — closures ────────────────────────────────
    /* 0 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[12]!.id, jobId: jobs[4]!.id,
      consultantId: consultants[9]!.id, vendorId: vendors[6]!.id,
      billRate: 108, payRate: 82, startDate: daysAgo(-7), status: 'ACCEPTED', updatedAt: hoursAgo(3),
    } }),
    /* 1 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[13]!.id, jobId: jobs[23]!.id,
      consultantId: consultants[8]!.id, vendorId: vendors[1]!.id,
      billRate: 120, payRate: 90, startDate: daysAgo(-5), status: 'ACCEPTED', updatedAt: hoursAgo(2),
    } }),
    // ── ACCEPTED historical — active placements ──────────────────
    /* 2 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[0]!.id, jobId: jobs[0]!.id,
      consultantId: consultants[0]!.id, vendorId: vendors[0]!.id,
      billRate: 95, payRate: 75, status: 'ACCEPTED', createdAt: daysAgo(43), updatedAt: daysAgo(42),
    } }),
    /* 3 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[1]!.id, jobId: jobs[1]!.id,
      consultantId: consultants[1]!.id, vendorId: vendors[1]!.id,
      billRate: 110, payRate: 82, status: 'ACCEPTED', createdAt: daysAgo(58), updatedAt: daysAgo(57),
    } }),
    /* 4 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[2]!.id, jobId: jobs[12]!.id,
      consultantId: consultants[2]!.id, vendorId: vendors[0]!.id,
      billRate: 125, payRate: 98, status: 'ACCEPTED', createdAt: daysAgo(38), updatedAt: daysAgo(37),
    } }),
    /* 5 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[3]!.id, jobId: jobs[22]!.id,
      consultantId: consultants[3]!.id, vendorId: vendors[2]!.id,
      billRate: 115, payRate: 88, status: 'ACCEPTED', createdAt: daysAgo(83), updatedAt: daysAgo(82),
    } }),
    /* 6 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[5]!.id, jobId: jobs[3]!.id,
      consultantId: consultants[5]!.id, vendorId: vendors[5]!.id,
      billRate: 100, payRate: 78, status: 'ACCEPTED', createdAt: daysAgo(18), updatedAt: daysAgo(17),
    } }),
    // ── EXTENDED — active offers (dashboard "Active Offers: 4") ──
    /* 7 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[61]!.id, jobId: jobs[0]!.id,
      consultantId: consultants[15]!.id, vendorId: vendors[0]!.id,
      billRate: 102, payRate: 82, startDate: daysAgo(-14), status: 'EXTENDED', expiresAt: daysAgo(-5),
    } }),
    /* 8 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[62]!.id, jobId: jobs[2]!.id,
      consultantId: consultants[13]!.id, vendorId: vendors[3]!.id,
      billRate: 105, payRate: 80, startDate: daysAgo(-10), status: 'EXTENDED', expiresAt: daysAgo(-3),
    } }),
    /* 9 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[63]!.id, jobId: jobs[5]!.id,
      consultantId: consultants[22]!.id, vendorId: vendors[7]!.id,
      billRate: 112, payRate: 85, startDate: daysAgo(-7), status: 'EXTENDED', expiresAt: daysAgo(-2),
    } }),
    /* 10 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[64]!.id, jobId: jobs[13]!.id,
      consultantId: consultants[12]!.id, vendorId: vendors[3]!.id,
      billRate: 125, payRate: 98, startDate: daysAgo(-5), status: 'EXTENDED', expiresAt: daysAgo(-1),
    } }),
    // ── DECLINED ─────────────────────────────────────────────────
    /* 11 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[65]!.id, jobId: jobs[17]!.id,
      consultantId: consultants[10]!.id, vendorId: vendors[8]!.id,
      billRate: 108, payRate: 85, status: 'DECLINED', createdAt: daysAgo(5), updatedAt: daysAgo(3),
    } }),
    /* 12 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[66]!.id, jobId: jobs[22]!.id,
      consultantId: consultants[19]!.id, vendorId: vendors[2]!.id,
      billRate: 115, payRate: 88, status: 'DECLINED', createdAt: daysAgo(4), updatedAt: daysAgo(2),
    } }),
    // ── EXPIRED ──────────────────────────────────────────────────
    /* 13 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[67]!.id, jobId: jobs[26]!.id,
      consultantId: consultants[17]!.id, vendorId: vendors[7]!.id,
      billRate: 100, payRate: 78, status: 'EXPIRED', expiresAt: daysAgo(2), createdAt: daysAgo(8),
    } }),
    /* 14 */ prisma.offer.create({ data: {
      tenantId: T, submissionId: submissions[68]!.id, jobId: jobs[29]!.id,
      consultantId: consultants[14]!.id, vendorId: vendors[0]!.id,
      billRate: 115, payRate: 90, status: 'EXPIRED', expiresAt: daysAgo(1), createdAt: daysAgo(6),
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // PLACEMENTS (12) — 8 active + 4 completed
  // Revenue: 8 active × ~$113/hr avg × 40hr/wk × 4.33 ≈ $156K/month
  // ══════════════════════════════════════════════════════════════════

  const placements = await Promise.all([
    // ── Active placements (0–7) ──────────────────────────────────
    /* 0 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[0]!.id, jobId: jobs[0]!.id, vendorId: vendors[0]!.id,
      startDate: daysAgo(42), endDate: daysAgo(-323), billRate: 95, payRate: 75, margin: 20, status: 'ACTIVE',
      retentionDays30: true, retentionDays60: false, extensionCount: 0,
      placementDna: { skills: ['Java', 'Spring Boot', 'AWS'], pod: 'SWE', visaType: 'H1B' },
    } }),
    /* 1 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[1]!.id, jobId: jobs[1]!.id, vendorId: vendors[1]!.id,
      startDate: daysAgo(57), endDate: daysAgo(-123), billRate: 110, payRate: 82, margin: 28, status: 'ACTIVE',
      retentionDays30: true, retentionDays60: true, extensionCount: 0,
      placementDna: { skills: ['React', 'TypeScript', 'Node.js'], pod: 'SWE', visaType: 'GC' },
    } }),
    /* 2 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[2]!.id, jobId: jobs[12]!.id, vendorId: vendors[0]!.id,
      startDate: daysAgo(37), endDate: daysAgo(-328), billRate: 125, payRate: 98, margin: 27, status: 'ACTIVE',
      retentionDays30: true, extensionCount: 0,
      placementDna: { skills: ['DevOps', 'Azure', 'Terraform'], pod: 'CLOUD_DEVOPS', visaType: 'USC' },
    } }),
    /* 3 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[3]!.id, jobId: jobs[22]!.id, vendorId: vendors[2]!.id,
      startDate: daysAgo(82), endDate: daysAgo(-283), billRate: 115, payRate: 88, margin: 27, status: 'ACTIVE',
      retentionDays30: true, retentionDays60: true, retentionDays90: true, extensionCount: 1,
      placementDna: { skills: ['Snowflake', 'dbt', 'Airflow'], pod: 'DATA', visaType: 'GC' },
    } }),
    /* 4 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[4]!.id, jobId: jobs[34]!.id, vendorId: vendors[1]!.id,
      startDate: daysAgo(32), endDate: daysAgo(-333), billRate: 120, payRate: 92, margin: 28, status: 'ACTIVE',
      retentionDays30: true, extensionCount: 0,
      placementDna: { skills: ['IAM', 'Cloud Security', 'SIEM'], pod: 'CYBER', visaType: 'OPT' },
    } }),
    /* 5 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[5]!.id, jobId: jobs[3]!.id, vendorId: vendors[5]!.id,
      startDate: daysAgo(17), billRate: 100, payRate: 78, margin: 22, status: 'ACTIVE',
      placementDna: { skills: ['Java', 'React', 'Spring Boot'], pod: 'SWE', visaType: 'H1B' },
    } }),
    /* 6 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[6]!.id, jobId: jobs[15]!.id, vendorId: vendors[6]!.id,
      startDate: daysAgo(28), endDate: daysAgo(-337), billRate: 130, payRate: 100, margin: 30, status: 'ACTIVE',
      retentionDays30: false, extensionCount: 0,
      placementDna: { skills: ['Kubernetes', 'EKS', 'Helm'], pod: 'CLOUD_DEVOPS', visaType: 'H1B' },
    } }),
    /* 7 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[7]!.id, jobId: jobs[39]!.id, vendorId: vendors[5]!.id,
      startDate: daysAgo(23), billRate: 108, payRate: 85, margin: 23, status: 'ACTIVE',
      placementDna: { skills: ['SIEM', 'SOC', 'Splunk'], pod: 'CYBER', visaType: 'GC' },
    } }),
    // ── Completed placements (8–11) ──────────────────────────────
    /* 8 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[22]!.id, jobId: jobs[6]!.id, vendorId: vendors[0]!.id,
      startDate: daysAgo(200), endDate: daysAgo(50), billRate: 105, payRate: 80, margin: 25, status: 'COMPLETED',
      retentionDays30: true, retentionDays60: true, retentionDays90: true,
    } }),
    /* 9 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[20]!.id, jobId: jobs[16]!.id, vendorId: vendors[10]!.id,
      startDate: daysAgo(180), endDate: daysAgo(60), billRate: 98, payRate: 80, margin: 18, status: 'COMPLETED',
      retentionDays30: true, retentionDays60: true, retentionDays90: true,
    } }),
    /* 10 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[19]!.id, jobId: jobs[24]!.id, vendorId: vendors[3]!.id,
      startDate: daysAgo(160), endDate: daysAgo(40), billRate: 75, payRate: 62, margin: 13, status: 'COMPLETED',
      retentionDays30: true, retentionDays60: true,
    } }),
    /* 11 */ prisma.placement.create({ data: {
      tenantId: T, consultantId: consultants[18]!.id, jobId: jobs[11]!.id, vendorId: vendors[8]!.id,
      startDate: daysAgo(190), endDate: daysAgo(55), billRate: 90, payRate: 72, margin: 18, status: 'COMPLETED',
      retentionDays30: true, retentionDays60: true, retentionDays90: true,
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // ASSIGNMENTS (8) — linked to active placements
  // ══════════════════════════════════════════════════════════════════

  await Promise.all([
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[0]!.id, jobId: jobs[0]!.id, vendorId: vendors[0]!.id, clientCompanyId: clients[0]!.id, placementId: placements[0]!.id, rateCardId: rateCards[0]!.id, startDate: daysAgo(42), projectedEnd: daysAgo(-323), status: 'ACTIVE', onboardingChecklist: [{ item: 'Background check', done: true }, { item: 'Drug test', done: true }, { item: 'VPN access', done: true }] } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[1]!.id, jobId: jobs[1]!.id, vendorId: vendors[1]!.id, clientCompanyId: clients[1]!.id, placementId: placements[1]!.id, rateCardId: rateCards[1]!.id, startDate: daysAgo(57), projectedEnd: daysAgo(-123), status: 'ACTIVE', onboardingChecklist: [{ item: 'Background check', done: true }] } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[2]!.id, jobId: jobs[12]!.id, vendorId: vendors[0]!.id, clientCompanyId: clients[2]!.id, placementId: placements[2]!.id, rateCardId: rateCards[2]!.id, startDate: daysAgo(37), projectedEnd: daysAgo(-328), status: 'ACTIVE' } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[3]!.id, jobId: jobs[22]!.id, vendorId: vendors[2]!.id, clientCompanyId: clients[1]!.id, placementId: placements[3]!.id, rateCardId: rateCards[3]!.id, startDate: daysAgo(82), projectedEnd: daysAgo(-283), status: 'ACTIVE' } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[4]!.id, jobId: jobs[34]!.id, vendorId: vendors[1]!.id, clientCompanyId: clients[2]!.id, placementId: placements[4]!.id, rateCardId: rateCards[4]!.id, startDate: daysAgo(32), projectedEnd: daysAgo(-333), status: 'ACTIVE' } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[5]!.id, jobId: jobs[3]!.id, vendorId: vendors[5]!.id, clientCompanyId: clients[4]!.id, placementId: placements[5]!.id, rateCardId: rateCards[5]!.id, startDate: daysAgo(17), status: 'ACTIVE' } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[6]!.id, jobId: jobs[15]!.id, vendorId: vendors[6]!.id, clientCompanyId: clients[5]!.id, placementId: placements[6]!.id, rateCardId: rateCards[7]!.id, startDate: daysAgo(28), projectedEnd: daysAgo(-337), status: 'ACTIVE' } }),
    prisma.assignment.create({ data: { tenantId: T, consultantId: consultants[7]!.id, jobId: jobs[39]!.id, vendorId: vendors[5]!.id, clientCompanyId: clients[3]!.id, placementId: placements[7]!.id, rateCardId: rateCards[8]!.id, startDate: daysAgo(23), status: 'ACTIVE' } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // TIMESHEETS — 6 weeks for each active placement
  // ══════════════════════════════════════════════════════════════════

  for (const p of placements.slice(0, 8)) {
    const weeksActive = Math.min(Math.floor((Date.now() - p.startDate.getTime()) / (7 * 86400000)), 6);
    for (let w = 0; w < weeksActive; w++) {
      const we = weekEnding(w * 7);
      const status = w === 0 ? 'SUBMITTED' : w === 1 ? 'APPROVED' : 'INVOICED';
      await prisma.timesheet.create({
        data: {
          tenantId: T, placementId: p.id, consultantId: p.consultantId,
          weekEnding: we, hoursRegular: 40, hoursOvertime: w % 3 === 0 ? 4 : 0,
          status, approvedById: status !== 'SUBMITTED' ? users[5]!.id : undefined,
          approvedAt: status !== 'SUBMITTED' ? daysAgo(w * 7 - 2) : undefined,
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // INVOICES (25) — 8 PAID, 5 OVERDUE, 3 PARTIAL, 5 SENT, 4 DRAFT
  // AR overdue total: ~$21K
  // ══════════════════════════════════════════════════════════════════

  const invoices = await Promise.all([
    // ── PAID (0–7) ───────────────────────────────────────────────
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[0]!.id, invoiceNumber: 'INV-2026-0001', periodStart: daysAgo(49), periodEnd: daysAgo(42), totalAmount: 3800, status: 'PAID', sentAt: daysAgo(40), dueDate: daysAgo(10), paidAt: daysAgo(12), paidAmount: 3800 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[0]!.id, invoiceNumber: 'INV-2026-0002', periodStart: daysAgo(42), periodEnd: daysAgo(35), totalAmount: 8800, status: 'PAID', sentAt: daysAgo(33), dueDate: daysAgo(3), paidAt: daysAgo(5), paidAmount: 8800 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[3]!.id, invoiceNumber: 'INV-2026-0003', periodStart: daysAgo(42), periodEnd: daysAgo(35), totalAmount: 4800, status: 'PAID', sentAt: daysAgo(33), dueDate: daysAgo(3), paidAt: daysAgo(4), paidAmount: 4800 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[5]!.id, invoiceNumber: 'INV-2026-0004', periodStart: daysAgo(25), periodEnd: daysAgo(18), totalAmount: 4000, status: 'PAID', sentAt: daysAgo(16), dueDate: daysAgo(0), paidAt: daysAgo(1), paidAmount: 4000 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[6]!.id, invoiceNumber: 'INV-2026-0005', periodStart: daysAgo(35), periodEnd: daysAgo(28), totalAmount: 5200, status: 'PAID', sentAt: daysAgo(26), dueDate: daysAgo(0), paidAt: daysAgo(2), paidAmount: 5200 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[1]!.id, invoiceNumber: 'INV-2026-0006', periodStart: daysAgo(63), periodEnd: daysAgo(56), totalAmount: 4400, status: 'PAID', sentAt: daysAgo(54), dueDate: daysAgo(9), paidAt: daysAgo(10), paidAmount: 4400 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[0]!.id, invoiceNumber: 'INV-2026-0007', periodStart: daysAgo(56), periodEnd: daysAgo(49), totalAmount: 7600, status: 'PAID', sentAt: daysAgo(48), dueDate: daysAgo(18), paidAt: daysAgo(20), paidAmount: 7600 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[2]!.id, invoiceNumber: 'INV-2026-0008', periodStart: daysAgo(84), periodEnd: daysAgo(77), totalAmount: 4600, status: 'PAID', sentAt: daysAgo(76), dueDate: daysAgo(16), paidAt: daysAgo(18), paidAmount: 4600 } }),
    // ── OVERDUE (8–12) — dueDate in the past ─────────────────────
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[1]!.id, invoiceNumber: 'INV-2026-0009', periodStart: daysAgo(56), periodEnd: daysAgo(49), totalAmount: 4400, status: 'OVERDUE', sentAt: daysAgo(48), dueDate: daysAgo(3) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[2]!.id, invoiceNumber: 'INV-2026-0010', periodStart: daysAgo(75), periodEnd: daysAgo(68), totalAmount: 6200, status: 'OVERDUE', sentAt: daysAgo(67), dueDate: daysAgo(15) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[4]!.id, invoiceNumber: 'INV-2026-0011', periodStart: daysAgo(60), periodEnd: daysAgo(53), totalAmount: 3200, status: 'OVERDUE', sentAt: daysAgo(52), dueDate: daysAgo(7) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[9]!.id, invoiceNumber: 'INV-2026-0012', periodStart: daysAgo(90), periodEnd: daysAgo(83), totalAmount: 2800, status: 'OVERDUE', sentAt: daysAgo(82), dueDate: daysAgo(45) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[11]!.id, invoiceNumber: 'INV-2026-0013', periodStart: daysAgo(80), periodEnd: daysAgo(73), totalAmount: 4500, status: 'OVERDUE', sentAt: daysAgo(72), dueDate: daysAgo(30) } }),
    // ── PARTIAL (13–15) ──────────────────────────────────────────
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[1]!.id, invoiceNumber: 'INV-2026-0014', periodStart: daysAgo(49), periodEnd: daysAgo(42), totalAmount: 4400, status: 'PARTIAL', sentAt: daysAgo(40), dueDate: daysAgo(0), paidAmount: 2200 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[7]!.id, invoiceNumber: 'INV-2026-0015', periodStart: daysAgo(42), periodEnd: daysAgo(35), totalAmount: 3600, status: 'PARTIAL', sentAt: daysAgo(33), dueDate: daysAgo(0), paidAmount: 1800 } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[4]!.id, invoiceNumber: 'INV-2026-0016', periodStart: daysAgo(42), periodEnd: daysAgo(35), totalAmount: 5000, status: 'PARTIAL', sentAt: daysAgo(33), dueDate: daysAgo(0), paidAmount: 2500 } }),
    // ── SENT (16–20) ─────────────────────────────────────────────
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[0]!.id, invoiceNumber: 'INV-2026-0017', periodStart: daysAgo(14), periodEnd: daysAgo(7), totalAmount: 8800, status: 'SENT', sentAt: daysAgo(5), dueDate: daysAgo(-25) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[2]!.id, invoiceNumber: 'INV-2026-0018', periodStart: daysAgo(14), periodEnd: daysAgo(7), totalAmount: 4600, status: 'SENT', sentAt: daysAgo(5), dueDate: daysAgo(-55) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[3]!.id, invoiceNumber: 'INV-2026-0019', periodStart: daysAgo(14), periodEnd: daysAgo(7), totalAmount: 4800, status: 'SENT', sentAt: daysAgo(5), dueDate: daysAgo(-25) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[5]!.id, invoiceNumber: 'INV-2026-0020', periodStart: daysAgo(14), periodEnd: daysAgo(7), totalAmount: 4000, status: 'SENT', sentAt: daysAgo(5), dueDate: daysAgo(-25) } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[6]!.id, invoiceNumber: 'INV-2026-0021', periodStart: daysAgo(14), periodEnd: daysAgo(7), totalAmount: 5200, status: 'SENT', sentAt: daysAgo(5), dueDate: daysAgo(-25) } }),
    // ── DRAFT (21–24) ────────────────────────────────────────────
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[0]!.id, invoiceNumber: 'INV-2026-0022', periodStart: daysAgo(7), periodEnd: daysAgo(0), totalAmount: 8800, status: 'DRAFT' } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[1]!.id, invoiceNumber: 'INV-2026-0023', periodStart: daysAgo(7), periodEnd: daysAgo(0), totalAmount: 4400, status: 'DRAFT' } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[8]!.id, invoiceNumber: 'INV-2026-0024', periodStart: daysAgo(7), periodEnd: daysAgo(0), totalAmount: 3800, status: 'DRAFT' } }),
    prisma.invoice.create({ data: { tenantId: T, vendorId: vendors[10]!.id, invoiceNumber: 'INV-2026-0025', periodStart: daysAgo(7), periodEnd: daysAgo(0), totalAmount: 5000, status: 'DRAFT' } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // PAYMENTS (9) — for PAID and PARTIAL invoices
  // ══════════════════════════════════════════════════════════════════

  await Promise.all([
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[0]!.id, amount: 3800, paymentDate: daysAgo(12), paymentMethod: 'ACH', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[1]!.id, amount: 8800, paymentDate: daysAgo(5), paymentMethod: 'ACH', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[2]!.id, amount: 4800, paymentDate: daysAgo(4), paymentMethod: 'ACH', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[3]!.id, amount: 4000, paymentDate: daysAgo(1), paymentMethod: 'Wire', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[4]!.id, amount: 5200, paymentDate: daysAgo(2), paymentMethod: 'ACH', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[5]!.id, amount: 4400, paymentDate: daysAgo(10), paymentMethod: 'ACH', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[6]!.id, amount: 7600, paymentDate: daysAgo(20), paymentMethod: 'Wire', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[7]!.id, amount: 4600, paymentDate: daysAgo(18), paymentMethod: 'ACH', status: 'COMPLETED' } }),
    prisma.payment.create({ data: { tenantId: T, invoiceId: invoices[13]!.id, amount: 2200, paymentDate: daysAgo(2), paymentMethod: 'ACH', status: 'COMPLETED' } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // IMMIGRATION CASES (3)
  // ══════════════════════════════════════════════════════════════════

  await Promise.all([
    prisma.immigrationCase.create({ data: {
      tenantId: T, consultantId: consultants[0]!.id, caseType: 'H1B', status: 'APPROVED',
      filingDate: daysAgo(365), expiryDate: new Date('2027-06-15'),
      milestones: [{ date: '2025-04-01', event: 'Petition filed', status: 'complete' }, { date: '2025-10-01', event: 'Approved', status: 'complete' }],
    } }),
    prisma.immigrationCase.create({ data: {
      tenantId: T, consultantId: consultants[23]!.id, caseType: 'H1B Transfer', status: 'PENDING',
      filingDate: daysAgo(30), expiryDate: new Date('2026-04-15'),
      milestones: [{ date: '2026-01-22', event: 'Transfer petition filed', status: 'complete' }, { date: '2026-02-15', event: 'RFE expected window', status: 'pending' }],
    } }),
    prisma.immigrationCase.create({ data: {
      tenantId: T, consultantId: consultants[4]!.id, caseType: 'OPT Extension', status: 'FILED',
      filingDate: daysAgo(15), expiryDate: new Date('2026-05-01'),
      milestones: [{ date: '2026-02-06', event: 'Extension filed', status: 'complete' }],
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // TRUST EVENTS (16) — vendor trends + consultant retention
  // ══════════════════════════════════════════════════════════════════

  await Promise.all([
    // TechForce (v0) — trending up
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[0]!.id, eventType: 'PAYMENT_ON_TIME', score: 85, delta: 2, reason: 'Invoice INV-2026-0002 paid on time', createdAt: daysAgo(5) } }),
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[0]!.id, eventType: 'FAST_FEEDBACK', score: 88, delta: 3, reason: 'Feedback within 24hrs on submission', createdAt: daysAgo(2) } }),
    // InfoSys (v1) — trending down
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[1]!.id, eventType: 'PAYMENT_LATE', score: 76, delta: -2, reason: 'INV-2026-0009 overdue', createdAt: daysAgo(3) } }),
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[1]!.id, eventType: 'FEEDBACK_DELAY', score: 74, delta: -2, reason: 'No feedback on submission for 5 days', createdAt: daysAgo(1) } }),
    // Cognizant (v2) — trending down
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[2]!.id, eventType: 'GHOST_AFTER_INTERVIEW', score: 58, delta: -5, reason: 'Ghosted after technical interview', createdAt: daysAgo(10) } }),
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[2]!.id, eventType: 'PAYMENT_LATE', score: 56, delta: -2, reason: 'INV-2026-0010 overdue by 15 days', createdAt: daysAgo(2) } }),
    // CloudNine (v3) — trending up
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[3]!.id, eventType: 'PAYMENT_EARLY', score: 90, delta: 2, reason: 'Paid 4 days before due date', createdAt: daysAgo(4) } }),
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[3]!.id, eventType: 'FAST_FEEDBACK', score: 92, delta: 2, reason: 'Same-day interview feedback', createdAt: daysAgo(1) } }),
    // Velocity (v4) — trending down
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[4]!.id, eventType: 'GHOST_AFTER_SUBMISSION', score: 45, delta: -5, reason: 'No response on 2 submissions', createdAt: daysAgo(5) } }),
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[4]!.id, eventType: 'PAYMENT_LATE', score: 42, delta: -3, reason: 'INV-2026-0011 overdue by 7 days', createdAt: daysAgo(1) } }),
    // NovaBridge (v5) — stable
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[5]!.id, eventType: 'PAYMENT_ON_TIME', score: 81, delta: 0, reason: 'Consistent payment behavior', createdAt: daysAgo(1) } }),
    // Apex Dynamics (v6) — trending up
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[6]!.id, eventType: 'FAST_FEEDBACK', score: 95, delta: 1, reason: 'Quick turnaround on all submissions', createdAt: daysAgo(3) } }),
    // TalentBridge (v9) — trending down
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[9]!.id, eventType: 'GHOST_AFTER_SUBMISSION', score: 48, delta: -4, reason: 'Ghosted on 3 submissions over 2 weeks', createdAt: daysAgo(7) } }),
    // Meridian (v11) — trending down
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[11]!.id, eventType: 'PAYMENT_LATE', score: 38, delta: -5, reason: 'INV-2026-0013 overdue by 30 days', createdAt: daysAgo(14) } }),
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'VENDOR', entityId: vendors[11]!.id, eventType: 'GHOST_AFTER_INTERVIEW', score: 35, delta: -3, reason: 'No response after scheduled interview', createdAt: daysAgo(3) } }),
    // Consultant trust
    prisma.trustEvent.create({ data: { tenantId: T, entityType: 'CONSULTANT', entityId: consultants[0]!.id, eventType: 'PLACEMENT_RETENTION_30', score: 90, delta: 5, reason: '30-day retention milestone', createdAt: daysAgo(12) } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // MARGIN EVENTS (16) — planned + realized for each active placement
  // ══════════════════════════════════════════════════════════════════

  for (const p of placements.slice(0, 8)) {
    await prisma.marginEvent.create({ data: { tenantId: T, entityType: 'placement', entityId: p.id, eventType: 'PLANNED', plannedMargin: p.margin, reason: 'Initial placement margin' } });
    await prisma.marginEvent.create({ data: { tenantId: T, entityType: 'placement', entityId: p.id, eventType: 'REALIZED', realizedMargin: p.margin, reason: 'Actual weekly margin' } });
  }

  // ══════════════════════════════════════════════════════════════════
  // COMMUNICATION EVENTS (16) — today's activity feed
  // ══════════════════════════════════════════════════════════════════

  await Promise.all([
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'job', entityId: jobs[37]!.id,
      channel: 'EMAIL', direction: 'INBOUND',
      subject: 'New job req received', body: 'CyberShield Inc — Incident Response Lead — Remote — $105-130/hr',
      fromAddress: 'kliu@cybershield.com', toAddress: 'sales@apex-staffing.com',
      createdAt: hoursAgo(6),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[98]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'Agent auto-match', body: 'Nadia Petrova auto-matched to Senior Java Developer at TechForce Global — consent pending',
      sentByAgent: true, agentId: 'submission-agent-001',
      createdAt: hoursAgo(5.5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[73]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'New submission', body: 'Michael Brown submitted to Senior Java Developer at TechForce Global',
      createdAt: hoursAgo(5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[74]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'New submission', body: 'Angela Torres submitted to React Native Mobile Developer at CloudNine Solutions',
      createdAt: hoursAgo(5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[75]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'New submission', body: 'Michael Brown submitted to Backend Python Developer at DataStream Partners',
      createdAt: hoursAgo(4),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[76]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'New submission', body: "James O'Brien submitted to AWS Cloud Architect at CloudNine Solutions",
      createdAt: hoursAgo(4),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'interview', entityId: submissions[41]!.id,
      channel: 'EMAIL', direction: 'OUTBOUND',
      subject: 'Interview scheduled', body: 'Anil Reddy — React Native Mobile Dev at CloudNine Solutions — Round 2 technical',
      fromAddress: 'recruiter@apex-staffing.com', toAddress: 'jpark@cloudnine.io',
      createdAt: hoursAgo(3.5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[77]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'Submission sent', body: 'Sarah Williams submitted to Data Engineer Snowflake/dbt at Cognizant Direct',
      createdAt: hoursAgo(3),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[78]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'Submission sent', body: 'Angela Torres submitted to SIEM/SOC Engineer at NovaBridge Corp',
      createdAt: hoursAgo(3),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'interview', entityId: submissions[41]!.id,
      channel: 'EMAIL', direction: 'INBOUND',
      subject: 'Interview feedback', body: 'Positive feedback from CloudNine Solutions on Anil Reddy Round 2 — strong problem solving',
      fromAddress: 'jpark@cloudnine.io', toAddress: 'recruiter@apex-staffing.com',
      createdAt: hoursAgo(2.5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'offer', entityId: offers[0]!.id,
      channel: 'EMAIL', direction: 'INBOUND',
      subject: 'Offer accepted', body: 'Sarah Williams accepted the Frontend Engineer offer at Apex Dynamics — $108/hr bill rate',
      fromAddress: 'dwright@apexdynamics.com', toAddress: 'recruiter@apex-staffing.com',
      createdAt: hoursAgo(2),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'invoice', entityId: invoices[3]!.id,
      channel: 'PORTAL', direction: 'INBOUND',
      subject: 'Invoice paid', body: 'NovaBridge Corp — INV-2026-0004 ($4,000) payment received via Wire transfer',
      createdAt: hoursAgo(2),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'vendor', entityId: vendors[4]!.id,
      channel: 'EMAIL', direction: 'OUTBOUND',
      subject: 'Vendor follow-up', body: 'Follow-up sent to Velocity Talent — 2 submissions pending feedback for 5+ days',
      fromAddress: 'recruiter@apex-staffing.com', toAddress: 'trichards@velocitytalent.com',
      createdAt: hoursAgo(1.5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'submission', entityId: submissions[107]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'Agent auto-submission', body: 'Fatima Al-Rashidi auto-matched to Kafka Streaming Engineer at CyberShield Inc — consent pending',
      sentByAgent: true, agentId: 'submission-agent-001',
      createdAt: hoursAgo(1),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'placement', entityId: placements[5]!.id,
      channel: 'INTERNAL_NOTE', direction: 'INTERNAL',
      subject: 'Placement milestone', body: 'Li Wei — 2-week check-in at NovaBridge Corp — positive client feedback',
      createdAt: hoursAgo(0.5),
    } }),
    prisma.communicationEvent.create({ data: {
      tenantId: T, entityType: 'vendor', entityId: vendors[11]!.id,
      channel: 'EMAIL', direction: 'OUTBOUND',
      subject: 'Payment escalation', body: 'Meridian Tech — INV-2026-0013 overdue by 30 days — escalation notice sent',
      fromAddress: 'accounts@apex-staffing.com', toAddress: 'pmartinez@meridiantech.com',
      createdAt: hoursAgo(0.5),
    } }),
  ]);

  // ══════════════════════════════════════════════════════════════════
  // DAILY SCOREBOARDS (7) — deterministic, progressively lower going back
  // Today is computed live; these are past 7 days
  // ══════════════════════════════════════════════════════════════════

  const scoreboardData = [
    { d: 1, qr: 11, hc: 4, subs: 20, iv: 3, off: 3, close: 1, pod: 'SWE'      as const, s2i: 0.25, i2o: 0.40, o2a: 0.60, mg: 15.5, ms: 16, mo: 1 },
    { d: 2, qr: 10, hc: 3, subs: 18, iv: 2, off: 3, close: 1, pod: 'CLOUD_DEVOPS' as const, s2i: 0.24, i2o: 0.38, o2a: 0.58, mg: 15.0, ms: 15, mo: 2 },
    { d: 3, qr: 10, hc: 3, subs: 17, iv: 3, off: 2, close: 0, pod: 'DATA'     as const, s2i: 0.23, i2o: 0.36, o2a: 0.56, mg: 14.5, ms: 14, mo: 1 },
    { d: 4, qr: 9,  hc: 3, subs: 15, iv: 2, off: 2, close: 1, pod: 'CYBER'    as const, s2i: 0.22, i2o: 0.34, o2a: 0.54, mg: 14.0, ms: 13, mo: 2 },
    { d: 5, qr: 9,  hc: 3, subs: 14, iv: 2, off: 2, close: 0, pod: 'SWE'      as const, s2i: 0.21, i2o: 0.33, o2a: 0.52, mg: 13.8, ms: 12, mo: 1 },
    { d: 6, qr: 8,  hc: 2, subs: 12, iv: 1, off: 1, close: 0, pod: 'CLOUD_DEVOPS' as const, s2i: 0.20, i2o: 0.32, o2a: 0.50, mg: 13.2, ms: 11, mo: 1 },
    { d: 7, qr: 8,  hc: 2, subs: 10, iv: 1, off: 1, close: 0, pod: 'DATA'     as const, s2i: 0.18, i2o: 0.30, o2a: 0.50, mg: 13.0, ms: 10, mo: 0 },
  ];

  for (const s of scoreboardData) {
    const date = new Date();
    date.setDate(date.getDate() - s.d);
    date.setHours(0, 0, 0, 0);
    await prisma.dailyScoreboard.create({
      data: {
        tenantId: T, date,
        actualQualifiedReqs: s.qr, actualHighConfReqs: s.hc,
        actualSubmissions: s.subs, actualInterviews: s.iv,
        actualActiveOffers: s.off, actualClosures: s.close,
        podFocus: s.pod,
        podRotationReason: 'Highest composite score for the day',
        subToInterviewRate: s.s2i, interviewToOfferRate: s.i2o, offerToAcceptRate: s.o2a,
        avgMarginHr: s.mg, marginSafeSubmissions: s.ms, marginOverrides: s.mo,
        actionPlan: [
          { action: `Need ${25 - s.subs} more submissions to hit target`, priority: 'critical' },
          { action: 'Follow up on pending vendor feedback', priority: 'high' },
        ],
        generatedByAgent: 'autopilot-gm',
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // COMPLIANCE DOCUMENT (1)
  // ══════════════════════════════════════════════════════════════════

  await prisma.complianceDocument.create({
    data: {
      tenantId: T, entityType: 'consultant', entityId: consultants[0]!.id,
      documentType: 'I-9', fileUrl: 's3://docs/consultants/rajesh-kumar/i9.pdf',
      verifiedById: users[3]!.id, verifiedAt: daysAgo(40), status: 'VERIFIED',
    },
  });

  // ══════════════════════════════════════════════════════════════════
  // SEED SUMMARY
  // ══════════════════════════════════════════════════════════════════

  // ── Market Job Query Plans (rotating hourly by pod + metro) ──────
  await prisma.marketQueryPlan.deleteMany();

  const US_METROS = [
    'New York, NY', 'San Francisco, CA', 'Dallas, TX', 'Chicago, IL',
    'Atlanta, GA', 'Seattle, WA', 'Boston, MA', 'Austin, TX',
    'Denver, CO', 'Washington, DC',
  ];

  type PodQuery = { pod: 'SWE' | 'CLOUD_DEVOPS' | 'DATA' | 'CYBER'; queries: string[] };
  const POD_QUERIES: PodQuery[] = [
    {
      pod: 'SWE',
      queries: [
        'C2C software engineer', 'W2 contract developer', 'C2C React developer',
        'W2 .NET developer', 'contract Java developer', 'C2C Python developer',
        'contract full stack engineer', 'C2C frontend developer',
      ],
    },
    {
      pod: 'CLOUD_DEVOPS',
      queries: [
        'C2C DevOps engineer', 'W2 contract cloud architect', 'contract AWS engineer',
        'C2C Kubernetes engineer', 'contract SRE', 'C2C Terraform engineer',
        'W2 Azure DevOps', 'contract platform engineer',
      ],
    },
    {
      pod: 'DATA',
      queries: [
        'C2C data engineer', 'W2 contract data analyst', 'contract Snowflake engineer',
        'C2C machine learning engineer', 'contract Databricks developer',
        'W2 data scientist', 'C2C ETL developer', 'contract BI developer',
      ],
    },
    {
      pod: 'CYBER',
      queries: [
        'C2C cybersecurity analyst', 'W2 contract security engineer', 'contract SOC analyst',
        'C2C SIEM engineer', 'contract penetration tester', 'W2 infosec engineer',
        'C2C GRC analyst', 'contract cloud security engineer',
      ],
    },
  ];

  // Rotating schedule: each pod gets specific hours
  // Hour 0-5: SWE, Hour 6-11: CLOUD_DEVOPS, Hour 12-17: DATA, Hour 18-23: CYBER
  // But each pod also runs at off-hours for broader coverage
  const POD_HOUR_SLOTS: Record<string, number[]> = {
    SWE:          [0, 1, 2, 3, 4, 5, 12, 18],
    CLOUD_DEVOPS: [6, 7, 8, 9, 10, 11, 14, 20],
    DATA:         [12, 13, 14, 15, 16, 17, 2, 8],
    CYBER:        [18, 19, 20, 21, 22, 23, 4, 10],
  };

  const PROVIDERS: Array<'JSEARCH' | 'JOOBLE' | 'ADZUNA' | 'CAREERJET' | 'CORPTOCORP'> = ['JSEARCH', 'JOOBLE', 'ADZUNA', 'CAREERJET', 'CORPTOCORP'];

  const queryPlanData: Array<{
    provider: 'JSEARCH' | 'JOOBLE' | 'ADZUNA' | 'CAREERJET' | 'CORPTOCORP';
    query: string;
    location: string | null;
    pod: 'SWE' | 'CLOUD_DEVOPS' | 'DATA' | 'CYBER';
    hourSlots: number[];
    maxPages: number;
    priority: number;
    maxCallsPerDay: number;
    maxCallsPerMonth: number;
  }> = [];

  for (const provider of PROVIDERS) {
    for (const { pod, queries } of POD_QUERIES) {
      const topQueries = queries.slice(0, 4);
      for (const query of topQueries) {
        queryPlanData.push({
          provider,
          query,
          location: 'United States',
          pod,
          hourSlots: POD_HOUR_SLOTS[pod],
          maxPages: 1,
          priority: pod === 'SWE' ? 10 : pod === 'CLOUD_DEVOPS' ? 8 : pod === 'DATA' ? 6 : 4,
          maxCallsPerDay: provider === 'JSEARCH' ? 8 : provider === 'ADZUNA' ? 10 : provider === 'CORPTOCORP' ? 24 : 15,
          maxCallsPerMonth: provider === 'JSEARCH' ? 200 : provider === 'ADZUNA' ? 250 : provider === 'CORPTOCORP' ? 720 : 500,
        });
      }
    }
  }

  for (const plan of queryPlanData) {
    await prisma.marketQueryPlan.upsert({
      where: {
        provider_query_location: {
          provider: plan.provider,
          query: plan.query,
          location: plan.location ?? '',
        },
      },
      update: {
        pod: plan.pod,
        hourSlots: plan.hourSlots,
        maxPages: plan.maxPages,
        priority: plan.priority,
        maxCallsPerDay: plan.maxCallsPerDay,
        maxCallsPerMonth: plan.maxCallsPerMonth,
        isEnabled: true,
      },
      create: plan,
    });
  }

  console.log(`  QueryPlans: ${queryPlanData.length} (rotating hourly by pod)`);

  console.log('Seed complete.');
  console.log(`  Tenant: ${tenant.name}`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Vendors: ${vendors.length}`);
  console.log(`  Client Companies: ${clients.length}`);
  console.log(`  Consultants: ${consultants.length}`);
  console.log(`  Jobs: ${jobs.length}`);
  console.log(`  Rate Cards: ${rateCards.length}`);
  console.log(`  Submissions: ${submissions.length}`);
  console.log(`  Offers: ${offers.length}`);
  console.log(`  Placements: ${placements.length}`);
  console.log(`  Invoices: ${invoices.length}`);
  console.log(`  Scoreboards: 7 (past week)`);
  console.log('');
  console.log('Login: md@apex-staffing.com / Password123!');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
