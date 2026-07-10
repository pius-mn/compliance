import React, { useState, useMemo, useCallback } from "react";
import { TechnicianProfile, TechnicianDocument, WorkRole, DocumentType, User } from "../types";
import { getDocStatus, getAuthFileUrl } from "../utils/helpers";
import {
  X,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  TrendingUp,
  ShieldCheck,
  Award,
  AlertTriangle,
  Activity,
  Phone,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Eye,
  LucideIcon,
} from "lucide-react";

interface TechnicianDetailsProps {
  user: User | null;
  technician: TechnicianProfile;
  documents: TechnicianDocument[];
  onClose: () => void;
  onUpload: (technicianId: number | string, docTypeName?: string) => void;
  allRoles: WorkRole[];
  allDocumentTypes: DocumentType[];
  onUpdateRoles: (technicianId: number | string, workRoleIds: (number | string)[]) => Promise<void>;
}

// --- Pure style/status helpers, hoisted out of the component so they aren't
// recreated on every render (they don't depend on props or state).
//
// Contrast notes: every pairing below targets WCAG AA (>=4.5:1) for text in
// BOTH themes. Light-mode text sits on the 700/800 step of its hue (not
// 500/600, which reads under ~4:1 on a white/slate-50 chip), and dark-mode
// text sits on the 400 step over a low-opacity (10-20%) tint of the same
// hue on a near-black card, which keeps the same ~4.5-7:1 range. ---

function getScoreColor(score: number) {
  if (score >= 90) return "text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20";
  if (score >= 75) return "text-amber-700 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
  return "text-rose-700 bg-rose-50 border-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20";
}

function getScoreBadgeColor(score: number) {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-amber-500";
  return "bg-rose-500";
}

interface ApprovalStatusBadge {
  bg: string;
  icon: LucideIcon;
  label: string;
}

