import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Compiles strategic analysis from internal data + industry intelligence.
 * Acts as the 30-year staffing veteran + PhD quant advisor.
 */
@Injectable()
export class StrategyResearchService {
  private readonly logger = new Logger(StrategyResearchService.name);

  constructor(private prisma: PrismaService) {}

  async getCloudResourcesStrategy() {
    const [systemMetrics, recruiterData, vendorIntel, benchStrength] = await Promise.all([
      this.getSystemMetrics(),
      this.getRecruiterProductivity(),
      this.getVendorNetworkAnalysis(),
      this.getBenchComposition(),
    ]);

    return {
      company: {
        name: 'Cloud Resources LLC',
        hq: 'Irving, TX 75063',
        phone: '(469) 458-7222',
        website: 'cloudresources.net',
        services: ['IT Staff Augmentation', 'Professional Services', 'DevOps Solutions'],
        specializations: ['Java/Python/.Net Developers', 'DevOps Engineers', 'Cloud Engineers', 'Salesforce', 'Data Scientists', 'Business Analysts'],
        strengths: [
          'Strong vendor email network (3,700+ vendor contacts)',
          'Deep email intelligence pipeline (392K+ emails, 106K+ req signals)',
          'AI-powered matching and actionability scoring',
          'Multi-technology bench capability',
        ],
      },
      industryAnalysis: this.getIndustryAnalysis(),
      competitorIntel: this.getCompetitorIntel(),
      oneClosurePerDayStrategy: this.buildOneClosureStrategy(systemMetrics, recruiterData, vendorIntel, benchStrength),
      optConsultantStrategy: this.getOPTStrategy(),
      handshakeIntegration: this.getHandshakeInfo(),
      socialMediaStrategy: this.getSocialMediaStrategy(),
      staffingReviewInsights: this.getStaffingReviewInsights(),
    };
  }

