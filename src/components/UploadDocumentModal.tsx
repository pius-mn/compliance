import React, { useRef, useState } from "react";
import { 
  FileUp, 
  Loader2, 
  CheckCircle, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  X, 
  XCircle, 
  Sparkles, 
  ArrowRight, 
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  BadgeAlert
} from "lucide-react";
import { User, DocumentType, Role } from "../types";
import { safeJson } from "../utils/helpers";

interface NewDocState {
  fileName?: string;
  documentText?: string;
  type?: string;
  technicianId?: string;
  documentTypeId?: string;
  expiryDate?: string;
  projectId?: string;
  previousVersionId?: string;
  [key: string]: unknown;
}

interface UploadDocumentFormProps {
  onClose: () => void;
  newDoc: NewDocState;
  setNewDoc: React.Dispatch<React.SetStateAction<NewDocState>>;
  handleSubmitDocument: (e: React.FormEvent) => Promise<void>;
  actionLoading: boolean;
  uploadedFileBase64: string | null;
  setUploadedFileBase64: (val: string | null) => void;
  uploadedFileMimeType: string | null;
  setUploadedFileMimeType: (val: string | null) => void;
  dragActive: boolean;
  setDragActive: (val: boolean) => void;
  user: User | null;
  technicians: Record<string, unknown>[];
  allDocumentTypes: DocumentType[];
  allRoles: Record<string, unknown>[]; // WorkRole[]
}

