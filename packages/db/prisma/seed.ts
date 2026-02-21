import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Apex Staffing Solutions',
      domain: 'apex-staffing.com',
      plan: 'professional',
      settings: {
        timezone: 'America/New_York',
        currency: 'USD',
        defaultPaymentTerms: 30,
      },
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // Create users for each role
  const users = await Promise.all([
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'md@apex-staffing.com',
        passwordHash,
        firstName: 'Sarah',
        lastName: 'Chen',
        role: 'MANAGEMENT',
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'recruiter@apex-staffing.com',
        passwordHash,
        firstName: 'James',
        lastName: 'Rodriguez',
        role: 'RECRUITMENT',
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'sales@apex-staffing.com',
        passwordHash,
        firstName: 'Priya',
        lastName: 'Patel',
        role: 'SALES',
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'hr@apex-staffing.com',
        passwordHash,
        firstName: 'Michael',
        lastName: 'Thompson',
        role: 'HR',
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'immigration@apex-staffing.com',
        passwordHash,
        firstName: 'Li',
        lastName: 'Wang',
        role: 'IMMIGRATION',
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'accounts@apex-staffing.com',
        passwordHash,
        firstName: 'David',
        lastName: 'Kim',
        role: 'ACCOUNTS',
      },
    }),
  ]);

  // Create vendors
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        tenantId: tenant.id,
        companyName: 'TechForce Global',
        contactName: 'Robert Blake',
        contactEmail: 'rblake@techforceglobal.com',
        contactPhone: '+1-555-0101',
        paymentTermsDays: 30,
        msaStatus: 'ACTIVE',
        w9Received: true,
        insuranceVerified: true,
        trustScore: 85,
        paySpeedDays: 28,
        ghostRate: 0.05,
        disputeFrequency: 0.02,
        feedbackLatencyHrs: 24,
      },
    }),
    prisma.vendor.create({
      data: {
        tenantId: tenant.id,
        companyName: 'InfoSys Prime',
        contactName: 'Anita Sharma',
        contactEmail: 'asharma@infosysprime.com',
        contactPhone: '+1-555-0102',
        paymentTermsDays: 45,
        msaStatus: 'ACTIVE',
        w9Received: true,
        insuranceVerified: true,
        trustScore: 72,
        paySpeedDays: 42,
        ghostRate: 0.12,
        disputeFrequency: 0.08,
        feedbackLatencyHrs: 48,
      },
    }),
    prisma.vendor.create({
      data: {
        tenantId: tenant.id,
        companyName: 'Cognizant Direct',
        contactName: 'Mark Stevens',
        contactEmail: 'mstevens@cognizantdirect.com',
        paymentTermsDays: 60,
        msaStatus: 'ACTIVE',
        w9Received: true,
        insuranceVerified: false,
        trustScore: 58,
        paySpeedDays: 55,
        ghostRate: 0.18,
        disputeFrequency: 0.15,
        feedbackLatencyHrs: 72,
      },
    }),
    prisma.vendor.create({
      data: {
        tenantId: tenant.id,
        companyName: 'CloudNine Solutions',
        contactName: 'Jennifer Park',
        contactEmail: 'jpark@cloudnine.io',
        paymentTermsDays: 30,
        msaStatus: 'PENDING',
        w9Received: false,
        trustScore: null,
      },
    }),
  ]);

  // Create consultants
  const consultants = await Promise.all([
    prisma.consultant.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Rajesh',
        lastName: 'Kumar',
        email: 'rajesh.kumar@email.com',
        phone: '+1-555-1001',
        skills: ['Java', 'Spring Boot', 'AWS', 'Microservices', 'Kubernetes'],
        visaStatus: 'H1B',
        workAuthExpiry: new Date('2027-06-15'),
        availableFrom: new Date('2026-03-01'),
        desiredRate: 95,
        currentRate: 85,
        verificationStatus: 'VERIFIED',
        trustScore: 90,
        consentPolicy: {
          autoApproveVendors: [vendors[0]!.id],
          autoApproveAboveRate: 80,
          blockVendors: [],
          requireExplicitConsent: true,
        },
      },
    }),
    prisma.consultant.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.garcia@email.com',
        phone: '+1-555-1002',
        skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'PostgreSQL'],
        visaStatus: 'GC',
        availableFrom: new Date('2026-02-15'),
        desiredRate: 105,
        currentRate: 95,
        verificationStatus: 'VERIFIED',
        trustScore: 88,
        consentPolicy: {
          autoApproveVendors: [],
          blockVendors: [vendors[2]!.id],
          requireExplicitConsent: true,
        },
      },
    }),
    prisma.consultant.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Anil',
        lastName: 'Reddy',
        email: 'anil.reddy@email.com',
        phone: '+1-555-1003',
        skills: ['Python', 'Django', 'Machine Learning', 'TensorFlow', 'AWS SageMaker'],
        visaStatus: 'H1B',
        workAuthExpiry: new Date('2026-12-31'),
        availableFrom: new Date('2026-04-01'),
        desiredRate: 110,
        verificationStatus: 'PARTIAL',
        trustScore: 75,
        verificationChecklist: [
          { item: 'Identity verified', status: 'complete' },
          { item: 'Employment history verified', status: 'pending' },
          { item: 'Skills assessment', status: 'pending' },
        ],
      },
    }),
    prisma.consultant.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Emily',
        lastName: 'Johnson',
        email: 'emily.johnson@email.com',
        skills: ['DevOps', 'Terraform', 'Docker', 'CI/CD', 'Azure'],
        visaStatus: 'USC',
        availableFrom: new Date('2026-02-21'),
        desiredRate: 120,
        currentRate: 110,
        verificationStatus: 'VERIFIED',
        trustScore: 92,
      },
    }),
    prisma.consultant.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Suresh',
        lastName: 'Patel',
        email: 'suresh.patel@email.com',
        skills: ['SAP', 'ABAP', 'S/4HANA', 'Fiori'],
        visaStatus: 'H1B',
        workAuthExpiry: new Date('2026-08-15'),
        desiredRate: 100,
        verificationStatus: 'FLAGGED',
        trustScore: 45,
        verificationChecklist: [
          { item: 'Identity verified', status: 'complete' },
          { item: 'Employment history verified', status: 'failed', note: 'Overlapping dates found' },
          { item: 'Skills assessment', status: 'pending' },
        ],
      },
    }),
  ]);

  // Create jobs
  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        tenantId: tenant.id,
        vendorId: vendors[0]!.id,
        title: 'Senior Java Developer',
        description: 'Looking for a Senior Java Developer with Spring Boot and AWS experience for a large-scale microservices migration project.',
        structuredRequirements: {
          mustHave: ['Java 11+', 'Spring Boot', 'AWS', 'Microservices'],
          niceToHave: ['Kubernetes', 'Kafka', 'DynamoDB'],
          yearsExperience: 8,
          education: "Bachelor's in CS or equivalent",
        },
        skills: ['Java', 'Spring Boot', 'AWS', 'Microservices'],
        location: 'Dallas, TX',
        locationType: 'HYBRID',
        rateMin: 80,
        rateMax: 100,
        rateType: 'HOURLY',
        startDate: new Date('2026-03-15'),
        durationMonths: 12,
        status: 'OPEN',
        closureLikelihood: 0.75,
        interviewSpeed: 5,
        rateHonesty: 0.9,
      },
    }),
    prisma.job.create({
      data: {
        tenantId: tenant.id,
        vendorId: vendors[1]!.id,
        title: 'Full Stack React/Node Developer',
        description: 'Need a Full Stack developer proficient in React, TypeScript, and Node.js for a fintech modernization project.',
        structuredRequirements: {
          mustHave: ['React', 'TypeScript', 'Node.js'],
          niceToHave: ['GraphQL', 'PostgreSQL', 'AWS'],
          yearsExperience: 5,
        },
        skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
        location: 'Remote',
        locationType: 'REMOTE',
        rateMin: 90,
        rateMax: 115,
        rateType: 'HOURLY',
        startDate: new Date('2026-03-01'),
        durationMonths: 6,
        status: 'OPEN',
        closureLikelihood: 0.60,
        interviewSpeed: 7,
        rateHonesty: 0.7,
      },
    }),
    prisma.job.create({
      data: {
        tenantId: tenant.id,
        vendorId: vendors[0]!.id,
        title: 'DevOps Engineer - Azure',
        description: 'DevOps engineer with strong Azure and Terraform experience for cloud infrastructure automation.',
        skills: ['DevOps', 'Azure', 'Terraform', 'Docker', 'CI/CD'],
        location: 'New York, NY',
        locationType: 'ONSITE',
        rateMin: 100,
        rateMax: 130,
        rateType: 'HOURLY',
        status: 'OPEN',
        closureLikelihood: 0.85,
      },
    }),
    prisma.job.create({
      data: {
        tenantId: tenant.id,
        vendorId: vendors[2]!.id,
        title: 'ML Engineer',
        description: 'Machine Learning Engineer for predictive analytics platform. Python, TensorFlow, MLOps experience required.',
        skills: ['Python', 'TensorFlow', 'Machine Learning', 'MLOps'],
        location: 'San Francisco, CA',
        locationType: 'HYBRID',
        rateMin: 100,
        rateMax: 120,
        rateType: 'HOURLY',
        status: 'ON_HOLD',
        closureLikelihood: 0.35,
      },
    }),
  ]);

  // Create submissions
  const submissions = await Promise.all([
    prisma.submission.create({
      data: {
        tenantId: tenant.id,
        jobId: jobs[0]!.id,
        consultantId: consultants[0]!.id,
        submittedById: users[1]!.id,
        submitterType: 'USER',
        resumeVersion: 'v2.1',
        resumeHash: 'sha256:abc123def456',
        status: 'SUBMITTED',
        consentRecord: {
          create: {
            tenantId: tenant.id,
            consultantId: consultants[0]!.id,
            consentType: 'AUTO_POLICY',
            vendorName: 'TechForce Global',
            jobTitle: 'Senior Java Developer',
            rateSubmitted: 90,
          },
        },
      },
    }),
    prisma.submission.create({
      data: {
        tenantId: tenant.id,
        jobId: jobs[1]!.id,
        consultantId: consultants[1]!.id,
        submittedById: users[1]!.id,
        submitterType: 'USER',
        resumeVersion: 'v1.3',
        resumeHash: 'sha256:ghi789jkl012',
        status: 'SHORTLISTED',
        vendorFeedback: 'Strong candidate, moving to technical interview',
        feedbackReceivedAt: new Date('2026-02-20'),
        consentRecord: {
          create: {
            tenantId: tenant.id,
            consultantId: consultants[1]!.id,
            consentType: 'EXPLICIT',
            vendorName: 'InfoSys Prime',
            jobTitle: 'Full Stack React/Node Developer',
            rateSubmitted: 100,
          },
        },
      },
    }),
    prisma.submission.create({
      data: {
        tenantId: tenant.id,
        jobId: jobs[2]!.id,
        consultantId: consultants[3]!.id,
        submitterType: 'AGENT',
        agentId: 'submission-agent-001',
        resumeVersion: 'v3.0',
        status: 'AWAITING_CONSENT',
      },
    }),
  ]);

  // Create an interview
  await prisma.interview.create({
    data: {
      tenantId: tenant.id,
      submissionId: submissions[1]!.id,
      scheduledAt: new Date('2026-02-25T14:00:00Z'),
      durationMinutes: 60,
      interviewType: 'Technical',
      status: 'SCHEDULED',
    },
  });

  // Create a placement
  const placement = await prisma.placement.create({
    data: {
      tenantId: tenant.id,
      consultantId: consultants[0]!.id,
      jobId: jobs[0]!.id,
      vendorId: vendors[0]!.id,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2027-01-14'),
      billRate: 95,
      payRate: 75,
      margin: 20,
      status: 'ACTIVE',
      retentionDays30: true,
      placementDna: {
        skills: ['Java', 'Spring Boot', 'AWS'],
        seniority: 'senior',
        visaType: 'H1B',
        locationType: 'hybrid',
        vendorType: 'prime',
        interviewRounds: 2,
        timeToOffer: 14,
      },
    },
  });

  // Create timesheets
  await Promise.all([
    prisma.timesheet.create({
      data: {
        tenantId: tenant.id,
        placementId: placement.id,
        consultantId: consultants[0]!.id,
        weekEnding: new Date('2026-02-07'),
        hoursRegular: 40,
        hoursOvertime: 0,
        status: 'INVOICED',
        approvedById: users[5]!.id,
        approvedAt: new Date('2026-02-09'),
      },
    }),
    prisma.timesheet.create({
      data: {
        tenantId: tenant.id,
        placementId: placement.id,
        consultantId: consultants[0]!.id,
        weekEnding: new Date('2026-02-14'),
        hoursRegular: 40,
        hoursOvertime: 4,
        status: 'APPROVED',
        approvedById: users[5]!.id,
        approvedAt: new Date('2026-02-16'),
      },
    }),
    prisma.timesheet.create({
      data: {
        tenantId: tenant.id,
        placementId: placement.id,
        consultantId: consultants[0]!.id,
        weekEnding: new Date('2026-02-21'),
        hoursRegular: 32,
        hoursOvertime: 0,
        status: 'SUBMITTED',
      },
    }),
  ]);

  // Create invoice
  const invoice = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      vendorId: vendors[0]!.id,
      invoiceNumber: 'INV-2026-0001',
      periodStart: new Date('2026-02-01'),
      periodEnd: new Date('2026-02-07'),
      totalAmount: 3800,
      status: 'SENT',
      sentAt: new Date('2026-02-10'),
      dueDate: new Date('2026-03-12'),
    },
  });

  // Create payment
  await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      invoiceId: invoice.id,
      amount: 3800,
      status: 'PENDING',
    },
  });

  // Create immigration case
  await prisma.immigrationCase.create({
    data: {
      tenantId: tenant.id,
      consultantId: consultants[0]!.id,
      caseType: 'H1B',
      status: 'APPROVED',
      filingDate: new Date('2025-04-01'),
      expiryDate: new Date('2027-06-15'),
      milestones: [
        { date: '2025-04-01', event: 'Petition filed', status: 'complete' },
        { date: '2025-04-15', event: 'Receipt notice received', status: 'complete' },
        { date: '2025-10-01', event: 'Approved', status: 'complete' },
        { date: '2027-03-15', event: '90-day renewal window', status: 'upcoming' },
      ],
      constraints: {
        permittedLocations: ['Dallas, TX', 'Houston, TX'],
        employer: 'Apex Staffing Solutions',
        specialtyOccupation: 'Software Developer',
      },
    },
  });

  // Create trust events
  await Promise.all([
    prisma.trustEvent.create({
      data: {
        tenantId: tenant.id,
        entityType: 'VENDOR',
        entityId: vendors[0]!.id,
        eventType: 'PAYMENT_ON_TIME',
        score: 85,
        delta: 2,
        reason: 'Invoice INV-2026-0001 paid within terms',
      },
    }),
    prisma.trustEvent.create({
      data: {
        tenantId: tenant.id,
        entityType: 'VENDOR',
        entityId: vendors[1]!.id,
        eventType: 'FEEDBACK_DELAY',
        score: 72,
        delta: -3,
        reason: 'Submission feedback took 5 days (threshold: 3 days)',
      },
    }),
    prisma.trustEvent.create({
      data: {
        tenantId: tenant.id,
        entityType: 'VENDOR',
        entityId: vendors[2]!.id,
        eventType: 'GHOST_AFTER_INTERVIEW',
        score: 58,
        delta: -8,
        reason: 'No response after candidate interview for 2 weeks',
      },
    }),
    prisma.trustEvent.create({
      data: {
        tenantId: tenant.id,
        entityType: 'CONSULTANT',
        entityId: consultants[0]!.id,
        eventType: 'PLACEMENT_RETENTION_30',
        score: 90,
        delta: 5,
        reason: '30-day retention milestone achieved on active placement',
      },
    }),
  ]);

  // Create compliance documents
  await prisma.complianceDocument.create({
    data: {
      tenantId: tenant.id,
      entityType: 'consultant',
      entityId: consultants[0]!.id,
      documentType: 'I-9',
      fileUrl: 's3://docs/consultants/rajesh-kumar/i9-verified.pdf',
      verifiedById: users[3]!.id,
      verifiedAt: new Date('2026-01-10'),
      status: 'VERIFIED',
    },
  });

  console.log('Seed complete.');
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  Users: ${users.length + 0} (password for all: Password123!)`);
  console.log(`  Vendors: ${vendors.length}`);
  console.log(`  Consultants: ${consultants.length}`);
  console.log(`  Jobs: ${jobs.length}`);
  console.log(`  Submissions: ${submissions.length}`);
  console.log(`  Placements: 1`);
  console.log('');
  console.log('Login credentials:');
  console.log('  Management: md@apex-staffing.com / Password123!');
  console.log('  Recruiter:  recruiter@apex-staffing.com / Password123!');
  console.log('  Sales:      sales@apex-staffing.com / Password123!');
  console.log('  HR:         hr@apex-staffing.com / Password123!');
  console.log('  Immigration: immigration@apex-staffing.com / Password123!');
  console.log('  Accounts:   accounts@apex-staffing.com / Password123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
