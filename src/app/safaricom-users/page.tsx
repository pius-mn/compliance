"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { SafaricomUsersView } from "../../views/SafaricomUsersView";
import { apiFetchPage } from "../../utils/apiFetch";
import { usePageParam } from "../../hooks/usePageParam";
import { Role } from "../../types";
import type { User } from "../../types";

export default function SafaricomUsersPage() {
  const {
    user,
    authToken,
    newUser,
    setNewUser,
    actionLoading,
    setActionLoading,
    triggerBannerAlert,
    refetchData,
  } = useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [currentPage, setCurrentPage] = usePageParam("page", 1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const ITEMS_PER_PAGE = 10;

  const fetchUsersPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (roleFilter !== "All") {
      params.role = roleFilter;
    } else {
      // When showing all, pass all Safaricom roles so the server filters correctly
      params.role = [
        Role.SafaricomAdmin,
        Role.SafaricomEHSOfficer,
        Role.SafaricomProjectAssigner,
        Role.SafaricomProjectCreator,
      ].join(",");
    }
    const result = await apiFetchPage<User>("/api/v1/users", currentPage, ITEMS_PER_PAGE, params);
    setUsers(result.data);
    setUsersTotal(result.total);
  }, [currentPage, search, roleFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsersPage();
  }, [fetchUsersPage]);

  // Reset to page 1 when search or role filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/users`, {
        method: "POST",
        headers,
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        triggerBannerAlert("success", "User created successfully!");
        setNewUser({ name: "", email: "", role: Role.SafaricomEHSOfficer });
        refetchData(["users"]);
        fetchUsersPage();
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to create user");
      }
    } catch {
      triggerBannerAlert("error", "Error creating user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (id: number | string, data: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data)
      });
      if (res.ok) {
        triggerBannerAlert("success", "User updated successfully!");
        refetchData(["users"]);
        fetchUsersPage();
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to update user");
      }
    } catch {
      triggerBannerAlert("error", "Error updating user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: number | string) => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user && authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        triggerBannerAlert("success", "User deleted successfully!");
        refetchData(["users"]);
        fetchUsersPage();
      } else {
        const err = await res.json().catch(() => ({}));
        triggerBannerAlert("error", err?.error || "Failed to delete user");
      }
    } catch {
      triggerBannerAlert("error", "Error deleting user.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafaricomUsersView
      user={user}
      users={users}
      usersTotal={usersTotal}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      search={search}
      setSearch={setSearch}
      roleFilter={roleFilter}
      setRoleFilter={setRoleFilter}
      itemsPerPage={ITEMS_PER_PAGE}
      newUser={newUser}
      setNewUser={setNewUser}
      actionLoading={actionLoading}
      handleCreateUser={handleCreateUser}
      handleUpdateUser={handleUpdateUser}
      handleDeleteUser={handleDeleteUser}
    />
  );
}
