import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** All 8 AI agent steps in execution order */
const PIPELINE_STEPS = [
  'RESUME_PARSING',
  'RESUME_PREP',
  'TECH_PREP',
  'COACHING',
  'LINKEDIN_PREP',
  'SALES_STRATEGY',
  'JOB_SEARCH',
  'GM_STRATEGIST',
] as const;

type StepName = (typeof PIPELINE_STEPS)[number];

@Injectable()
export class AiPipelineService {
  private readonly logger = new Logger(AiPipelineService.name);

  constructor(private prisma: PrismaService) {}

  /* ── Main pipeline orchestrator ──────────────────────────── */

  async runPipeline(tenantId: string, consultantId: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      include: {
        workAuths: { where: { isCurrent: true }, take: 1 },
        documents: { where: { docType: 'ORIGINAL_RESUME' }, take: 1 },
      },
    });

    if (!consultant) {
      this.logger.error(`Consultant ${consultantId} not found for AI pipeline`);
      return;
    }

    // Create AI run record
    const aiRun = await this.prisma.consultantAiRun.create({
      data: {
        tenantId,
        consultantId,
        status: 'PROCESSING',
        currentStep: 'RESUME_PARSING',
        stepsCompleted: 0,
        totalSteps: PIPELINE_STEPS.length,
        startedAt: new Date(),
      },
    });

    // Update consultant status
    await this.prisma.consultant.update({
      where: { id: consultantId },
      data: { benchStatus: 'IN_PREPARATION' },
    });

    // Add activity for pipeline start
    await this.prisma.consultantActivity.create({
      data: {
        tenantId,
        consultantId,
        activityType: 'AI_RUN_STARTED',
        title: 'AI preparation pipeline started',
        description: `Running ${PIPELINE_STEPS.length}-step AI pipeline for ${consultant.firstName} ${consultant.lastName}.`,
        metadata: { runId: aiRun.id },
        createdBy: 'ai-agent',
      },
    });

    // Create all step output records as QUEUED
    for (const step of PIPELINE_STEPS) {
      await this.prisma.consultantAiOutput.create({
        data: {
          runId: aiRun.id,
          step: step as any,
          status: 'QUEUED',
          input: {},
          output: {},
        },
      });
    }

    const skills = (consultant.skills as string[]) || [];
    const visa = consultant.workAuths[0]?.authType || 'Unknown';
    const fullName = `${consultant.firstName} ${consultant.lastName}`;

    // Execute each step sequentially
    let stepIndex = 0;
    let allSucceeded = true;

    for (const step of PIPELINE_STEPS) {
      try {
        // Mark step as PROCESSING
        await this.prisma.consultantAiOutput.update({
          where: { runId_step: { runId: aiRun.id, step: step as any } },
          data: { status: 'PROCESSING' },
        });

        await this.prisma.consultantAiRun.update({
          where: { id: aiRun.id },
          data: { currentStep: step as any },
        });

        const startMs = Date.now();

        // Generate step output
        const result = await this.executeStep(step, {
          consultantId,
          fullName,
          skills,
          visa,
          email: consultant.email,
          phone: consultant.phone,
          desiredRate: consultant.desiredRate,
          availableFrom: consultant.availableFrom,
        });

        const durationMs = Date.now() - startMs;

        // Save output
        await this.prisma.consultantAiOutput.update({
          where: { runId_step: { runId: aiRun.id, step: step as any } },
          data: {
            status: 'COMPLETED',
            output: result.output,
            htmlContent: result.htmlContent,
            durationMs,
            tokensUsed: result.tokensUsed || 0,
          },
        });

        stepIndex++;

        await this.prisma.consultantAiRun.update({
          where: { id: aiRun.id },
          data: { stepsCompleted: stepIndex },
        });

        // Activity for step completion
        await this.prisma.consultantActivity.create({
          data: {
            tenantId,
            consultantId,
            activityType: 'AI_STEP_COMPLETED',
            title: `AI step completed: ${this.stepLabel(step)}`,
            description: `Step ${stepIndex}/${PIPELINE_STEPS.length} completed in ${durationMs}ms.`,
            metadata: { runId: aiRun.id, step, stepIndex, durationMs },
            createdBy: 'ai-agent',
          },
        });

        // Simulate async delay between steps
        await this.delay(100);
      } catch (err: any) {
        this.logger.error(`Step ${step} failed for ${consultantId}: ${err.message}`);

        await this.prisma.consultantAiOutput.update({
          where: { runId_step: { runId: aiRun.id, step: step as any } },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
          },
        });

        allSucceeded = false;

        await this.prisma.consultantAiRun.update({
          where: { id: aiRun.id },
          data: {
            status: 'FAILED',
            errorMessage: `Pipeline failed at step ${step}: ${err.message}`,
            completedAt: new Date(),
          },
        });

        break;
      }
    }

    if (allSucceeded) {
      // Compute readiness score
      const readinessScore = this.computeReadinessScore(skills, consultant);

      await this.prisma.consultantAiRun.update({
        where: { id: aiRun.id },
        data: {
          status: 'COMPLETED',
          readinessScore,
          completedAt: new Date(),
        },
      });

      await this.prisma.consultant.update({
        where: { id: consultantId },
        data: {
          benchStatus: 'READY_TO_MARKET',
          readinessScore,
        },
      });

      await this.prisma.consultantActivity.create({
        data: {
          tenantId,
          consultantId,
          activityType: 'AI_RUN_COMPLETED',
          title: 'AI preparation pipeline completed',
          description: `All ${PIPELINE_STEPS.length} steps completed. Readiness score: ${readinessScore}/100.`,
          metadata: { runId: aiRun.id, readinessScore },
          createdBy: 'ai-agent',
        },
      });
    }

    return aiRun.id;
  }

  /* ── Step dispatcher ─────────────────────────────────────── */

  private async executeStep(
    step: StepName,
    ctx: {
      consultantId: string;
      fullName: string;
      skills: string[];
      visa: string;
      email: string;
      phone: string | null;
      desiredRate: number | null;
      availableFrom: Date | null;
    },
  ): Promise<{ output: any; htmlContent: string; tokensUsed?: number }> {
    switch (step) {
      case 'RESUME_PARSING':
        return this.stepResumeParsing(ctx);
      case 'RESUME_PREP':
        return this.stepResumePrep(ctx);
      case 'TECH_PREP':
        return this.stepTechPrep(ctx);
      case 'COACHING':
        return this.stepCoaching(ctx);
      case 'LINKEDIN_PREP':
        return this.stepLinkedinPrep(ctx);
      case 'SALES_STRATEGY':
        return this.stepSalesStrategy(ctx);
      case 'JOB_SEARCH':
        return this.stepJobSearch(ctx);
      case 'GM_STRATEGIST':
        return this.stepGmStrategist(ctx);
    }
  }

  /* ── Step 1: Resume Parsing ──────────────────────────────── */

  private async stepResumeParsing(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['JavaScript', 'Python', 'SQL'];
    const experienceYears = 3 + Math.floor(Math.random() * 8);

    const output = {
      name: ctx.fullName,
      email: ctx.email,
      phone: ctx.phone || 'Not provided',
      skills: skillsList,
      experienceYears,
      education: [
        { degree: "Master's in Computer Science", institution: 'University of Technology', year: 2020 },
      ],
      certifications: skillsList.includes('AWS') ? ['AWS Solutions Architect'] : [],
      summary: `Experienced ${skillsList.slice(0, 3).join('/')} professional with ${experienceYears}+ years of hands-on experience in enterprise environments.`,
      workHistory: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Corp',
          duration: `${Math.ceil(experienceYears / 2)} years`,
          highlights: skillsList.slice(0, 4).map((s: string) => `Developed and maintained ${s}-based solutions`),
        },
        {
          title: 'Software Engineer',
          company: 'Innovation Labs',
          duration: `${Math.floor(experienceYears / 2)} years`,
          highlights: skillsList.slice(0, 3).map((s: string) => `Built scalable ${s} applications`),
        },
      ],
    };

    const htmlContent = `
<div class="ai-output resume-parsing">
  <h3>Resume Analysis</h3>
  <div class="section">
    <h4>Contact Information</h4>
    <p><strong>Name:</strong> ${ctx.fullName}</p>
    <p><strong>Email:</strong> ${ctx.email}</p>
    <p><strong>Phone:</strong> ${ctx.phone || 'Not provided'}</p>
  </div>
  <div class="section">
    <h4>Skills Identified (${skillsList.length})</h4>
    <div class="skills-tags">
      ${skillsList.map((s: string) => `<span class="skill-tag">${s}</span>`).join(' ')}
    </div>
  </div>
  <div class="section">
    <h4>Experience Summary</h4>
    <p>${experienceYears}+ years of professional experience</p>
    <p>${output.summary}</p>
  </div>
  <div class="section">
    <h4>Work History</h4>
    ${output.workHistory
      .map(
        (w: any) => `
      <div class="work-entry">
        <strong>${w.title}</strong> at ${w.company} (${w.duration})
        <ul>${w.highlights.map((h: string) => `<li>${h}</li>`).join('')}</ul>
      </div>`,
      )
      .join('')}
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 1250 };
  }

  /* ── Step 2: Resume Prep ─────────────────────────────────── */

  private async stepResumePrep(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['JavaScript', 'Python'];

    const output = {
      enhancedSummary: `Results-driven ${skillsList[0]} specialist with a proven track record in designing, developing, and deploying scalable solutions. Adept at translating complex business requirements into elegant technical architectures.`,
      keyHighlights: [
        `Expert-level proficiency in ${skillsList.slice(0, 3).join(', ')}`,
        'Proven ability to reduce system downtime by 40% through proactive monitoring',
        'Led cross-functional teams of 5-10 engineers on mission-critical projects',
        'Strong communicator with experience in client-facing technical presentations',
      ],
      suggestedFormat: 'Modern two-column layout with skills sidebar',
      atsScore: 78 + Math.floor(Math.random() * 15),
    };

    const htmlContent = `
