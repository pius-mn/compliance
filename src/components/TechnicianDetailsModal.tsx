import React, { useState } from "react";
import { TechnicianProfile, TechnicianDocument, WorkRole, DocumentType, User, Role } from "../types";
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
  Edit,
  Trash2
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
  onUpdateTechnician?: (id: number | string, tech: { name: string; phone: string; specialization: string; email?: string }) => Promise<void>;
  onDeleteTechnician?: (id: number | string) => Promise<void>;
}

export const TechnicianDetails: React.FC<TechnicianDetailsProps> = ({
  user,
  technician,
  documents,
  onClose,
  onUpload,
  allRoles,
  allDocumentTypes,
  onUpdateRoles,
  onUpdateTechnician,
  onDeleteTechnician,
}) => {
  // Client-side current time to avoid SSR hydration mismatches from new Date()
  const [currentTime] = useState(() => Date.now());

  const [selectedRoleIds, setSelectedRoleIds] = useState<(number | string)[]>(technician.workRoleIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<number | string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    name: technician.name,
    phone: technician.phone,
    specialization: technician.specialization,
  });
  const techDocs = (documents || []).filter(doc => doc.technicianId === technician.id);
  const isTechnician = user?.role === Role.Technician;

  const handleUpdateTechnician = async () => {
    if (onUpdateTechnician) {
      setIsSaving(true);
      try {
        await onUpdateTechnician(technician.id, editForm);
        setIsEditMode(false);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteTechnician = async () => {
    if (onDeleteTechnician) {
      setIsSaving(true);
      try {
        await onDeleteTechnician(technician.id);
        onClose();
      } finally {
        setIsSaving(false);
      }
    }
  };

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

  const requiredDocumentTypeIds = Array.from(new Set(
    (allRoles || []).filter(role => selectedRoleIds.includes(role.id))
      .flatMap(role => role.documentTypeIds)
  ));
  
  const requiredDocumentTypes = (allDocumentTypes || []).filter(doc => requiredDocumentTypeIds.includes(doc.id));

  // Compute stats for required compliance
  const uploadedRequiredDocs = requiredDocumentTypes.filter(docType => {
    const existingDoc = techDocs.find(d => d.type === docType.name || d.documentTypeId === docType.id);
    const isExpired = existingDoc?.expiryDate && currentTime > 0 && new Date(existingDoc.expiryDate).getTime() < currentTime;
    return existingDoc && !isExpired;
  });

  const percentComplete = requiredDocumentTypes.length > 0 
    ? Math.round((uploadedRequiredDocs.length / requiredDocumentTypes.length) * 100) 
    : 100;

  // Score styling
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (score >= 75) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-100";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden" id="technician_details_modal_container">
      {/* Header - Fixed */}
      <div className="p-6 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50/70">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#18863A] to-[#25d366] flex items-center justify-center text-white font-extrabold text-xl shadow-md uppercase">
              {technician.name.substring(0, 2)}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${getScoreBadgeColor(technician.overallEhsScore)}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-[#18863A] uppercase bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-100/50">
                EHS Profile & Audits
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                technician.status === "Active" 
                  ? "bg-emerald-100 text-emerald-800" 
                  : technician.status === "EHS Check Needed"
                    ? "bg-amber-150 text-amber-900"
                    : "bg-rose-100 text-rose-800"
              }`}>
                {technician.status}
              </span>
            </div>
            
            {isEditMode ? (
              <div className="mt-2 space-y-2">
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                  className="w-full text-lg font-black text-slate-900 px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] outline-hidden" 
                  placeholder="Technician Name"
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editForm.specialization} 
                    onChange={(e) => setEditForm({...editForm, specialization: e.target.value})} 
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] outline-hidden" 
                    placeholder="Specialization"
                  />
                  <input 
                    type="text" 
                    value={editForm.phone} 
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})} 
                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] outline-hidden" 
                    placeholder="Phone"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleUpdateTechnician} disabled={isSaving} className="px-3 py-1 bg-[#18863A] text-white rounded-lg text-xs font-bold hover:bg-[#156e2f] transition-all disabled:opacity-50">
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setIsEditMode(false)} disabled={isSaving} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">{technician.name}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} className="text-slate-400" />
                    {technician.specialization}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" />
                    {technician.phone}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditMode && !isTechnician && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 bg-rose-50 p-1 rounded-xl border border-rose-100">
                  <button onClick={handleDeleteTechnician} disabled={isSaving} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all whitespace-nowrap">
                    {isSaving ? "Wait..." : "Confirm Delete"}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)} disabled={isSaving} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-all">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditMode(true)} 
                    className="p-2 hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-[#18863A] rounded-full transition-all border border-slate-100 bg-white"
                    title="Edit Details"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)} 
                    className="p-2 hover:bg-rose-50 active:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-full transition-all border border-slate-100 bg-white"
                    title="Delete Technician"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </>
          )}
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-all border border-slate-100 bg-white"
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
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-[#18863A] rounded-xl border border-emerald-100/40">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Overall EHS Score</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{technician.overallEhsScore}%</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getScoreColor(technician.overallEhsScore)}`}>
                  {technician.overallEhsScore >= 90 ? "Excellent" : technician.overallEhsScore >= 75 ? "Satisfactory" : "At Risk"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/40">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Last Audit Conducted</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-slate-800">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <Award size={14} className="text-[#18863A]" />
                Assigned Job Roles
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Active roles automatically map required safety certifications & site clearance docs</p>
            </div>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
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
                      ? "border-[#18863A] bg-emerald-50/15 shadow-xs"
                      : "border-slate-150 bg-slate-50/30 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRoleIds(prev => [...prev, role.id]);
                      else setSelectedRoleIds(prev => prev.filter(id => id !== role.id));
                    }}
                    className="accent-[#18863A] w-4.5 h-4.5 mt-0.5 rounded border-slate-300 focus:ring-[#18863A] cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">{role.name}</span>
                    <span className="text-[9px] text-slate-400 font-medium mt-1">Requires {role.documentTypeIds?.length || 0} EHS clearance document{role.documentTypeIds?.length !== 1 ? 's' : ''}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Documents Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1 pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#18863A]" />
              Required Safety Documents & Clearance
            </h3>
            <p className="text-[10px] text-slate-400">Must be kept current and verified through Safaricom EHS sign-off</p>
          </div>

          {/* Compliance Progress Bar Tracker */}
          {requiredDocumentTypes.length > 0 && (
            <div className="bg-slate-50 border border-slate-150/70 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-[#18863A]" />
                  <span className="text-xs font-bold text-slate-700">Safety Compliance Standing</span>
                </div>
                <span className={`text-xs font-black ${percentComplete === 100 ? 'text-[#18863A]' : 'text-amber-600'}`}>
                  {uploadedRequiredDocs.length} of {requiredDocumentTypes.length} Active ({percentComplete}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#18863A] to-[#25d366] transition-all duration-500 rounded-full" 
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredDocumentTypes.length === 0 && (
              <div className="text-sm text-slate-400 col-span-full py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <AlertTriangle size={24} className="text-slate-300" />
                <span>Select technician roles above to load required safety documents.</span>
              </div>
            )}
            {requiredDocumentTypes.map(docType => {
              const existingDoc = techDocs.find(d => d.type === docType.name || d.documentTypeId === docType.id);
              const isExpired = existingDoc?.expiryDate && currentTime > 0 && new Date(existingDoc.expiryDate).getTime() < currentTime;
              const isValid = existingDoc && !isExpired;
              
              return (
                <div 
                  key={docType.id} 
                  className={`border rounded-2xl p-4 flex flex-col justify-between hover:shadow-xs transition-all duration-200 ${
                    isValid 
                      ? "bg-emerald-50/10 border-emerald-200 hover:border-emerald-300" 
                      : isExpired 
                        ? "bg-rose-50/10 border-rose-200 hover:border-rose-300"
                        : "bg-amber-50/5 border-amber-200 hover:border-amber-300"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="flex gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                        isValid 
                          ? "bg-emerald-100/50 text-[#18863A]" 
                          : isExpired 
                            ? "bg-rose-100/50 text-rose-600"
                            : "bg-amber-100/50 text-amber-600"
                      }`}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 leading-snug">{docType.name}</h4>
                        {existingDoc ? (
                          <div className="space-y-0.5 mt-1">
                            <p className="text-[10px] text-slate-500 font-medium">File: <span className="font-bold text-slate-700">{existingDoc.fileName}</span></p>
                            <p className="text-[9px] text-slate-400">Uploaded: {new Date(existingDoc.uploadDate).toLocaleDateString()}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-1 italic">Not uploaded yet</p>
                        )}
                      </div>
                    </div>
                    {isValid ? (
                      <CheckCircle2 size={18} className="text-[#18863A] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={18} className={`${isExpired ? "text-rose-500" : "text-amber-500"} shrink-0 mt-0.5 animate-pulse`} />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100/80 mt-2">
                    {existingDoc ? (
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                        isExpired 
                          ? 'bg-rose-100/40 text-rose-700 border-rose-100' 
                          : 'bg-emerald-100/40 text-[#18863A] border-emerald-100/50'
                      }`}>
                        {existingDoc.expiryDate ? (isExpired ? `Expired: ${new Date(existingDoc.expiryDate).toLocaleDateString()}` : `Expires: ${new Date(existingDoc.expiryDate).toLocaleDateString()}`) : 'No Expiry'}
                      </div>
                    ) : (
                      <div className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-100/40 text-amber-700 border border-amber-150/40">
                        Required
                      </div>
                    )}
                    
                    <button 
                      onClick={() => onUpload(technician.id, docType.name)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer ${
                        existingDoc 
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200" 
                          : "bg-[#18863A] text-white hover:bg-[#156e2f] shadow-[#18863A]/10"
                      }`}
                    >
                      <Upload size={12} /> {existingDoc ? "Update" : "Upload File"}
                    </button>
                  </div>

                  {existingDoc && (
                    <div className="mt-3 pt-3 border-t border-slate-100/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">EHS Verification Report</span>
                      <button
                        type="button"
                        onClick={() => setExpandedDocId(expandedDocId === existingDoc.id ? null : existingDoc.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[10px] font-black text-[#18863A] border border-slate-200 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer"
                      >
                        {expandedDocId === existingDoc.id ? (
                          <>Hide Details <ChevronUp size={12} /></>
                        ) : (
                          <>View Details <ChevronDown size={12} /></>
                        )}
                      </button>
                    </div>
                  )}

                  {existingDoc && expandedDocId === existingDoc.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                      {/* Safety Score */}
                      <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/60">
                        <span className="text-[10px] font-black uppercase text-slate-400">EHS Safety Index:</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          existingDoc.complianceResult?.score !== undefined && existingDoc.complianceResult.score >= 80
                            ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                            : existingDoc.complianceResult?.score !== undefined && existingDoc.complianceResult.score >= 60
                              ? "bg-amber-50 text-amber-700 border-amber-150"
                              : "bg-rose-50 text-rose-700 border-rose-150"
                        }`}>
                          {existingDoc.complianceResult?.score !== undefined ? `${existingDoc.complianceResult.score}%` : "0%"}
                        </span>
                      </div>

                      {/* Summary */}
                      {existingDoc.summary && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">AI Audit Summary</span>
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed bg-slate-50/40 p-2.5 rounded-xl border border-slate-150/50">
                            {existingDoc.summary}
                          </p>
                        </div>
                      )}

                      {/* Failures & Flagged Issues */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Flagged Compliance Exceptions</span>
                        {existingDoc.flaggedIssues && existingDoc.flaggedIssues.length > 0 ? (
                          <div className="space-y-1.5">
                            {existingDoc.flaggedIssues.map((issue, idx) => (
                              <div key={idx} className="flex items-start gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-[11px] text-rose-800 leading-relaxed font-semibold">
                                <ShieldAlert size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        ) : existingDoc.complianceResult?.issues && existingDoc.complianceResult.issues.length > 0 ? (
                          <div className="space-y-1.5">
                            {existingDoc.complianceResult.issues.map((issue, idx) => (
                              <div key={idx} className="flex items-start gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-[11px] text-rose-800 leading-relaxed font-semibold">
                                <ShieldAlert size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-50/25 p-2.5 rounded-xl border border-emerald-100/50 leading-relaxed flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-[#18863A]" />
                            No compliance issues flagged. This document is certified.
                          </p>
                        )}
                      </div>

                      {/* Corrective Actions Recommendations */}
                      {existingDoc.complianceResult?.recommendations && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Corrective Action Recommendations</span>
                          <p className="text-[11px] text-amber-800 font-semibold bg-amber-50/20 p-2.5 rounded-xl border border-amber-100/50 leading-relaxed">
                            {existingDoc.complianceResult.recommendations}
                          </p>
                        </div>
                      )}

                      {/* Approval comments */}
                      {existingDoc.approvalChainComments && existingDoc.approvalChainComments.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Auditor Review Comments</span>
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-150/70 font-semibold leading-relaxed">
                            {existingDoc.approvalChainComments.join(" | ")}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* General/Other Documents */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex justify-between items-center gap-2 pb-2">
            <div>
              <h3 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <FileText size={14} className="text-slate-500" />
                Other EHS Documents & Permits
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Additional certifications, incident forms, or local work permits</p>
            </div>
            <button 
              onClick={() => onUpload(technician.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-250/30 text-slate-700 border border-slate-200 rounded-xl text-xs font-extrabold active:scale-95 transition-all cursor-pointer"
            >
              <Upload size={12} /> Upload General
            </button>
          </div>

          {techDocs.filter(d => !requiredDocumentTypes.some(rt => rt.name === d.type || rt.id === d.documentTypeId)).length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/40 rounded-2xl border border-dashed border-slate-150 flex flex-col items-center justify-center gap-1.5">
              <span>No additional safety documents or permits uploaded.</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {techDocs.filter(d => !requiredDocumentTypes.some(rt => rt.name === d.type || rt.id === d.documentTypeId)).map(doc => {
                const isExpired = doc.expiryDate && currentTime > 0 && new Date(doc.expiryDate).getTime() < currentTime;
                return (
                  <li key={doc.id} className="flex flex-col bg-white border border-slate-150/70 rounded-2xl p-4 hover:shadow-xs transition-all space-y-3">
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex gap-3">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-xl shrink-0 flex items-center justify-center border border-slate-200/50">
                          <FileText size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-none">{doc.type}</p>
                          <p className="text-[10px] text-slate-400 mt-1.5">Uploaded: {new Date(doc.uploadDate).toLocaleDateString()} • File: <span className="font-semibold text-slate-500">{doc.fileName}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-[9px] font-black px-2 py-0.5 rounded border ${isExpired ? 'bg-rose-100/40 text-rose-700 border-rose-100' : 'bg-emerald-100/40 text-[#18863A] border border-emerald-100/50'}`}>
                          {doc.expiryDate ? (isExpired ? `Expired: ${new Date(doc.expiryDate).toLocaleDateString()}` : `Expires: ${new Date(doc.expiryDate).toLocaleDateString()}`) : 'No Expiry'}
                        </div>
                        <button 
                          onClick={() => onUpload(technician.id, doc.type)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-all border border-slate-200 bg-white cursor-pointer"
                          title="Update Document"
                        >
                          <Upload size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">EHS Verification Report</span>
                      <button
                        type="button"
                        onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[10px] font-black text-[#18863A] border border-slate-200 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer"
                      >
                        {expandedDocId === doc.id ? (
                          <>Hide Details <ChevronUp size={12} /></>
                        ) : (
                          <>View Details <ChevronDown size={12} /></>
                        )}
                      </button>
                    </div>

                    {expandedDocId === doc.id && (
                      <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                        {/* Safety Score */}
                        <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/60">
                          <span className="text-[10px] font-black uppercase text-slate-400">EHS Safety Index:</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                            doc.complianceResult?.score !== undefined && doc.complianceResult.score >= 80
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                              : doc.complianceResult?.score !== undefined && doc.complianceResult.score >= 60
                                ? "bg-amber-50 text-amber-700 border-amber-150"
                                : "bg-rose-50 text-rose-700 border-rose-150"
                          }`}>
                            {doc.complianceResult?.score !== undefined ? `${doc.complianceResult.score}%` : "0%"}
                          </span>
                        </div>

                        {/* Summary */}
                        {doc.summary && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">AI Audit Summary</span>
                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed bg-slate-50/40 p-2.5 rounded-xl border border-slate-150/50">
                              {doc.summary}
                            </p>
                          </div>
                        )}

                        {/* Failures & Flagged Issues */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Flagged Compliance Exceptions</span>
                          {doc.flaggedIssues && doc.flaggedIssues.length > 0 ? (
                            <div className="space-y-1.5">
                              {doc.flaggedIssues.map((issue, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-[11px] text-rose-800 leading-relaxed font-semibold">
                                  <ShieldAlert size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          ) : doc.complianceResult?.issues && doc.complianceResult.issues.length > 0 ? (
                            <div className="space-y-1.5">
                              {doc.complianceResult.issues.map((issue, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-[11px] text-rose-800 leading-relaxed font-semibold">
                                  <ShieldAlert size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-50/25 p-2.5 rounded-xl border border-emerald-100/50 leading-relaxed flex items-center gap-1.5">
                              <CheckCircle2 size={12} className="text-[#18863A]" />
                              No compliance issues flagged. This document is certified.
                            </p>
                          )}
                        </div>

                        {/* Corrective Actions Recommendations */}
                        {doc.complianceResult?.recommendations && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Corrective Action Recommendations</span>
                            <p className="text-[11px] text-amber-800 font-semibold bg-amber-50/20 p-2.5 rounded-xl border border-amber-100/50 leading-relaxed">
                              {doc.complianceResult.recommendations}
                            </p>
                          </div>
                        )}

                        {/* Approval comments */}
                        {doc.approvalChainComments && doc.approvalChainComments.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Auditor Review Comments</span>
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-150/70 font-semibold leading-relaxed">
                              {doc.approvalChainComments.join(" | ")}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};


