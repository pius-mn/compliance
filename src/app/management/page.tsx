"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import ManagementView from "../../views/ManagementView";

export default function ManagementPage() {
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
    ...appState
  } = useApp();

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

  return (
    <ManagementView
      user={user}
      {...appState}
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
    />
  );
}