<div class="ai-output resume-prep">
  <h3>AI-Enhanced Resume</h3>
  <div class="resume-preview">
    <div class="resume-header">
      <h2>${ctx.fullName}</h2>
      <p class="subtitle">${skillsList[0]} Specialist | ${ctx.visa} Authorization</p>
    </div>
    <div class="resume-summary">
      <h4>Professional Summary</h4>
      <p>${output.enhancedSummary}</p>
    </div>
    <div class="resume-highlights">
      <h4>Key Highlights</h4>
      <ul>${output.keyHighlights.map((h: string) => `<li>${h}</li>`).join('')}</ul>
    </div>
    <div class="resume-skills">
      <h4>Technical Skills</h4>
      <div class="skills-grid">
        ${skillsList.map((s: string) => `<span class="skill-pill">${s}</span>`).join(' ')}
      </div>
    </div>
    <div class="ats-score">
      <h4>ATS Compatibility Score</h4>
      <div class="score-bar">
        <div class="score-fill" style="width: ${output.atsScore}%"></div>
        <span>${output.atsScore}%</span>
      </div>
    </div>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 2100 };
  }

  /* ── Step 3: Tech Prep ───────────────────────────────────── */

  private async stepTechPrep(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['JavaScript'];
    const primary = skillsList[0];

    const output = {
      interviewTopics: [
        { topic: `${primary} Fundamentals`, priority: 'HIGH', estimatedPrepHours: 4 },
        { topic: 'System Design', priority: 'HIGH', estimatedPrepHours: 6 },
        { topic: 'Data Structures & Algorithms', priority: 'MEDIUM', estimatedPrepHours: 8 },
        { topic: 'Behavioral Questions', priority: 'MEDIUM', estimatedPrepHours: 2 },
        { topic: `${skillsList[1] || 'Cloud'} Architecture`, priority: 'MEDIUM', estimatedPrepHours: 4 },
      ],
      codingExercises: [
        { name: 'REST API Design', difficulty: 'Medium', platform: 'LeetCode / HackerRank' },
        { name: 'Database Query Optimization', difficulty: 'Medium', platform: 'Practice SQL' },
        { name: `${primary} Performance Optimization`, difficulty: 'Hard', platform: 'Custom Exercise' },
      ],
      studyPlan: {
        week1: `Core ${primary} concepts review and system design basics`,
        week2: 'Data structures deep-dive and mock interview practice',
        week3: 'Advanced architecture patterns and behavioral prep',
      },
    };

    const htmlContent = `
<div class="ai-output tech-prep">
  <h3>Technical Preparation Guide</h3>
  <div class="section">
    <h4>Priority Interview Topics</h4>
    <table class="prep-table">
      <thead><tr><th>Topic</th><th>Priority</th><th>Est. Hours</th></tr></thead>
      <tbody>
        ${output.interviewTopics
          .map(
            (t) =>
              `<tr><td>${t.topic}</td><td><span class="priority-${t.priority.toLowerCase()}">${t.priority}</span></td><td>${t.estimatedPrepHours}h</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>
  <div class="section">
    <h4>Recommended Coding Exercises</h4>
    <ul>
      ${output.codingExercises.map((e) => `<li><strong>${e.name}</strong> (${e.difficulty}) - ${e.platform}</li>`).join('')}
    </ul>
  </div>
  <div class="section">
    <h4>3-Week Study Plan</h4>
    <div class="study-plan">
      <div class="week"><strong>Week 1:</strong> ${output.studyPlan.week1}</div>
      <div class="week"><strong>Week 2:</strong> ${output.studyPlan.week2}</div>
      <div class="week"><strong>Week 3:</strong> ${output.studyPlan.week3}</div>
    </div>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 1800 };
  }

  /* ── Step 4: Coaching ────────────────────────────────────── */

  private async stepCoaching(ctx: any) {
    const output = {
      communicationStyle: 'Direct and technical with room for improvement in storytelling',
      tips: [
        {
          area: 'STAR Method',
          advice: 'Structure every behavioral answer with Situation, Task, Action, Result. Quantify results wherever possible.',
        },
        {
          area: 'Technical Communication',
          advice: 'When explaining architecture decisions, start with the business problem before diving into technical details.',
        },
        {
          area: 'Salary Negotiation',
          advice: `Current desired rate of $${ctx.desiredRate || 'N/A'}/hr is competitive. Lead with value delivered, not rate expectations.`,
        },
        {
          area: 'First Impressions',
          advice: 'Open with a concise 60-second pitch: who you are, what you specialize in, and your most impactful achievement.',
        },
        {
          area: 'Remote Interview Tips',
          advice: 'Test audio/video 15 minutes before. Use a clean background. Maintain eye contact with the camera, not the screen.',
        },
      ],
      overallAssessment: 'Strong technical foundation. Focus coaching on storytelling and quantifying impact in behavioral answers.',
    };

    const htmlContent = `
<div class="ai-output coaching">
  <h3>Communication & Interview Coaching</h3>
  <div class="section">
    <h4>Communication Profile</h4>
    <p>${output.communicationStyle}</p>
  </div>
  <div class="section">
    <h4>Coaching Recommendations</h4>
    ${output.tips
      .map(
        (t) => `
      <div class="coaching-tip">
        <h5>${t.area}</h5>
        <p>${t.advice}</p>
      </div>`,
      )
      .join('')}
  </div>
  <div class="section">
    <h4>Overall Assessment</h4>
    <p class="assessment">${output.overallAssessment}</p>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 1500 };
  }

  /* ── Step 5: LinkedIn Prep ───────────────────────────────── */

  private async stepLinkedinPrep(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['Technology'];

    const output = {
      headlineSuggestion: `${skillsList[0]} Engineer | ${skillsList.slice(0, 3).join(' | ')} | Open to Opportunities`,
      aboutSuggestion: `Passionate ${skillsList[0]} professional with extensive experience building scalable solutions for enterprise clients. I thrive on solving complex technical challenges and mentoring engineering teams. Currently exploring new opportunities where I can drive innovation and deliver measurable impact.`,
      profileOptimizations: [
        { area: 'Headline', recommendation: 'Add specific technologies and "Open to Work" signal' },
        { area: 'About Section', recommendation: 'Lead with specialization, include metrics, end with call to action' },
        { area: 'Experience', recommendation: 'Add quantifiable achievements to each role (%, $, scale)' },
        { area: 'Skills', recommendation: `Ensure top 3 skills match target roles: ${skillsList.slice(0, 3).join(', ')}` },
        { area: 'Recommendations', recommendation: 'Request 2-3 recommendations from recent managers or tech leads' },
      ],
      keywordsToAdd: [...skillsList.slice(0, 5), 'agile', 'microservices', 'CI/CD', 'cloud architecture'],
    };

    const htmlContent = `
<div class="ai-output linkedin-prep">
  <h3>LinkedIn Profile Optimization</h3>
  <div class="section">
    <h4>Suggested Headline</h4>
    <p class="linkedin-headline">"${output.headlineSuggestion}"</p>
  </div>
  <div class="section">
    <h4>Suggested About Section</h4>
    <blockquote>${output.aboutSuggestion}</blockquote>
  </div>
  <div class="section">
    <h4>Profile Optimizations</h4>
    <table class="optimization-table">
      <thead><tr><th>Area</th><th>Recommendation</th></tr></thead>
      <tbody>
        ${output.profileOptimizations.map((o) => `<tr><td><strong>${o.area}</strong></td><td>${o.recommendation}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="section">
    <h4>Keywords to Include</h4>
    <div class="keyword-tags">
      ${output.keywordsToAdd.map((k: string) => `<span class="keyword-tag">${k}</span>`).join(' ')}
    </div>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 1600 };
  }

  /* ── Step 6: Sales Strategy ──────────────────────────────── */

  private async stepSalesStrategy(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['Full Stack'];
    const rate = ctx.desiredRate || 85;

    const output = {
      positioningStatement: `${ctx.fullName} is a highly capable ${skillsList[0]} specialist with a versatile skill set spanning ${skillsList.slice(0, 3).join(', ')}. Ideal for mid-to-senior level engagements requiring immediate productivity.`,
      targetIndustries: ['Financial Services', 'Healthcare IT', 'E-Commerce', 'SaaS / Enterprise Software'],
      sellingPoints: [
        `Immediate availability${ctx.availableFrom ? ` from ${new Date(ctx.availableFrom).toLocaleDateString()}` : ''}`,
        `Competitive rate at $${rate}/hr for the skill level offered`,
        `${ctx.visa} work authorization - no sponsorship complexities`,
        `Strong ${skillsList[0]} expertise with complementary skills in ${skillsList.slice(1, 3).join(', ') || 'modern frameworks'}`,
      ],
      objectionHandling: [
        { objection: 'Rate too high', response: `At $${rate}/hr, this consultant delivers senior-level output. Compare against market rate of $${rate + 15}-${rate + 30}/hr for similar profiles.` },
        { objection: 'Visa concerns', response: `${ctx.visa} authorization is current and valid. No employer sponsorship required.` },
        { objection: 'No direct client experience', response: 'Consultant has been coached on client communication and has strong references from previous engagements.' },
      ],
      recommendedApproach: 'Lead with technical depth, follow up with availability and rate competitiveness. Position for 6-12 month contract engagements.',
    };

    const htmlContent = `
<div class="ai-output sales-strategy">
  <h3>Sales & Positioning Strategy</h3>
  <div class="section">
    <h4>Positioning Statement</h4>
    <p class="positioning">${output.positioningStatement}</p>
  </div>
  <div class="section">
    <h4>Key Selling Points</h4>
    <ul class="selling-points">
      ${output.sellingPoints.map((p) => `<li>${p}</li>`).join('')}
    </ul>
  </div>
  <div class="section">
    <h4>Target Industries</h4>
    <div class="industry-tags">
      ${output.targetIndustries.map((i) => `<span class="industry-tag">${i}</span>`).join(' ')}
    </div>
  </div>
  <div class="section">
    <h4>Objection Handling</h4>
    ${output.objectionHandling
      .map(
        (o) => `
      <div class="objection">
        <p class="objection-q"><strong>Objection:</strong> "${o.objection}"</p>
        <p class="objection-a"><strong>Response:</strong> ${o.response}</p>
      </div>`,
      )
      .join('')}
  </div>
  <div class="section">
    <h4>Recommended Approach</h4>
    <p>${output.recommendedApproach}</p>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 2200 };
  }

  /* ── Step 7: Job Search ──────────────────────────────────── */

  private async stepJobSearch(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['Software Engineer'];
    const primary = skillsList[0];

    const output = {
      searchParameters: {
        titles: [`${primary} Developer`, `Senior ${primary} Engineer`, `${primary} Consultant`, 'Full Stack Developer'],
        keywords: skillsList.slice(0, 6),
        locations: ['Remote', 'Hybrid - Major Metro Areas'],
        rateRange: { min: (ctx.desiredRate || 75) - 10, max: (ctx.desiredRate || 75) + 25 },
        contractTypes: ['W2 Contract', 'C2C', 'Contract-to-Hire'],
      },
      recommendedJobBoards: [
        { name: 'LinkedIn Jobs', priority: 'HIGH', reason: 'Largest professional network with direct recruiter access' },
        { name: 'Dice', priority: 'HIGH', reason: 'Tech-focused job board with strong contract market' },
        { name: 'Indeed', priority: 'MEDIUM', reason: 'High volume, good for broad reach' },
        { name: 'Built In', priority: 'MEDIUM', reason: 'Quality tech companies, startup focus' },
      ],
      idealJobProfile: `Contract or contract-to-hire ${primary} role at a mid-to-large enterprise, remote-friendly, with a team of 5-15 engineers. Rate range $${(ctx.desiredRate || 75) - 10}-${(ctx.desiredRate || 75) + 25}/hr.`,
    };

    const htmlContent = `
<div class="ai-output job-search">
  <h3>Job Search Strategy</h3>
  <div class="section">
    <h4>Recommended Search Titles</h4>
    <ul>${output.searchParameters.titles.map((t) => `<li>${t}</li>`).join('')}</ul>
  </div>
  <div class="section">
    <h4>Search Keywords</h4>
    <div class="keyword-tags">
      ${output.searchParameters.keywords.map((k: string) => `<span class="keyword-tag">${k}</span>`).join(' ')}
    </div>
  </div>
  <div class="section">
    <h4>Target Rate Range</h4>
    <p>$${output.searchParameters.rateRange.min}/hr - $${output.searchParameters.rateRange.max}/hr</p>
  </div>
  <div class="section">
    <h4>Recommended Job Boards</h4>
    <table class="boards-table">
      <thead><tr><th>Platform</th><th>Priority</th><th>Why</th></tr></thead>
      <tbody>
        ${output.recommendedJobBoards.map((b) => `<tr><td><strong>${b.name}</strong></td><td><span class="priority-${b.priority.toLowerCase()}">${b.priority}</span></td><td>${b.reason}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="section">
    <h4>Ideal Job Profile</h4>
    <p>${output.idealJobProfile}</p>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 1900 };
  }

  /* ── Step 8: GM Strategist (Final Assessment) ────────────── */

  private async stepGmStrategist(ctx: any) {
    const skillsList = ctx.skills.length > 0 ? ctx.skills : ['General'];
    const score = this.computeReadinessScore(skillsList, ctx);

    const output = {
      readinessScore: score,
      overallAssessment: score >= 80
        ? `${ctx.fullName} is highly market-ready. Strong technical profile with competitive positioning. Recommend immediate marketing to top-tier clients.`
        : score >= 60
          ? `${ctx.fullName} shows solid potential with some areas for improvement. Recommend targeted preparation in weak areas before active marketing.`
          : `${ctx.fullName} requires additional preparation before active marketing. Focus on resume enhancement, technical prep, and interview coaching.`,
      scoreBreakdown: {
        resumeQuality: { weight: 25, score: Math.min(100, 65 + skillsList.length * 3), label: 'Resume Quality' },
        skillsDepth: { weight: 25, score: Math.min(100, 50 + skillsList.length * 5), label: 'Skills Depth' },
        marketFit: { weight: 20, score: Math.min(100, 60 + Math.floor(Math.random() * 20)), label: 'Market Fit' },
        interviewReadiness: { weight: 15, score: Math.min(100, 55 + Math.floor(Math.random() * 25)), label: 'Interview Readiness' },
        documentationCompleteness: { weight: 15, score: ctx.phone ? 80 : 50, label: 'Documentation Completeness' },
      },
      recommendations: [
        score < 80 ? 'Enhance resume with quantified achievements and ATS-friendly formatting' : null,
        skillsList.length < 5 ? 'Add more specific technical skills to strengthen profile' : null,
        'Schedule a mock interview within the first week',
        'Complete LinkedIn profile optimization per the LinkedIn Prep recommendations',
        ctx.desiredRate ? null : 'Set a target rate to improve positioning clarity',
      ].filter(Boolean),
      nextSteps: [
        { action: 'Review and approve AI-enhanced resume', priority: 'HIGH', owner: 'Recruitment' },
        { action: 'Schedule initial coaching call', priority: 'HIGH', owner: 'Recruitment' },
        { action: 'Begin targeted job submissions', priority: 'MEDIUM', owner: 'Sales' },
        { action: 'Update LinkedIn profile', priority: 'MEDIUM', owner: 'Consultant' },
      ],
    };

    const breakdown = output.scoreBreakdown;

    const htmlContent = `
<div class="ai-output gm-strategist">
  <h3>General Manager Strategy Assessment</h3>
  <div class="section score-hero">
    <div class="readiness-score">
      <div class="score-circle">
        <span class="score-value">${score}</span>
        <span class="score-label">/ 100</span>
      </div>
      <p class="score-status">${score >= 80 ? 'Market Ready' : score >= 60 ? 'Nearly Ready' : 'Needs Preparation'}</p>
    </div>
  </div>
  <div class="section">
    <h4>Overall Assessment</h4>
    <p>${output.overallAssessment}</p>
  </div>
  <div class="section">
    <h4>Score Breakdown</h4>
    <table class="breakdown-table">
      <thead><tr><th>Category</th><th>Weight</th><th>Score</th></tr></thead>
      <tbody>
        <tr><td>${breakdown.resumeQuality.label}</td><td>${breakdown.resumeQuality.weight}%</td><td>${breakdown.resumeQuality.score}/100</td></tr>
        <tr><td>${breakdown.skillsDepth.label}</td><td>${breakdown.skillsDepth.weight}%</td><td>${breakdown.skillsDepth.score}/100</td></tr>
        <tr><td>${breakdown.marketFit.label}</td><td>${breakdown.marketFit.weight}%</td><td>${breakdown.marketFit.score}/100</td></tr>
        <tr><td>${breakdown.interviewReadiness.label}</td><td>${breakdown.interviewReadiness.weight}%</td><td>${breakdown.interviewReadiness.score}/100</td></tr>
        <tr><td>${breakdown.documentationCompleteness.label}</td><td>${breakdown.documentationCompleteness.weight}%</td><td>${breakdown.documentationCompleteness.score}/100</td></tr>
      </tbody>
    </table>
  </div>
  <div class="section">
    <h4>Recommendations</h4>
    <ul>${output.recommendations.map((r) => `<li>${r}</li>`).join('')}</ul>
  </div>
  <div class="section">
    <h4>Next Steps</h4>
    <table class="next-steps-table">
      <thead><tr><th>Action</th><th>Priority</th><th>Owner</th></tr></thead>
      <tbody>
        ${output.nextSteps.map((s) => `<tr><td>${s.action}</td><td><span class="priority-${s.priority.toLowerCase()}">${s.priority}</span></td><td>${s.owner}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`.trim();

    return { output, htmlContent, tokensUsed: 2500 };
  }

  /* ── Readiness score computation ─────────────────────────── */

  private computeReadinessScore(skills: string[], ctx: any): number {
    const skillCount = skills.length;
    const hasResume = ctx.documents?.length > 0;
    const hasVisa = !!ctx.workAuths?.[0]?.authType;
    const hasPhone = !!ctx.phone;
    const hasEmail = !!ctx.email;
    const hasRate = !!ctx.desiredRate;
    const hasAvailability = !!ctx.availableFrom;

    // Resume quality (25%) - having a resume is worth a lot
    let resumeQuality = 50;
    if (hasResume) resumeQuality += 30;        // uploaded resume = strong signal
    if (skillCount >= 1) resumeQuality += 5;
    if (skillCount >= 3) resumeQuality += 5;
    if (skillCount >= 6) resumeQuality += 5;
    if (skillCount >= 10) resumeQuality += 5;
    resumeQuality = Math.min(100, resumeQuality);

    // Skills depth (20%) - differentiate by skill breadth
    let skillsDepth = 50;
    if (skillCount >= 1) skillsDepth += 10;
    if (skillCount >= 3) skillsDepth += 10;
    if (skillCount >= 5) skillsDepth += 10;
    if (skillCount >= 8) skillsDepth += 10;
    if (skillCount >= 12) skillsDepth += 10;
    skillsDepth = Math.min(100, skillsDepth);

    // Market fit (20%) - visa + rate + availability = ready for market
    let marketFit = 55;
    if (hasVisa) marketFit += 15;
    if (hasRate) marketFit += 10;
    if (hasAvailability) marketFit += 10;
    if (skillCount >= 3) marketFit += 5;
    if (skillCount >= 8) marketFit += 5;
    marketFit = Math.min(100, marketFit);

    // Interview readiness (15%) - having detailed profile helps
    let interviewReadiness = 55;
    if (hasResume) interviewReadiness += 15;
    if (skillCount >= 3) interviewReadiness += 10;
    if (skillCount >= 6) interviewReadiness += 10;
    if (hasPhone) interviewReadiness += 5;
    if (hasRate) interviewReadiness += 5;
    interviewReadiness = Math.min(100, interviewReadiness);

    // Documentation completeness (20%) - profile completeness
    let docComplete = 30;
    if (hasResume) docComplete += 20;
    if (hasEmail) docComplete += 10;
    if (hasPhone) docComplete += 10;
    if (hasVisa) docComplete += 10;
    if (hasRate) docComplete += 10;
    if (hasAvailability) docComplete += 5;
    if (skillCount >= 1) docComplete += 5;
    docComplete = Math.min(100, docComplete);

    const weighted =
      resumeQuality * 0.25 +
      skillsDepth * 0.20 +
      marketFit * 0.20 +
      interviewReadiness * 0.15 +
      docComplete * 0.20;

    return Math.round(weighted);
  }

  /* ── Step labels for activity messages ───────────────────── */

  private stepLabel(step: StepName): string {
    const labels: Record<StepName, string> = {
      RESUME_PARSING: 'Resume Parsing',
      RESUME_PREP: 'Resume Preparation',
      TECH_PREP: 'Technical Preparation',
      COACHING: 'Interview Coaching',
      LINKEDIN_PREP: 'LinkedIn Optimization',
      SALES_STRATEGY: 'Sales Strategy',
      JOB_SEARCH: 'Job Search Strategy',
      GM_STRATEGIST: 'GM Strategy Assessment',
    };
    return labels[step];
  }

  /* ── Utility ─────────────────────────────────────────────── */

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
