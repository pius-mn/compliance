import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Download, 
  RefreshCw, 
  SlidersHorizontal, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp, 
  Printer, 
  Sparkles,
  Info,
  Shield,
  Leaf,
  Clock,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { PaginationControls } from "../components/PaginationControls";
import { DailyNotesHistory } from "../components/DailyNotesHistory";
import { 
  Role, 
  Project, 
  TechnicianProfile, 
  TechnicianDocument, 
  Contractor, 
  Milestone, 
  User,
  ComplianceFlag
} from "../types";
import { safeNumber, safeString } from "../utils/helpers";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

export interface ReportingViewProps {
  projects: Project[];
  technicians: TechnicianProfile[];
  documents: TechnicianDocument[];
  contractors: Contractor[];
  allUsers: User[];
  currentUser: User | null;
  complianceFlags?: ComplianceFlag[];
  onTriggerScan?: () => void;
  onResolveFlag?: (flagId: number, comments: string) => void;
  milestones?: Milestone[];
}

const ReportingView: React.FC<ReportingViewProps> = ({
  projects,
  technicians,
  documents,
  contractors,
  allUsers,
  currentUser,
  complianceFlags = [],
  onTriggerScan,
  onResolveFlag,
  milestones = []
}) => {
  // Filters state
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [minEhsScore, setMinEhsScore] = useState<number>(0);

  // Compliance Engine Panel states
  const [complianceStandardFilter, setComplianceStandardFilter] = useState<string>("all");
  const [complianceSeverityFilter, setComplianceSeverityFilter] = useState<string>("all");
  const [complianceStatusFilter, setComplianceStatusFilter] = useState<string>("Active");
  const [compFlagsPage, setCompFlagsPage] = useState(1);
  const COMP_FLAGS_PER_PAGE = 10;
  const [resolvingFlagId, setResolvingFlagId] = useState<number | null>(null);
  const [resolutionInputText, setResolutionInputText] = useState<string>("");

  // Document Expiration Predictor States
  const [expirationDays, setExpirationDays] = useState<string>("30");
  const [expiredOnlyFilter, setExpiredOnlyFilter] = useState<boolean>(false);
  const [expirationBranchFilter, setExpirationBranchFilter] = useState<string>("all");
  const [notifiedDocs, setNotifiedDocs] = useState<Record<string, boolean>>({});
  
  // AI report generation state
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiReportOutput, setAiReportOutput] = useState<string | null>(null);

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedBranchId("all");
    setSelectedProjectId("all");
    setSelectedStatus("all");
    setMinEhsScore(0);
  };

  // Contractor isolation security constraints (Contractor Managers / Contractor Safety Leads can only view their own contractor)
  const isCentral = currentUser?.isCentral ?? true;
  const activeContractorId = isCentral ? selectedBranchId : (currentUser?.contractorId || "all");

  // Filtered lists
  const filteredProjects = useMemo(() => {
    return (projects || []).filter(p => {
      if (!isCentral && p.contractorId !== currentUser?.contractorId) return false;
      if (activeContractorId !== "all" && String(p.contractorId) !== activeContractorId) return false;
      return true;
    });
  }, [projects, activeContractorId, isCentral, currentUser]);

  const filteredTechnicians = useMemo(() => {
    return (technicians || []).filter(t => {
      // Find technician's user or check contractorId mapping
      const techUser = (allUsers || []).find(u => u.id === t.userId);
      if (!techUser) return false;
      
      if (!isCentral && techUser.contractorId !== currentUser?.contractorId) return false;
      if (activeContractorId !== "all" && String(techUser.contractorId) !== activeContractorId) return false;
      if (t.overallEhsScore < minEhsScore) return false;
      return true;
    });
  }, [technicians, activeContractorId, isCentral, currentUser, allUsers, minEhsScore]);

  const filteredDocs = useMemo(() => {
    return (documents || []).filter(d => {
      if (!isCentral && d.contractorId !== currentUser?.contractorId) return false;
      if (activeContractorId !== "all" && String(d.contractorId) !== String(activeContractorId)) return false;
      if (selectedProjectId !== "all" && String(d.projectId) !== String(selectedProjectId)) return false;
      if (selectedStatus !== "all" && d.status !== selectedStatus) return false;
      return true;
    });
  }, [documents, activeContractorId, selectedProjectId, selectedStatus, isCentral, currentUser]);

  // Memoized filtered list of compliance flags
  const filteredFlags = useMemo(() => {
    return (complianceFlags || []).filter(flag => {
      // Contractor filtering
      if (!isCentral) {
        if (flag.targetType === "project") {
          const p = (projects || []).find(proj => proj.id === flag.targetId);          if (p && p.contractorId !== currentUser?.contractorId) return false;
          } else if (flag.targetType === "document") {
          const d = (documents || []).find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== currentUser?.contractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = (technicians || []).find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = (allUsers || []).find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== currentUser?.contractorId) return false;
          }
        }
      } else if (activeContractorId !== "all") {
        if (flag.targetType === "project") {
          const p = (projects || []).find(proj => proj.id === flag.targetId);          if (p && p.contractorId !== activeContractorId) return false;
          } else if (flag.targetType === "document") {
          const d = (documents || []).find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== activeContractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = (technicians || []).find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = (allUsers || []).find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== activeContractorId) return false;
          }
        }
      }

      // Standard filtering
      if (complianceStandardFilter !== "all" && flag.standard !== complianceStandardFilter) return false;

      // Severity filtering
      if (complianceSeverityFilter !== "all" && flag.severity !== complianceSeverityFilter) return false;

      // Status filtering
      if (complianceStatusFilter !== "all" && flag.status !== complianceStatusFilter) return false;

      return true;
    });
  }, [complianceFlags, projects, documents, technicians, allUsers, currentUser, isCentral, activeContractorId, complianceStandardFilter, complianceSeverityFilter, complianceStatusFilter]);

  // Reset pagination when filters change
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompFlagsPage(1);
  }, [complianceStandardFilter, complianceSeverityFilter, complianceStatusFilter, activeContractorId]);

  // Paginate filtered flags
  const paginatedFlags = filteredFlags.slice(
    (compFlagsPage - 1) * COMP_FLAGS_PER_PAGE,
    compFlagsPage * COMP_FLAGS_PER_PAGE
  );

  // Memoized unresolved high-risk compliance flags
  const unresolvedHighRiskFlags = useMemo(() => {
    return (complianceFlags || []).filter(flag => {
      if (!flag) return false;
      // Filter strictly unresolved (Active) and High-Risk flags
      if (flag.status !== "Active") return false;
      if (flag.severity !== "High") return false;

      // Contractor security isolation check
      if (!isCentral) {
        if (flag.targetType === "project") {
          const p = projects.find(proj => proj.id === flag.targetId);
          if (p && p.contractorId !== currentUser?.contractorId) return false;
        } else if (flag.targetType === "document") {
          const d = documents.find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== currentUser?.contractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = technicians.find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = allUsers.find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== currentUser?.contractorId) return false;
          }
        }
      } else if (activeContractorId !== "all") {
        if (flag.targetType === "project") {
          const p = projects.find(proj => proj.id === flag.targetId);
          if (p && p.contractorId !== activeContractorId) return false;
        } else if (flag.targetType === "document") {
          const d = documents.find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== activeContractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = technicians.find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = allUsers.find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== activeContractorId) return false;
          }
        }
      }
      return true;
    });
  }, [complianceFlags, projects, documents, technicians, allUsers, currentUser, isCentral, activeContractorId]);

  // Memoized expiring and expired documents report query
  const expiringDocsReport = useMemo(() => {
    const refDate = new Date("2026-06-14T00:00:00");
    const thresholdDays = parseInt(expirationDays) || 0;

    const matched = (documents || []).filter((doc) => {
      if (!doc) return false;
      if (!doc.expiryDate) return false;

      // Contractor safety filtering
      if (!isCentral) {
        if (doc.contractorId !== currentUser?.contractorId) return false;
      } else if (expirationBranchFilter !== "all") {
        if (String(doc.contractorId) !== String(expirationBranchFilter)) return false;
      }
      return true;
    });

    return matched
      .map((doc) => {
        const safeDateStr = (v: unknown) => {
          return safeString(v);
        };
        const expiry = new Date(safeDateStr(doc.expiryDate) + "T00:00:00");
        const diffTime = expiry.getTime() - refDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...doc,
          remainingDays: diffDays
        };
      })
      .filter((item) => {
        if (expiredOnlyFilter) {
          return item.remainingDays < 0;
        }
        return item.remainingDays <= thresholdDays;
      })
      .sort((a, b) => a.remainingDays - b.remainingDays);
  }, [documents, expirationDays, expiredOnlyFilter, expirationBranchFilter, isCentral, currentUser]);

  // Compute calculated metrics
  const stats = useMemo(() => {
    // 1. Average safety score
    const scores = (filteredTechnicians || []).map(t => safeNumber(t.overallEhsScore));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // 2. Audit approval rate
    const approvedCount = (filteredDocs || []).filter(d => d.status === "Approved").length;
    const totalDocs = (filteredDocs || []).length;
    const approvalRate = totalDocs ? Math.round((approvedCount / totalDocs) * 100) : 0;

    // 3. Highlighted Safety Flags
    const totalFlagsArr = (filteredDocs || []).reduce<string[]>((acc, d) => {          if (d.flaggedIssues && d.flaggedIssues.length) {
        acc.push(...d.flaggedIssues);
      }
      return acc;
    }, []);
    const issueCount = totalFlagsArr.length;

    // 4. Contractor Performance League
    const partnerStats = (contractors || []).map(b => {
      const branchTechs = (technicians || []).filter(t => {
        const u = (allUsers || []).find(uUser => uUser.id === t.userId);
        return u?.contractorId === b.id;
      });
      const avgBranchScore = branchTechs.length 
        ? Math.round(branchTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / branchTechs.length)
        : 75; // baseline/default
      return {
        name: b.name,
        code: b.code,
        score: avgBranchScore,
        techCount: branchTechs.length
      };
    });

    // 5. Total Rollout Distance
    const totalRolloutDistance = filteredProjects.reduce((sum, p) => sum + safeNumber(p.rolloutDistance), 0);

    return {
      avgScore,
      approvalRate,
      issueCount,
      totalDocs,
      partnerStats,
      totalRolloutDistance
    };
  }, [filteredTechnicians, filteredDocs, contractors, technicians, allUsers, filteredProjects]);

  // Visual Chart Data 1: Average Technician EHS Scores by Project
  const projectChartData = useMemo(() => {
    return (filteredProjects || []).map(p => {
      // Find technicians assigned to this project
      const assignedTechIds = p.assignedTechnicianIds || [];
      const projectTechs = (technicians || []).filter(t => assignedTechIds.includes(t.id));
      const avgProjScore = projectTechs.length
        ? Math.round(projectTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / projectTechs.length)
        : 80; // Baseline default if none assigned
      return {
        projectName: safeString(p.name).length > 20 ? safeString(p.name).substring(0, 20) + "..." : safeString(p.name),
        "Avg safety score (%)": avgProjScore,
        "Distance Coverage Index": Math.round((safeNumber(p.budget) / 1000) * 5) // distance scale factor
      };
    });
  }, [filteredProjects, technicians]);

  // Visual Chart Data 2: Safety Certificate Status distribution
  const documentStatusPieData = useMemo(() => {
    const statuses = ["Approved", "Pending Central Approval", "Pending Contractor Approval", "Rejected"];
    const colors = ["#18863A", "#F59E0B", "#3B82F6", "#E61C24"];
    
    return statuses.map((status, idx) => {
      const count = (filteredDocs || []).filter(d => d.status === status).length;
      return {
        name: status,
        value: count,
        color: colors[idx]
      };
    }).filter(item => item.value > 0); // hide zero records for prettier visualization
  }, [filteredDocs]);

  // Mock safety report auto-narrative generator based on live calculations (Simulated AI)
  const handleGenerateAiReport = () => {
    setIsAiGenerating(true);
    setAiReportOutput(null);
    setTimeout(() => {
      setIsAiGenerating(false);
      
      const flaggedTotal = stats.issueCount;
      const lowScores = (technicians || []).filter(t => t && t.overallEhsScore < 70);
      
      let summary = `### SAFARICOM EXECUTIVE SAFETY INTELLIGENCE REPORT\n`;
      summary += `**Generated for:** Unified EHS Portal (Safaricom Audit Ops)\n`;
      summary += `**Overall Scope Compliance Rating:** ${stats.avgScore}% Average Score / ${stats.approvalRate}% Audit Acceptance Rate\n\n`;
      
      summary += `#### 🚨 KEY SAFETY OBSERVATIONS & HEALTH VECTORS\n`;
      if (flaggedTotal > 0) {
        summary += `- **System alert:** Identified ${flaggedTotal} recurring compliance or safety item flags across active safety certification folders.\n`;
      } else {
        summary += `- **Perfect File Clearance:** No structural hazardous flags detected across currently filtered compliance archives.\n`;
      }
      
      if (lowScores.length > 0) {
        summary += `- **High-Risk Crew Warning:** ${lowScores.length} field engineers currently fall below the Safaricom 70% basic compliance safety threshold. Immediate retraining is strongly recommended prior to next tower climbs.\n`;
        summary += `  - *Flagged Crew members (Critical status):* ${lowScores.map(t => t.name).join(", ")}.\n`;
      } else {
        summary += `- **Superb Crew Compliance:** 100% of currently active technician field personnel are verified compliant with high safety scores.\n`;
      }

      summary += `\n#### 🏢 PARTNER PERFORMANCE COMPLIANCE BENCHMARK\n`;
      stats.partnerStats.forEach(p => {
        const rating = p.score >= 85 ? "Excellent (🎖️ Gold Standard)" : p.score >= 75 ? "Satisfactory" : "At Risk (⚠️ Under active review)";
        summary += `- **${p.name} (${p.code}):** Average score **${p.score}%** — Ranking: *${rating}* with ${p.techCount} deployed crew.\n`;
      });

      summary += `\n#### 📋 STRATEGIC AUDIT RECOMMENDATIONS\n`;
      summary += `1. **Enforce Mandatory Re-Auditing:** Require immediate safety upload verification checklists for any project holding an average compliance index under 80%.\n`;
      summary += `2. **Proactive Site Gatekeeping:** Establish strict biometric entry restrictions linked directly to the Technician overall EHS clearance score database.\n`;
      summary += `3. **Digital Log Archiving:** Maintain weekly visual proofs of certified working-at-height harnesses before dispatching subcontractors.\n`;

      setAiReportOutput(summary);
    }, 1100);
  };

  // Safe print preview handler
  const handlePrintReport = () => {
    window.print();
  };

  // Safe Export to CSV handler for active compliance flags and their status
  const handleExportCSV = () => {
    // We export filteredFlags to support filtering by standard/severity/status,
    // or the full complianceFlags list if they clear filters.
    const flagsToExport = filteredFlags;

    const headers = [
      "Flag ID",
      "Target ID",
      "Target Type",
      "Target Name",
      "Compliance Standard",
      "Rule Name",
      "Severity",
      "Status",
      "Description",
      "Flagged At",
      "Resolved At",
      "Resolution Comments"
    ];

    const escapeCSV = (val: unknown) => {
      if (val === null || val === undefined) return "";
      let str = "";
      try {
        str = safeString(val);
      } catch {
        str = "[Object]";
      }
      str = str.replace(/"/g, '""');
      if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(","),
      ...flagsToExport.map(flag => [
        escapeCSV(flag.id),
        escapeCSV(flag.targetId),
        escapeCSV(flag.targetType),
        escapeCSV(flag.targetName),
        escapeCSV(flag.standard),
        escapeCSV(flag.ruleName),
        escapeCSV(flag.severity),
        escapeCSV(flag.status),
        escapeCSV(flag.description),
        escapeCSV(flag.flaggedAt),
        escapeCSV(flag.resolvedAt || "N/A"),
        escapeCSV(flag.resolutionComments || "N/A")
      ].join(","))
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `safaricom_compliance_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe Print to PDF handler for high-risk unresolved flags
  const handlePrintHighRiskFlags = () => {
    const branchName = activeContractorId === "all" 
      ? "Safaricom Unified Network (All Partners)" 
      : (contractors.find(b => b.id === activeContractorId)?.name || "Contractor");

    const dateStr = new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short"
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    let tableRowsHtml = "";
    if (unresolvedHighRiskFlags.length > 0) {
      unresolvedHighRiskFlags.forEach((flag, index) => {
        const safe = (v: unknown) => {
          return safeString(v);
        };
        let flagDate = "Unknown";
        try {
          flagDate = new Date(safe(flag.flaggedAt)).toLocaleString();
        } catch { /* ignore */ }

        tableRowsHtml += `
          <div class="flag-card">
            <div class="flag-header">
              <div class="flag-title-block">
                <span class="flag-title">#${index + 1}: ${safe(flag.ruleName)}</span>
                <span class="flag-meta">Logged: ${flagDate} | Standard Focus: <strong>${safe(flag.standard)}</strong></span>
              </div>
              <span class="badge-high">High Risk</span>
            </div>
            <div class="flag-body">
              <p class="flag-desc">${safe(flag.description)}</p>
              <div class="flag-details-grid">
                <div class="detail-item"><strong>Target Type:</strong> <span style="text-transform: capitalize;">${safe(flag.targetType)}</span></div>
                <div class="detail-item"><strong>Target Name:</strong> <span>${safe(flag.targetName)}</span></div>
                <div class="detail-item"><strong>Compliance Rule ID:</strong> <span>${safe(flag.id)}</span></div>
                <div class="detail-item"><strong>Security Classification:</strong> <span>Active Unresolved</span></div>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      tableRowsHtml = `
        <div class="no-flags">
          <div class="no-flags-title">✓ No Active High-Risk Flags</div>
          <p class="no-flags-text">
            Excellent! A real-time audit scan verifies that there are currently zero unresolved high-risk 
            compliance breaches or safety violations recorded for the selected operational scope. All critical 
            standards (OSHA, EPA, NEMA, and internal Safaricom guidelines) are fully clear.
          </p>
        </div>
      `;
    }

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Safaricom EHS High-Risk Compliance Audit Summary</title>
        <style>
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background-color: #ffffff !important;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 40px;
            line-height: 1.5;
            background-color: #ffffff;
          }
          .header {
            border-bottom: 3px solid #e11d48;
            padding-bottom: 15px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .logo-area h1 {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .logo-area h2 {
            font-size: 11px;
            font-weight: 600;
            color: #e11d48;
            margin: 3px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .info-area {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .info-area strong {
            color: #0f172a;
          }
          .title-banner {
            background-color: #fff1f2 !important;
            border: 1px solid #fecdd3;
            border-left: 5px solid #e11d48;
            padding: 15px 18px;
            border-radius: 6px;
            margin-bottom: 25px;
          }
          .title-banner h3 {
            font-size: 16px;
            color: #9f1239;
            margin: 0 0 4px 0;
            font-weight: 700;
          }
          .title-banner p {
            font-size: 12px;
            color: #881337;
            margin: 0;
            font-weight: 500;
          }
          .flag-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            overflow: hidden;
          }
          .flag-header {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #cbd5e1;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .flag-title-block {
            display: flex;
            flex-direction: column;
          }
          .flag-title {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
          }
          .flag-meta {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
          }
          .badge-high {
            background-color: #e11d48 !important;
            color: #ffffff !important;
            font-size: 9px;
            font-weight: 850;
            padding: 3px 8px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .flag-body {
            padding: 14px 15px;
            background: #ffffff;
          }
          .flag-desc {
            font-size: 12.5px;
            color: #334155;
            line-height: 1.5;
            margin: 0 0 12px 0;
          }
          .flag-details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 11px;
            background-color: #f1f5f9 !important;
            padding: 10px 12px;
            border-radius: 4px;
          }
          .detail-item strong {
            color: #0f172a;
          }
          .detail-item span {
            color: #475569;
          }
          .no-flags {
            text-align: center;
            padding: 40px;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            background-color: #fafafa !important;
            margin-bottom: 30px;
          }
          .no-flags-title {
            font-size: 18px;
            color: #059669;
            font-weight: bold;
            margin: 0 0 8px 0;
          }
          .no-flags-text {
            font-size: 13px;
            color: #475569;
            max-w: 480px;
            margin: 0 auto;
            line-height: 1.5;
          }
          .signature-section {
            margin-top: 45px;
            page-break-inside: avoid;
          }
          .signature-title {
            font-size: 11px;
            font-weight: bold;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
          }
          .sig-block {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 12px;
            background-color: #f8fafc !important;
          }
          .sig-line {
            border-bottom: 1px solid #475569;
            margin-top: 35px;
            margin-bottom: 6px;
          }
          .sig-label {
            font-size: 10.5px;
            font-weight: 600;
            color: #334155;
          }
          .sig-sub {
            font-size: 9px;
            color: #64748b;
            margin-top: 1.5px;
          }
          .footer {
            margin-top: 45px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <h1>Safaricom</h1>
            <h2>Unified EHS & Compliance Operations</h2>
          </div>
          <div class="info-area">
            <div>Scope: <strong>${branchName}</strong></div>
            <div>Generated: <strong>${dateStr}</strong></div>
            <div>Report Security: <strong>Safaricom Internal Strict Compliance</strong></div>
          </div>
        </div>

        <div class="title-banner">
          <h3>Unresolved High-Risk Compliance Audit Summary</h3>
          <p>This document presents a structured and detailed clearance report of all unresolved high-risk compliance warnings flagged across active technicians, documentation pools, and project rollout sites.</p>
        </div>

        ${tableRowsHtml}

        <div class="signature-section">
          <div class="signature-title">Review & Validation Approvals</div>
          <div class="signature-grid">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Safaricom Senior EHS Lead</div>
              <div class="sig-sub">Corporate HQ Operations</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Partner Safety Coordinator</div>
              <div class="sig-sub">Regional Infrastructure Team</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Independent Safety Auditor</div>
              <div class="sig-sub">Third Party Compliance Board</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <div>© 2026 Safaricom PLC • Unified EHS Portal (Reporting Module)</div>
          <div>Page 1 of 1</div>
          <div>Strictly Private & Confidential</div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 450);
  };

  return (
    <div id="reporting_module_container" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
      
      {/* Title block with actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-[#E61C24] text-[10px] font-extrabold uppercase rounded-full tracking-wider animate-pulse">
              Ops Insights
            </span>
            <span className="text-slate-400 font-mono text-[11px]">System Tool</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#E61C24]" /> Unified EHS & Project Compliance Reports
          </h2>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl">
            Interactive analytical suite providing high-fidelity oversight of partner compliance scores, 
            safety certification approval times, and regional safety metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            id="print_report_btn"
            onClick={handlePrintReport}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-3xs"
          >
            <Printer className="w-3.5 h-3.5" /> Print Audit Portfolio
          </button>
          
          <button 
            id="ai_report_btn"
            onClick={handleGenerateAiReport}
            disabled={isAiGenerating}
            className="px-4 py-1.5 bg-[#E61C24] hover:bg-[#c2141a] text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
          >
            {isAiGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing Safety Records...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 fill-white/10" /> Compile AI Executive Summary
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider">
            <SlidersHorizontal className="w-4 h-4 text-[#E61C24]" /> Filter Parameters
          </div>
          <button 
            onClick={handleResetFilters}
            className="text-[10px] text-slate-500 hover:text-[#E61C24] font-semibold flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" /> Reset Filter Settings
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Contractor Filter */}
          <div>
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">
              Filter by Partner Contractor:
            </label>
            <select
              value={activeContractorId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={!isCentral}
              className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none w-full focus:bg-white focus:border-[#E61C24] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <option value="all">Safaricom Unified Network (All Partners)</option>
              {contractors.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">
              Select Active Project Trace:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none w-full focus:bg-white focus:border-[#E61C24]"
            >
              <option value="all">Analyze All Projects ({filteredProjects.length})</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Verification Status Filter */}
          <div>
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">
              Cert Upload Status:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none w-full focus:bg-white focus:border-[#E61C24]"
            >
              <option value="all">All Submission Statuses</option>
              <option value="Approved">Verified / Approved</option>
              <option value="Pending Central Approval">Pending Central HQ Approval</option>
              <option value="Pending Contractor Approval">Pending Contractor EHS Lead Approval</option>
              <option value="Rejected">Rejected Compliance Files</option>
            </select>
          </div>

          {/* Minimum safety rating */}
          <div>
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">
              Min overall Crew Safety Score: {minEhsScore > 0 ? `${minEhsScore}%` : "All scores"}
            </label>
            <input 
              type="range" 
              min="0" 
              max="95" 
              step="5"
              value={minEhsScore}
              onChange={(e) => setMinEhsScore(parseInt(e.target.value))}
              className="w-full accent-[#E61C24] cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Key Metric KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Compliance Index KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100">
            {stats.avgScore}%
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Compliance Index</span>
            <span className="text-sm font-extrabold text-slate-800">
              {stats.avgScore >= 85 ? "Optimum (Gold)" : stats.avgScore >= 75 ? "Robust" : "Pre-Critical Warning"}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold mt-0.5">
              <TrendingUp className="w-3 h-3" /> Tested field crew
            </div>
          </div>
        </div>

        {/* Upload Audit Success KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-100">
            {stats.approvalRate}%
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Audit Approval Success</span>
            <span className="text-sm font-extrabold text-slate-800">{stats.totalDocs} uploaded cert files</span>
            <div className="text-[10px] text-slate-400 mt-0.5">Approved compliance submissions</div>
          </div>
        </div>

        {/* Active safety issue alert notifications */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${stats.issueCount > 0 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-400 border-slate-100"}`}>
            {stats.issueCount}
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Active Hazard Flags</span>
            <span className="text-sm font-extrabold text-slate-800">
              {stats.issueCount > 0 ? "Hazards Flagged" : "Zero Issues Flagged"}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">Extracted by intelligent review</div>
          </div>
        </div>

        {/* Deployed Safety Lead Presence */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-[#E61C24] flex items-center justify-center font-bold text-lg border border-rose-100">
            {filteredProjects.length}
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Contractor Projects</span>
            <span className="text-sm font-extrabold text-slate-800">Under Active Oversight</span>
            <div className="text-[10px] text-slate-400 mt-0.5">Audited regional tower hubs</div>
          </div>
        </div>

        {/* Total Rollout Distance KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-lg border border-sky-100">
            <span className="flex flex-col items-center">
              {stats.totalRolloutDistance}
              <span className="text-[8px] font-bold text-sky-500 uppercase">km</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Total Rollout</span>
            <span className="text-sm font-extrabold text-slate-800">In Fibre Kilometers</span>
            <div className="text-[10px] text-slate-400 mt-0.5">Aggregated fibre distance</div>
          </div>
        </div>
      </div>

      {/* AI compiled summary dynamic output and charts */}
      {aiReportOutput && (
        <div className="bg-rose-50/70 border border-rose-150 rounded-xl p-5 shadow-3xs animate-fade-in text-slate-800 text-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 font-bold text-[#E61C24] uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#E61C24] fill-rose-200" /> Compiled Executive Summary Findings
            </div>
            <button 
              onClick={() => setAiReportOutput(null)}
              className="text-[10px] hover:text-[#E61C24] text-slate-500 font-bold"
            >
              ✕ Hide Report Panel
            </button>
          </div>
          <div className="bg-white rounded-lg p-5 border border-slate-150 space-y-3 prose prose-sm max-w-none text-slate-700">
            {aiReportOutput.split("\n").map((line, i) => {
              if (line.startsWith("### ")) {
                return <h3 key={i} className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-1.5 mt-2 uppercase tracking-wide">{line.replace("### ", "")}</h3>;
              }
              if (line.startsWith("#### ")) {
                return <h4 key={i} className="text-xs font-bold text-slate-850 mt-3 flex items-center gap-1">{line.replace("#### ", "")}</h4>;
              }
              if (line.startsWith("- ")) {
                return <p key={i} className="pl-4 border-l-2 border-red-500/30 my-1">{line.replace("- ", "")}</p>;
              }
              if (line.startsWith("  - ")) {
                return <p key={i} className="pl-8 text-[11px] text-slate-500 italic my-0.5">{line.replace("  - ", "")}</p>;
              }
              if (line.trim() === "") return <div key={i} className="h-1" />;
              return <p key={i} className="leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      )}

      {/* Daily Notes History — Management Analysis */}
      <DailyNotesHistory user={currentUser} />

      {/* Graphic Analytical Visualizations block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Project-wise EHS scores comparison */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-4">Project-wise Safety Score Index Comparison</h3>
          
          <div className="h-[250px] w-full">
            {projectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100} id="project_ehs_score_chart">
                <BarChart data={projectChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="projectName" 
                    tick={{ fill: "#64748b", fontSize: 9 }} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fill: "#64748b", fontSize: 9 }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", color: "#fff", border: "none", borderRadius: "8px", fontSize: "10px" }}
                    labelStyle={{ fontWeight: "bold", color: "#94a3b8" }}
                  />
                  <Bar 
                    dataKey="Avg safety score (%)" 
                    fill="#E61C24" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-[11px] italic">
                No project score data available under current filter variables.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Safety Certificate Upload verification State distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-4">Verification State Distribution (Safety Audits)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[250px] items-center">
            <div className="col-span-7 h-full w-full">
              {documentStatusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100} id="doc_status_pie_chart">
                  <PieChart>
                    <Pie
                      data={documentStatusPieData}
                      cx="55%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {documentStatusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#1e293b", color: "#fff", border: "none", borderRadius: "8px", fontSize: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-[11px] italic">
                  No certificate document statistics available.
                </div>
              )}
            </div>

            <div className="col-span-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Legend Breakdown</span>
              {documentStatusPieData.map((item, _idx) => (
                <div key={item.name} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="capitalize">{item.name}:</span>
                  <strong className="font-bold text-slate-800 text-xs">{item.value}</strong>
                </div>
              ))}
              {documentStatusPieData.length === 0 && (
                <div className="text-[10px] text-slate-400 italic">No submissions file queue logged representing active partner filters.</div>
              )}
            </div>
          </div>
        </div>

      </div>

    {/* AUTOMATED REGULATORY COMPLIANCE SYSTEM MONITOR (OSHA / EPA / NEMA) */}
    <div className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden">
      <div className="p-5 border-b border-slate-150 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
              Safaricom Compliance Engine (Daemon Active)
            </span>
          </div>
          <h3 className="font-extrabold text-sm text-slate-900 uppercase mt-1 flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-[#E61C24]" /> Automated Policy & Regulatory Audit
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Periodic scanning engine mapping active operations against OSHA crew standards, NEMA/EPA environmental clearances, and Safaricom safety validation SLAs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            id="print_high_risk_pdf_btn"
            onClick={handlePrintHighRiskFlags}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
            title="Print a formatted, printer-friendly summary of all unresolved high-risk compliance flags"
          >
            <Printer className="w-3.5 h-3.5" /> Print to PDF
          </button>

          <button
            id="export_compliance_csv_btn"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
            title="Export active compliance flags and their status to a CSV file for external audit reporting"
          >
            <Download className="w-3.5 h-3.5" /> Export Compliance CSV
          </button>

          {onTriggerScan && (currentUser?.role === Role.SafaricomAdmin || currentUser?.role === Role.SafaricomEHSOfficer) && (
            <button
              id="sweep_scan_btn"
              onClick={onTriggerScan}
              className="px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 shadow-sm"
              title="Scan whole active database to look for newly active regulatory warnings"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sweep & Analyze Workspace
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-slate-100 bg-slate-50/20 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Standard selector */}
        <div className="md:col-span-5 flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-[10px] uppercase font-bold text-slate-400 pr-1 shrink-0 font-mono">Standard:</span>
          {["all", "OSHA", "EPA", "Regulatory", "Safaricom Internal"].map((std) => (
            <button
              key={std}
              onClick={() => setComplianceStandardFilter(std)}
              className={`px-3 py-1 text-xs rounded-full font-bold transition whitespace-nowrap ${
                complianceStandardFilter === std
                  ? "bg-[#E61C24] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {std === "all" ? "All Rules" : std}
            </button>
          ))}
        </div>

        {/* Severity Selector */}
        <div className="md:col-span-4 flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Severity:</span>
          <select
            value={complianceSeverityFilter}
            onChange={(e) => setComplianceSeverityFilter(e.target.value)}
            className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none w-full"
          >
            <option value="all">All Severities</option>
            <option value="High">🔴 High Severity</option>
            <option value="Medium">🟡 Medium Severity</option>
            <option value="Low">🔵 Low Severity</option>
          </select>
        </div>

        {/* Status Selector Tabs (Active vs Resolved) */}
            <div className="md:col-span-3 flex border border-slate-200 rounded-lg p-0.5 bg-slate-100/60 ml-auto w-full md:w-auto">
          <button
            onClick={() => {
              setComplianceStatusFilter("Active");
              setResolvingFlagId(null);
            }}
            className={`flex-1 px-3 py-1 text-xs rounded-md font-bold transition flex items-center justify-center gap-1 ${
              complianceStatusFilter === "Active"
                ? "bg-white text-slate-900 shadow-3xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Active ({(complianceFlags || []).filter(f => f && f.status === "Active").length})
          </button>
          <button
            onClick={() => {
              setComplianceStatusFilter("Resolved");
              setResolvingFlagId(null);
            }}
            className={`flex-1 px-3 py-1 text-xs rounded-md font-bold transition flex items-center justify-center gap-1 ${
              complianceStatusFilter === "Resolved"
                ? "bg-white text-slate-900 shadow-3xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved ({(complianceFlags || []).filter(f => f && f.status === "Resolved").length})
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-150 flex-1 overflow-y-auto min-h-0">
        {paginatedFlags.map((flag) => {
          // Identify corresponding visual icon
          let FlagIcon = AlertCircle;
          let iconColor = "text-slate-400";
          if (flag.standard === "OSHA") {
            FlagIcon = Shield;
            iconColor = "text-red-500";
          } else if (flag.standard === "EPA" || flag.standard === "NEMA") {
            FlagIcon = Leaf;
            iconColor = "text-emerald-500";
          } else if (flag.standard === "Regulatory") {
            FlagIcon = Clock;
            iconColor = "text-indigo-500";
          } else {
            FlagIcon = Info;
            iconColor = "text-slate-500";
          }

          // Severity colors
          let severityBadge = "bg-slate-100 text-slate-700";
          if (flag.severity === "High") {
            severityBadge = "bg-red-50 text-red-700 border border-red-150 font-extrabold";
          } else if (flag.severity === "Medium") {
            severityBadge = "bg-amber-50 text-amber-700 border border-amber-150 font-bold";
          } else if (flag.severity === "Low") {
            severityBadge = "bg-blue-50 text-blue-700 border border-blue-150 font-medium";
          }

          return (
            <div key={flag.id} className="p-4 hover:bg-slate-50/40 transition">
              <div className="flex items-start gap-3.5">
                <div className={`p-2 bg-slate-100 rounded-xl ${iconColor} mt-0.5 shadow-3xs border border-slate-200/50`}>
                  <FlagIcon className="w-5 h-5" />
                </div>

                <div className="flex-grow space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-[13px]">{flag.ruleName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase font-semibold ${severityBadge}`}>
                      {flag.severity}
                    </span>
                    <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {flag.standard}
                    </span>
                    <span className="text-[10.5px] text-slate-400 ml-auto font-medium">
                      Flagged: {(() => {
                        try {
                          return new Date(flag.flaggedAt).toLocaleString();
                        } catch {
                          try { return safeString(flag.flaggedAt); } catch { return "Unknown"; }
                        }
                      })()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-3 rounded-lg border border-slate-100 mt-1">
                    {flag.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-bold">
                      <span className="uppercase tracking-wider text-[9px] text-slate-400 font-mono">Linked Entity:</span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded capitalize font-mono text-[10px]">
                        {flag.targetType}
                      </span>
                      <span className="text-slate-800 font-bold italic">&quot;{flag.targetName}&quot;</span>
                    </div>

                    {flag.status === "Active" ? (
                      <div>
                        {resolvingFlagId === flag.id ? (
                          <div className="mt-3 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2.5 max-w-xl">
                            <span className="text-[11px] font-extrabold text-indigo-900 block uppercase tracking-wider font-mono">
                              File Official Resolution Corrective Action
                            </span>
                            <textarea
                              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium"
                              rows={2}
                              value={resolutionInputText}
                              onChange={(e) => setResolutionInputText(e.target.value)}
                              placeholder="Please detail the corrective actions filed (e.g. Technician safety training program completed, valid NEMA certificate uploaded, or field safety equipment checked)..."
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setResolvingFlagId(null)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-bold transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (onResolveFlag) {
                                    onResolveFlag(flag.id, resolutionInputText);
                                    setResolvingFlagId(null);
                                    setResolutionInputText("");
                                  }
                                }}
                                disabled={!resolutionInputText.trim()}
                                className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
                              >
                                Submit Compliance Audit Log
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setResolvingFlagId(flag.id);
                              setResolutionInputText("");
                            }}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 text-[10.5px] font-extrabold rounded-lg transition"
                          >
                            Resolve Warning Flag
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 w-full text-left">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>RESOLVED AUDIT SIGN-OFF</span>
                        </div>
                        {flag.resolvedAt && (
                          <span className="text-[10px] text-emerald-600/80 block font-semibold mt-0.5">
                            Closed on: {(() => {
                              try {
                                return new Date(flag.resolvedAt).toLocaleString();
                              } catch {
                                try { return safeString(flag.resolvedAt); } catch { return "Unknown"; }
                              }
                            })()}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-600 mt-1 italic font-medium">
                          <strong>Correction Notes:</strong> {flag.resolutionComments || "Approved during regular safety cycle checks."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {paginatedFlags.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
            <div>
              <p className="font-extrabold text-slate-800 uppercase tracking-wider text-sm">
                No Policy Breaches Detected
              </p>
              <p className="text-slate-400 text-[11px] mt-1 max-w-sm mx-auto">
                Excellent! All currently monitored active projects and documentations have completely passed OSHA & NEMA compliance audits under specified filters.
              </p>
            </div>
          </div>
        )}

        <PaginationControls
          currentPage={compFlagsPage}
          setCurrentPage={setCompFlagsPage}
          totalItems={filteredFlags.length}
          itemsPerPage={COMP_FLAGS_PER_PAGE}
        />
      </div>
    </div>

    {/* TECHNICIAN SAFETY DOCUMENT EXPIRATION AUDIT & PROGNOSIS REPORT */}
    <div id="document-expiration-report" className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden my-6">
      <div className="p-5 border-b border-slate-150 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-[#E61C24]/10 text-[#E61C24] rounded border border-[#E61C24]/20 uppercase tracking-widest font-mono">
                Predictive SLA Watch
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Reference Date: June 14, 2026</span>
            </div>
            <h3 className="font-extrabold text-sm text-slate-900 uppercase flex items-center gap-1.5">
              <Clock className="w-5 h-5 text-[#E61C24]" /> Document Expiration Forecasting Report
            </h3>
            <p className="text-[10.5px] text-slate-500 max-w-2xl leading-relaxed">
              Dynamically audit active technician certificates and credentials. Filter or input a customized day-count window to capture impending expirations and prevent unauthorized field work.
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Controls Section */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/20 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Dynamic Days Range Selector */}
        <div className="lg:col-span-5 space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Forecast Threshold (Days):</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={expirationDays}
              onChange={(e) => {
                setExpiredOnlyFilter(false);
                setExpirationDays(e.target.value.replace(/\D/g, ""));
              }}
              disabled={expiredOnlyFilter}
              className="px-3 py-1.5 w-24 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono outline-none text-slate-800 focus:border-[#E61C24]"
              placeholder="e.g. 30"
            />
            <span className="text-xs text-slate-500 font-medium">days out</span>

            {/* Quick buttons */}
            <div className="flex gap-1 items-center ml-2 border-l border-slate-200 pl-3">
              {[15, 30, 60, 90].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setExpiredOnlyFilter(false);
                    setExpirationDays(preset.toString());
                  }}
                  className={`px-2 py-1 text-[10.5px] rounded font-bold transition ${
                    !expiredOnlyFilter && expirationDays === preset.toString()
                      ? "bg-[#18863A] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {preset}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status Filter Toggles (Expired Only vs Impending) */}
        <div className="lg:col-span-4 space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Auditing State Filter:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setExpiredOnlyFilter(false)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                !expiredOnlyFilter
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Expiring &lt;= {expirationDays || "0"} Days
            </button>
            <button
              onClick={() => setExpiredOnlyFilter(true)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                expiredOnlyFilter
                  ? "bg-red-500 border-red-500 text-white shadow-3xs"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Already Expired
            </button>
          </div>
        </div>

        {/* Regional isolation option */}
        <div className="lg:col-span-3 space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Hub Region presence:</label>
          {isCentral ? (
            <select
              value={expirationBranchFilter}
              onChange={(e) => setExpirationBranchFilter(e.target.value)}
              className="text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none w-full"
            >
              <option value="all">Global Safaricom Network</option>
              {contractors.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <div className="text-xs py-1.5 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold capitalize">
              {contractors.find(b => b.id === currentUser?.contractorId)?.name || "Local Contractor Unit"}
            </div>
          )}
        </div>
      </div>

      {/* Expiring List Table results */}
      <div className="overflow-x-auto">
        {expiringDocsReport.length > 0 ? (
          <table className="w-full text-xs text-left text-slate-700 divide-y divide-slate-150">
            <thead className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
              <tr>
                <th className="p-3.5 pl-5">Holder / Contact</th>
                <th className="p-3.5">Regional presence</th>
                <th className="p-3.5">Document Audit Name</th>
                <th className="p-3.5">Expiration Date</th>
                <th className="p-3.5">Days Left (Prognosis)</th>
                <th className="p-3.5 text-center">Urgency Tier</th>
                <th className="p-3.5 pr-5 text-right">SLA Action Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expiringDocsReport.map((doc) => {
                const docBranch = contractors.find(b => b.id === doc.contractorId)?.name || "N/A";
                const techProfile = technicians.find(t => t.id === doc.technicianId);
                const isExpired = doc.remainingDays < 0;

                // Urgency mapping
                let urgencyBadge = "bg-green-50 text-green-700 border border-green-150";
                let urgencyLabel = "Low Risk";
                if (isExpired) {
                  urgencyBadge = "bg-red-50 text-red-700 border border-red-150 font-black";
                  urgencyLabel = "CRITICAL: EXPIRED";
                } else if (doc.remainingDays <= 15) {
                  urgencyBadge = "bg-amber-50 text-amber-700 border border-amber-150 font-bold";
                  urgencyLabel = "IMMEDIATE SLA EXPIRY";
                } else if (doc.remainingDays <= 30) {
                  urgencyBadge = "bg-yellow-50 text-yellow-700 border border-yellow-150 font-semibold";
                  urgencyLabel = "WARNING WINDOW";
                }

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/40 transition">
                    <td className="p-3.5 pl-5">
                      <div className="font-extrabold text-slate-900">{doc.technicianName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{techProfile?.phone || "+254 No Phone"}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-600">{docBranch}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{doc.type}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-sm mt-0.5">{doc.fileName}</div>
                    </td>
                    <td className="p-3.5 font-bold font-mono text-slate-700">{doc.expiryDate}</td>
                    <td className="p-3.5">
                      {isExpired ? (
                        <span className="text-red-700 font-extrabold flex items-center gap-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Expired {Math.abs(doc.remainingDays)}d ago
                        </span>
                      ) : (
                        <span className="text-slate-800 font-extrabold pl-0.5 text-[11px]">
                          {doc.remainingDays} days remaining
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${urgencyBadge}`}>
                        {urgencyLabel}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      {notifiedDocs[doc.id] ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-150 px-2.5 py-1 rounded-lg text-[10px] shadow-3xs">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Alert Dispatched
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setNotifiedDocs(prev => ({ ...prev, [doc.id]: true }));
                          }}
                          className={`px-3 py-1 bg-indigo-50 hover:bg-[#E61C24]/10 hover:text-[#E61C24] hover:border-[#E61C24]/50 border border-indigo-150 text-indigo-700 text-[10px] font-extrabold rounded-lg transition shadow-3xs flex items-center gap-1.5 ml-auto ${
                            isExpired ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : ""
                          }`}
                        >
                          Send SLA Alert
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-500 py-16 flex flex-col items-center justify-center space-y-3.5 bg-slate-50/20">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            <div className="space-y-1">
              <p className="font-extrabold text-slate-800 uppercase tracking-widest text-xs font-mono">
                Safe Expiration State
              </p>
              <p className="text-slate-400 text-xs font-medium max-w-md mx-auto">
                No active credentials expire within {expiredOnlyFilter ? "the selected past window" : `${expirationDays || "0"} days`}. Regional field safety compliance is secure!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Official Project Clearance and safety Gate Audit table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-3xs">
        <div className="p-4 bg-slate-550 border-b border-slate-150 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-xs text-slate-900 uppercase">Subcontractor Site Clearance Ledger</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Visual representation of real-time project risk thresholds and crew compliance rates.</p>
          </div>
          <span className="text-[9px] uppercase font-bold text-slate-400 font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            Records Count: {filteredProjects.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table id="site_clearance_table" className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50/70 border-b border-slate-150 text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
              <tr>
                <th className="p-4">Active Hub / Project</th>
                <th className="p-4">Assigned Partner</th>
                <th className="p-4">Current Milestone</th>
                <th className="p-4">Safaricom Lead</th>
                <th className="p-4">Safety Lead</th>
                <th className="p-4 text-center">Safety Rating Score</th>
                <th className="p-4 text-center">Clearance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((p) => {
                const partnerName = contractors.find(b => b.id === p.contractorId)?.name || "Not assigned";
                const leadName = allUsers.find(u => u.id === p.projectLeadId)?.name || "Unassigned Lead";
                const ehsOfficer = allUsers.find(u => u.id === p.ehsOfficerId)?.name || "Unassigned EHS";
                
                // average safety rating for crew profiles
                const assignedIds = p.assignedTechnicianIds || [];
                const matchedTechs = (technicians || []).filter(t => t && assignedIds.includes(t.id));
                const averageScore = matchedTechs.length
                  ? Math.round(matchedTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / matchedTechs.length)
                  : 80;

                // compliance evaluation status
                let evaluatedStatus = "Cleared";
                let evaluatedStyle = "bg-emerald-50 text-emerald-800 border-emerald-150";
                if (averageScore < 70) {
                  evaluatedStatus = "Suspended Site Access";
                  evaluatedStyle = "bg-red-50 text-red-800 border-red-150";
                } else if (averageScore < 80) {
                  evaluatedStatus = "Needs Inspection";
                  evaluatedStyle = "bg-amber-50 text-amber-800 border-amber-150";
                }

                const projectMilestones = (milestones || []).filter(m => m.projectId === p.id);
                let currentMilestone = projectMilestones.find(m => m.status === "In Progress" || m.status === "Blocked");
                if (!currentMilestone) {
                  currentMilestone = projectMilestones.find(m => m.status === "Pending");
                }
                if (!currentMilestone && projectMilestones.length > 0) {
                  currentMilestone = projectMilestones[projectMilestones.length - 1];
                }
                const currentMilestoneTitle = currentMilestone ? currentMilestone.title : "Not Started";

                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-semibold text-slate-900">
                      <div className="truncate max-w-sm">{p.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.startDate} to {p.endDate}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-600">{partnerName}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 truncate max-w-[180px]" title={currentMilestoneTitle}>{currentMilestoneTitle}</div>
                      {currentMilestone && (
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          currentMilestone.status === "In Progress" ? "bg-blue-50 text-blue-700 border border-blue-150" :
                          currentMilestone.status === "Blocked" ? "bg-red-50 text-red-700 border border-red-150 animate-pulse" :
                          currentMilestone.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-150" :
                          "bg-slate-50 text-slate-500 border border-slate-200"
                        }`}>
                          {currentMilestone.status}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500">{leadName}</td>
                    <td className="p-4 text-slate-500">{ehsOfficer}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[11px] font-bold ${averageScore >= 80 ? "text-emerald-600" : averageScore >= 70 ? "text-amber-500" : "text-red-500"}`}>
                          {averageScore}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">avg ({matchedTechs.length} crew)</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${evaluatedStyle}`}>
                        {evaluatedStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={7} className="bg-slate-50/50 p-12 text-center text-slate-400 text-xs italic">
                    There are no recorded project scopes matching the compliance metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ReportingView;
