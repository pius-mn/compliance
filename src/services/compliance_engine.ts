/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, TechnicianDocument, TechnicianProfile, User, ComplianceFlag } from "../types";
import { safeString } from "../utils/helpers";

let flagCounter = 1;

function nextFlagId(): number {
  return flagCounter++;
}

/**
 * Runs a deterministic compliance scan over all active projects, technicians, and EHS documents.
 * Returns an array of newly identified ComplianceFlags.
 * It will merge or compare them with any existing flags to avoid duplicating active ones.
 */
export function runComplianceScan(
  projects: Project[],
  documents: TechnicianDocument[],
  technicians: TechnicianProfile[],
  users: User[],
  existingFlags: ComplianceFlag[] = []
): { newFlags: ComplianceFlag[]; updatedFlags: ComplianceFlag[] } {
  const currentFlags: ComplianceFlag[] = [...existingFlags];
  const newFlags: ComplianceFlag[] = [];
  const activeScannedKeys = new Set<string>(); // Tracks uniquely scanned standard failures

  // Helper to generate a unique key for an active issue
  const makeIssueKey = (targetId: number, ruleName: string) => `${targetId}::${ruleName}`;

  // 1. PROJECT TIMELINE COMPLIANCE (Regulatory / SLA timelines)
  // Standard: Safaricom Project Governance
  const currentDate = new Date("2026-06-14T06:45:33-07:00"); // Standard alignment with local system metadata

  projects.forEach((proj) => {
    if (proj.status !== "Completed" && proj.status !== "On Hold") {
      const projEndDate = new Date(proj.endDate);
      if (projEndDate < currentDate) {
        const ruleName = "Regulatory Timeline Delay Warning";
        const key = makeIssueKey(proj.id, ruleName);
        activeScannedKeys.add(key);

        const exists = currentFlags.find((f) => f.targetId === proj.id && f.ruleName === ruleName && f.status === "Active");
        if (!exists) {
          newFlags.push({
            id: nextFlagId(),
            targetId: proj.id,
            targetType: "project",
            targetName: proj.name,
            standard: "Regulatory",
            ruleName,
            severity: "Medium",
            status: "Active",
            description: `Project has breached its scheduled completion date of ${proj.endDate} without being finalized. This represents an increased SLA delivery and EHS oversight exposure risk.`,
            flaggedAt: currentDate.toISOString()
          });
        }
      }
    }
  });

  // 2. OSHA CREW COMPETENCE & SAFETY RATINGS STANDARD (OSHA Standard 1910.120)
  // Active/In Progress projects must be backed by technicians with healthy safety scores
  projects.forEach((proj) => {
    if (proj.status === "In Progress") {
      const assignedTechIds = proj.assignedTechnicianIds || [];
      const projectTechs = technicians.filter((t) => assignedTechIds.includes(t.id));

      projectTechs.forEach((tech) => {
        if (tech.overallEhsScore < 70 || tech.status === "EHS Check Needed") {
          const ruleName = "OSHA Crew Welfare & Competence Standard";
          const key = makeIssueKey(proj.id, `${ruleName}::${tech.id}`);
          activeScannedKeys.add(key);

          const exists = currentFlags.find(
            (f) => f.targetId === proj.id && f.ruleName === ruleName && f.description.includes(tech.name) && f.status === "Active"
          );
          if (!exists) {
            newFlags.push({
              id: nextFlagId(),
              targetId: proj.id,
              targetType: "project",
              targetName: proj.name,
              standard: "OSHA",
              ruleName,
              severity: "High",
              status: "Active",
              description: `High risk crew member assigned: Field Technician "${tech.name}" has an unsafe compliance score of ${tech.overallEhsScore}% (Minimum threshold is 70%). Immediate retraining is required.`,
              flaggedAt: currentDate.toISOString()
            });
          }
        }
      });
    }
  });

  // 3. EPA / NEMA ENVIRONMENTAL ASSESSMENTS (EPA Clean Water / EIA Standards)
  // Any project involving high impact excavation or marine activities must have an Environmental Impact Assessment document approved.
  const highImpactKeywords = ["marine", "submarine", "undersea", "trenching", "civil", "excavation", "tower", "mast", "fiber corridors", "LTE Expansion"];
  
  projects.forEach((proj) => {
    if (proj.status !== "Completed") {
      const isHighImpact = highImpactKeywords.some(
        (kw) => proj.name.toLowerCase().includes(kw) || proj.description.toLowerCase().includes(kw)
      );

      if (isHighImpact) {
        // Look for approved NEMA/Environmental doc linked to this project or submitted by the same contractor
        const environmentalDocs = documents.filter(
          (d) =>
            d.contractorId === proj.contractorId &&
            (d.type.toLowerCase().includes("environmental") ||
              d.type.toLowerCase().includes("nema") ||
              d.type.toLowerCase().includes("eia") ||
              d.type.toLowerCase().includes("impact")) &&
            d.status === "Approved"
        );

        if (environmentalDocs.length === 0) {
          const ruleName = "EPA/NEMA Site Clearance Assessment Standard";
          const key = makeIssueKey(proj.id, ruleName);
          activeScannedKeys.add(key);

          const exists = currentFlags.find((f) => f.targetId === proj.id && f.ruleName === ruleName && f.status === "Active");
          if (!exists) {
            newFlags.push({
              id: nextFlagId(),
              targetId: proj.id,
              targetType: "project",
              targetName: proj.name,
              standard: "EPA",
              ruleName,
              severity: "High",
              status: "Active",
              description: `Project description contains high-impact civil/marine/excavation tags but no environmental clearance certificates, NEMA audits, or approved EIA documents are logged for contractor: "${proj.contractorId}".`,
              flaggedAt: currentDate.toISOString()
            });
          }
        }
      }
    }
  });

  // 4. CERTIFICATION VALIDITY EXPIRED OR CRITICALLY FAILED (OSHA 1910.132 / NTSA Regulations)
  // Checks raw files or file summaries for the word "EXPIRED"
  documents.forEach((doc) => {
    let isExpiredByDate = false;
    if (doc.expiryDate) {
      let dateStr = "";
      try { dateStr = safeString(doc.expiryDate); } catch { dateStr = ""; }
      const expiry = new Date(dateStr + "T00:00:00");
      const refDate = new Date("2026-06-14T00:00:00");
      isExpiredByDate = expiry.getTime() < refDate.getTime();
    }

    const isExpired =
      isExpiredByDate ||
      doc.fileName.toLowerCase().includes("expired") ||
      (doc.summary && doc.summary.toLowerCase().includes("expired")) ||
       (Array.isArray(doc.flaggedIssues) && doc.flaggedIssues.some((issue) => issue.toLowerCase().includes("expired")));

    if (isExpired && doc.status !== "Rejected") {
      const ruleName = "Regulatory Certification Validity";
      const key = makeIssueKey(doc.id, ruleName);
      activeScannedKeys.add(key);

      const exists = currentFlags.find((f) => f.targetId === doc.id && f.ruleName === ruleName && f.status === "Active");
      if (!exists) {
        newFlags.push({
          id: nextFlagId(),
          targetId: doc.id,
          targetType: "document",
          targetName: doc.fileName,
          standard: "Regulatory",
          ruleName,
          severity: "High",
          status: "Active",
          description: `Uploaded document "${doc.fileName}" (for Technician: ${doc.technicianName}) is flagged as EXPIRED. Continued operations present a severe regulatory violation threat.`,
          flaggedAt: currentDate.toISOString()
        });
      }
    }
  });

  // 5. OSHA SAFETY/PPE FIELD DEFIENCY (OSHA Standard 1910.132 PPE Audit check)
  // Generates flags for documents with very low scores or specific complianceResult issues
  documents.forEach((doc) => {
    if (doc.status === "Rejected") {
      const ruleName = "Safaricom Core PPE Protocol Failure";
      const key = makeIssueKey(doc.id, ruleName);
      activeScannedKeys.add(key);

      const exists = currentFlags.find((f) => f.targetId === doc.id && f.ruleName === ruleName && f.status === "Active");
      if (!exists) {
        newFlags.push({
          id: nextFlagId(),
          targetId: doc.id,
          targetType: "document",
          targetName: doc.fileName,
          standard: "OSHA",
          ruleName,
          severity: "High",
          status: "Active",
          description: `Critical EHS Document "${doc.fileName}" has been REJECTED. Safety comments: ${doc.approvalChainComments[doc.approvalChainComments.length - 1] || "Rejected during EHS review."}`,
          flaggedAt: currentDate.toISOString()
        });
      }
    } else if (doc.complianceResult && doc.complianceResult.score < 75) {
      const ruleName = "OSHA Site Safety PPE Deficiency (Standard 1910.132)";
      const key = makeIssueKey(doc.id, ruleName);
      activeScannedKeys.add(key);

      const exists = currentFlags.find((f) => f.targetId === doc.id && f.ruleName === ruleName && f.status === "Active");
      if (!exists) {
        const issuesText = doc.complianceResult.issues.length > 0 
          ? `Issues highlighted: ${doc.complianceResult.issues.join(", ")}` 
          : "PPE score scored below 75 compliance percent threshold.";
          
        newFlags.push({
          id: nextFlagId(),
          targetId: doc.id,
          targetType: "document",
          targetName: doc.fileName,
          standard: "OSHA",
          ruleName,
          severity: "Medium",
          status: "Active",
          description: `EHS Assessment file "${doc.fileName}" scored low compliance rating (${doc.complianceResult.score}%). ${issuesText}`,
          flaggedAt: currentDate.toISOString()
        });
      }
    }
  });

  // 6. AUTO-RESOLVE FLAGS THAT NO LONGER APPLY
  const updatedFlags = currentFlags.map((flag) => {
    if (flag.status === "Active") {
      // If document flag was active, but document has been deleted or approved since:
      if (flag.targetType === "document") {
        const doc = documents.find((d) => d.id === flag.targetId);
        // If document was approved, we can resolve safety/PPE or validity flags!
        if (doc && doc.status === "Approved") {
          return {
            ...flag,
            status: "Resolved",
            resolvedAt: currentDate.toISOString(),
            resolutionComments: "System Auto-Resolution: Document successfully approved by Safaricom EHS and verified central audit."
          } as ComplianceFlag;
        }
      }
      
      // If project has been marked completed, resolve timeline flags
      if (flag.targetType === "project") {
        const proj = projects.find((p) => p.id === flag.targetId);
        if (proj && proj.status === "Completed") {
          return {
            ...flag,
            status: "Resolved",
            resolvedAt: currentDate.toISOString(),
            resolutionComments: "System Auto-Resolution: Linked project scope marked successfully Completed."
          } as ComplianceFlag;
        }
      }
    }
    return flag;
  });

  return {
    newFlags,
    updatedFlags: updatedFlags.filter((f) => f.status === "Resolved" && !existingFlags.find((ef) => ef.id === f.id && ef.status === "Resolved"))
  };
}
