import { useState, useEffect, useMemo } from "react";
import type {
  Role,
  User,
  Project,
  Milestone,
  TechnicianProfile,
  TechnicianDocument,
  AuditLog,
  Notification,
  Contractor,
  WorkRole,
  DocumentType,
  ComplianceFlag,
  SitePhoto,
} from "../types";

export function useAppStates() {
  // ── Core Persistent States ─────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  // ── Reference / Master Data ────────────────────────────────────
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRoles, setAllRoles] = useState<WorkRole[]>([]);
  const [allDocumentTypes, setAllDocumentTypes] = useState<DocumentType[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [predefinedMilestones, setPredefinedMilestones] = useState<string[]>([]);
  const [predefinedPrerequisites, setPredefinedPrerequisites] = useState<string[]>([]);

  // ── Main Application Data ──────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [documents, setDocuments] = useState<TechnicianDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [complianceFlags, setComplianceFlags] = useState<ComplianceFlag[]>([]);

  // ── UI Filters & Pagination ────────────────────────────────────
  const [projectSearch, setProjectSearch] = useState("");
  const [techSearch, setTechSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ── Loading States ─────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [aiAuditing, setAiAuditing] = useState(false);

  // ── Form & Modal States ────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "2026-12-31",
    budget: "",
    contractorId: "",
    rolloutDistance: "",
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Field Technician" as Role,
    isCentral: false,
    phone: "",
    specialization: "",
  });

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [updatingMilestone, setUpdatingMilestone] = useState<Milestone | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<Milestone["status"] | null>(null);
  const [statusComments, setStatusComments] = useState("");
  const [newMilestone, setNewMilestone] = useState({
    title: "",
    description: "",
    dueDate: new Date().toISOString().split("T")[0],
    weight: "20",
    dependencies: [] as string[],
    prerequisites: [] as string[],
    prerequisiteNotes: "",
  });

  // Document Management
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [newDoc, setNewDoc] = useState({
    technicianId: "",
    type: "",
    documentTypeId: "",
    fileName: "",
    documentText: "",
    previousVersionId: "",
    expiryDate: "",
  });

  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [uploadedFileMimeType, setUploadedFileMimeType] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [viewingDoc, setViewingDoc] = useState<TechnicianDocument | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<"audit" | "history">("audit");
  const [approvalComment, setApprovalComment] = useState("");
  const [exportingCertDoc, setExportingCertDoc] = useState<TechnicianDocument | null>(null);

  const [verifiedAuditCheckpoints, setVerifiedAuditCheckpoints] = useState<Record<string, boolean>>({
    authenticity: false,
    expiration: false,
    ppe: false,
    nema: false,
    protocols: false,
  });

  // Transient States
  const [newRole, setNewRole] = useState({ name: "", documentTypeIds: [] as string[] });
  const [newDocumentType, setNewDocumentType] = useState({ name: "" });
  const [sysAlert, setSysAlert] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<Record<string, unknown> | null>(null);

  // ── Hydration & Persistence ─────────────────────────────────────
  useEffect(() => {
    // Load saved data
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));

    const savedToken = localStorage.getItem("authToken");
    if (savedToken) setAuthToken(savedToken);

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
    }

    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Persist dark mode
  useEffect(() => {
    if (isDarkMode) {
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // ── Memoized Return Value (Prevents unnecessary re-renders) ─────
  return useMemo(() => ({
    // Core
    user, setUser,
    authToken, setAuthToken,
    isDarkMode, setIsDarkMode,
    isSidebarOpen, setIsSidebarOpen,
    isNotificationsDrawerOpen, setIsNotificationsDrawerOpen,

    // Reference Data
    allUsers, setAllUsers,
    allRoles, setAllRoles,
    allDocumentTypes, setAllDocumentTypes,
    contractors, setContractors,
    predefinedMilestones, setPredefinedMilestones,
    predefinedPrerequisites, setPredefinedPrerequisites,

    // Main Data
    projects, setProjects,
    milestones, setMilestones,
    allMilestones, setAllMilestones,
    technicians, setTechnicians,
    documents, setDocuments,
    auditLogs, setAuditLogs,
    notifications, setNotifications,
    sitePhotos, setSitePhotos,
    complianceFlags, setComplianceFlags,

    // UI Controls
    projectSearch, setProjectSearch,
    techSearch, setTechSearch,
    docSearch, setDocSearch,
    itemsPerPage, setItemsPerPage,

    // Loading
    actionLoading, setActionLoading,
    aiAuditing, setAiAuditing,

    // Forms & UI
    selectedProjectId, setSelectedProjectId,
    showAddProject, setShowAddProject,
    newProject, setNewProject,
    newUser, setNewUser,
    showAddMilestone, setShowAddMilestone,
    updatingMilestone, setUpdatingMilestone,
    updatingStatus, setUpdatingStatus,
    statusComments, setStatusComments,
    newMilestone, setNewMilestone,

    showUploadDoc, setShowUploadDoc,
    newDoc, setNewDoc,
    uploadedFileBase64, setUploadedFileBase64,
    uploadedFileMimeType, setUploadedFileMimeType,
    dragActive, setDragActive,

    viewingDoc, setViewingDoc,
    activeDocTab, setActiveDocTab,
    approvalComment, setApprovalComment,
    verifiedAuditCheckpoints, setVerifiedAuditCheckpoints,
    exportingCertDoc, setExportingCertDoc,

    // Transient
    newRole, setNewRole,
    newDocumentType, setNewDocumentType,
    sysAlert, setSysAlert,
    aiAnalysisResult, setAiAnalysisResult,
  }), [
    user, authToken, isDarkMode, isSidebarOpen, isNotificationsDrawerOpen,
    allUsers, allRoles, allDocumentTypes, contractors,
    predefinedMilestones, predefinedPrerequisites,
    projects, milestones, allMilestones, technicians, documents,
    auditLogs, notifications, sitePhotos, complianceFlags,
    projectSearch, techSearch, docSearch, itemsPerPage,
    actionLoading, aiAuditing,
    selectedProjectId, showAddProject, newProject, newUser,
    showAddMilestone, updatingMilestone, updatingStatus, statusComments, newMilestone,
    showUploadDoc, newDoc, uploadedFileBase64, uploadedFileMimeType, dragActive,
    viewingDoc, activeDocTab, approvalComment, verifiedAuditCheckpoints, exportingCertDoc,
    newRole, newDocumentType, sysAlert, aiAnalysisResult,
  ]);
}