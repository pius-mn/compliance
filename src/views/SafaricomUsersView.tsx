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

const DISPLAY_ROLES = [
  Role.SafaricomAdmin,
  Role.SafaricomEHSOfficer,
  Role.SafaricomProjectAssigner,
  Role.SafaricomProjectCreator,
];

// --- Shared style tokens & small pieces, so the "name / email / role"
// field trio (used in both the create form and the inline row editor)
// and the role-badge coloring aren't each written out multiple times. ---

const fieldInputClasses =
  "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500";

const fieldSelectClasses = `${fieldInputClasses} cursor-pointer`;

function RoleOptions() {
  return (
    <>
      {DISPLAY_ROLES.map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </>
  );
}

function getRoleBadgeClasses(role: Role) {
  if (role === Role.SafaricomAdmin) {
    return "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400";
  }
  if (role === Role.SafaricomEHSOfficer) {
    return "bg-emerald-50 border-emerald-100 text-[#18863A] dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400";
  }
  return "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400";
}

type EditingData = {
  name: string;
  email: string;
  role: Role;
};

interface UserRowProps {
  emp: User;
  isCurrentUser: boolean;
  canManage: boolean;
  isEditing: boolean;
  editingData: EditingData;
  setEditingData: React.Dispatch<React.SetStateAction<EditingData>>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  actionLoading: boolean;
}

function UserRow({
  emp, isCurrentUser, canManage, isEditing, editingData, setEditingData,
  onStartEdit, onCancelEdit, onSave, onDelete, actionLoading,
}: UserRowProps) {
  return (
    <li className="px-4 sm:px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="sm:flex-[1.3] min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editingData.name}
              onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
              className={fieldInputClasses}
              required
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0">
                {emp.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">{emp.name}</span>
            </div>
          )}
        </div>

        <div className="sm:flex-[1.3] min-w-0 text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
          {isEditing ? (
            <input
              type="email"
              value={editingData.email}
              onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
              className={fieldInputClasses}
              required
            />
          ) : (
            emp.email
          )}
        </div>

        <div className="sm:flex-1 min-w-0">
          {isEditing ? (
            <select
              value={editingData.role}
              onChange={(e) => setEditingData({ ...editingData, role: e.target.value as Role })}
              className={fieldSelectClasses}
            >
              <RoleOptions />
            </select>
          ) : (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-block ${getRoleBadgeClasses(emp.role)}`}>
              {emp.role}
            </span>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-1.5 sm:justify-end shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={onSave}
                  disabled={actionLoading}
                  className="p-1.5 text-[#18863A] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                  title="Save changes"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={onCancelEdit}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : isCurrentUser ? (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic font-medium">Current Active Session</span>
            ) : (
              <>
                <button
                  onClick={onStartEdit}
                  disabled={actionLoading}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-[#18863A] dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center"
                  title="Edit User"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onDelete}
                  disabled={actionLoading}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center"
                  title="Delete User"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

const SafaricomUsersView: React.FC<SafaricomUsersViewProps> = React.memo(function SafaricomUsersView({
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
}) {
  // Editing state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<EditingData>({
    name: "",
    email: "",
    role: Role.SafaricomEHSOfficer
  });

  const isAdmin = user?.role === Role.SafaricomAdmin;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 sm:space-y-8 animate-fade-in bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-rose-100 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-[#18863A]/10 rounded-lg text-[#18863A] text-lg">👥</span>
            Safaricom Internal Users
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage administrative credentials, project managers, and EHS safety review coordinators.
          </p>
        </div>
        <div className="bg-[#18863A]/10 text-[#18863A] dark:text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 shrink-0">
          <ShieldCheck className="w-4 h-4" /> Auth: {user?.role}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">
        {/* Form Column (visible only for admin) */}
        {isAdmin && (
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#18863A] dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">New Safaricom Employee</h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Register internal staff. Technicians from partner vendors should be managed through the Contractors page.
              </p>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="new-user-name" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
                  <input
                    id="new-user-name"
                    name="name"
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className={fieldInputClasses}
                    placeholder="e.g. Amina Hussein"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-user-email" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Email Address</label>
                  <input
                    id="new-user-email"
                    name="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className={fieldInputClasses}
                    placeholder="employee@safaricom.co.ke"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-user-role" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Administrative Role</label>
                  <select
                    id="new-user-role"
                    name="role"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                    className={fieldSelectClasses}
                  >
                    <RoleOptions />
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

        {/* List Column */}
        <div className={isAdmin ? "xl:col-span-8 space-y-4" : "xl:col-span-12 space-y-4"}>
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <input
                id="search-users"
                name="search"
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Filter Role:</span>
              <select
                id="role-filter"
                name="roleFilter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#18863A] focus:border-[#18863A] transition-all cursor-pointer text-slate-900 dark:text-slate-100"
              >
                <option value="All">All Safaricom Roles</option>
                <RoleOptions />
              </select>
            </div>
          </div>

          {/* List container: a responsive card list instead of a table that
              needed horizontal scroll + a fixed min-width on mobile. */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="hidden sm:flex items-center gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <span className="flex-[1.3] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</span>
              <span className="flex-[1.3] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</span>
              <span className="flex-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Administrative Role</span>
              {isAdmin && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-[76px]">Actions</span>
              )}
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(emp => (
                <UserRow
                  key={emp.id}
                  emp={emp}
                  isCurrentUser={emp.id === user?.id}
                  canManage={isAdmin}
                  isEditing={emp.id === editingUserId}
                  editingData={editingData}
                  setEditingData={setEditingData}
                  onStartEdit={() => {
                    setEditingUserId(emp.id);
                    setEditingData({ name: emp.name, email: emp.email, role: emp.role });
                  }}
                  onCancelEdit={() => setEditingUserId(null)}
                  onSave={async () => {
                    if (handleUpdateUser) {
                      await handleUpdateUser(emp.id, editingData);
                      setEditingUserId(null);
                    }
                  }}
                  onDelete={async () => {
                    if (handleDeleteUser && window.confirm(`Are you sure you want to delete ${emp.name}?`)) {
                      await handleDeleteUser(emp.id);
                    }
                  }}
                  actionLoading={actionLoading}
                />
              ))}

              {users.length === 0 && (
                <li className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                  <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  No Safaricom users found matching your search.
                </li>
              )}
            </ul>

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
});

export { SafaricomUsersView };