function getApprovalStatusBadge(status: string): ApprovalStatusBadge {
  switch (status) {
    case "Approved":
      return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", icon: CheckCircle2, label: "Approved" };
    case "Pending Central Approval":
      return { bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", icon: Upload, label: "Pending Central" };
    case "Pending Contractor Approval":
      return { bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", icon: Upload, label: "Pending Contractor" };
    case "Rejected":
      return { bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20", icon: ShieldAlert, label: "Rejected" };
    default:
      return { bg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", icon: FileText, label: status };
  }
}

function isDocExpired(doc: Pick<TechnicianDocument, "expiryDate">, currentTime: number) {
  return !!doc.expiryDate && currentTime > 0 && new Date(doc.expiryDate).getTime() < currentTime;
}

// --- Expiry + approval-status badge pair, previously duplicated verbatim in
// both the "required documents" and "general documents" sections. ---

function DocStatusBadges({ doc, currentTime }: { doc: TechnicianDocument; currentTime: number }) {
  const expired = isDocExpired(doc, currentTime);
  const approval = getApprovalStatusBadge(getDocStatus(doc));
  const ApprovalIcon = approval.icon;

  return (
    <>
      <div
        className={`text-[9px] font-black px-2 py-0.5 rounded border ${
          expired
            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
            : "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
        }`}
      >
        {doc.expiryDate ? (expired ? `Expired: ${new Date(doc.expiryDate).toLocaleDateString()}` : `Expires: ${new Date(doc.expiryDate).toLocaleDateString()}`) : 'No Expiry'}
      </div>
      <div className={`text-[9px] font-black px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${approval.bg}`}>
        <ApprovalIcon size={10} />
        {approval.label}
      </div>
    </>
  );
}

// --- Collapsible "EHS Verification Report" preview, previously duplicated
// verbatim (file-src resolution + image/PDF branching) in both document
// sections below. ---

function DocumentDetailsToggle({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-black text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer"
    >
      {isExpanded ? (
        <>Hide Details <ChevronUp size={12} /></>
      ) : (
        <>View Details <ChevronDown size={12} /></>
      )}
    </button>
  );
}

function DocumentPreview({ doc }: { doc: TechnicianDocument }) {
  const docFileSrc = doc.file_path
    ? getAuthFileUrl(`/api/v1/ehs/documents/${doc.id}/file`)
    : (doc.fileData || null);
  if (!docFileSrc) return null;

  const isImage = doc.fileMimeType?.startsWith("image/") || doc.fileName?.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-150 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
        <Eye size={12} className="text-slate-500 dark:text-slate-400" />
        <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Document Preview</span>
      </div>
      {isImage ? (
        <div className="flex items-center justify-center p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={docFileSrc}
            alt={doc.fileName}
            className="max-h-48 w-auto object-contain rounded-lg shadow-xs"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 p-4">
          <a
            href={docFileSrc}
            download={doc.fileName}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100 dark:border-indigo-500/20 cursor-pointer"
          >
            <Eye size={12} />
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}

export const TechnicianDetails: React.FC<TechnicianDetailsProps> = ({
  technician,
  documents,
  onClose,
  onUpload,
  allRoles,
  allDocumentTypes,
  onUpdateRoles,
}) => {
  // Client-side current time to avoid SSR hydration mismatches from new Date()
  const [currentTime] = useState(() => Date.now());

  const [selectedRoleIds, setSelectedRoleIds] = useState<(number | string)[]>(technician.workRoleIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<number | string | null>(null);

  const toggleExpanded = useCallback((id: number | string) => {
    setExpandedDocId(prev => (prev === id ? null : id));
  }, []);

  const techDocs = useMemo(
    () => (documents || []).filter(doc => doc.technicianId === technician.id),
    [documents, technician.id]
  );

  const handleSaveRoles = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateRoles(technician.id, selectedRoleIds);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const requiredDocumentTypes = useMemo(() => {
    const requiredDocumentTypeIds = new Set(
      (allRoles || []).filter(role => selectedRoleIds.includes(role.id))
        .flatMap(role => role.documentTypeIds)
    );
    return (allDocumentTypes || []).filter(doc => requiredDocumentTypeIds.has(doc.id));
  }, [allRoles, allDocumentTypes, selectedRoleIds]);

  // O(1) name lookups instead of an Array#find per doc, per render.
  const docTypeById = useMemo(
    () => new Map(allDocumentTypes.map(t => [t.id, t.name])),
    [allDocumentTypes]
  );

  const getDocTypeName = useCallback(
    (docTypeId: number | null | undefined): string => (docTypeId == null ? "" : docTypeById.get(docTypeId) || ""),
    [docTypeById]
  );

  // Docs that don't correspond to any currently-required document type —
  // computed once and reused, rather than re-filtered for the empty-state
  // check and again for the render map (same predicate, run twice before).
  const generalDocs = useMemo(
    () => techDocs.filter(d => !requiredDocumentTypes.some(rt => rt.name === d.type || rt.id === d.documentTypeId)),
    [techDocs, requiredDocumentTypes]
  );

  // Score is computed server-side and passed via the API
  const percentComplete = technician.overallEhsScore;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden" id="technician_details_modal_container">
      {/* Header - Fixed */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#18863A] to-[#25d366] flex items-center justify-center text-white font-extrabold text-xl shadow-md uppercase">
              {technician.name.substring(0, 2)}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center ${getScoreBadgeColor(technician.overallEhsScore)}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-emerald-700 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-100/50 dark:border-emerald-500/20">
                EHS Profile & Audits
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                technician.status === "Active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : technician.status === "EHS Check Needed"
                    ? "bg-amber-150 text-amber-900 dark:bg-amber-500/10 dark:text-amber-400"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400"
              }`}>
                {technician.status}
              </span>
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">{technician.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Briefcase size={12} className="text-slate-400 dark:text-slate-500" />
                {technician.specialization}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="flex items-center gap-1">
                <Phone size={12} className="text-slate-400 dark:text-slate-500" />
                {technician.phone}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full transition-all border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {/* Compliance Stats Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50/50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl border border-emerald-100/40 dark:border-emerald-500/20">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Overall EHS Score</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{technician.overallEhsScore}%</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getScoreColor(technician.overallEhsScore)}`}>
                  {technician.overallEhsScore >= 90 ? "Excellent" : technician.overallEhsScore >= 75 ? "Satisfactory" : "At Risk"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl border border-indigo-100/40 dark:border-indigo-500/20">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Last Audit Conducted</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {technician.lastEhsAuditDate
                    ? new Date(technician.lastEhsAuditDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : "No audits yet"
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Roles config */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <Award size={14} className="text-emerald-700 dark:text-emerald-400" />
                Assigned Job Roles
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Active roles automatically map required safety certifications & site clearance docs</p>
            </div>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 size={12} /> Saved Successfully
                </span>
              )}
              <button
                onClick={handleSaveRoles}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#18863A] text-white rounded-xl text-xs font-black hover:bg-[#156e2f] active:scale-95 transition-all disabled:opacity-50 shadow-sm shadow-[#18863A]/10 cursor-pointer"
              >
                <Save size={13} /> {isSaving ? "Saving..." : "Save Roles"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allRoles.map(role => {
              const isChecked = selectedRoleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? "border-[#18863A] bg-emerald-50/40 dark:bg-emerald-500/10 dark:border-emerald-500/50 shadow-xs"
                      : "border-slate-150 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRoleIds(prev => [...prev, role.id]);
                      else setSelectedRoleIds(prev => prev.filter(id => id !== role.id));
                    }}
                    className="accent-[#18863A] w-4.5 h-4.5 mt-0.5 rounded border-slate-300 dark:border-slate-600 focus:ring-[#18863A] cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{role.name}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium mt-1">Requires {role.documentTypeIds?.length || 0} EHS clearance document{role.documentTypeIds?.length !== 1 ? 's' : ''}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Documents Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-700 dark:text-emerald-400" />
              Required Safety Documents & Clearance
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Must be kept current and verified through Safaricom EHS sign-off</p>
          </div>

          {/* Compliance Progress Bar Tracker */}
          {requiredDocumentTypes.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-700 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Safety Compliance Standing</span>
                </div>
                <span className={`text-xs font-black ${percentComplete === 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {percentComplete}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#18863A] to-[#25d366] transition-all duration-500 rounded-full"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredDocumentTypes.length === 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400 col-span-full py-8 text-center bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2">
                <AlertTriangle size={24} className="text-slate-300 dark:text-slate-600" />
                <span>Select technician roles above to load required safety documents.</span>
              </div>
            )}
            {requiredDocumentTypes.map(docType => {
              const existingDoc = techDocs.find(d => d.type === docType.name || d.documentTypeId === docType.id);
              const isExpired = existingDoc ? isDocExpired(existingDoc, currentTime) : false;
              const isValid = !!existingDoc && !isExpired;

              return (
                <div
                  key={docType.id}
                  className={`border rounded-2xl p-4 flex flex-col justify-between hover:shadow-xs transition-all duration-200 ${
                    isValid
                      ? "bg-emerald-50/10 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/40"
                      : isExpired
                        ? "bg-rose-50/10 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/40"
                        : "bg-amber-50/5 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="flex gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                        isValid
                          ? "bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : isExpired
                            ? "bg-rose-100/50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
                            : "bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 leading-snug">{docType.name}</h4>
                        {existingDoc ? (
                          <div className="space-y-0.5 mt-1">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">File: <span className="font-bold text-slate-700 dark:text-slate-300">{existingDoc.fileName}</span></p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400">Uploaded: {new Date(existingDoc.uploadDate).toLocaleDateString()}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">Not uploaded yet</p>
                        )}
                      </div>
                    </div>
                    {isValid ? (
                      <CheckCircle2 size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={18} className={`${isExpired ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"} shrink-0 mt-0.5 animate-pulse`} />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100/80 dark:border-slate-800 mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {existingDoc ? (
                        <DocStatusBadges doc={existingDoc} currentTime={currentTime} />
                      ) : (
                        <div className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-100/40 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-150 dark:border-amber-500/20">
                          Required
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onUpload(technician.id, docType.name)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer ${
                        existingDoc
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700"
                          : "bg-[#18863A] text-white hover:bg-[#156e2f] shadow-[#18863A]/10"
                      }`}
                    >
                      <Upload size={12} /> {existingDoc ? "Update" : "Upload File"}
                    </button>
                  </div>

                  {existingDoc && (
                    <div className="mt-3 pt-3 border-t border-slate-100/80 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">EHS Verification Report</span>
                      <DocumentDetailsToggle
                        isExpanded={expandedDocId === existingDoc.id}
                        onToggle={() => toggleExpanded(existingDoc.id)}
                      />
                    </div>
                  )}

                  {existingDoc && expandedDocId === existingDoc.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                      <DocumentPreview doc={existingDoc} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* General/Other Documents */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center gap-2 pb-2">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <FileText size={14} className="text-slate-600 dark:text-slate-400" />
                Other EHS Documents & Permits
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Additional certifications, incident forms, or local work permits</p>
            </div>
            <button
              onClick={() => onUpload(technician.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold active:scale-95 transition-all cursor-pointer"
            >
              <Upload size={12} /> Upload General
            </button>
          </div>

          {generalDocs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50/40 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-150 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5">
              <span>No additional safety documents or permits uploaded.</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {generalDocs.map(doc => (
                <li key={doc.id} className="flex flex-col bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 hover:shadow-xs transition-all space-y-3">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl shrink-0 flex items-center justify-center border border-slate-200/50 dark:border-slate-700">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{getDocTypeName(doc.documentTypeId) || doc.type}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">Uploaded: {new Date(doc.uploadDate).toLocaleDateString()} • File: <span className="font-semibold text-slate-600 dark:text-slate-300">{doc.fileName}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DocStatusBadges doc={doc} currentTime={currentTime} />
                      <button
                        onClick={() => onUpload(technician.id, getDocTypeName(doc.documentTypeId) || doc.type)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-all border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
                        title="Update Document"
                      >
                        <Upload size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100/80 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">EHS Verification Report</span>
                    <DocumentDetailsToggle
                      isExpanded={expandedDocId === doc.id}
                      onToggle={() => toggleExpanded(doc.id)}
                    />
                  </div>

                  {expandedDocId === doc.id && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                      <DocumentPreview doc={doc} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
