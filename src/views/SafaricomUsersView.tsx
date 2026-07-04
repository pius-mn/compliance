import React, { useState } from "react";
import { Role, User } from "../types";
import { Plus, Trash2, Edit2, Check, X, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PaginationControls } from "../components/PaginationControls";

export interface SafaricomUsersViewProps {
  user: User | null;
  users: User[];
  usersTotal: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  roleFilter: string;
  setRoleFilter: React.Dispatch<React.SetStateAction<string>>;
  itemsPerPage: number;
  newUser: { name: string; email: string; role: Role; isCentral?: boolean };
  setNewUser: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  handleCreateUser: (e: React.FormEvent) => void;
  handleUpdateUser?: (id: number, data: Record<string, unknown>) => Promise<void>;
  handleDeleteUser?: (id: number) => Promise<void>;
  actionLoading: boolean;
}

export const SafaricomUsersView: React.FC<SafaricomUsersViewProps> = ({
  user,
  users = [],
  usersTotal,
  currentPage,
  setCurrentPage,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  itemsPerPage,
  newUser,
  setNewUser,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser,
  actionLoading
}) => {
  // Editing state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<{ name: string; email: string; role: Role }>({
    name: "",
    email: "",
    role: Role.SafaricomEHSOfficer
  });

  const displayRoles = [
    Role.SafaricomAdmin,
    Role.SafaricomEHSOfficer,
    Role.SafaricomProjectAssigner,
    Role.SafaricomProjectCreator
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-rose-100 pb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-[#18863A]/10 rounded-lg text-[#18863A] text-lg">👥</span>
            Safaricom Internal Users
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage administrative credentials, project managers, and EHS safety review coordinators.
          </p>
        </div>
        <div className="bg-[#18863A]/10 text-[#18863A] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" /> Auth: {user?.role}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Form Column (visible only for admin) */}
        {user?.role === Role.SafaricomAdmin && (
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#18863A]" />
                <h3 className="text-sm font-bold text-slate-800">New Safaricom Employee</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Register internal staff. Technicians from partner vendors should be managed through the Contractors page.
              </p>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="new-user-name" className="text-[11px] font-semibold text-slate-600">Full Name</label>
                  <input
                    id="new-user-name"
                    name="name"
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all"
                    placeholder="e.g. Amina Hussein"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-user-email" className="text-[11px] font-semibold text-slate-600">Email Address</label>
                  <input
                    id="new-user-email"
                    name="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all"
                    placeholder="employee@safaricom.co.ke"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-user-role" className="text-[11px] font-semibold text-slate-600">Administrative Role</label>
                  <select
                    id="new-user-role"
                    name="role"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all cursor-pointer"
                  >
                    {displayRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-[#18863A] hover:bg-[#156e2f] text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add User
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Table Column */}
        <div className={user?.role === Role.SafaricomAdmin ? "xl:col-span-8 space-y-4" : "xl:col-span-12 space-y-4"}>
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                id="search-users"
                name="search"
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Filter Role:</span>
              <select
                id="role-filter"
                name="roleFilter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all cursor-pointer"
              >
                <option value="All">All Safaricom Roles</option>
                {displayRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table container */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administrative Role</th>
                  {user?.role === Role.SafaricomAdmin && (
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(emp => {
                  const isEditing = emp.id === editingUserId;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            id={`edit-name-${emp.id}`}
                            name="edit-name"
                            type="text"
                            value={editingData.name}
                            onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all"
                            required
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                              {emp.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900 text-xs">{emp.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                        {isEditing ? (
                          <input
                            id={`edit-email-${emp.id}`}
                            name="edit-email"
                            type="email"
                            value={editingData.email}
                            onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all"
                            required
                          />
                        ) : (
                          emp.email
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select
                            id={`edit-role-${emp.id}`}
                            name="edit-role"
                            value={editingData.role}
                            onChange={(e) => setEditingData({ ...editingData, role: e.target.value as Role })}
                            className="px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all cursor-pointer"
                          >
                            {displayRoles.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            emp.role === Role.SafaricomAdmin 
                              ? "bg-rose-50 border-rose-100 text-rose-600" 
                              : emp.role === Role.SafaricomEHSOfficer 
                                ? "bg-emerald-50 border-emerald-100 text-[#18863A]" 
                                : "bg-blue-50 border-blue-100 text-blue-600"
                          }`}>
                            {emp.role}
                          </span>
                        )}
                      </td>
                      {user?.role === Role.SafaricomAdmin && (
                        <td className="px-6 py-4 text-right">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={async () => {
                                  if (handleUpdateUser) {
                                    await handleUpdateUser(emp.id, editingData);
                                    setEditingUserId(null);
                                  }
                                }}
                                disabled={actionLoading}
                                className="p-1 text-[#18863A] hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                title="Save changes"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5 justify-end items-center">
                              {emp.id !== user?.id ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingUserId(emp.id);
                                      setEditingData({ name: emp.name, email: emp.email, role: emp.role });
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 text-slate-400 hover:text-[#18863A] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center"
                                    title="Edit User"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (handleDeleteUser && window.confirm(`Are you sure you want to delete ${emp.name}?`)) {
                                        await handleDeleteUser(emp.id);
                                      }
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-medium pr-2">Current Active Session</span>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === Role.SafaricomAdmin ? 4 : 3} className="px-6 py-12 text-center text-slate-500 text-xs">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      No Safaricom users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <PaginationControls
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalItems={usersTotal}
              itemsPerPage={itemsPerPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
