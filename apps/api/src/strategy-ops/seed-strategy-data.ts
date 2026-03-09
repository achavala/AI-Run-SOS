/**
 * Seed script for Strategy Operations data.
 * Run: npx tsx apps/api/src/strategy-ops/seed-strategy-data.ts
 *
 * Seeds TechTierConfig and OptEmployerProfile from the
 * AI-RUN-SOS Strategic Playbook (March 2026).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TECH_TIERS = [
  {
    rank: 1,
    technologyFamily: 'AI/ML Engineering',
    premiumSkillFamily: 'AI_ML',
    pod: 'DATA',
    c2cBillRateMin: 120,
    c2cBillRateMax: 250,
    fteSalaryMin: 150000,
    fteSalaryMax: 312000,
    demandGrowthPct: 40,
    competitionLevel: 'LOW',
    grossProfitPerPlacement: 45000,
    portfolioAllocationPct: 25,
    keySkills: ['Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'PyTorch', 'TensorFlow', 'LLM', 'GenAI', 'RAG', 'LangChain', 'Transformers', 'Hugging Face', 'Fine-tuning'],
    targetVendorTiers: ['PRIME', 'DIRECT'],
    sourcingStrategy: 'Technical vetting team required. GitHub/arXiv/Kaggle/HuggingFace sourcing. Community presence (AI Tinkerers, MLOps Slack). Client education / role advisory service. Highest margin + lowest competition = #1 priority.',
  },
  {
    rank: 2,
    technologyFamily: 'MLOps / GenAI Infrastructure',
    premiumSkillFamily: 'MLOPS_GENAI',
    pod: 'DATA',
    c2cBillRateMin: 100,
    c2cBillRateMax: 180,
    fteSalaryMin: 140000,
    fteSalaryMax: 220000,
    demandGrowthPct: 55,
    competitionLevel: 'LOW',
    grossProfitPerPlacement: 38000,
    portfolioAllocationPct: 20,
    keySkills: ['MLOps', 'Kubeflow', 'MLflow', 'SageMaker', 'Vertex AI', 'Model Deployment', 'Model Serving', 'Feature Store', 'Model Monitoring', 'LLMOps', 'GenAI Infra'],
    targetVendorTiers: ['PRIME', 'DIRECT'],
    sourcingStrategy: 'MLOps Community Slack (10K+ engineers). Fastest-growing niche — 55% YoY. Partner with cloud providers for early talent access. Cross-sell with AI/ML placements.',
  },
  {
    rank: 3,
    technologyFamily: 'Data Engineering',
    premiumSkillFamily: 'DATA_ENGINEERING',
    pod: 'DATA',
    c2cBillRateMin: 90,
    c2cBillRateMax: 140,
    fteSalaryMin: 120000,
    fteSalaryMax: 190000,
    demandGrowthPct: 25,
    competitionLevel: 'MEDIUM',
    grossProfitPerPlacement: 28000,
    portfolioAllocationPct: 15,
    keySkills: ['Spark', 'Airflow', 'Databricks', 'Snowflake', 'dbt', 'Kafka', 'Data Pipeline', 'ETL', 'Data Lake', 'Data Warehouse', 'BigQuery', 'Redshift'],
    targetVendorTiers: ['PRIME', 'DIRECT', 'SUB'],
    sourcingStrategy: 'Gateway to AI/ML placements — clients building AI need data engineers first. Position data engineering as infrastructure layer for AI/ML. Synergy sell: "Data Eng + ML Eng = production AI."',
  },
  {
    rank: 4,
    technologyFamily: 'Python Development',
    premiumSkillFamily: 'SWE_CORE',
    pod: 'SWE',
    c2cBillRateMin: 80,
    c2cBillRateMax: 130,
    fteSalaryMin: 110000,
    fteSalaryMax: 175000,
    demandGrowthPct: 15,
    competitionLevel: 'MEDIUM',
    grossProfitPerPlacement: 22000,
    portfolioAllocationPct: 10,
    keySkills: ['Python', 'Django', 'FastAPI', 'Flask', 'Pandas', 'NumPy', 'Celery', 'asyncio'],
    targetVendorTiers: ['PRIME', 'DIRECT', 'SUB'],
    sourcingStrategy: 'Position as "Python ML Developer" or "Python Data Platform Engineer" for $100-130/hr instead of generic $80-100/hr. AI-RUN-SOS resume tailoring optimizes this positioning.',
  },
  {
    rank: 5,
    technologyFamily: 'Cloud / DevOps / Platform',
    premiumSkillFamily: 'CLOUD_DEVOPS',
    pod: 'CLOUD_DEVOPS',
    c2cBillRateMin: 85,
    c2cBillRateMax: 150,
    fteSalaryMin: 120000,
    fteSalaryMax: 200000,
    demandGrowthPct: 20,
    competitionLevel: 'MEDIUM',
    grossProfitPerPlacement: 25000,
    portfolioAllocationPct: 10,
    keySkills: ['Kubernetes', 'Terraform', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Docker', 'Ansible', 'Helm', 'ArgoCD', 'Platform Engineering', 'SRE'],
    targetVendorTiers: ['PRIME', 'DIRECT'],
    sourcingStrategy: 'Premium shifts to AI infrastructure roles. Position DevOps engineers as "AI Platform Engineers" when skills support it. Combine with MLOps for full-stack AI infra placements.',
  },
  {
    rank: 6,
    technologyFamily: 'Cybersecurity',
    premiumSkillFamily: 'CYBERSECURITY',
    pod: 'CYBER',
    c2cBillRateMin: 90,
    c2cBillRateMax: 160,
    fteSalaryMin: 120000,
    fteSalaryMax: 210000,
    demandGrowthPct: 18,
    competitionLevel: 'MEDIUM',
    grossProfitPerPlacement: 26000,
    portfolioAllocationPct: 5,
    keySkills: ['Security Engineering', 'Penetration Testing', 'SOC Analysis', 'SIEM', 'Zero Trust', 'IAM', 'DevSecOps', 'Cloud Security', 'Threat Modeling', 'Vulnerability Assessment'],
    targetVendorTiers: ['PRIME', 'DIRECT'],
    sourcingStrategy: 'Niche with high demand and clearance requirements. Focus on cloud security and AI security intersections for premium positioning.',
  },
  {
    rank: 7,
    technologyFamily: 'Data Analysis / BI',
    premiumSkillFamily: null,
    pod: 'DATA',
    c2cBillRateMin: 70,
    c2cBillRateMax: 110,
    fteSalaryMin: 85000,
    fteSalaryMax: 140000,
    demandGrowthPct: 10,
    competitionLevel: 'HIGH',
    grossProfitPerPlacement: 16000,
    portfolioAllocationPct: 5,
    keySkills: ['SQL', 'Tableau', 'Power BI', 'Looker', 'Excel', 'Python Analytics', 'R', 'Statistics'],
    targetVendorTiers: ['DIRECT', 'SUB'],
    sourcingStrategy: 'Volume play with moderate margins. AI-RUN-SOS handles these almost autonomously, freeing team for premium roles. Gateway to Data Engineering upsell.',
  },
  {
    rank: 8,
    technologyFamily: 'Java Full Stack',
    premiumSkillFamily: 'SWE_CORE',
    pod: 'SWE',
    c2cBillRateMin: 65,
    c2cBillRateMax: 100,
    fteSalaryMin: 95000,
    fteSalaryMax: 160000,
    demandGrowthPct: 5,
    competitionLevel: 'HIGH',
    grossProfitPerPlacement: 14000,
    portfolioAllocationPct: 5,
    keySkills: ['Java', 'Spring Boot', 'Microservices', 'React', 'Angular', 'REST API', 'Hibernate', 'Maven'],
    targetVendorTiers: ['DIRECT', 'SUB'],
    sourcingStrategy: 'Bread-and-butter with thinner margins. Strategy: speed + volume. AI-RUN-SOS processes reqs and generates submissions in <2 hours. Base revenue while premium AI/ML grows.',
  },
  {
    rank: 9,
    technologyFamily: '.NET Full Stack',
    premiumSkillFamily: 'SWE_CORE',
    pod: 'SWE',
    c2cBillRateMin: 55,
    c2cBillRateMax: 90,
    fteSalaryMin: 90000,
    fteSalaryMax: 150000,
    demandGrowthPct: 3,
    competitionLevel: 'HIGH',
    grossProfitPerPlacement: 12000,
    portfolioAllocationPct: 5,
    keySkills: ['.NET', 'C#', 'ASP.NET', 'Azure', 'SQL Server', 'React', 'Angular', 'Blazor'],
    targetVendorTiers: ['DIRECT', 'SUB'],
    sourcingStrategy: 'Largest candidate pool, most competition. Speed-to-submit is the differentiator. AI-RUN-SOS autonomous processing. Cross-train .NET devs toward Azure/Cloud for rate uplift.',
  },
];

const OPT_EMPLOYERS = [
  { companyName: 'Google', website: 'careers.google.com', visaFriendliness: 95, juniorFitScore: 80, compensationTier: 'SENIOR', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'EE', 'DS', 'MATH'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 135000 },
  { companyName: 'Microsoft', website: 'careers.microsoft.com', visaFriendliness: 95, juniorFitScore: 85, compensationTier: 'SENIOR', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'EE', 'DS'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 125000 },
  { companyName: 'Amazon', website: 'amazon.jobs', visaFriendliness: 90, juniorFitScore: 85, compensationTier: 'SENIOR', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'EE'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 120000 },
  { companyName: 'Meta', website: 'metacareers.com', visaFriendliness: 90, juniorFitScore: 70, compensationTier: 'SENIOR', roleFamilies: ['SWE', 'DATA'], degreeAlignment: ['CS', 'EE', 'MATH'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 130000 },
  { companyName: 'JPMorgan Chase', website: 'careers.jpmorgan.com', visaFriendliness: 85, juniorFitScore: 90, compensationTier: 'MID', roleFamilies: ['SWE', 'DATA'], degreeAlignment: ['CS', 'MATH', 'FINANCE'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 95000 },
  { companyName: 'Deloitte', website: 'deloitte.com/careers', visaFriendliness: 85, juniorFitScore: 90, compensationTier: 'MID', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'MIS', 'DS'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 85000 },
  { companyName: 'Accenture', website: 'accenture.com/careers', visaFriendliness: 85, juniorFitScore: 95, compensationTier: 'ENTRY', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'MIS', 'EE'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 75000 },
  { companyName: 'Cognizant', website: 'cognizant.com/careers', visaFriendliness: 90, juniorFitScore: 95, compensationTier: 'ENTRY', roleFamilies: ['SWE', 'DATA'], degreeAlignment: ['CS', 'EE', 'MIS'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 70000 },
  { companyName: 'Infosys', website: 'infosys.com/careers', visaFriendliness: 90, juniorFitScore: 95, compensationTier: 'ENTRY', roleFamilies: ['SWE', 'DATA'], degreeAlignment: ['CS', 'EE'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 65000 },
  { companyName: 'Capital One', website: 'capitalonecareers.com', visaFriendliness: 85, juniorFitScore: 85, compensationTier: 'MID', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'DS', 'MATH'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 100000 },
  { companyName: 'Salesforce', website: 'salesforce.com/careers', visaFriendliness: 85, juniorFitScore: 75, compensationTier: 'SENIOR', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'EE'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 115000 },
  { companyName: 'IBM', website: 'ibm.com/careers', visaFriendliness: 85, juniorFitScore: 85, compensationTier: 'MID', roleFamilies: ['SWE', 'DATA', 'CLOUD'], degreeAlignment: ['CS', 'EE', 'DS'], h1bSponsored: true, optStemEligible: true, avgStartingSalary: 90000 },
];

async function main() {
  console.log('Seeding Technology Tier Config...');
  for (const tier of TECH_TIERS) {
    await prisma.techTierConfig.upsert({
      where: { technologyFamily: tier.technologyFamily },
      create: tier,
      update: tier,
    });
    console.log(`  [${tier.rank}] ${tier.technologyFamily}`);
  }

  console.log('\nSeeding OPT Employer Profiles...');
  for (const emp of OPT_EMPLOYERS) {
    await prisma.optEmployerProfile.upsert({
      where: { companyName: emp.companyName },
      create: emp,
      update: emp,
    });
    console.log(`  ${emp.companyName} (visa: ${emp.visaFriendliness}, junior: ${emp.juniorFitScore})`);
  }

  console.log(`\nDone: ${TECH_TIERS.length} tech tiers, ${OPT_EMPLOYERS.length} OPT employers.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
