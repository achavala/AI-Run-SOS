export const UserRole = {
  MANAGEMENT: 'MANAGEMENT',
  CONSULTANT: 'CONSULTANT',
  RECRUITMENT: 'RECRUITMENT',
  SALES: 'SALES',
  HR: 'HR',
  IMMIGRATION: 'IMMIGRATION',
  ACCOUNTS: 'ACCOUNTS',
  SUPERADMIN: 'SUPERADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const JobStatus = {
  NEW: 'NEW',
  QUALIFYING: 'QUALIFYING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const SubmissionStatus = {
  CONSENT_PENDING: 'CONSENT_PENDING',
  SUBMITTED: 'SUBMITTED',
  INTERVIEWING: 'INTERVIEWING',
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  CLOSED: 'CLOSED',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const TimesheetStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  INVOICED: 'INVOICED',
} as const;
export type TimesheetStatus = (typeof TimesheetStatus)[keyof typeof TimesheetStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  OVERDUE: 'OVERDUE',
  DISPUTED: 'DISPUTED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PlacementStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
  EXTENDED: 'EXTENDED',
} as const;
export type PlacementStatus = (typeof PlacementStatus)[keyof typeof PlacementStatus];
