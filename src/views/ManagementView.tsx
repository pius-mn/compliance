import React, { useState } from "react";
import { Role, User, DocumentType, WorkRole } from "../types";
import { Plus, Trash2, Edit2, Save, X, ShieldCheck, FileText, ListCollapse } from "lucide-react";

export interface ManagementViewProps {
  user: User | null;
  actionLoading: boolean;
  handleCreateRole: (e: React.FormEvent) => void;
  newRole: { name: string; documentTypeIds: (number | string)[] };
  setNewRole: React.Dispatch<React.SetStateAction<{ name: string; documentTypeIds: (number | string)[] }>>;
  allDocumentTypes: DocumentType[];
  handleCreateDocumentType: (e: React.FormEvent) => void;
  newDocumentType: { name: string };
  setNewDocumentType: React.Dispatch<React.SetStateAction<{ name: string }>>;
  
  // New props for CRUD
  allRoles: WorkRole[];
  handleUpdateRole: (roleId: number | string, name: string, documentTypeIds: (number | string)[]) => Promise<void>;
  handleDeleteRole: (roleId: number | string) => Promise<void>;
  handleUpdateDocumentType: (dtId: number | string, name: string) => Promise<void>;
  handleDeleteDocumentType: (dtId: number | string) => Promise<void>;
}

