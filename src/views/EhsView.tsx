import React, { useState } from "react";
import { Search, Shield, ChevronLeft, Check, X, AlertTriangle, History, Eye, FileText as FileTextIcon, ZoomIn } from "lucide-react";
import { Role, User, Contractor, DocumentType, TechnicianDocument, TechnicianProfile } from "../types";
import { PaginationControls } from "../components/PaginationControls";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { getDocStatus, getAuthFileUrl } from "../utils/helpers";

export interface EhsViewProps {
  user: User | null;
  docSearch: string;
  setDocSearch: (val: string) => void;
  docsTotal: number;
  setDocPage: (val: number) => void;
  docPage: number;
  showUploadDoc: boolean;
  setShowUploadDoc: (val: boolean) => void;
  dragActive: boolean;
  newDoc: Record<string, unknown>;
  setNewDoc: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  aiAnalysisResult: Record<string, unknown> | null;
  aiAuditing: boolean;
  handleSubmitDocument: (e: React.FormEvent) => void;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  technicians: TechnicianProfile[];
  paginatedDocuments: TechnicianDocument[];
  filteredDocuments: TechnicianDocument[];
  getActiveContractorLabel: (contractorId: string | null, contractors: Contractor[], isUserLabel?: boolean, cleanMode?: boolean) => string;
  viewingDoc: TechnicianDocument | null;
  setViewingDoc: (doc: TechnicianDocument | null) => void;
  setApprovalComment: (val: string) => void;
  approvalComment: string;
  documents: TechnicianDocument[];
  activeDocTab: "audit" | "history";
  setActiveDocTab: (tab: "audit" | "history") => void;
  verifiedAuditCheckpoints: Record<string, unknown>;
  setVerifiedAuditCheckpoints: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  allUsers: User[];
  itemsPerPage: number;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  API_BASE: string;
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", msg: string) => void;
  handleApproveDocument: (docId: string) => void;
  handleRejectDocument: (docId: string) => void;
  setExportingCertDoc: (doc: TechnicianDocument | null) => void;
  exportingCertDoc: TechnicianDocument | null;
  filteredContractors: Contractor[];
  actionLoading: boolean;
  allDocumentTypes: DocumentType[];
}

// --- Shared status helpers ---
// Document status is now computed from rejected/approverId fields.

type DocStatus = "Approved" | "Rejected" | "Pending Central Approval" | "Pending Contractor Approval";

const STATUS_CLASSES: Record<"Approved" | "Rejected" | "default", string> = {
  Approved: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  Rejected: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  default: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
};

function getStatusClasses(status: DocStatus) {
  if (status === "Approved") return STATUS_CLASSES.Approved;
  if (status === "Rejected") return STATUS_CLASSES.Rejected;
  return STATUS_CLASSES.default;
}

function StatusIcon({ status, className }: { status: DocStatus; className: string }) {
  if (status === "Approved") return <Check className={className} />;
  if (status === "Rejected") return <X className={className} />;
  if (String(status).includes("Pending")) return <AlertTriangle className={className} />;
  return null;
}

function StatusBadge({ status, size = "md" }: { status: DocStatus; size?: "sm" | "md" }) {
  const padding = size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span
      className={`${padding} rounded-xl font-bold uppercase tracking-widest inline-flex items-center gap-1.5 ${getStatusClasses(
        status
      )}`}
    >
      <StatusIcon status={status} className={iconSize} />
      {status}
    </span>
  );
}

function MetaField({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</label>
      <p className={valueClassName || "text-sm font-semibold text-slate-900 dark:text-slate-100"}>{value}</p>
    </div>
  );
}

function getDocTypeName(docTypeId: number | null | undefined, allTypes: DocumentType[]): string {
  if (docTypeId == null) return "";
  const found = allTypes.find((t) => t.id === docTypeId);
  return found?.name || "";
}

