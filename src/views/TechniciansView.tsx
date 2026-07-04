import React, { useState } from "react";
import { User, TechnicianProfile, TechnicianDocument, WorkRole, Role, DocumentType, Contractor } from "../types";
import { TechnicianDetails } from "../components/TechnicianDetailsModal";
import { AddTechnicianForm } from "../components/AddTechnicianModal";
import { 
  Plus, 
  Search, 
  Users, 
  ShieldCheck, 
  Activity, 
  ShieldAlert, 
  SlidersHorizontal
} from "lucide-react";
import { PaginationControls } from "../components/PaginationControls";

interface TechniciansViewProps {
  user: User | null;
  technicians: TechnicianProfile[];
  filteredTechnicians: TechnicianProfile[];
  techsTotal: number;
  techSearch: string;
  setTechSearch: React.Dispatch<React.SetStateAction<string>>;
  contractors: Contractor[];
  documents: TechnicianDocument[];
  onUpload: (technicianId: number | string, docTypeName?: string) => void;
  onAddTechnician: (tech: { name: string; email: string; phone: string; specialization: string }) => Promise<void>;
  onUpdateTechnician: (id: number | string, tech: { name: string; email?: string; phone: string; specialization: string }) => Promise<void>;
  onDeleteTechnician: (id: number | string) => Promise<void>;
  actionLoading: boolean;
  allRoles: WorkRole[];
  allDocumentTypes: DocumentType[];
  onUpdateTechnicianRoles: (technicianId: number | string, workRoleIds: (number | string)[]) => Promise<void>;
}

