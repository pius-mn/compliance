import { NextResponse } from "next/server";
import { Role } from "@/src/types";
import { getProjects } from "@/src/services/projects";
import { getEHSDocuments } from "@/src/services/ehs";
import { getTechnicians } from "@/src/services/technicians";
import { getMilestones } from "@/src/services/milestones";
import { getComplianceFlags } from "@/src/services/compliance";
import { getDocStatus } from "@/src/utils/helpers";
import { requireAuth } from "@/src/lib/routeAuth";
import { getAll } from "@/src/lib";
import { isSafaricomRole, isContractorRole } from "@/src/lib/permissions";

// ─── GET /api/v1/dashboard/stats ─────────────────────────────────────────────

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const isSafaricom = isSafaricomRole(user.role);
    const isContractor = isContractorRole(user.role);
    const requestedUserId = searchParams.get("userId") ? Number(searchParams.get("userId")) : null;

    // ── Determine the contractor scope ───────────────────────────────────────
    const activeContractorId = isSafaricom
      ? (searchParams.get("contractorId") ? Number(searchParams.get("contractorId")) : null)
      : (user.contractorId as number | null);

    // ── Fetch all data in parallel ───────────────────────────────────────────
    const [projects, documents, technicians, milestones, complianceFlags, users, contractors] =
      await Promise.all([
        getProjects(),
        getEHSDocuments(),
        getTechnicians(),
        getMilestones(),
        getComplianceFlags(),
        getAll("users"),
        getAll("contractors"),
      ]);

    // ── Apply contractor filter ──────────────────────────────────────────────
    let filteredProjects = activeContractorId
      ? projects.filter((p) => p.contractorId === activeContractorId)
      : projects;

    let filteredDocs = activeContractorId
      ? documents.filter((d) => d.contractorId === activeContractorId)
      : documents;

    let filteredTechs = technicians;
    if (activeContractorId) {
      const contractorUsers = (users || []).filter(
        (u: Record<string, unknown>) => u.contractorId === activeContractorId && u.role === Role.Technician
      );
      filteredTechs = technicians.filter(
        (t: Record<string, unknown>) =>
          t.contractorId === activeContractorId ||
          contractorUsers.some((cu: Record<string, unknown>) => cu.id === t.userId)
      );
    }

    // ── Apply userId scope ──────────────────────────────────────────────────
    if (requestedUserId) {
      filteredProjects = filteredProjects.filter(
        (p) => p.assignedTechnicianIds?.includes(requestedUserId)
      );
      filteredTechs = filteredTechs.filter(
        (t) => (t as Record<string, unknown>).userId === requestedUserId
      );
      filteredDocs = filteredDocs.filter(
        (d) => d.technicianId === requestedUserId
      );
    }

    // Milestones scoped to the filtered projects
    const authorizedProjectIds = filteredProjects.map((p) => p.id);
    const filteredMilestones = milestones.filter((m) =>
      authorizedProjectIds.includes(m.projectId)
    );

    // Compliance flags - compute contractorId for each flag
    const filteredFlags = activeContractorId
      ? complianceFlags.filter((flag) => {
          let flagContractorId: number | null = null;
          if (flag.targetType === "project") {
            const project = projects.find((p) => p.id === flag.targetId);
            flagContractorId = project ? (project.contractorId as number) : null;
          } else if (flag.targetType === "document") {
            const doc = documents.find((d) => d.id === flag.targetId);
            flagContractorId = doc ? doc.contractorId : null;
          } else if (flag.targetType === "technician") {
            const tech = technicians.find((t: Record<string, unknown>) => t.id === flag.targetId);
            flagContractorId = tech ? ((tech.contractorId as number | null) || null) : null;
          }
          return flagContractorId === activeContractorId;
        })
      : complianceFlags;

    // ── Compute stats ────────────────────────────────────────────────────────
    const projectStats = {
      total: filteredProjects.length,
      completed: filteredProjects.filter((p) => p.status === "Completed").length,
      inProgress: filteredProjects.filter((p) => p.status === "In Progress").length,
      planning: filteredProjects.filter((p) => p.status === "Planning").length,
      onHold: filteredProjects.filter((p) => p.status === "On Hold").length,
      totalBudget: filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0),
    };

    const documentStats = {
      total: filteredDocs.length,
      approved: filteredDocs.filter((d) => getDocStatus(d) === "Approved").length,
      pendingContractor: filteredDocs.filter((d) => getDocStatus(d) === "Pending Contractor Approval").length,
      pendingCentral: filteredDocs.filter((d) => getDocStatus(d) === "Pending Central Approval").length,
      rejected: filteredDocs.filter((d) => getDocStatus(d) === "Rejected").length,
    };

    const technicianStats = {
      total: filteredTechs.length,
      active: filteredTechs.filter((t) => (t as Record<string, unknown>).status === "Active").length,
      warningNeeded: filteredTechs.filter((t) => (t as Record<string, unknown>).status === "EHS Check Needed").length,
      avgScore: filteredTechs.length
        ? Math.round(
            filteredTechs.reduce((acc: number, t) => acc + ((t as Record<string, unknown>).overallEhsScore as number || 0), 0) /
              filteredTechs.length
          )
        : 100,
    };

    const milestoneStats = {
      total: filteredMilestones.length,
      completed: filteredMilestones.filter((m) => m.status === "Completed").length,
      inProgress: filteredMilestones.filter((m) => m.status === "In Progress").length,
      pending: filteredMilestones.filter((m) => m.status === "Pending").length,
      blocked: filteredMilestones.filter((m) => m.status === "Blocked").length,
      completionRate: filteredMilestones.length
        ? Math.round(
            (filteredMilestones.filter((m) => m.status === "Completed").length /
              filteredMilestones.length) * 100
          )
        : 0,
    };

    const complianceStats = {
      total: filteredFlags.length,
      active: filteredFlags.filter((f) => f.status === "Active").length,
      resolved: filteredFlags.filter((f) => f.status === "Resolved").length,
      highSeverity: filteredFlags.filter((f) => f.severity === "High").length,
      mediumSeverity: filteredFlags.filter((f) => f.severity === "Medium").length,
      lowSeverity: filteredFlags.filter((f) => f.severity === "Low").length,
    };

    // ── Monthly trend helpers ────────────────────────────────────────────────
    function getMonthKey(dateStr: string): string {
      const d = new Date(dateStr);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${months[d.getMonth()]} ${String(d.getFullYear()).substring(2)}`;
    }

    function buildMonthBuckets() {
      const now = new Date();
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const buckets: { month: string; created: number; resolved: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          month: `${months[d.getMonth()]} ${String(d.getFullYear()).substring(2)}`,
          created: 0,
          resolved: 0,
        });
      }
      return buckets;
    }

    // ── Compliance flag trend (last 6 months) ────────────────────────────────
    const complianceTrend = buildMonthBuckets();
    for (const flag of filteredFlags) {
      const cb = complianceTrend.find((b) => b.month === getMonthKey(flag.flaggedAt));
      if (cb) cb.created++;
      if (flag.resolvedAt && flag.status === "Resolved") {
        const resolvedAt = flag.resolvedAt;
        const rb = complianceTrend.find((b) => b.month === getMonthKey(resolvedAt));
        if (rb) rb.resolved++;
      }
    }

    // ── Milestone completion trend (last 6 months) ───────────────────────────
    const milestoneCompletedTrend = buildMonthBuckets();
    for (const m of filteredMilestones) {
      if (m.completedAt && m.status === "Completed") {
        const completedAt = m.completedAt;
        const b = milestoneCompletedTrend.find((b) => b.month === getMonthKey(completedAt));
        if (b) b.created++;
      }
    }

    // ── Resolve contractor name if scoped ────────────────────────────────────
    let contractorName: string | null = null;
    if (activeContractorId) {
      const contractor = (contractors as Record<string, unknown>[]).find((c) => (c.id as number) === activeContractorId);
      contractorName = (contractor?.name as string | null) || null;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        isSafaricom,
        isContractor,
        contractorId: user.contractorId,
      },
      contractorFilter: activeContractorId || null,
      contractorName,
      projectStats,
      documentStats,
      technicianStats,
      milestoneStats,
      complianceStats,
      complianceTrend,
      milestoneCompletedTrend,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to calculate stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
