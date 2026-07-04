import { apiFetch } from "./apiFetch";

// ─── State setter interface ──────────────────────────────────────────────────
// Every fetch-data function receives a states object typed with setter
// callbacks.  This mirrors the shape of the app-level state returned by
// useAppStates / usePageData.
export interface DataSyncStates {
  setContractors: (data: unknown) => void;
  setAllRoles: (data: unknown) => void;
  setAllDocumentTypes: (data: unknown) => void;
  setAllUsers: (data: unknown) => void;
  setPredefinedMilestones: (data: unknown) => void;
  setPredefinedPrerequisites: (data: unknown) => void;
  setProjects: (data: unknown) => void;
  setTechnicians: (data: unknown) => void;
  setDocuments: (data: unknown) => void;
  setNotifications: (data: unknown) => void;
  setComplianceFlags: (data: unknown) => void;
  setAuditLogs: (data: unknown) => void;
  setSitePhotos: (data: unknown) => void;
  setAllMilestones: (data: unknown) => void;
}

// ─── Individual collection fetchers ───────────────────────────────────────────
// Each fetches a single data type and sets it via the corresponding setter.
// Use these for per-page lazy loading.

async function fetchAndSet(url: string, setter: (data: unknown) => void): Promise<void> {
  try {
    const res = await apiFetch(url);
    if (res.ok) {
      setter(await res.json());
    }
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
  }
}

export function fetchReferenceData(states: DataSyncStates, API_BASE: string) {
  return Promise.all([
    fetchAndSet(`${API_BASE}/contractors`, states.setContractors),
    fetchAndSet(`${API_BASE}/work-roles`, states.setAllRoles),
    fetchAndSet(`${API_BASE}/document-types`, states.setAllDocumentTypes),
    fetchAndSet(`${API_BASE}/users`, states.setAllUsers),
    fetchAndSet(`${API_BASE}/metadata/milestones`, states.setPredefinedMilestones),
    fetchAndSet(`${API_BASE}/metadata/prerequisites`, states.setPredefinedPrerequisites),
  ]);
}

export function fetchProjectsData(states: DataSyncStates, API_BASE: string, params?: Record<string, string>) {
  const url = params
    ? `${API_BASE}/projects?${new URLSearchParams(params).toString()}`
    : `${API_BASE}/projects`;
  return fetchAndSet(url, states.setProjects);
}

export function fetchTechniciansData(states: DataSyncStates, API_BASE: string, params?: Record<string, string>) {
  const url = params
    ? `${API_BASE}/technicians?${new URLSearchParams(params).toString()}`
    : `${API_BASE}/technicians`;
  return fetchAndSet(url, states.setTechnicians);
}

export function fetchEHSDocumentsData(states: DataSyncStates, API_BASE: string, params?: Record<string, string>) {
  const url = params
    ? `${API_BASE}/ehs/documents?${new URLSearchParams(params).toString()}`
    : `${API_BASE}/ehs/documents`;
  return fetchAndSet(url, states.setDocuments);
}

export function fetchNotificationsData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/notifications`, states.setNotifications);
}

export function fetchComplianceFlagsData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/compliance/flags`, states.setComplianceFlags);
}

export function fetchAuditLogsData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/audit-logs`, states.setAuditLogs);
}

export function fetchSitePhotosData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/site-photos`, states.setSitePhotos);
}

export function fetchMilestonesData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/milestones`, states.setAllMilestones);
}

/** Response shape from GET /api/v1/dashboard/stats */
export interface DashboardStatsResponse {
  user: { id: string; name: string; role: string; isSafaricom: boolean; isContractor: boolean; contractorId: string | null };
  contractorFilter: string | null;
  contractorName: string | null;
  projectStats: { total: number; completed: number; inProgress: number; planning: number; onHold: number; totalBudget: number };
  documentStats: { total: number; approved: number; pendingBranch: number; pendingCentral: number; rejected: number };
  technicianStats: { total: number; active: number; warningNeeded: number; avgScore: number };
  milestoneStats: { total: number; completed: number; inProgress: number; pending: number; blocked: number; completionRate: number };
  complianceStats: { total: number; active: number; resolved: number; highSeverity: number; mediumSeverity: number; lowSeverity: number };
  complianceTrend: Array<{ month: string; created: number; resolved: number }>;
  milestoneCompletedTrend: Array<{ month: string; created: number; resolved: number }>;
}

export async function fetchDashboardStatsData(API_BASE: string, userId?: string, contractorId?: string): Promise<DashboardStatsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (contractorId) params.set("contractorId", contractorId);
    const qs = params.toString();
    const url = qs ? `${API_BASE}/dashboard/stats?${qs}` : `${API_BASE}/dashboard/stats`;
    const res = await apiFetch(url);
    if (res.ok) {
      return await res.json();
    }
    console.error("Failed to fetch dashboard stats");
    return null;
  } catch (err) {
    console.error("Failed to fetch dashboard stats:", err);
    return null;
  }
}

// ─── Individual reference-data fetchers ───────────────────────────────────────

export function fetchUsersData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/users`, states.setAllUsers);
}

export function fetchContractorsData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/contractors`, states.setContractors);
}

export function fetchWorkRolesData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/work-roles`, states.setAllRoles);
}

export function fetchDocumentTypesData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/document-types`, states.setAllDocumentTypes);
}

export function fetchPredefinedMilestonesData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/metadata/milestones`, states.setPredefinedMilestones);
}

export function fetchPredefinedPrerequisitesData(states: DataSyncStates, API_BASE: string) {
  return fetchAndSet(`${API_BASE}/metadata/prerequisites`, states.setPredefinedPrerequisites);
}

/**
 * Collection key type for targeted refetches.
 */
export type CollectionKey =
  | "projects"
  | "technicians"
  | "documents"
  | "notifications"
  | "milestones"
  | "complianceFlags"
  | "auditLogs"
  | "sitePhotos"
  | "contractors"
  | "users"
  | "workRoles"
  | "documentTypes"
  | "predefinedMilestones"
  | "predefinedPrerequisites";

/**
 * Collection fetcher registry — maps a collection key to its fetch function.
 * Used by refetchCollections to perform targeted re-fetches after mutations.
 */
const collectionFetchers: Record<CollectionKey, (states: DataSyncStates, API_BASE: string) => Promise<void>> = {
  projects: fetchProjectsData,
  technicians: fetchTechniciansData,
  documents: fetchEHSDocumentsData,
  notifications: fetchNotificationsData,
  milestones: fetchMilestonesData,
  complianceFlags: fetchComplianceFlagsData,
  auditLogs: fetchAuditLogsData,
  sitePhotos: fetchSitePhotosData,
  contractors: fetchContractorsData,
  users: fetchUsersData,
  workRoles: fetchWorkRolesData,
  documentTypes: fetchDocumentTypesData,
  predefinedMilestones: fetchPredefinedMilestonesData,
  predefinedPrerequisites: fetchPredefinedPrerequisitesData,
};

/**
 * Targeted re-fetch: fetches only the specified collections.
 * Use this after mutations to avoid re-fetching all 14+ collections.
 *
 * @example
 *   // After creating a technician, only re-fetch users + technicians
 *   await refetchCollections(states, API_BASE, ["users", "technicians"]);
 */
export async function refetchCollections(
  states: DataSyncStates,
  API_BASE: string,
  collections: CollectionKey[]
): Promise<void> {
  const fetchers = collections
    .filter((key) => key in collectionFetchers)
    .map((key) => collectionFetchers[key](states, API_BASE));

  if (fetchers.length > 0) {
    await Promise.all(fetchers);
  }
}


