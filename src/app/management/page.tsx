"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import ManagementView from "../../views/ManagementView";

export default function ManagementPage() {
  const appState = useApp();
  const {
    user,
    authToken,
    allRoles,
    allDocumentTypes,
    newRole,
    setNewRole,
    newDocumentType,
    setNewDocumentType,
    actionLoading,
    setActionLoading,
    triggerBannerAlert,
    refetchData,
    ...rest
  } = appState;

  // AI score threshold setting
  const [aiScoreThreshold, setAiScoreThreshold] = useState(50);
  const [thresholdLoading, setThresholdLoading] = useState(true);

  const fetchThreshold = useCallback(async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch(`/api/v1/settings/ai-score-threshold`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAiScoreThreshold(data.threshold);
      }
    } catch {}
    setThresholdLoading(false);
  }, [user, authToken]);

  useEffect(() => {
    fetchThreshold();
  }, [fetchThreshold]);

  const handleUpdateThreshold = useCallback(async (newThreshold: number) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch(`/api/v1/settings/ai-score-threshold`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ threshold: newThreshold }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiScoreThreshold(data.threshold);
        triggerBannerAlert("success", `AI score threshold updated to ${data.threshold}%`);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to update threshold");
      }
    } catch {
      triggerBannerAlert("error", "Network error updating threshold");
    } finally {
      setActionLoading(false);
    }
  }, [user, authToken, triggerBannerAlert, setActionLoading]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/work-roles`, {
        method: "POST",
        headers,
        body: JSON.stringify(newRole)
      });
      if (res.ok) {
        triggerBannerAlert("success", "Work role created successfully!");
        setNewRole({ name: "", documentTypeIds: [] });
        refetchData(["workRoles", "documentTypes"]);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to create role");
      }
    } catch {
      triggerBannerAlert("error", "Error creating work role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (roleId: number | string, name: string, documentTypeIds: (number | string)[]) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/work-roles/${roleId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name, documentTypeIds })
      });
      if (res.ok) {
        triggerBannerAlert("success", "Work role updated successfully!");
        refetchData(["workRoles"]);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to update role");
      }
    } catch {
      triggerBannerAlert("error", "Error updating work role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: number | string) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/work-roles/${roleId}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        triggerBannerAlert("success", "Work role deleted successfully!");
        refetchData(["workRoles"]);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to delete role");
      }
    } catch {
      triggerBannerAlert("error", "Error deleting work role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDocumentType = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/document-types`, {
        method: "POST",
        headers,
        body: JSON.stringify(newDocumentType)
      });
      if (res.ok) {
        triggerBannerAlert("success", "Document type created successfully!");
        setNewDocumentType({ name: "" });
        refetchData(["documentTypes", "workRoles"]);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to create document type");
      }
    } catch {
      triggerBannerAlert("error", "Error creating document type.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateDocumentType = async (dtId: number | string, name: string) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/document-types/${dtId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        triggerBannerAlert("success", "Document type updated successfully!");
        refetchData(["documentTypes"]);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to update document type");
      }
    } catch {
      triggerBannerAlert("error", "Error updating document type.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDocumentType = async (dtId: number | string) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/document-types/${dtId}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        triggerBannerAlert("success", "Document type deleted successfully!");
        refetchData(["documentTypes", "workRoles"]);
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to delete document type");
      }
    } catch {
      triggerBannerAlert("error", "Error deleting document type.");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch work roles + document types once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    appState.fetchWorkRolesData();
    appState.fetchDocumentTypesData();
  }, []);

  return (
    <ManagementView
      user={user}
      {...rest}
      actionLoading={actionLoading}
      allRoles={allRoles || []}
      allDocumentTypes={allDocumentTypes || []}
      newRole={newRole}
      setNewRole={setNewRole}
      newDocumentType={newDocumentType}
      setNewDocumentType={setNewDocumentType}
      handleCreateRole={handleCreateRole}
      handleUpdateRole={handleUpdateRole}
      handleDeleteRole={handleDeleteRole}
      handleCreateDocumentType={handleCreateDocumentType}
      handleUpdateDocumentType={handleUpdateDocumentType}
      handleDeleteDocumentType={handleDeleteDocumentType}
      aiScoreThreshold={aiScoreThreshold}
      onUpdateThreshold={handleUpdateThreshold}
      thresholdLoading={thresholdLoading}
    />
  );
}
