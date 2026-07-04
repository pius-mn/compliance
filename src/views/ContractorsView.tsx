import React, { useState } from "react";
import { User, Contractor, Role } from "../types";
import { Building2, Search, Phone, Mail, Plus, Edit2, Trash2, X } from "lucide-react";
import type { CollectionKey } from "../utils/dataSync";
import { PaginationControls } from "../components/PaginationControls";

export interface ContractorsViewProps {
  user: User | null;
  contractors: Contractor[];
  triggerBannerAlert?: (type: "success" | "error" | "info" | "warning", msg: string) => void;
  refetchData?: (collections: CollectionKey[]) => Promise<void>;
}

export default function ContractorsView(props: ContractorsViewProps) {
  const { user, contractors, triggerBannerAlert, refetchData } = props;
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const initialFormData: Partial<Contractor> = {
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    status: "Active"
  };
  const [formData, setFormData] = useState<Partial<Contractor>>(initialFormData);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredContractors = (contractors || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [search]);

  const paginatedContractors = filteredContractors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleOpenAdd = () => {
    setFormData(initialFormData);
    setEditMode(false);
    setShowModal(true);
  };

  const handleOpenEdit = (c: Contractor) => {
    setFormData(c);
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id: number | string) => {
    if (!window.confirm("Are you sure you want to delete this contractor?")) return;
    try {
      const res = await fetch(`/api/v1/contractors/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${typeof window !== "undefined" ? localStorage.getItem("authToken") || `` : ``}`,
        }
      });
      if (!res.ok) throw new Error("Failed to delete contractor");
      triggerBannerAlert?.("success", "Contractor deleted successfully.");
      await refetchData?.(["contractors"]);
    } catch (err) {
      triggerBannerAlert?.("error", (err as { message?: string }).message || "An error occurred");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.contactPerson) {
      triggerBannerAlert?.("error", "Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const url = editMode ? `/api/v1/contractors/${formData.id}` : "/api/v1/contractors";
      const method = editMode ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${typeof window !== "undefined" ? localStorage.getItem("authToken") || `` : ``}`
        },
        body: JSON.stringify({
          ...formData,
          dateAdded: editMode ? (formData as Record<string, unknown>).dateAdded as string : new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error(`Failed to ${editMode ? "update" : "add"} contractor`);
      triggerBannerAlert?.("success", `Contractor ${editMode ? "updated" : "added"} successfully.`);
      await refetchData?.(["contractors"]);
      setShowModal(false);
    } catch (err) {
      triggerBannerAlert?.("error", (err as { message?: string }).message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const isEditable = user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomEHSOfficer;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50 min-h-0">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Contractor Partners
            </h2>
            <p className="text-sm text-slate-500">Manage third-party contractor agencies and their assignments.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group w-full sm:w-72">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600" />
              <input 
                type="text"
                placeholder="Search contractors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
              />
            </div>
            {isEditable && (
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Contractor
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contractor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Details</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                {isEditable && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedContractors.map(c => {
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 mt-1">Rep: {c.contactPerson}</div>
                    </td>
                    <td className="px-6 py-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {c.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {c.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        c.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                        c.status === "Suspended" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    {isEditable && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedContractors.length === 0 && (
                <tr>
                  <td colSpan={isEditable ? 4 : 3} className="px-6 py-12 text-center text-slate-500 text-sm">
                    <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    No contractor partners found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          <PaginationControls
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalItems={filteredContractors.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 modal-mobile-bottom">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editMode ? "Edit Contractor" : "Add Contractor"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Company / Contractor Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Contact Person</label>
                    <input 
                      type="text" 
                      value={formData.contactPerson} 
                      onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                      className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Phone</label>
                    <input 
                      type="text" 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email Address</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value as "Active" | "Suspended"})}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : editMode ? "Save Changes" : "Add Contractor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
