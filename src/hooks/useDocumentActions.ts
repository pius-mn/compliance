import React from "react";
import { TechnicianProfile } from "../types";
import { safeJson } from "../utils/helpers";
import { apiFetch, apiFetchJson } from "../utils/apiFetch";
import type { CollectionKey } from "../utils/dataSync";

interface DocumentActionStates {
  user: { id?: number | string; role?: string } | null;
  newDoc: Record<string, unknown>;
  setNewDoc: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  aiAnalysisResult: Record<string, unknown> | null;
  setAiAnalysisResult: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
  aiAuditing: boolean;
  setAiAuditing: React.Dispatch<React.SetStateAction<boolean>>;
  uploadedFileBase64: string | null;
  setUploadedFileBase64: React.Dispatch<React.SetStateAction<string | null>>;
  uploadedFileMimeType: string | null;
  setUploadedFileMimeType: React.Dispatch<React.SetStateAction<string | null>>;
  technicians: TechnicianProfile[];
  setViewingDoc: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
  setApprovalComment: React.Dispatch<React.SetStateAction<string>>;
  approvalComment: string;
  setShowUploadDoc: React.Dispatch<React.SetStateAction<boolean>>;
  setActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useDocumentActions(
  states: DocumentActionStates,
  API_BASE: string,
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", msg: string) => void,
  refetchData: (collections: CollectionKey[]) => Promise<void>
) {
  const {
    user,
    newDoc,
    setNewDoc,
    aiAnalysisResult,
    setAiAnalysisResult,
    aiAuditing,
    setAiAuditing,
    uploadedFileBase64,
    setUploadedFileBase64,
    uploadedFileMimeType,
    setUploadedFileMimeType,
    technicians,
    setViewingDoc,
    setApprovalComment,
    approvalComment,
    setShowUploadDoc,
    setActionLoading
  } = states;

  const handleAiVerificationCheck = async () => {
    if (!newDoc.documentText && !uploadedFileBase64) {
      triggerBannerAlert("error", "Provide raw, uploaded text data or file upload for the Safety Compliance Auditor Gemini report.");
      return;
    }
    setAiAuditing(true);
    setAiAnalysisResult(null);
    try {
      const matchedTech = (technicians || []).find((t: TechnicianProfile) => t.id === newDoc.technicianId);
      const res = await apiFetchJson(`${API_BASE}/ehs/ai-verify`, {
        method: "POST",
        body: {
          documentText: newDoc.documentText,
          type: newDoc.type,
          fileBase64: uploadedFileBase64,
          fileMimeType: uploadedFileMimeType,
          technicianName: matchedTech ? matchedTech.name : ""
        }
      });
      if (res.ok) {
        const data = (await safeJson(res)) as Record<string, unknown>;
        setAiAnalysisResult(data);
        
        if (!newDoc.documentText && data.summary) {
          setNewDoc((prev: Record<string, unknown>) => ({
            ...prev,
            documentText: `Summary:\n${data.summary}\n\nSafety Protocols:\n${(data.safetyProtocols as string[]).join("\n")}`
          }));
        }
        
        triggerBannerAlert("success", `Audit Checklist completed! Score: ${data.score}%`);
        
        const flaggedIssues = data.flaggedIssues as unknown[];
        const hasIssues = flaggedIssues && flaggedIssues.length > 0;
        const score = data.score as number;
        const lowScore = score < 70;
        
        if (hasIssues || lowScore) {
          triggerBannerAlert("warning", `Compliance issues detected (${flaggedIssues?.length || 0} issues, Score: ${score}%). Please review the audit results before manual submission.`);
        } else {
          const payload: Record<string, unknown> = {
            ...newDoc,
            score: data?.score || null,
            issues: data?.flaggedIssues || [],
            recommendations: data?.recommendations || "Verified safety compliance",
            verifiedByAi: data?.verifiedByAi || false,
            summary: data?.summary || null,
            flaggedIssues: data?.flaggedIssues || null,
            extractedData: data ? {
              safetyProtocols: data.safetyProtocols,
              environmentalImpacts: data.environmentalImpacts,
              incidentReports: data.incidentReports
            } : null,
            userId: user?.id,
            expiryDate: newDoc.expiryDate || null
          };
          await submitDocument(payload);
        }
      } else {
        triggerBannerAlert("error", "Gemini compliance auditor failed to parse raw text.");
      }
    } catch {
      triggerBannerAlert("error", "AI Server error occurred.");
    } finally {
      setAiAuditing(false);
    }
  };

  const submitDocument = async (payload: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/ehs/documents`, {
        method: "POST",
        body: payload
      });

      if (res.ok) {
        setShowUploadDoc(false);
        setNewDoc({
          fileName: "",
          documentText: "",
          type: "PPE Audit",
          technicianId: "",
          documentTypeId: "",
          expiryDate: ""
        });
        setUploadedFileBase64(null);
        setUploadedFileMimeType(null);
        setAiAnalysisResult(null);
        triggerBannerAlert("success", "Document successfully submitted!");
      } else {
        triggerBannerAlert("error", "Failed to submit document.");
      }      } catch {
      triggerBannerAlert("error", "Error submitting document.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.fileName) {
      triggerBannerAlert("error", "Please configure file reference name.");
      return;
    }
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...newDoc,
        score: (aiAnalysisResult?.score as number) || null,
        issues: (aiAnalysisResult?.flaggedIssues as unknown[]) || [],
        recommendations: aiAnalysisResult?.recommendations || "Verified safety compliance",
        verifiedByAi: (aiAnalysisResult?.verifiedByAi as boolean) || false,
        summary: aiAnalysisResult?.summary || null,
        flaggedIssues: aiAnalysisResult?.flaggedIssues || null,
        extractedData: aiAnalysisResult ? {
          safetyProtocols: aiAnalysisResult.safetyProtocols,
          environmentalImpacts: aiAnalysisResult.environmentalImpacts,
          incidentReports: aiAnalysisResult.incidentReports
        } : null,
        userId: user?.id,
        expiryDate: newDoc.expiryDate || null
      };

      const userRole = user?.role;
      if (userRole === "Field Technician") {
        if (aiAuditing) {
          triggerBannerAlert("error", "AI verification is still in progress. Please wait.");
          setActionLoading(false);
          return;
        }
        if (!aiAnalysisResult || !aiAnalysisResult.verifiedByAi) {
          const flaggedIssues = (aiAnalysisResult?.flaggedIssues as string[]) || [];
          const issues = flaggedIssues;
          const issueText = issues.length > 0 
            ? `Safety Issues: ${issues.join("; ")}`
            : `Compliance score was only ${(aiAnalysisResult?.score as number) || 0}% (minimum 70% required).`;
          triggerBannerAlert("error", `Cannot submit document that failed AI compliance verification. ${issueText}`);
          setActionLoading(false);
          return;
        }
      }

      const res = await apiFetchJson(`${API_BASE}/ehs/documents`, {
        method: "POST",
        body: payload
      });

      if (res.ok) {
        setShowUploadDoc(false);
        setNewDoc({
          technicianId: String(technicians[0]?.id || "t-1"),
          projectId: "",
          type: "PPE Audit",
          documentTypeId: "",
          fileName: "",
          documentText: "",
          previousVersionId: "",
          expiryDate: ""
        });
        setAiAnalysisResult(null);
        setUploadedFileBase64(null);
        setUploadedFileMimeType(null);
        triggerBannerAlert("success", "Safety Certificate document dispatched into Audit approval chain!");
        await refetchData(["documents", "notifications"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Submission failed");
      }
    } catch {
      triggerBannerAlert("error", "Network submission failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDocument = async (docId: number | string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/ehs/documents/${docId}/approve`, {
        method: "PUT",
        body: {
          userId: user.id,
          comment: approvalComment || "Verified HSE Standard check Passed."
        }
      });

      if (res.ok) {
        const updated = await safeJson(res) as Record<string, unknown>;
        setViewingDoc(null);
        setApprovalComment("");
        triggerBannerAlert("success", `HSE Certified Approval registered! New Status: ${updated?.status}`);
        await refetchData(["documents"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "HSE workflow failed.");
      }
    } catch {
      triggerBannerAlert("error", "Audit network request crash.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = async (docId: number | string) => {
    if (!user) return;
    if (!approvalComment) {
      triggerBannerAlert("error", "You must input a detailed auditing comment/rejection reason first.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/ehs/documents/${docId}/reject`, {
        method: "PUT",
        body: {
          userId: user.id,
          comment: approvalComment
        }
      });

      if (res.ok) {
        setViewingDoc(null);
        setApprovalComment("");
        triggerBannerAlert("warning", `EHS safety documents rejected. Score adjusted on Technician.`);
        await refetchData(["documents"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Rejection action denied.");
      }
    } catch {
      triggerBannerAlert("error", "Remote server network fail.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearBroadcast = async () => {
    try {
      await apiFetch(`${API_BASE}/notifications/clear`, { method: "PUT" });
      triggerBannerAlert("success", "Cleared all dashboard notification badges.");
      await refetchData(["notifications"]);
    } catch (e) {
      console.error(e);
    }
  };

  return {
    handleAiVerificationCheck,
    handleSubmitDocument,
    handleApproveDocument,
    handleRejectDocument,
    handleClearBroadcast
  };
}