const EhsView = React.memo(function EhsView(props: EhsViewProps) {
  const {
    user,
    docSearch, setDocSearch,
    filteredDocuments,
    docPage, setDocPage,
    itemsPerPage,
    allDocumentTypes,
  } = props;

  const [selectedDocId, setSelectedDocId] = useState<number | string | null>(null);
  const [lightboxDocImage, setLightboxDocImage] = useState<string | null>(null);
  const selectedDoc = (filteredDocuments || []).find(d => d.id === selectedDocId) || null;

  const isApprover = user && [Role.SafaricomAdmin, Role.SafaricomEHSOfficer, Role.ContractorEHSOfficer, Role.ContractorManager].some(r => r === user.role);

  if (selectedDoc) {
    return (
      <>
      {lightboxDocImage && selectedDoc && (
        <PhotoLightbox src={lightboxDocImage} onClose={() => setLightboxDocImage(null)}>
          <p className="text-sm font-medium text-white/60">{selectedDoc.fileName}</p>
          <p className="text-xs text-white/40">{selectedDoc.type} • {selectedDoc.technicianName}</p>
        </PhotoLightbox>
      )}
      <div className="fixed inset-0 z-[180] flex flex-col bg-[#F8FAFC] dark:bg-slate-950 overflow-y-auto panel-mobile-bottom">
        <div className="flex-1 min-h-0 bg-[#F8FAFC] dark:bg-slate-950 flex flex-col p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto space-y-6 sm:space-y-8 animate-in fade-in lg:animate-in lg:slide-in-from-bottom-4 lg:duration-500">

            <button
              onClick={() => setSelectedDocId(null)}
              className="group flex items-center gap-2 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <div className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 group-hover:shadow-md transition-all">
                <ChevronLeft className="w-4 h-4" />
              </div>
              Back to Documents
            </button>

            <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 lg:p-10 rounded-[24px] sm:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-6 sm:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight break-words">
                      {selectedDoc.fileName}
                    </h2>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 pl-12 sm:pl-12">
                    {getDocTypeName(selectedDoc.documentTypeId, allDocumentTypes) || "Document Audit"}
                  </p>
                </div>
                <div className="pl-12 sm:pl-0">
                  <StatusBadge status={getDocStatus(selectedDoc)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 p-5 sm:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800">
                <MetaField label="Technician" value={selectedDoc.technicianName} />
                <MetaField label="Upload Date" value={new Date(selectedDoc.uploadDate).toLocaleString()} />
                {/* Compliance Score field was removed from documents table */}
              </div>

              {/* Document Preview — prefer filesystem path over base64 */}
              {(() => {
                const docFileSrc = selectedDoc.file_path
                  ? getAuthFileUrl(`/api/v1/ehs/documents/${selectedDoc.id}/file`)
                  : (selectedDoc.fileData || null);
                if (!docFileSrc) return null;

                const isImage = selectedDoc.fileMimeType?.startsWith("image/") ||
                  selectedDoc.fileName?.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);

                return (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <Eye className="w-4 h-4" />
                      Document Preview
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      {isImage ? (
                        <div
                          className="flex items-center justify-center p-4 relative group cursor-pointer"
                          onClick={() => setLightboxDocImage(docFileSrc)}
                        >
                          {/* Zoom overlay on hover */}
                          <div className="absolute inset-4 rounded-xl bg-slate-900/0 group-hover:bg-slate-900/40 transition-all duration-200 flex items-center justify-center z-10">
                            <div className="p-2.5 bg-white/90 text-slate-800 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-75 group-hover:scale-100">
                              <ZoomIn size={20} />
                            </div>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={docFileSrc}
                            alt={selectedDoc.fileName}
                            className="max-h-[400px] w-auto object-contain rounded-xl shadow-xs relative"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center border border-rose-100 dark:border-rose-500/20">
                            <FileTextIcon size={28} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">PDF Document</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{selectedDoc.fileName}</p>
                          </div>
                          <a
                            href={docFileSrc}
                            download={selectedDoc.fileName}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100 dark:border-indigo-500/20 cursor-pointer"
                          >
                            <Eye size={14} />
                            Download & View PDF
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}



              {isApprover && getDocStatus(selectedDoc).startsWith("Pending") && (
                <div className="space-y-6 pt-6 sm:pt-8 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                      Reason for Approval / Rejection
                    </label>
                    <textarea
                      value={props.approvalComment}
                      onChange={(e) => props.setApprovalComment(e.target.value)}
                      className="w-full p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 outline-none transition-all text-sm resize-none h-32 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                      placeholder="Provide detailed feedback for the technician..."
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      onClick={() => {
                        props.handleRejectDocument(String(selectedDoc.id));
                        setSelectedDocId(null);
                      }}
                      className="flex-1 py-4 bg-white dark:bg-slate-900 border-2 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all"
                    >
                      Reject Document
                    </button>
                    <button
                      onClick={() => {
                        props.handleApproveDocument(String(selectedDoc.id));
                        setSelectedDocId(null);
                      }}
                      className="flex-1 py-4 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 dark:shadow-none hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-all hover:-translate-y-0.5"
                    >
                      Sign Off & Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-[#F8FAFC] dark:bg-slate-950 flex flex-col p-4 sm:p-8 lg:p-12 pb-24 lg:pb-12 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1 sm:space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Compliance Ledger
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Manage and review all EHS documentation and site evidence.
            </p>
          </div>
          <div className="relative group w-full sm:w-72">
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search documents..."
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-white dark:bg-slate-900 border-2 border-transparent shadow-sm rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
          {/* Card list: works uniformly across breakpoints instead of a table
              that needs a separate cramped mobile mode. */}
          <ul className="divide-y divide-slate-50 dark:divide-slate-800">
            {(props.paginatedDocuments || []).map(doc => (
              <li
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
              >
                <div className="flex items-center gap-3 min-w-0 sm:flex-[2]">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase sm:hidden">
                    {(doc.technicianName || "").slice(0, 2)}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                      {(() => {
                        const typeName = getDocTypeName(doc.documentTypeId, allDocumentTypes);
                        if (!typeName) return null;
                        return (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-indigo-500 dark:text-indigo-400">{typeName}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-3 sm:flex-[1.5]">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                    {(doc.technicianName || "").slice(0, 2)}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{doc.technicianName}</span>
                </div>

                <div className="flex items-center justify-between sm:justify-start sm:flex-1">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:hidden">{doc.technicianName}</span>
                  <StatusBadge status={getDocStatus(doc)} size="sm" />
                </div>
              </li>
            ))}

            {props.paginatedDocuments.length === 0 && (
              <li className="px-8 py-16">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                    <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No documents found.</p>
                </div>
              </li>
            )}
          </ul>

          <PaginationControls
            currentPage={docPage}
            setCurrentPage={setDocPage}
            totalItems={props.docsTotal}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>
    </div>
  );
});

export default EhsView;
