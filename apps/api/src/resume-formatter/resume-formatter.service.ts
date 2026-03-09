import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

type ResumeTemplate = 'CLEAN' | 'VENDOR_BRANDED' | 'WATERMARKED';

interface FormatOptions {
  template: ResumeTemplate;
  removeAddress?: boolean;
  removePhone?: boolean;
  addBranding?: boolean;
  brandingText?: string;
  watermarkText?: string;
}

interface FormattedResume {
  content: string;
  hash: string;
  template: ResumeTemplate;
  version: string;
}

const POD_TEMPLATES: Record<string, { headerColor: string; sections: string[] }> = {
  SWE: {
    headerColor: '#1a56db',
    sections: ['Summary', 'Technical Skills', 'Professional Experience', 'Education', 'Certifications'],
  },
  CLOUD_DEVOPS: {
    headerColor: '#047857',
    sections: ['Summary', 'Cloud & DevOps Skills', 'Certifications', 'Professional Experience', 'Education'],
  },
  DATA: {
    headerColor: '#7c3aed',
    sections: ['Summary', 'Data & Analytics Skills', 'Professional Experience', 'Projects', 'Education'],
  },
  CYBER: {
    headerColor: '#dc2626',
    sections: ['Summary', 'Security Certifications', 'Security Skills', 'Professional Experience', 'Education'],
  },
  DEFAULT: {
    headerColor: '#374151',
    sections: ['Summary', 'Skills', 'Professional Experience', 'Education'],
  },
};

@Injectable()
export class ResumeFormatterService {
  private readonly logger = new Logger(ResumeFormatterService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate all three resume versions for a consultant and store them.
   */
  async formatAndStore(
    tenantId: string,
    consultantId: string,
    rawContent: string,
    pod?: string,
  ): Promise<{ clean: string; vendorBranded: string; watermarked: string }> {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    const podKey = pod || 'DEFAULT';
    const template = POD_TEMPLATES[podKey] ?? POD_TEMPLATES.DEFAULT!;

    // Generate all 3 versions
    const tpl = template!;

    const clean = this.formatResume(rawContent, consultant, tpl, {
      template: 'CLEAN',
      removeAddress: true,
      removePhone: false,
    });

    const vendorBranded = this.formatResume(rawContent, consultant, tpl, {
      template: 'VENDOR_BRANDED',
      removeAddress: true,
      addBranding: true,
      brandingText: 'Presented by Cloud Resources Inc.',
    });

    const watermarked = this.formatResume(rawContent, consultant, tpl, {
      template: 'WATERMARKED',
      removeAddress: true,
      watermarkText: `CR-${consultantId.slice(-6)}-${Date.now().toString(36)}`,
    });

    // Store versions
    const versions = [
      { formatted: clean, version: 'clean' },
      { formatted: vendorBranded, version: 'vendor' },
      { formatted: watermarked, version: 'watermarked' },
    ];

    for (const v of versions) {
      const hash = crypto.createHash('sha256').update(v.formatted.content).digest('hex').slice(0, 16);

      // Mark old versions as not current
      await this.prisma.resumeVersion.updateMany({
        where: { tenantId, consultantId, version: v.version, isCurrent: true },
        data: { isCurrent: false },
      });

      await this.prisma.resumeVersion.create({
        data: {
          tenantId,
          consultantId,
          version: v.version,
          fileUrl: `resume://${consultantId}/${v.version}/${hash}`,
          fileHash: hash,
          watermark: v.formatted.template === 'WATERMARKED' ? `CR-${consultantId.slice(-6)}` : null,
          source: 'auto-formatter',
          isCurrent: true,
        },
      });
    }

    this.logger.log(
      `Formatted 3 resume versions for consultant ${consultant.firstName} ${consultant.lastName} (${podKey} template)`,
    );

    return { clean: clean.content, vendorBranded: vendorBranded.content, watermarked: watermarked.content };
  }

  /**
   * Get the current resume version for a consultant, by type.
   */
  async getCurrentVersion(tenantId: string, consultantId: string, versionType = 'vendor') {
    return this.prisma.resumeVersion.findFirst({
      where: { tenantId, consultantId, version: versionType, isCurrent: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all versions for a consultant.
   */
  async getVersions(tenantId: string, consultantId: string) {
    return this.prisma.resumeVersion.findMany({
      where: { tenantId, consultantId },
      orderBy: [{ version: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get resume content formatted as HTML for email attachment.
   */
  async getResumeForSubmission(tenantId: string, consultantId: string): Promise<{
    content: string;
    fileName: string;
    hash: string;
  } | null> {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });
    if (!consultant) return null;

    const version = await this.getCurrentVersion(tenantId, consultantId, 'vendor');
    if (!version) return null;

    return {
      content: version.fileUrl,
      fileName: `${consultant.firstName}_${consultant.lastName}_Resume.pdf`,
      hash: version.fileHash,
    };
  }

  private formatResume(
    rawContent: string,
    consultant: any,
    template: { headerColor: string; sections: string[] },
    options: FormatOptions,
  ): FormattedResume {
    let content = rawContent;

    // Strip personal address if requested
    if (options.removeAddress) {
      content = content.replace(
        /\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Way|Ct|Court|Pl|Place)[\s,]+[\w\s]+,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?/gi,
        '',
      );
    }

    // Strip phone if requested
    if (options.removePhone) {
      content = content.replace(
        /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        '',
      );
    }

    const html = this.buildHtmlResume(content, consultant, template, options);

    const hash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);

    return {
      content: html,
      hash,
      template: options.template,
      version: `${options.template.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  private buildHtmlResume(
    content: string,
    consultant: any,
    template: { headerColor: string; sections: string[] },
    options: FormatOptions,
  ): string {
    const name = `${consultant.firstName} ${consultant.lastName}`;
    const email = consultant.email;
    const phone = !options.removePhone && consultant.phone ? consultant.phone : '';
    const skills = Array.isArray(consultant.skills)
      ? (consultant.skills as string[]).join(' | ')
      : '';

    let watermarkCss = '';
    if (options.watermarkText) {
      watermarkCss = `
        body::after {
          content: '${options.watermarkText}';
          position: fixed; bottom: 10px; right: 10px;
          font-size: 8px; color: #e5e7eb; z-index: 9999;
        }`;
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; line-height: 1.5; font-size: 11pt; }
  .header { background: ${template.headerColor}; color: white; padding: 20px 24px; margin: -20px -20px 20px; }
  .header h1 { margin: 0 0 4px; font-size: 20pt; font-weight: 600; }
  .header .contact { font-size: 10pt; opacity: 0.9; }
  .branding { text-align: right; font-size: 9pt; color: #6b7280; margin-bottom: 16px; font-style: italic; }
  h2 { color: ${template.headerColor}; border-bottom: 2px solid ${template.headerColor}; padding-bottom: 4px; font-size: 13pt; margin-top: 20px; }
  .skills-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .skill-tag { background: ${template.headerColor}15; color: ${template.headerColor}; padding: 2px 10px; border-radius: 12px; font-size: 9pt; }
  .content { white-space: pre-wrap; }
  ${watermarkCss}
</style>
</head>
<body>
  <div class="header">
    <h1>${name}</h1>
    <div class="contact">${email}${phone ? ' | ' + phone : ''}</div>
  </div>
  ${options.addBranding ? `<div class="branding">${options.brandingText || ''}</div>` : ''}
  ${skills ? `<h2>Skills</h2><div class="skills-bar">${skills.split(' | ').map((s) => `<span class="skill-tag">${s}</span>`).join('')}</div>` : ''}
  <div class="content">${this.escapeHtml(content)}</div>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
