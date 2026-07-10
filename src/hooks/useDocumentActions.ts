import React from "react";
import { TechnicianProfile } from "../types";
import { safeJson, getDocStatus } from "../utils/helpers";
import { apiFetch, apiFetchJson } from "../utils/apiFetch";


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
  setDocuments?: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>;
}

export function useDocumentActions(
  states: DocumentActionStates,
  API_BASE: string,
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", msg: string) => void
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
    setActionLoading,
    setDocuments
  } = states;

  const handleAiVerificationCheck = async () => {
    if (!newDoc.documentText && !uploadedFileBase64) {
      triggerBannerAlert("error", "Provide raw, uploaded text data or file upload for the Safety Compliance Auditor Gemini report.");
      return;
    }
    setAiAuditing(true);
    setAiAnalysisResult(null);
    try {
      const matchedTech = (technicians || []).find((t: TechnicianProfile) => String(t.id) === String(newDoc.technicianId));
      const res = await apiFetchJson(`${API_BASE}/ehs/ai-verify`, {
        method: "POST",
        body: {
          documentText: newDoc.documentText,
          type: newDoc.type,
          fileBase64: uploadedFileBase64,
          fileMimeType: uploadedFileMimeType,
          technicianName: matchedTech ? matchedTech.name : "",
          technicianId: newDoc.technicianId,
          fileName: newDoc.fileName,
          documentTypeId: newDoc.documentTypeId,
        }
      });
      if (res.ok) {
        const data = (await safeJson(res)) as Record<string, unknown>;
        setAiAnalysisResult(data);
        
        const verified = data.verifiedByAi as boolean;
        
        if (!verified) {
          triggerBannerAlert("warning", `AI verification failed: ${(data.failureReason as string) || "Document did not pass compliance checks."} Please review before manual submission.`);
        } else if (data.documentInserted) {
          triggerBannerAlert("success", `Document verified & registered! Expiry: ${data.expiryDate || "Not specified"}`);
          // Document was already inserted by the AI verify endpoint
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
        } else {
          triggerBannerAlert("error", (data.documentInsertError as string) || "Document verification passed but registration failed.");
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
        verifiedByAi: (aiAnalysisResult?.verifiedByAi as boolean) || false,
        userId: user?.id,
        expiryDate: aiAnalysisResult?.expiryDate || newDoc.expiryDate || null,
        fileBase64: uploadedFileBase64,
        fileMimeType: uploadedFileMimeType,
      };

      const userRole = user?.role;
      if (userRole === "Field Technician") {
        if (aiAuditing) {
          triggerBannerAlert("error", "AI verification is still in progress. Please wait.");
          setActionLoading(false);
          return;
        }
        if (!aiAnalysisResult || !aiAnalysisResult.verifiedByAi) {
          triggerBannerAlert("error", "Cannot submit document that failed AI compliance verification.");
          setActionLoading(false);
          return;
        }
      }

      const res = await apiFetchJson(`${API_BASE}/ehs/documents`, {
        method: "POST",
        body: payload
      });

      if (res.ok) {
        // Parse the returned document so we can update the local state
        const newDocData = await safeJson(res).catch(() => null) as Record<string, unknown> | null;

        setShowUploadDoc(false);
        setNewDoc({
          technicianId: String(technicians[0]?.id || "t-1"),
          type: "PPE Audit",
          documentTypeId: "",
          fileName: "",
          documentText: "",
          expiryDate: ""
        });
        setAiAnalysisResult(null);
        setUploadedFileBase64(null);
        setUploadedFileMimeType(null);

        // Immediately reflect the new document in the global list
        if (newDocData && setDocuments) {
          setDocuments((prev: Record<string, unknown>[]) => [newDocData, ...prev]);
        }

        triggerBannerAlert("success", "Safety Certificate document dispatched into Audit approval chain!");
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
        triggerBannerAlert("success", `HSE Certified Approval registered! New Status: ${updated ? getDocStatus(updated as { rejected: boolean; contractorApproverId: number | null; centralApproverId: number | null }) : "Unknown"}`);
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
