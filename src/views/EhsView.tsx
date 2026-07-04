import React, { useState } from "react";
import { Search, Shield, ChevronLeft, Check, X, AlertTriangle, History } from "lucide-react";
import { Role, User, Contractor, TechnicianDocument, TechnicianProfile } from "../types";
import { PaginationControls } from "../components/PaginationControls";

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
  filteredBranches: Contractor[];
  actionLoading: boolean;
}

export default function EhsView(props: EhsViewProps) {
  const {
    user,
    docSearch, setDocSearch,
    filteredDocuments,
    docPage, setDocPage,
    itemsPerPage,
  } = props;

  const [selectedDocId, setSelectedDocId] = useState<number | string | null>(null);
  const selectedDoc = (filteredDocuments || []).find(d => d.id === selectedDocId) || null;

  const isApprover = user && [Role.SafaricomAdmin, Role.SafaricomEHSOfficer, Role.ContractorEHSOfficer, Role.ContractorManager].some(r => r === user.role);

  if (selectedDoc) {
    return (
      <div className="fixed inset-0 z-[180] flex flex-col bg-[#F8FAFC] overflow-y-auto panel-mobile-bottom">
        <div className="flex-1 min-h-0 bg-[#F8FAFC] flex flex-col p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto space-y-8 animate-in fade-in lg:animate-in lg:slide-in-from-bottom-4 lg:duration-500">
          
          <button 
            onClick={() => setSelectedDocId(null)} 
            className="group flex items-center gap-2 text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <div className="p-2 bg-white rounded-full shadow-sm border border-slate-100 group-hover:shadow-md transition-all">
              <ChevronLeft className="w-4 h-4" />
            </div>
            Back to Documents
          </button>

          <div className="bg-white p-8 sm:p-10 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedDoc.fileName}</h2>
                </div>
                <p className="text-sm font-medium text-slate-500 pl-12">{selectedDoc.type || "Document Audit"}</p>
              </div>
              <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                selectedDoc.status === "Approved" ? "bg-emerald-50 text-emerald-600" :
                selectedDoc.status === "Rejected" ? "bg-red-50 text-red-600" :
                "bg-amber-50 text-amber-600"
              }`}>
                {selectedDoc.status === "Approved" && <Check className="w-4 h-4" />}
                {selectedDoc.status === "Rejected" && <X className="w-4 h-4" />}
                {selectedDoc.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Technician</label>
                <p className="text-sm font-semibold text-slate-900">{selectedDoc.technicianName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Upload Date</label>
                <p className="text-sm font-semibold text-slate-900">{new Date(selectedDoc.uploadDate).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compliance Score</label>
                <p className={`text-xl font-black ${selectedDoc.complianceResult?.score && selectedDoc.complianceResult.score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedDoc.complianceResult?.score || 0}%
                </p>
              </div>
            </div>

            {selectedDoc.summary && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <Search className="w-4 h-4" />
                  AI Analysis Summary
                </label>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed">
                  {selectedDoc.summary}
                </div>
              </div>
            )}
            
            {isApprover && selectedDoc.status.startsWith("Pending") && (
              <div className="space-y-6 pt-8 border-t border-slate-100">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-widest">Reason for Approval / Rejection</label>
                  <textarea 
                    value={props.approvalComment}
                    onChange={(e) => props.setApprovalComment(e.target.value)}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all text-sm resize-none h-32 placeholder:text-slate-400"
                    placeholder="Provide detailed feedback for the technician..."
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      props.handleRejectDocument(String(selectedDoc.id));
                      setSelectedDocId(null);
                    }} 
                    className="flex-1 py-4 bg-white border-2 border-red-100 text-red-600 font-bold rounded-2xl hover:bg-red-50 hover:border-red-200 transition-all"
                  >
                    Reject Document
                  </button>
                  <button 
                    onClick={() => {
                      props.handleApproveDocument(String(selectedDoc.id));
                      setSelectedDocId(null);
                    }} 
                    className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all hover:-translate-y-0.5"
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
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-[#F8FAFC] flex flex-col p-4 sm:p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Compliance Ledger</h2>
            <p className="text-sm font-medium text-slate-500">Manage and review all EHS documentation and site evidence.</p>
          </div>
          <div className="relative group w-full sm:w-72">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search documents..."
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent shadow-sm rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Document Artifact</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Technician</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(props.paginatedDocuments || []).map(doc => (
                <tr 
                  key={doc.id} 
                  onClick={() => setSelectedDocId(doc.id)} 
                  className="group cursor-pointer hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{doc.fileName}</p>
                      <p className="text-xs font-medium text-slate-500">{new Date(doc.uploadDate).toLocaleDateString()}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                        {(doc.technicianName || "").slice(0, 2)}
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{doc.technicianName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5 ${
                      doc.status === "Approved" ? "bg-emerald-50 text-emerald-600" :
                      doc.status === "Rejected" ? "bg-red-50 text-red-600" :
                      "bg-amber-50 text-amber-600"
                    }`}>
                      {doc.status === "Approved" && <Check className="w-3.5 h-3.5" />}
                      {doc.status === "Rejected" && <X className="w-3.5 h-3.5" />}
                      {doc.status.includes("Pending") && <AlertTriangle className="w-3.5 h-3.5" />}
                      {doc.status}
                    </span>
                  </td>
                </tr>
              ))}
              {props.paginatedDocuments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                        <History className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">No documents found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
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
}
