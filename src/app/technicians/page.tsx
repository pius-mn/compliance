"use client";

import { useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { TechniciansView } from "../../views/TechniciansView";
import { apiFetch, apiFetchPage } from "../../utils/apiFetch";
import { usePageParam } from "../../hooks/usePageParam";
import { Role, DocumentType } from "../../types";
import type { TechnicianProfile } from "../../types";
import type { TechnicianDocument } from "../../types";

export default function TechniciansPage() {
  const appState = useApp();
  const {
    user,
    authToken,
    technicians,
    techSearch,
    setTechSearch,
    documents,
    newDoc,
    setNewDoc,
    setShowUploadDoc,
    setActionLoading,
    triggerBannerAlert,
    triggerToast,
    setTechnicians,
    setDocuments,
  } = appState;

  const [techPage, setTechPage] = usePageParam("page", 1);
  const ITEMS_PER_PAGE = 10;

  const fetchTechsPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (techSearch) params.search = techSearch;
    const result = await apiFetchPage<TechnicianProfile>("/api/v1/technicians", techPage || 1, ITEMS_PER_PAGE, params);
    setTechnicians(result.data);
  }, [techPage, techSearch, setTechnicians]);

  // Fetch all documents so the technician details modal can display them
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ehs/documents");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDocuments(data as TechnicianDocument[]);
        }
      }
    } catch {
      // Non-critical — without documents the details modal will show
      // "Not uploaded yet" but no error is thrown to the user.
    }
  }, [setDocuments]);

  useEffect(() => {
    fetchTechsPage();
  }, [fetchTechsPage]);

  // Documents only need to be loaded once on mount, not on every search/page flip
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Re-fetch when search changes (but debounced via the page reset logic in view)
  useEffect(() => {
    setTechPage(1);
  }, [techSearch, setTechPage]);

  const handleAddTechnician = async (tech: Record<string, unknown>) => {
    if (user?.role !== Role.ContractorManager && user?.role !== Role.ContractorEHSOfficer) {
      triggerBannerAlert("error", "Only contractors can add technicians.");
      return;
    }
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...tech,
          role: Role.Technician,
          contractorId: user?.contractorId
        })
      });

      if (res.ok) {
        triggerBannerAlert("success", "Technician added successfully!");
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to add technician");
      }
    } catch {
      triggerBannerAlert("error", "Network error when adding technician");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTechnicianRoles = async (technicianId: number | string, workRoleIds: (number | string)[]) => {
    if (user?.role !== Role.ContractorManager && user?.role !== Role.ContractorEHSOfficer) {
      triggerBannerAlert("error", "Only contractors can update technician roles.");
      return;
    }
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/technicians/${technicianId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ workRoleIds })
      });

      if (res.ok) {
        triggerBannerAlert("success", "Technician roles updated successfully!");
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to update technician roles");
      }
    } catch {
      triggerBannerAlert("error", "Error updating technician roles.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTechnician = async (id: number | string, data: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/technicians/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data)
      });

      if (res.ok) {
        triggerBannerAlert("success", "Technician updated successfully!");
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to update technician");
      }
    } catch {
      triggerBannerAlert("error", "Error updating technician.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTechnician = async (id: number | string) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/technicians/${id}`, {
        method: "DELETE",
        headers
      });

      if (res.ok) {
        triggerToast("success", "Technician deleted successfully!");
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to delete technician");
      }
    } catch {
      triggerBannerAlert("error", "Error deleting technician.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <TechniciansView
      user={user}
      technicians={technicians}
      filteredTechnicians={technicians || []}
      techSearch={techSearch || ""}
      setTechSearch={setTechSearch}
      documents={documents}
      onUpload={(technicianId, docTypeName?: string) => {
        // Resolve documentTypeId from the type name when pre-selected from a work role
        const matchedDt = docTypeName ? (appState.allDocumentTypes as DocumentType[]).find((dt: DocumentType) => dt.name === docTypeName) : null;
        setNewDoc({
          ...newDoc,
          technicianId,
          type: docTypeName || "",
          documentTypeId: matchedDt ? String(matchedDt.id) : "",
        });
        setShowUploadDoc(true);
      }}
      onAddTechnician={handleAddTechnician}
      onUpdateTechnicianRoles={handleUpdateTechnicianRoles}
      onUpdateTechnician={handleUpdateTechnician}
      onDeleteTechnician={handleDeleteTechnician}
      actionLoading={appState.actionLoading}
      allRoles={appState.allRoles}
      allDocumentTypes={appState.allDocumentTypes}
    />
  );
}
