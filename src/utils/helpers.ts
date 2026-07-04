import { Role, Contractor, TechnicianProfile, TechnicianDocument, WorkRole } from "../types";

/**
 * Generate the next sequential integer ID for a collection.
 * Finds the max existing ID and returns max + 1.
 * Returns 1 if the collection is empty.
 */
export function nextId(items: { id: number }[]): number {
  return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
}

/** Get the next ID from a local DB snapshot for a specific table */
export function getNextId(data: Record<string, unknown>, table: string): number {
  const items = (data[table] as unknown[]) || [];
  return items.length > 0 ? Math.max(...items.map((i: unknown) => (i as Record<string, unknown>).id as number)) + 1 : 1;
}

// Helper for safe JSON parsing
export async function safeJson(res: Response) {
  try {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch (e) {
    console.error("JSON parse error:", e);
  }
  return null;
}

// Friendly role label helper
export const getFriendlyRoleLabel = (role: Role | undefined) => {
  if (!role) return "";
  switch (role) {
    case Role.SafaricomAdmin: return "Safaricom Central Admin";
    case Role.SafaricomProjectCreator: return "Safaricom Project Creator";
    case Role.SafaricomProjectAssigner: return "Safaricom Project Assigner";
    case Role.SafaricomEHSOfficer: return "Safaricom Central EHS Officer";
    case Role.ContractorManager: return "Contractor Manager";
    case Role.ContractorEHSOfficer: return "Contractor Safety Lead";
    case Role.Technician: return "Field Technician";
    default: return role;
  }
};

// Friendly contractor partner label helper
export const getActiveContractorLabel = (
  contractorId: number | string | null,
  contractors: Contractor[],
  isUserLabel: boolean = false,
  cleanMode: boolean = false
) => {
  if (contractorId === null || contractorId === undefined || contractorId === "unassigned") {
    return isUserLabel ? "Safaricom Central Safety Command" : "Unassigned / Pending Contractor Allocation";
  }
  const b = (contractors || []).find(br => br && br.id === Number(contractorId));
  if (!b) return "Contractor Scope";
  const safeStr = (v: unknown) => {
    try { return String(v); } catch { return ""; }
  };
  if (cleanMode) {
    return safeStr(b.name || "");
  }
  return `${safeStr(b.name || "")} (${safeStr(b.code || "")})`;
};

export const safeNumber = (v: unknown, fallback: number = 0): number => {
  if (typeof v === 'number') return isNaN(v) ? fallback : v;
  try {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
};

export const safeString = (v: unknown, fallback: string = ""): string => {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  try {
    return String(v);
  } catch {
    return fallback;
  }
};

// Helper for safety & role compliance score calculations
export const getComputedEhsScore = (
  t: TechnicianProfile,
  documents: TechnicianDocument[],
  allRoles: WorkRole[]
) => {
  if (!t) return 0;
  const essentials = [
    { name: "PPE Audit", docTypeId: null },
    { name: "Risk Assessment (RAMS)", docTypeId: null },
    { name: "Job Safety Analysis", docTypeId: null }
  ];
  
  let roleIds = t.workRoleIds;
  if (!Array.isArray(roleIds)) roleIds = [];

  const roleDocIds = Array.from(new Set(
    roleIds.flatMap(roleId => {
      const role = (allRoles || []).find(r => r && r.id === roleId);
      return role?.documentTypeIds || [];
    })
  ));

  const mergedRequirements = [
    ...essentials,
    ...roleDocIds.map(id => ({ name: null, docTypeId: id }))
  ];

  let fulfilledCount = 0;
  mergedRequirements.forEach(req => {
    const hasDoc = (documents || []).find(d => 
      d && d.technicianId === t.id && 
      (req.docTypeId ? d.documentTypeId === req.docTypeId : d.type === req.name) && 
      (d.status === "Approved" || d.status === "Pending Contractor Approval" || d.status === "Pending Central Approval")
    );
    if (hasDoc) fulfilledCount++;
  });

  const reqRatio = mergedRequirements.length > 0 ? (fulfilledCount / mergedRequirements.length) : 0;
  let rawScore: unknown = t.overallEhsScore;
  if (typeof rawScore !== 'number') {
    rawScore = safeNumber(rawScore);
  }
  return Math.round((rawScore as number) * reqRatio);
};
