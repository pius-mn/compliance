"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { usePageData } from "../../hooks/usePageData";
import { TechniciansView } from "../../views/TechniciansView";
import { apiFetchPage } from "../../utils/apiFetch";
import { usePageParam } from "../../hooks/usePageParam";
import { Role, DocumentType } from "../../types";
import type { TechnicianProfile } from "../../types";

export default function TechniciansPage() {
  const {
    user,
    authToken,
    technicians,
    techSearch,
    setTechSearch,
    contractors,
    documents,
    newDoc,
    setNewDoc,
    setShowUploadDoc,
    setActionLoading,
    triggerBannerAlert,
    triggerToast,
    refetchData,
    setTechnicians,
    fetchEHSDocumentsData,
    ...appState
  } = useApp();

  const [techPage, setTechPage] = usePageParam("page", 1);

  const [techsTotal, setTechsTotal] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const fetchTechsPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (techSearch) params.search = techSearch;
    const result = await apiFetchPage<TechnicianProfile>("/api/v1/technicians", techPage || 1, ITEMS_PER_PAGE, params);
    setTechnicians(result.data);
    setTechsTotal(result.total);
  }, [techPage, techSearch, setTechnicians]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTechsPage();
  }, [fetchTechsPage]);

  // Re-fetch when search changes (but debounced via the page reset logic in view)
  useEffect(() => {
    setTechPage(1);
  }, [techSearch]);

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
        refetchData(["users", "technicians"]);
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
        refetchData(["technicians"]);
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
        refetchData(["technicians"]);
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
        refetchData(["users", "technicians"]);
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

  // Lazy-load supporting data (EHS docs for doc counts in details modal)
  usePageData(fetchEHSDocumentsData);

  return (
    <TechniciansView
      user={user}
      technicians={technicians}
      filteredTechnicians={technicians || []}
      techSearch={techSearch || ""}
      setTechSearch={setTechSearch}
      contractors={contractors}
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
      techsTotal={techsTotal}
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