export const TechniciansView: React.FC<TechniciansViewProps> = ({
  user,
  filteredTechnicians,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  techsTotal,
  techSearch,
  setTechSearch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contractors,
  documents,
  onUpload,
  onAddTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  actionLoading,
  allRoles,
  allDocumentTypes,
  onUpdateTechnicianRoles,
}) => {
  // Client-side current time to avoid SSR hydration mismatches from new Date()
  const [currentTime] = useState(() => Date.now());

  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianProfile | null>(null);
  const [showAddTech, setShowAddTech] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter based on role
  const displayTechnicians = React.useMemo(() => {
    const list = filteredTechnicians || [];
    if (user?.role === Role.Technician) {
      return list.filter(t => t.userId === user.id);
    }
    if (statusFilter !== "All") {
      return list.filter(t => t.status === statusFilter);
    }
    return list;
  }, [filteredTechnicians, user, statusFilter]);

  // Reset page when filters change
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [techSearch, statusFilter]);

  const paginatedTechnicians = displayTechnicians.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const canAddTechnician = user?.role === Role.SafaricomAdmin || 
                         user?.role === Role.ContractorManager || 
                         user?.role === Role.ContractorEHSOfficer;

  // Compute dashboard metrics
  const stats = React.useMemo(() => {
    const total = displayTechnicians.length;
    const fullyCompliant = displayTechnicians.filter(t => t.overallEhsScore >= 90).length;
    const actionRequired = displayTechnicians.filter(t => t.status === "EHS Check Needed" || t.overallEhsScore < 75).length;
    const avgScore = total > 0 
      ? Math.round(displayTechnicians.reduce((sum, t) => sum + t.overallEhsScore, 0) / total) 
      : 0;

    return { total, fullyCompliant, actionRequired, avgScore };
  }, [displayTechnicians]);

  // Handle gradient avatars
  const gradients = [
    "from-emerald-500 to-teal-600",
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-amber-600",
  ];

  const getGradient = (id: number | string) => {
    const charCodeSum = String(id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[charCodeSum % gradients.length];
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "EHS Check Needed":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "Suspended":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "On Leave":
        return "bg-slate-50 text-slate-600 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50/40 custom-scrollbar max-w-[1600px] w-full mx-auto">
      {/* Title & Actions Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#18863A] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#18863A] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50">
              Contractor Personnel
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic mt-1.5">
            {user?.role === Role.Technician ? "My Safety Profile" : "Technician Crew"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage safety certifications, compliance standings, and assign active field roles</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user?.role !== Role.Technician && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search technicians..." 
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] transition-all outline-hidden shadow-xs"
              />
            </div>
          )}
          {canAddTechnician && (
            <button 
              onClick={() => setShowAddTech(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#18863A] text-white rounded-xl text-sm font-black hover:bg-[#156e2f] active:scale-95 transition-all shadow-md shadow-[#18863A]/10 cursor-pointer"
            >
              <Plus size={16} /> Register Technician
            </button>
          )}
        </div>
      </div>

      {/* Safety Statistics Summary Dashboard Banner */}
      {user?.role !== Role.Technician && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-50 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Crew</p>
              <h4 className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.total}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border-2 border-slate-50 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Fully Compliant</p>
              <h4 className="text-xl font-extrabold text-[#18863A] mt-0.5">{stats.fullyCompliant}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border-2 border-slate-50 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">At Risk / Review</p>
              <h4 className="text-xl font-extrabold text-rose-600 mt-0.5">{stats.actionRequired}</h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border-2 border-slate-50 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Avg Safety Score</p>
              <h4 className="text-xl font-extrabold text-slate-800 mt-0.5">{stats.avgScore}%</h4>
            </div>
          </div>
        </div>
      )}

      {/* Filter Chips & View Controls */}
      {user?.role !== Role.Technician && (
        <div className="flex items-center gap-2 pb-1 overflow-x-auto">
          <SlidersHorizontal size={14} className="text-slate-400 mr-2 shrink-0" />
          {["All", "Active", "EHS Check Needed", "Suspended", "On Leave"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? "bg-[#18863A] text-white border-[#18863A] shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Technicians Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Technician</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">EHS Score</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Documents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedTechnicians.map(tech => {
              const techGrd = getGradient(tech.id);
              const statusStyle = getStatusStyle(tech.status);
              
              const techDocs = documents.filter(doc => doc.technicianId === tech.id);
              const expiredDocs = techDocs.filter(d => d.expiryDate && currentTime > 0 && new Date(d.expiryDate).getTime() < currentTime);
              const validDocsCount = techDocs.length - expiredDocs.length;

              return (
                <tr 
                  key={tech.id} 
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedTechnician(tech)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${techGrd} flex items-center justify-center text-white font-black text-base shadow-sm uppercase shrink-0`}>
                        {tech.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-[#18863A] transition-colors">{tech.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{tech.specialization}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                      {tech.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${tech.overallEhsScore >= 90 ? "text-[#18863A]" : tech.overallEhsScore >= 75 ? "text-amber-600" : "text-rose-600"}`}>
                        {tech.overallEhsScore}%
                      </span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            tech.overallEhsScore >= 90 ? "bg-[#18863A]" : tech.overallEhsScore >= 75 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${tech.overallEhsScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        {validDocsCount}
                      </span>
                      {expiredDocs.length > 0 && (
                        <span className="flex items-center gap-1 font-medium text-rose-600 ml-2">
                          <ShieldAlert size={14} />
                          {expiredDocs.length}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedTechnicians.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  No technicians found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        <PaginationControls
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalItems={displayTechnicians.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {/* ADD TECHNICIAN MODAL OVERLAY */}
      {showAddTech && canAddTechnician && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[180] flex items-center justify-center p-4 overflow-y-auto modal-mobile-bottom">
          <div className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <AddTechnicianForm
              onAdd={async (tech) => {
                await onAddTechnician(tech);
                setShowAddTech(false);
              }}
              onClose={() => setShowAddTech(false)}
              actionLoading={actionLoading}
            />
          </div>
        </div>
      )}

      {/* TECHNICIAN DETAILS OVERLAY DRAWER SHEET */}
      {selectedTechnician && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[180] flex justify-end items-stretch p-0 md:p-4 overflow-hidden animate-in fade-in duration-200 panel-mobile-bottom">
          <div className="w-full md:max-w-2xl bg-white h-full md:h-[calc(100vh-2rem)] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden lg:animate-in lg:slide-in-from-right lg:duration-300">
            <TechnicianDetails 
              user={user}
              technician={selectedTechnician}
              documents={documents}
              onClose={() => setSelectedTechnician(null)}
              onUpload={onUpload}
              allRoles={allRoles}
              allDocumentTypes={allDocumentTypes}
              onUpdateRoles={onUpdateTechnicianRoles}
              onUpdateTechnician={onUpdateTechnician}
              onDeleteTechnician={onDeleteTechnician}
            />
          </div>
        </div>
      )}
    </div>
  );
};