const ManagementView: React.FC<ManagementViewProps> = ({
  user,
  actionLoading,
  handleCreateRole,
  newRole,
  setNewRole,
  allDocumentTypes,
  handleCreateDocumentType,
  newDocumentType,
  setNewDocumentType,
  allRoles,
  handleUpdateRole,
  handleDeleteRole,
  handleUpdateDocumentType,
  handleDeleteDocumentType
}) => {
  // Local state for editing WorkRoles
  const [editingRoleId, setEditingRoleId] = useState<number | string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [editingRoleDocIds, setEditingRoleDocIds] = useState<(number | string)[]>([]);

  // Local state for editing DocumentTypes
  const [editingDocTypeId, setEditingDocTypeId] = useState<number | string | null>(null);
  const [editingDocTypeName, setEditingDocTypeName] = useState("");

  const startEditRole = (role: WorkRole) => {
    setEditingRoleId(role.id);
    setEditingRoleName(role.name);
    setEditingRoleDocIds(role.documentTypeIds || []);
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditingRoleName("");
    setEditingRoleDocIds([]);
  };

  const saveRoleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleId || !editingRoleName.trim()) return;
    await handleUpdateRole(editingRoleId, editingRoleName, editingRoleDocIds);
    cancelEditRole();
  };

  const startEditDocType = (dt: DocumentType) => {
    setEditingDocTypeId(dt.id);
    setEditingDocTypeName(dt.name);
  };

  const cancelEditDocType = () => {
    setEditingDocTypeId(null);
    setEditingDocTypeName("");
  };

  const saveDocTypeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocTypeId || !editingDocTypeName.trim()) return;
    await handleUpdateDocumentType(editingDocTypeId, editingDocTypeName);
    cancelEditDocType();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-rose-100 pb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-[#E61C24]/10 rounded-lg text-[#E61C24] text-lg">⚙️</span>
            Safaricom EHS & Asset Administration
          </h2>
          <p className="text-xs text-slate-500 mt-1">Configure user accounts, technician required EHS roles, and required safety verification documents.</p>
        </div>
        <div className="bg-[#18863A]/10 text-[#18863A] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1">
          <ShieldCheck className="w-4 h-4" /> Auth: {user?.role}
        </div>
      </div>
      
      {/* Primary Layout Block */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Form Column (40% width) */}
        <div className="xl:col-span-5 space-y-8">
          
          {/* Section: Create Work Role */}
          {(user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomEHSOfficer) && (
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E61C24]" />
                <h3 className="text-sm font-bold text-slate-800">Define Job Specialist Roles</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">Establish field roles (e.g., Tower Rigger) and bind they must upload strict safety verification document categories.</p>
              
              <form onSubmit={handleCreateRole} className="space-y-3.5">
                <div className="space-y-1">
                  <label htmlFor="new-role-name" className="text-[11px] font-semibold text-slate-600">Role Specialist ID / Name</label>
                  <input 
                    id="new-role-name"
                    name="name"
                    type="text" 
                    value={newRole.name} 
                    onChange={(e) => setNewRole({...newRole, name: e.target.value})} 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#E61C24] focus:border-[#E61C24] transition-all" 
                    placeholder="e.g. High-Altitude Mast Climber" 
                    required 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 block">Required Certifications / Documents</span>
                  <div className="max-h-36 overflow-y-auto p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2 focus-within:ring-1 focus-within:ring-[#E61C24] focus-within:border-[#E61C24]">
                    {(allDocumentTypes || []).map(dt => (
                      <label key={dt.id} className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={(newRole.documentTypeIds || []).includes(dt.id)} 
                          onChange={(e) => {
                             if (e.target.checked) setNewRole(prev => ({...prev, documentTypeIds: [...(prev.documentTypeIds || []), dt.id] }));
                             else setNewRole(prev => ({...prev, documentTypeIds: (prev.documentTypeIds || []).filter(id => id !== dt.id) }));
                          }} 
                          className="mt-0.5 accent-[#E61C24]"
                        />
                        <span className="text-slate-700 leading-tight">{dt.name}</span>
                      </label>
                    ))}
                    {(allDocumentTypes || []).length === 0 && (
                      <p className="text-slate-400 italic text-center py-2">No document types defined yet. Create document types below first.</p>
                    )}
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={actionLoading || allDocumentTypes.length === 0} 
                  className="w-full bg-[#E61C24] hover:bg-[#c4151c] text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Save New Role Specifications
                </button>
              </form>
            </div>
          )}

          {/* Section: Create Document Type */}
          {(user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomEHSOfficer) && (
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-800">Add Global Safety Document Template</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">Create a certified EHS documentation type to track technician physical assessments or certification cards.</p>
              
              <form onSubmit={handleCreateDocumentType} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="new-doc-type-name" className="text-[11px] font-semibold text-slate-600">Document / Certificate Name</label>
                  <input 
                    id="new-doc-type-name"
                    name="name"
                    type="text" 
                    value={newDocumentType.name} 
                    onChange={(e) => setNewDocumentType({...newDocumentType, name: e.target.value})} 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 transition-all" 
                    placeholder="e.g. CAK Clearance Card" 
                    required 
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={actionLoading} 
                  className="w-full bg-slate-800 hover:bg-slate-950 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save Global Template
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Right Admin Listing & CRUD Column (60% width) */}
        <div className="xl:col-span-7 space-y-8">
          
          {/* List Section: Work/Job Roles with CRUD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <ListCollapse className="w-4.5 h-4.5 text-[#E61C24]" />
                  Active Job Role Configurations ({(allRoles || []).length})
                </h3>
                <p className="text-[10px] text-slate-400">Manage definitions and assigned safety document types.</p>
              </div>
            </div>

            {/* Editing WorkRole Form/Modal Block */}
            {editingRoleId && (
              <form onSubmit={saveRoleUpdate} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-800">Editing Job Specification: {editingRoleId}</span>
                  <button type="button" onClick={cancelEditRole} className="p-1 hover:bg-rose-100 rounded text-rose-800 border-none bg-transparent cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="edit-role-title" className="text-[10px] font-bold text-slate-600">Role Specialist Title</label>
                  <input 
                    id="edit-role-title"
                    name="edit-role-name"
                    type="text" 
                    value={editingRoleName} 
                    onChange={(e) => setEditingRoleName(e.target.value)} 
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-[#E61C24]" 
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-600 block">Required Certificates</span>
                  <div className="max-h-24 overflow-y-auto p-2.5 bg-white border border-slate-200 rounded text-xs space-y-1.5">
                    {(allDocumentTypes || []).map(dt => (
                      <label key={dt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded">
                        <input 
                          type="checkbox" 
                          checked={(editingRoleDocIds || []).includes(dt.id)} 
                          onChange={(e) => {
                            if (e.target.checked) setEditingRoleDocIds(prev => [...(prev || []), dt.id]);
                            else setEditingRoleDocIds(prev => (prev || []).filter(id => id !== dt.id));
                          }} 
                          className="accent-[#E61C24]"
                        />
                        <span className="text-slate-700">{dt.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit" 
                    disabled={actionLoading} 
                    className="flex-1 bg-[#18863A] hover:bg-[#156e2f] text-white py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-none"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                  <button 
                    type="button" 
                    onClick={cancelEditRole} 
                    className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer border-none"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* List of Roles */}
            <div className="space-y-3">
              {(allRoles || []).map(role => {
                // Find required documents names
                const linkedDocs = (role.documentTypeIds || [])
                  .map(id => (allDocumentTypes || []).find(dt => dt.id === id))
                  .filter(Boolean) as DocumentType[];

                return (
                  <div key={role.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-100 transition-colors gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{role.name}</span>
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">{role.id}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {linkedDocs.map(ld => (
                          <span key={ld.id} className="text-[10px] text-[#E61C24] bg-red-50 border border-red-100/60 px-2 py-0.5 rounded-full font-medium">
                            📄 {ld.name}
                          </span>
                        ))}
                        {linkedDocs.length === 0 && (
                          <span className="text-[10px] text-slate-400 italic">No certificates linked yet. Not safe.</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 self-end sm:self-auto shrink-0">
                      <button 
                        onClick={() => startEditRole(role)}
                        className="p-1.5 bg-white text-slate-600 border border-slate-200 hover:text-[#18863A] hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Edit specialist requirements"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-1.5 bg-white text-slate-600 border border-slate-200 hover:text-[#E61C24] hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(allRoles || []).length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-6">No specialist job roles defined in Safaricom EHS database.</p>
              )}
            </div>
          </div>

          {/* List Section: Global Safety Document Types with CRUD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4.5 h-4.5 text-slate-700" />
                  Required Safety Verification Documents ({(allDocumentTypes || []).length})
                </h3>
                <p className="text-[10px] text-slate-400">Configure global document verification files.</p>
              </div>
            </div>

            {/* Editing DocumentType inline Form/Modal Block */}
            {editingDocTypeId && (
              <form onSubmit={saveDocTypeUpdate} className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-3 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Rename Safety Template: {editingDocTypeId}</span>
                  <button type="button" onClick={cancelEditDocType} className="p-1 hover:bg-slate-200 rounded text-slate-600 border-none bg-transparent cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="edit-doc-type-name" className="text-[10px] font-bold text-slate-600">Safety Verification Name</label>
                  <input 
                    id="edit-doc-type-name"
                    name="edit-doc-type-name"
                    type="text" 
                    value={editingDocTypeName} 
                    onChange={(e) => setEditingDocTypeName(e.target.value)} 
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-slate-800" 
                    required 
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    type="submit" 
                    disabled={actionLoading} 
                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-none"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                  <button 
                    type="button" 
                    onClick={cancelEditDocType} 
                    className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer border-none"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* List of Document types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(allDocumentTypes || []).map(dt => (
                <div key={dt.id} className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-100 transition-colors gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{dt.name}</p>
                    <p className="text-[9px] font-mono text-slate-400 mt-0.5">{dt.id}</p>
                  </div>
                  
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={() => startEditDocType(dt)}
                      className="p-1 bg-white text-slate-500 border border-slate-200 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                      title="Rename Document Type"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDocumentType(dt.id)}
                      className="p-1 bg-white text-slate-500 border border-slate-200 hover:text-[#E61C24] hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title="Delete Document Type"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {(allDocumentTypes || []).length === 0 && (
                <p className="col-span-2 text-xs text-slate-400 italic text-center py-6">No EHS Document Templates registered.</p>
              )}
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
};

export default ManagementView;