export const UploadDocumentForm: React.FC<UploadDocumentFormProps> = ({
  onClose,
  newDoc,
  setNewDoc,
  uploadedFileBase64,
  setUploadedFileBase64,
  uploadedFileMimeType,
  setUploadedFileMimeType,
  dragActive,
  setDragActive,
  user,
  technicians,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allDocumentTypes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allRoles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redesigned interactive feedback states
  const [step, setStep] = useState<"form" | "auditing" | "compliance-failed" | "success" | "error">("form");
  const [currentProgressText, setCurrentProgressText] = useState("Preparing document metadata...");
  const [currentProgressPercent, setCurrentProgressPercent] = useState(10);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [uploadError, setUploadError] = useState("");

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFileBase64(e.target?.result as string);
      setUploadedFileMimeType(file.type);
      setNewDoc((prev: Record<string, unknown>) => ({
        ...prev,
        fileName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFileBase64(null);
    setUploadedFileMimeType(null);
    setNewDoc((prev: Record<string, unknown>) => ({
      ...prev,
      fileName: ""
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Master upload & AI-auditing sequence
  const handleUploadFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFileBase64) return;
    if (!newDoc.fileName) {
      setUploadError("Please select a valid document or verify the name of your file.");
      setStep("error");
      return;
    }

    setStep("auditing");
    setUploadError("");

    const API_BASE = "/api/v1";
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (user) {
      headers["Authorization"] = `Bearer ${typeof window !== "undefined" ? localStorage.getItem("authToken") || `` : ``}`;
    }

    try {
      // Step 1: Simulating OCR Scan & parsing
      setCurrentProgressText("Safaricom Central AI: Scanning document structures...");
      setCurrentProgressPercent(25);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 2: Running AI Verify Endpoint
      setCurrentProgressText("Safaricom Central AI: Analyzing EHS guidelines & authenticity...");
      setCurrentProgressPercent(50);

      const matchedTech = technicians.find(t => t.id === newDoc.technicianId);
      const aiRes = await fetch(`${API_BASE}/ehs/ai-verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          documentText: newDoc.documentText || "",
          type: newDoc.type,
          fileBase64: uploadedFileBase64,
          fileMimeType: uploadedFileMimeType,
          technicianName: matchedTech ? matchedTech.name : ""
        })
      });

      if (!aiRes.ok) {
        setUploadError("The Safaricom AI EHS Auditor failed to verify this document structure. Please upload a valid, clear safety certificate PDF/image.");
        setStep("error");
        return;
      }

      const aiData = await safeJson(aiRes);
      setAiResult(aiData);

      setCurrentProgressText("Safaricom Central AI: Checking compliance standards & expiration dates...");
      setCurrentProgressPercent(75);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Evaluate EHS standing and check if it violates strict Field Technician submission guidelines
      const hasIssues = aiData?.flaggedIssues && aiData.flaggedIssues.length > 0;
      const lowScore = aiData?.score < 70;

      const isTech = user?.role === Role.Technician;
      if ((hasIssues || lowScore) && isTech) {
        // Force strict block for Field Technicians so they can review EHS issues
        setCurrentProgressPercent(100);
        setStep("compliance-failed");
        return;
      }

      // Step 3: Register in compliance ledger database
      setCurrentProgressText("Creating secure safety record & routing to Safaricom approval chain...");
      setCurrentProgressPercent(90);

      const payload = {
        ...newDoc,
        score: aiData?.score || null,
        issues: aiData?.flaggedIssues || [],
        recommendations: aiData?.recommendations || "Verified safety compliance",
        verifiedByAi: aiData?.verifiedByAi || false,
        summary: aiData?.summary || null,
        flaggedIssues: aiData?.flaggedIssues || null,
        extractedData: aiData ? {
          safetyProtocols: aiData.safetyProtocols,
          environmentalImpacts: aiData.environmentalImpacts,
          incidentReports: aiData.incidentReports
        } : null,
        userId: user?.id,
        expiryDate: newDoc.expiryDate || null
      };

      const submitRes = await fetch(`${API_BASE}/ehs/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!submitRes.ok) {
        const errorData = await safeJson(submitRes);
        setUploadError(errorData?.error || "EHS document registration rules rejected this filing.");
        setStep("error");
        return;
      }

      // Finished!
      setCurrentProgressPercent(100);
      setStep("success");

    } catch (err) {
      console.error(err);
      setUploadError("A communication exception occurred. Please verify your connection to Safaricom Central Server.");
      setStep("error");
    }
  };

  // Administrator/Manager Bypass Submit Override
  const handleAdminOverrideSubmit = async () => {
    if (!aiResult) return;
    setStep("auditing");
    setCurrentProgressText("Admin Override active: Registering bypass standard with warnings...");
    setCurrentProgressPercent(85);

    const API_BASE = "/api/v1";
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (user) {
      headers["Authorization"] = `Bearer ${typeof window !== "undefined" ? localStorage.getItem("authToken") || `` : ``}`;
    }

    try {
      const payload = {
        ...newDoc,
        score: aiResult?.score || null,
        issues: aiResult?.flaggedIssues || [],
        recommendations: `Admin Override Bypass: ${aiResult?.recommendations || "Verified with compliance warning"}`,
        verifiedByAi: aiResult?.verifiedByAi || false,
        summary: aiResult?.summary || null,
        flaggedIssues: aiResult?.flaggedIssues || null,
        extractedData: aiResult ? {
          safetyProtocols: aiResult.safetyProtocols,
          environmentalImpacts: aiResult.environmentalImpacts,
          incidentReports: aiResult.incidentReports
        } : null,
        userId: user?.id,
        expiryDate: newDoc.expiryDate || null
      };

      const submitRes = await fetch(`${API_BASE}/ehs/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!submitRes.ok) {
        const errorData = await safeJson(submitRes);
        setUploadError(errorData?.error || "Failed to register override record.");
        setStep("error");
        return;
      }

      setStep("success");
    } catch (err) {
      console.error(err);
      setUploadError("Connection failed during exception override dispatch.");
      setStep("error");
    }
  };

  const isPreFilledType = !!newDoc.type;

  return (
    <div className="bg-white rounded-3xl w-full border border-slate-150 overflow-hidden shadow-2xl flex flex-col" id="upload_document_modal_flow">
      {/* 1. idle input FORM SCREEN */}
      {step === "form" && (
        <form onSubmit={handleUploadFlow} className="p-6 md:p-8 space-y-6 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black tracking-widest text-[#18863A] uppercase bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100">
                Safaricom EHS Compliance Audit
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-2 tracking-tight">
                {isPreFilledType ? `Upload ${newDoc.type}` : "Submit Safety Permit / Document"}
              </h2>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition-all active:scale-95 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Interactive Drag & Drop zone */}
          <div 
            className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 relative select-none ${
              dragActive 
                ? 'border-[#18863A] bg-emerald-50/40 scale-[1.01] shadow-inner' 
                : uploadedFileBase64 
                  ? 'border-emerald-200 bg-emerald-50/15 hover:border-emerald-300' 
                  : 'border-slate-200 hover:border-[#18863A]/40 hover:bg-slate-50/30'
            }`}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              id="file-upload" 
              className="hidden" 
              onChange={(e) => e.target.files && handleFile(e.target.files[0])} 
            />

            {uploadedFileBase64 ? (
              <div className="space-y-4 max-w-sm mx-auto relative">
                {/* Clear button */}
                <button 
                  type="button" 
                  onClick={handleClearFile}
                  className="absolute -top-1 -right-1 p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-full transition-all z-10 shadow-xs active:scale-90 cursor-pointer"
                  title="Remove file"
                >
                  <X size={12} />
                </button>

                {uploadedFileMimeType?.startsWith("image/") ? (
                  <div className="relative h-28 w-full bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm">
                    <img 
                      src={uploadedFileBase64} 
                      alt="File preview" 
                      className="h-full object-contain p-2" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                ) : (
                  <div className="h-28 w-full bg-slate-50 rounded-xl flex flex-col items-center justify-center border border-slate-150 shadow-xs">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-sm mb-2 border border-rose-100 font-extrabold text-xs">
                      PDF
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Portable Document Format
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 truncate px-4">{newDoc.fileName}</p>
                  <p className="text-[10px] text-[#18863A] font-black flex items-center justify-center gap-1 bg-emerald-100/50 py-1 px-3 rounded-full w-fit mx-auto border border-emerald-150/40">
                    <CheckCircle size={12} className="text-[#18863A]" />
                    File Selected Successfully
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                <div className="w-14 h-14 bg-emerald-50 text-[#18863A] rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100/40 shadow-xs">
                  <FileUp size={24} className="text-[#18863A]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Click to select or drag document here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PDF, PNG, JPG files up to 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 tracking-wider">
                Document Type Name
              </label>
              {isPreFilledType ? (
                <div className="relative">
                  <input 
                    type="text" 
                    value={newDoc.type}
                    readOnly
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-not-allowed outline-hidden pl-11"
                  />
                  <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#18863A]" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#18863A] bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-100">
                    Auto-Mapped
                  </span>
                </div>
              ) : (
                <input 
                  type="text" 
                  value={newDoc.type as string}
                  onChange={(e) => setNewDoc({...newDoc, type: e.target.value})}
                  placeholder="e.g. Environmental Health JSA, Certification"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/25 focus:border-[#18863A] outline-hidden transition-all text-slate-800 placeholder-slate-400 font-medium"
                  required
                />
              )}
            </div>
            
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" />
                Expiry Date <span className="text-[9px] font-normal text-slate-400 font-sans italic lowercase">(optional)</span>
              </label>
              <input 
                type="date" 
                value={newDoc.expiryDate}
                onChange={(e) => setNewDoc({...newDoc, expiryDate: e.target.value})}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/25 focus:border-[#18863A] outline-hidden transition-all text-slate-700 font-medium"
              />
            </div>
          </div>
          
          {/* Action Button */}
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={!uploadedFileBase64}
              className="w-full py-4 bg-[#18863A] hover:bg-[#156e2f] text-white rounded-xl text-sm font-black active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all flex justify-center items-center gap-2 shadow-lg shadow-[#18863A]/20 cursor-pointer"
            >
              <span>Verify & Submit Certificate</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      )}

      {/* 2. REAL-TIME AI AUDITING PROGRESS SCREEN */}
      {step === "auditing" && (
        <div className="p-8 space-y-8 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
          <div className="relative flex items-center justify-center py-6">
            <div className="absolute w-24 h-24 border-4 border-[#18863A]/10 border-t-[#18863A] rounded-full animate-spin" />
            <div className="absolute w-18 h-18 bg-emerald-50 text-[#18863A] rounded-full flex items-center justify-center animate-pulse border border-emerald-100">
              <Sparkles size={28} className="animate-bounce" />
            </div>
          </div>

          <div className="space-y-3 max-w-sm">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Safaricom Compliance Scan</h3>
            <p className="text-xs text-slate-400">Your safety document is being checked by our Central AI Compliance engine to guarantee regulatory EHS standards.</p>
          </div>

          {/* Staggered Checklist Feedback */}
          <div className="w-full max-w-md bg-slate-50 border border-slate-150 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Audit Execution Logs</span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">{currentProgressPercent}%</span>
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs">
                <CheckCircle2 size={14} className="text-[#18863A] shrink-0" />
                <span className="font-bold text-slate-700">Checking document file signature</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                {currentProgressPercent >= 50 ? (
                  <CheckCircle2 size={14} className="text-[#18863A] shrink-0" />
                ) : (
                  <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
                )}
                <span className={currentProgressPercent >= 50 ? "font-bold text-slate-700" : "text-slate-400 font-medium"}>
                  Extracting OCR safety criteria
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                {currentProgressPercent >= 75 ? (
                  <CheckCircle2 size={14} className="text-[#18863A] shrink-0" />
                ) : currentProgressPercent >= 50 ? (
                  <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" />
                )}
                <span className={currentProgressPercent >= 75 ? "font-bold text-slate-700" : "text-slate-400 font-medium"}>
                  Auditing EHS regulations & scores
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                {currentProgressPercent >= 90 ? (
                  <CheckCircle2 size={14} className="text-[#18863A] shrink-0" />
                ) : currentProgressPercent >= 75 ? (
                  <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" />
                )}
                <span className={currentProgressPercent >= 90 ? "font-bold text-slate-700" : "text-slate-400 font-medium"}>
                  Filing record in approval queue
                </span>
              </div>
            </div>

            {/* Micro Progress Bar */}
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
              <div 
                className="h-full bg-[#18863A] transition-all duration-300 rounded-full" 
                style={{ width: `${currentProgressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-bold italic mt-2 animate-pulse">{currentProgressText}</p>
          </div>
        </div>
      )}

      {/* 3. EHS COMPLIANCE FLAGGED (FAILING SCORE / CRITICAL ISSUES) */}
      {step === "compliance-failed" && (
        <div className="p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-center justify-center shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-sm uppercase">
                Compliance Blocked
              </span>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">EHS Safety Audit Failed</h3>
            </div>
          </div>

          <div className="bg-rose-50/20 border-2 border-rose-100 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-mono text-2xl font-black">
                {(aiResult?.score as number) || 0}%
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Audit Score Granted</p>
                <p className="text-xs font-bold text-rose-800 mt-0.5">Safaricom EHS compliance score is too low.</p>
              </div>
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded bg-rose-100 text-rose-800 border border-rose-200">
              Required: ≥ 70%
            </span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BadgeAlert size={14} className="text-rose-500" />
              Flagged Safety Exceptions ({((aiResult?.flaggedIssues as unknown[])?.length) || 0})
            </h4>
            <div className="max-h-44 overflow-y-auto border border-slate-150 rounded-2xl p-4 bg-slate-50 space-y-2.5 custom-scrollbar">
              {(aiResult?.flaggedIssues as unknown[])?.length > 0 ? (
                (aiResult?.flaggedIssues as unknown as string[]).map((issue: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-slate-600 font-medium leading-relaxed">{issue}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 font-medium">No explicit issues flagged, but overall EHS metrics fall short.</p>
              )}
            </div>
          </div>

          {/* Conditional Controls based on user role */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => {
                setUploadedFileBase64(null);
                setUploadedFileMimeType(null);
                setNewDoc((prev: Record<string, unknown>) => ({ ...prev, fileName: "" }));
                setStep("form");
              }}
              className="w-full sm:flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all border border-slate-200 cursor-pointer text-center"
            >
              Re-upload Compliant File
            </button>

            {user?.role !== Role.Technician ? (
              <button
                onClick={handleAdminOverrideSubmit}
                className="w-full sm:flex-1 py-3 bg-[#18863A] hover:bg-[#156e2f] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-[#18863A]/10 cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <span>Override & File Exception</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full sm:flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center"
              >
                Cancel & Contact Lead
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. SUCCESS SCREEN */}
      {step === "success" && (
        <div className="p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-50 text-[#18863A] rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-sm animate-bounce">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-[#18863A] uppercase bg-emerald-100 border border-emerald-150 px-3 py-1 rounded-full">
              Filing Complete
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mt-3">Document Verified & Dispatched!</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">Safaricom EHS Audit Ledger registered successfully and added to the approval queue.</p>
          </div>

          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 text-left divide-y divide-slate-100 space-y-3.5">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-bold text-slate-500">Compliance Audit Score</span>
              <span className="text-sm font-black text-[#18863A] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                {(aiResult?.score as number) || 100}%
              </span>
            </div>

            <div className="pt-3.5 space-y-2.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Identified EHS Parameters</span>
              <div className="max-h-28 overflow-y-auto space-y-1.5 custom-scrollbar">
                {(aiResult?.safetyProtocols as unknown[])?.length > 0 ? (
                  (aiResult?.safetyProtocols as unknown as string[]).map((p: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] font-medium text-slate-600">
                      <CheckCircle size={10} className="text-[#18863A] shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-1.5 text-[11px] font-medium text-slate-600">
                    <CheckCircle size={10} className="text-[#18863A] shrink-0 mt-0.5" />
                    <span>Verified general work safety certification compliance</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setStep("form");
              onClose();
            }}
            className="w-full py-4 bg-[#18863A] hover:bg-[#156e2f] text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-[#18863A]/10 cursor-pointer"
          >
            Great, Close Modal
          </button>
        </div>
      )}

      {/* 5. ERROR SCREEN (GENERIC NETWORK/VALIDATION FAILURE) */}
      {step === "error" && (
        <div className="p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border-2 border-rose-100 shadow-xs animate-pulse">
            <XCircle size={36} />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-rose-600 uppercase bg-rose-50 border border-rose-100 px-3 py-1 rounded-full">
              Upload Failed
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mt-3">Document Processing Error</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">We encountered an issue validating your document with the Safaricom EHS gateway.</p>
          </div>

          <div className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4 text-xs font-semibold text-rose-800 text-left leading-relaxed">
            {uploadError || "An unexpected error occurred while communicating with the centralized EHS database."}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("form")}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all border border-slate-200 cursor-pointer"
            >
              Go Back and Edit
            </button>
            <button
              onClick={handleUploadFlow}
              className="flex-1 py-3.5 bg-[#18863A] hover:bg-[#156e2f] text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#18863A]/10 cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Retry Scan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