  private async getSystemMetrics() {
    const [result] = await this.prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM raw_email_message) as "totalEmails",
        (SELECT COUNT(*)::int FROM vendor_req_signal) as "totalReqs",
        (SELECT COUNT(*)::int FROM vendor_req_signal WHERE actionability_score >= 60) as "qualityReqs",
        (SELECT COUNT(*)::int FROM consultant) as "totalConsultants",
        (SELECT COUNT(*)::int FROM vendor_company WHERE name NOT LIKE '[SYSTEM]%') as "vendors",
        (SELECT COUNT(*)::int FROM vendor_contact) as "vendorContacts",
        (SELECT COUNT(*)::int FROM vendor_req_signal WHERE created_at >= NOW() - interval '7 days') as "reqsThisWeek",
        (SELECT COUNT(*)::int FROM vendor_req_signal WHERE created_at >= NOW() - interval '1 day') as "reqsToday"
    ` as any[];
    return result;
  }

  private async getRecruiterProductivity() {
    return this.prisma.$queryRaw`
      SELECT
        SPLIT_PART(mailbox_email, '@', 1) as "name",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "reqs",
        COUNT(*) FILTER (WHERE (subject ILIKE '%submit%') AND from_email = mailbox_email)::int as "subs",
        COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::int as "interviews",
        COUNT(*) FILTER (WHERE subject ILIKE 'Re:%' AND from_email = mailbox_email)::int as "replies",
        ROUND(
          COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::numeric /
          GREATEST(COUNT(*) FILTER (WHERE (subject ILIKE '%submit%') AND from_email = mailbox_email), 1) * 100, 1
        ) as "interviewRate"
      FROM raw_email_message
      GROUP BY mailbox_email
      ORDER BY "subs" DESC
    ` as Promise<any[]>;
  }

  private async getVendorNetworkAnalysis() {
    return this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int as "totalVendors",
        COUNT(*) FILTER (WHERE trust_score >= 70)::int as "highTrust",
        COUNT(*) FILTER (WHERE trust_score >= 40 AND trust_score < 70)::int as "medTrust",
        COUNT(*) FILTER (WHERE trust_score < 40)::int as "lowTrust",
        ROUND(AVG(trust_score)::numeric, 1) as "avgTrust"
      FROM vendor_trust_score
    ` as Promise<any[]>;
  }

  private async getBenchComposition() {
    return this.prisma.$queryRaw`
      SELECT skill as "skill", COUNT(*)::int as "count"
      FROM consultant, unnest(primary_skills) as skill
      GROUP BY skill
      HAVING COUNT(*) >= 3
      ORDER BY "count" DESC
      LIMIT 15
    ` as Promise<any[]>;
  }

  private getIndustryAnalysis() {
    return {
      marketSize: 'IT staffing in US: ~$46B market (2025), growing 6-8% annually',
      keyTrends2025_2026: [
        'AI-augmented recruiting is becoming table stakes — firms without it lose 2-3x on speed-to-submit',
        'W2 vs 1099 classification audits intensifying across states; compliance is a competitive differentiator',
        'Candidates now expect transparency: real-time status updates, clear bill rates, and career pathing',
        'Remote work normalization means geographic boundaries are dissolving — expand bench nationally',
        'Top firms deliver shortlists in 24-72 hours; full placements in 2-14 days',
        'Contract staffing markup ranges: 40-100% for contract, 15-30% for direct placement',
        'Minimum wage increases and new wage reporting mandates require tighter margin tracking',
      ],
      biggestThreats: [
        'Large firms (TEKsystems, Insight Global, Kforce) have massive candidate databases and MSA access',
        'Direct sourcing platforms (Upwork, Toptal) disintermediating traditional staffing for commodity skills',
        'VMS/MSP programs squeezing margins and reducing direct client relationships',
        'AI-native startups building "staffing without recruiters" platforms',
      ],
      biggestOpportunities: [
        'Email intel pipeline gives you 106K+ req signals — most small firms have <5K',
        'Speed: with AI matching + pre-scored reqs, you can submit in <2 hours vs industry avg of 24-48 hours',
        'Niche specialization: focus on C2C IT roles where large firms have less presence',
        'Vendor relationship depth: 3,700+ contacts is a moat — invest in top 300 relationships',
        'OPT/H1B consulting niche: growing demand despite regulatory uncertainty',
      ],
    };
  }

  private getCompetitorIntel() {
    return {
      topCompetitors: [
        { name: 'TEKsystems', size: '$4.4B revenue', strength: 'Massive database, MSA access', weakness: 'Slow, bureaucratic, high fees' },
        { name: 'Insight Global', size: '$3.5B revenue', strength: 'Process discipline, training', weakness: 'Cookie-cutter approach, turnover' },
        { name: 'Robert Half', size: '$4.6B revenue', strength: 'Brand recognition', weakness: 'Generalist, not deep in C2C' },
        { name: 'Kforce', size: '$1.4B revenue', strength: 'Strong in finance + tech', weakness: 'Limited C2C/third-party model' },
        { name: 'Apex Systems', size: '$1.8B revenue', strength: 'Fast placement', weakness: 'Margin pressure from VMS' },
      ],
      yourAdvantage: [
        'AI-powered email intelligence no competitor has (proprietary data from 5 mailboxes)',
        'Real-time req scoring and vendor trust — competitors rely on manual research',
        'Speed-to-submit can be <1 hour with automated matching pipeline',
        'Lower overhead = ability to compete on rate while maintaining margins',
        'Direct vendor relationships without MSP/VMS intermediary on C2C deals',
      ],
    };
  }

  private buildOneClosureStrategy(metrics: any, recruiters: any[], vendors: any[], bench: any[]) {
    const dailyReqs = metrics?.reqsToday || 0;
    const weeklyReqs = metrics?.reqsThisWeek || 0;
    const qualityReqs = metrics?.qualityReqs || 0;

    return {
      title: 'Strategy: 1 Closure Per Day (250 Closures/Year)',
      math: {
        targetClosuresPerDay: 1,
        industryConversionRate: '3-5% (submission → placement)',
        requiredDailySubmissions: '25-35',
        requiredDailyQualityReqs: '100+ (you have access to ' + dailyReqs + ' daily)',
        benchSizeNeeded: '50-100 active, skill-matched consultants',
        vendorRelationshipsNeeded: '200+ responsive (you have ' + (vendors[0]?.highTrust || 0) + ' high-trust)',
      },
      morningSprintProtocol: {
        time: '8:00 AM - 11:00 AM',
        actions: [
          '1. System auto-generates "Top 30 Actionable Reqs" ranked by actionability_score + vendor_trust',
          '2. Each recruiter picks their top 10 reqs from the queue',
          '3. For each req: run AI match → select best consultant → generate submission packet → SEND',
          '4. Target: 8-10 submissions per recruiter before 11 AM',
          '5. Flag any consent-pending or rate-mismatch issues for immediate resolution',
        ],
      },
      middayFollowUp: {
        time: '12:00 PM - 2:00 PM',
        actions: [
          '1. Follow up on all morning submissions (T+4h rule)',
          '2. Check for new high-actionability reqs that arrived since morning',
          '3. Process any vendor replies and move submissions forward',
          '4. Schedule interviews for any positive responses',
          '5. Target: 5 additional submissions + 10 follow-ups',
        ],
      },
      eveningReview: {
        time: '4:00 PM - 5:30 PM',
        actions: [
          '1. Review all submission statuses — escalate no-responses to high-trust vendors',
          '2. Prepare tomorrow\'s req queue (pre-score new overnight reqs)',
          '3. Update consultant availability and consent records',
          '4. Weekly: drop bottom 20% vendors, add 10 new from email intel',
          '5. Calculate daily pipeline velocity and identify bottlenecks',
        ],
      },
      recruiterTargets: (recruiters || []).map((r: any) => ({
        name: r.name,
        currentSubmissions: r.subs,
        currentInterviews: r.interviews,
        targetDailySubmissions: r.name === 'sai.l' ? 15 : r.name === 'bharath' ? 10 : 5,
        targetWeeklyInterviews: r.name === 'sai.l' ? 10 : r.name === 'bharath' ? 8 : 4,
        keyAction: r.subs < 100 && r.reqs > 10000
          ? 'CRITICAL: Receiving massive req volume but not converting — implement speed-to-submit workflow'
          : r.interviews > r.subs
            ? 'Good interview rate — focus on increasing submission volume for more closures'
            : 'Improve submission quality to increase interview conversion rate',
      })),
      kpis: [
        { metric: 'Speed to Submit', target: '<2 hours from req receipt', industry: '24-48 hours' },
        { metric: 'Submission to Interview', target: '>8%', industry: '3-5%' },
        { metric: 'Interview to Offer', target: '>25%', industry: '15-20%' },
        { metric: 'Offer to Start', target: '>80%', industry: '60-70%' },
        { metric: 'Daily Submissions', target: '25-35 team total', industry: '10-15' },
        { metric: 'Weekly Interviews', target: '20+', industry: '5-10' },
        { metric: 'Monthly Closures', target: '20+', industry: '3-5 per firm this size' },
      ],
      revenueProjection: {
        avgPlacementFee: '$15-25/hr margin on contract (avg $20/hr)',
        avgContractDuration: '6-12 months (avg 9 months)',
        revenuePerPlacement: '$20/hr × 40hr/wk × 39 weeks = $31,200/placement',
        yearlyAt1PerDay: '250 × $31,200 = $7.8M annual margin',
        yearlyAt5PerWeek: '250 × $31,200 = $7.8M (conservative)',
        breakEven: 'At current team size, need ~3 closures/month to cover operating costs',
      },
    };
  }

  private getOPTStrategy() {
    return {
      title: 'OPT Consultant Sourcing Strategy',
      platforms: [
        {
          name: 'Handshake',
          description: 'Largest college career platform — 1,400+ universities, integrated with career centers',
          howToUse: 'Register as employer, post positions targeting OPT-eligible candidates, use work authorization filters',
          cost: 'Free for basic posting, premium plans for advanced features',
          bestFor: 'Fresh OPT candidates from top CS programs',
          url: 'https://joinhandshake.com',
        },
        {
          name: 'UnitedOPT',
          description: 'Purpose-built for OPT/CPT job seekers — 50,000+ employers',
          howToUse: 'Post jobs, search resume database for OPT candidates',
          cost: 'Subscription-based',
          bestFor: 'IT consultants on OPT with experience',
          url: 'https://unitedopt.com',
        },
        {
          name: 'OpenH1B',
          description: 'Database of 672,281 H1B salary records — use for rate benchmarking',
          howToUse: 'Search by employer, title, location to validate market rates for OPT/H1B roles',
          cost: 'Free',
          bestFor: 'Rate intelligence and employer targeting',
          url: 'https://openh1b.org',
        },
        {
          name: 'LinkedIn (OPT Groups)',
          description: 'Multiple OPT-focused groups with 50K+ members',
          howToUse: 'Join groups, post opportunities, direct message candidates',
          cost: 'Free (Premium for InMail)',
          bestFor: 'Experienced OPT candidates (3+ years)',
        },
        {
          name: 'University Career Fairs',
          description: 'Direct access to STEM OPT candidates before graduation',
          howToUse: 'Register for virtual/in-person career fairs at UT Dallas, UTD, UTA (local Texas universities)',
          cost: '$200-500 per fair',
          bestFor: 'High-quality candidates, brand building',
        },
      ],
      selectionCriteria: [
        'Minimum 3 years of IT experience (post-education)',
        'STEM OPT eligible (36-month work authorization)',
        'Strong communication skills (client-facing ready)',
        'In-demand skills: Java, Python, AWS, Azure, DevOps, Data Engineering',
        'Located in or willing to relocate to major tech hubs',
      ],
      regulatoryWatch: [
        'ALERT: OPT elimination bill (H.R. 2315) introduced March 2025 — monitor progress',
        'ALERT: OPT Fair Tax Act (S. 2940) would require FICA taxes for OPT, increasing costs ~7.5%',
        'DHS H-1B integrity rules may affect post-OPT transitions',
        'Strategy: diversify between OPT, H1B, GC/Citizen consultants to reduce regulatory risk',
      ],
    };
  }

  private getHandshakeInfo() {
    return {
      platform: 'Handshake (joinhandshake.com)',
      overview: 'Largest college-to-career platform in the US, connecting 1,400+ universities with employers',
      features: [
        'Work authorization filters: "accepts OPT/CPT", "will sponsor visa"',
        'University-verified profiles with GPA, skills, and coursework',
        'Career fair virtual and in-person event hosting',
        'Employer branding pages and job board integration',
        'Analytics on application and engagement rates',
      ],
      integrationPlan: [
        '1. Register cloudresources.net as employer on Handshake',
        '2. Complete employer verification (may require BBB or Dun & Bradstreet listing)',
        '3. Post recurring job templates for top 5 in-demand technologies',
        '4. Set up "OPT Friendly" tags on all postings',
        '5. Target universities: UT Dallas, UTA, Texas A&M, Georgia Tech (strong CS programs)',
        '6. Attend 2-3 virtual career fairs per quarter',
        '7. Build pipeline: applicant → screen → bench → match to req',
      ],
      estimatedCost: 'Free for basic posting; premium plans $5K-15K/year for advanced features',
      expectedYield: '10-20 qualified OPT candidates per month from targeted university outreach',
    };
  }

  private getSocialMediaStrategy() {
    return {
      currentPresence: {
        website: 'cloudresources.net — professional, clean, but limited content',
        linkedin: 'Needs active posting and thought leadership content',
        glassdoor: 'Limited reviews — need 10+ positive reviews from placed consultants',
        google: 'Google My Business listing should be claimed and optimized',
      },
      actionPlan: [
        '1. LinkedIn: Post 3x/week — industry insights, placement success stories, technology trends',
        '2. LinkedIn: Have each recruiter connect with 50 new vendor contacts/week',
        '3. LinkedIn: Join and actively post in IT staffing groups (25K+ member groups)',
        '4. Google Reviews: Ask every successfully placed consultant for a Google review',
        '5. Website Blog: Publish 2 articles/month on IT trends, salary guides, career advice',
        '6. Glassdoor: Encourage employees and consultants to leave honest reviews',
        '7. Twitter/X: Share job openings and industry news daily',
        '8. YouTube: Create 2-minute "Day in the Life" videos of consultants at client sites',
      ],
      contentCalendar: {
        monday: 'Industry insight post (technology trends, market data from your AI agents)',
        tuesday: 'Consultant spotlight (success story from recent placement)',
        wednesday: 'Job market update (generated from your req signal data)',
        thursday: 'Career advice for consultants (OPT tips, interview prep)',
        friday: 'Company culture / team highlight',
      },
    };
  }

  private getStaffingReviewInsights() {
    return {
      topPainPoints2025_2026: [
        {
          painPoint: 'Speed — vendors want submissions within 2-4 hours, not days',
          yourSolution: 'AI matching + pre-scored req queue + automated submission packet generation',
          competitiveEdge: 'Your system can generate a matched submission in <30 minutes',
        },
        {
          painPoint: 'Quality over quantity — clients tired of getting 10 bad resumes',
          yourSolution: 'Skill overlap scoring + actionability filtering ensures only relevant submissions',
          competitiveEdge: 'Every submission is pre-validated against consultant skills, consent, and req requirements',
        },
        {
          painPoint: 'Communication gaps — candidates and vendors left in the dark',
          yourSolution: 'Automated follow-up engine (T+4h, T+24h, T+48h) + submission event tracking',
          competitiveEdge: 'No submission goes without follow-up — system enforces communication discipline',
        },
        {
          painPoint: 'Cultural/team fit failures — placements that don\'t last',
          yourSolution: 'Deep consultant profiles from email history + skill matching beyond keywords',
          competitiveEdge: 'Vendor trust scoring helps you send to vendors who actually respond and convert',
        },
        {
          painPoint: 'Compliance risk — 1099/W2 misclassification, missing documentation',
          yourSolution: 'Engagement model tagging (C2C/W2) + consent ledger + margin guard',
          competitiveEdge: 'System prevents C2C/W2 mismatched submissions automatically',
        },
        {
          painPoint: 'Lack of data-driven decision making',
          yourSolution: '5 AI agents providing real-time market analysis, recruiter coaching, and strategic direction',
          competitiveEdge: 'No competitor this size has an AI-powered operating system with this depth of intelligence',
        },
      ],
      topRatedFirmsBestPractices: [
        'Aplin (4.79 rating): Personalized communication + genuine career guidance',
        'Compustaff (4.82 rating): Thorough candidate vetting + responsiveness',
        'Benchmark IT (4.77 rating): Industry specialization + long-term relationship focus',
        'X-Team (97% retention): Ongoing developer support after placement',
      ],
      actionableInsights: [
        'Aim for NPS > 70 from placed consultants — survey every consultant 30 days after start',
        'Target 4.5+ Glassdoor rating — currently most small firms are at 3.5-4.0',
        'Implement 48-hour response guarantee to all vendor inquiries',
        'Create consultant loyalty program — referral bonuses, upskilling partnerships',
        'Build "consultant success manager" role — dedicated support post-placement',
      ],
    };
  }
}
