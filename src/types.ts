/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const Role = {
  SafaricomAdmin: "Safaricom Admin",
  SafaricomProjectCreator: "Safaricom Project Creator",
  SafaricomProjectAssigner: "Safaricom Project Assigner",
  SafaricomEHSOfficer: "Safaricom EHS Officer",
  ContractorManager: "Contractor Manager",
  ContractorEHSOfficer: "Contractor Safety Lead",
  Technician: "Field Technician"
} as const;
export type Role = typeof Role[keyof typeof Role];

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  contractorId: number | null; // null for central roles
  isCentral: boolean;
  username?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  status: "Planning" | "In Progress" | "On Hold" | "Completed" | "Delayed";
  contractorId: number;
  startDate: string;
  endDate: string;
  budget: number;
  milestonesCount: {
    total: number;
    completed: number;
  };
  rolloutDistance?: number; // Distance in kilometers for fibre rollout
  assignedTechnicianIds?: number[];
  projectLeadId?: number | null;
  ehsOfficerId?: number | null;
}

export interface Contractor {
  id: number;
  name: string;
  code: string;
  location: string;
  ehsOfficerId: number | null;
  managerId: number | null;
  contactPerson: string;
  email: string;
  phone: string;
  status: "Active" | "Suspended" | "Pending Review";
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: "Pending" | "In Progress" | "Completed" | "Blocked";
  dueDate: string;
  weight: number; // 0 to 100 percentage weight
  dependencies: number[]; // Milestone IDs that must be completed first
  prerequisites: string[]; // Predefined constraints like "Rollout Distance Approval", "Way Leave"
  clearedPrerequisites: string[]; // Prerequisites that have been cleared
  clearedDependencies?: number[]; // Dependencies that have been cleared
  prerequisiteNotes?: string; // Additional documentation or context for clearance
  statusComments?: string; // Documenting why a milestone is in its current status or was updated
  completedAt?: string | null; // Date when the milestone was completed
}

export interface TechnicianProfile {
  id: number;
  userId: number;
  name: string;
  phone: string;
  specialization: string;
  status: "Active" | "Suspended" | "On Leave" | "EHS Check Needed";
  lastEhsAuditDate: string | null;
  overallEhsScore: number; // 0 to 100
  contractorId?: number | null; // contractor who manages this technician
  workRoleIds?: number[];
}

export interface TechnicianDocument {
  id: number;
  technicianId: number;
  technicianName: string;
  contractorId: number;
  projectId?: number | null; // linked project ID
  type: string; // The category name (e.g. PPE Audit) or name of DocumentType
  documentTypeId?: number | null; // link to DocumentType ID if applicable
  fileName: string;
  uploadDate: string;
  status: "Pending Contractor Approval" | "Pending Central Approval" | "Approved" | "Rejected";
  contractorApproverId: number | null;
  centralApproverId: number | null;
  approvalChainComments: string[];
  complianceResult: {
    score: number; // calculated by AI or officer
    issues: string[];
    recommendations: string;
    verifiedByAi: boolean;
  } | null;
  summary?: string | null; // concise summary
  extractedData?: {
    safetyProtocols?: string[];
    environmentalImpacts?: string[];
    incidentReports?: string[];
  } | null; // extracted data points
  flaggedIssues?: string[] | null; // potential issues flagged by AI
  previousVersionId?: number | null; // link to previous version of this safety certificate
  expiryDate?: string | null; // expiration date of the certificate (YYYY-MM-DD)
}

export interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  action: string;
  category: "EHS Compliance" | "Project Management" | "User Management" | "System";
  timestamp: string;
  details: string;
  contractorId: number | null;
}

export interface Notification {
  id: number;
  userId: number | null; // null for broadcast to everyone
  role: Role | null; // broadcast to a specific role
  contractorId: number | null; // broadcast to a specific contractor
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "danger";
  createdAt: string;
  read: boolean;
}

export interface WorkRole {
  id: number;
  name: string;
  documentTypeIds: number[]; // Linked document type IDs
}

export interface DocumentType {
  id: number;
  name: string; // e.g., "Driving License", "Medical Certificate"
}

export interface ComplianceFlag {
  id: number;
  targetId: number; // project ID, document ID or technician ID
  targetType: "project" | "document" | "technician";
  targetName: string; // name of the project or document
  standard: "OSHA" | "EPA" | "NEMA" | "Regulatory" | "Safaricom Internal";
  ruleName: string; // rule detail
  severity: "High" | "Medium" | "Low";
  status: "Active" | "Resolved";
  description: string;
  flaggedAt: string; // ISO date
  resolvedAt?: string | null;
  resolutionComments?: string | null;
}

export interface DailyNote {
  id: number;
  projectId: number;
  date: string; // YYYY-MM-DD
  hazard: string;
  solution: string;
  updatedAt: string;
  aiScore: number | null; // AI rating of how well solution addresses hazard (0-100)
  aiMissedItems: string[] | null; // What the solution missed / gaps identified by AI
  aiAnalyzedAt: string | null;
}

export interface SitePhoto {
  id: number;
  projectId: number;
  uploadedByUserId: number;
  uploadedByUserName: string;
  contractorId: number;
  photoData: string; // public URL path (e.g. /uploads/site-photos/3/file.jpg) or base64 for backward compat
  uploadDate: string;
  description: string;
  complianceNotes?: string;
}
