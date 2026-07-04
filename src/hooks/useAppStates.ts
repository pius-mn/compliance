import { useState, useEffect } from "react";
import { Role, User, Project, Milestone, TechnicianProfile, TechnicianDocument, AuditLog, Notification, Contractor, WorkRole, DocumentType, ComplianceFlag, SitePhoto } from "../types";

export function useAppStates() {
  const [user, setUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRoles, setAllRoles] = useState<WorkRole[]>([]);
  const [newRole, setNewRole] = useState({ name: "", documentTypeIds: [] as string[] });
  const [allDocumentTypes, setAllDocumentTypes] = useState<DocumentType[]>([]);
  const [newDocumentType, setNewDocumentType] = useState({ name: "" });

  const [projects, setProjects] = useState<Project[]>([]);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [documents, setDocuments] = useState<TechnicianDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [complianceFlags, setComplianceFlags] = useState<ComplianceFlag[]>([]);
  const [predefinedMilestones, setPredefinedMilestones] = useState<string[]>([]);
  const [predefinedPrerequisites, setPredefinedPrerequisites] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(savedUser));
    }
    const savedToken = localStorage.getItem("authToken");
    if (savedToken) {
      setAuthToken(savedToken);
    }
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
      setIsDarkMode(true);
    }
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  // Search filter strings
  const [projectSearch, setProjectSearch] = useState("");
  const [techSearch, setTechSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");

  // Pagination states
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Loading States
  const [actionLoading, setActionLoading] = useState(false);
  const [aiAuditing, setAiAuditing] = useState(false);

  // Forms States
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "2026-12-31",
    budget: "",
    contractorId: "",
    rolloutDistance: ""
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Field Technician" as Role,
    isCentral: false,
    phone: "",
    specialization: ""
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
    prerequisiteNotes: ""
  });

  // Document upload form
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [newDoc, setNewDoc] = useState({
    technicianId: "",
    type: "",
    documentTypeId: "",
    fileName: "",
    documentText: "",
    previousVersionId: "",
    expiryDate: ""
  });
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [uploadedFileMimeType, setUploadedFileMimeType] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Selected document for detailed auditing view
  const [viewingDoc, setViewingDoc] = useState<TechnicianDocument | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<"audit" | "history">("audit");
  const [approvalComment, setApprovalComment] = useState("");
  const [verifiedAuditCheckpoints, setVerifiedAuditCheckpoints] = useState<Record<string, boolean>>({
    authenticity: false,
    expiration: false,
    ppe: false,
    nema: false,
    protocols: false
  });
  const [exportingCertDoc, setExportingCertDoc] = useState<TechnicianDocument | null>(null);

  // System general feedback alert
  const [sysAlert, setSysAlert] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  // AI draft report assistance
  const [aiAnalysisResult, setAiAnalysisResult] = useState<Record<string, unknown> | null>(null);

  return {
    user, setUser,
    isDarkMode, setIsDarkMode,
    allUsers, setAllUsers,
    allRoles, setAllRoles,
    newRole, setNewRole,
    allDocumentTypes, setAllDocumentTypes,
    newDocumentType, setNewDocumentType,
    projects, setProjects,
    allMilestones, setAllMilestones,
    milestones, setMilestones,
    technicians, setTechnicians,
    documents, setDocuments,
    auditLogs, setAuditLogs,
    notifications, setNotifications,
    sitePhotos, setSitePhotos,
    contractors, setContractors,
    complianceFlags, setComplianceFlags,
    predefinedMilestones, setPredefinedMilestones,
    predefinedPrerequisites, setPredefinedPrerequisites,
    isSidebarOpen, setIsSidebarOpen,
    isNotificationsDrawerOpen, setIsNotificationsDrawerOpen,
    projectSearch, setProjectSearch,
    techSearch, setTechSearch,
    docSearch, setDocSearch,
    itemsPerPage, setItemsPerPage,
    actionLoading, setActionLoading,
    aiAuditing, setAiAuditing,
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
    sysAlert, setSysAlert,
    aiAnalysisResult, setAiAnalysisResult,
    authToken, setAuthToken
  };
}
