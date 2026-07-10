import React from "react";
import { 
  Search, Plus, ArrowUpDown 
} from "lucide-react";
import { Project, Contractor } from "../types";
import { highlightText } from "../utils/ui";
import { safeNumber } from "../utils/helpers";
import { PaginationControls } from "./PaginationControls";
import { TOTAL_MILESTONES } from "../lib/constants";

// Derive milestone display label from milestonesCount (avoids needing allMilestones fetch)
function getMilestoneStatusLabel(mc: { total: number; completed: number } | undefined): string {
  if (!mc || mc.total === 0) return "Not Started";
  if (mc.completed >= mc.total) return "All Complete";
  if (mc.completed > 0) return "In Progress";
  return "Pending";
}

function getMilestoneStatusBadge(mc: { total: number; completed: number } | undefined): string {
  if (!mc || mc.total === 0) return "Pending";
  if (mc.completed >= mc.total) return "Completed";
  if (mc.completed > 0) return "In Progress";
  return "Pending";
}

interface ProjectListProps {
  projectSearch: string;
  setProjectSearch: (search: string) => void;
  projectPage: number;
  setProjectPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (count: number) => void;
  filteredProjects: Project[];
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  contractors: Contractor[];
  onAddProject: () => void;
  showAddButton?: boolean;
  handleExportProjects?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projectSearch,
  setProjectSearch,
  projectPage,
  setProjectPage,
  itemsPerPage,
  setItemsPerPage,
  filteredProjects,
  selectedProjectId,
  setSelectedProjectId,
  contractors = [],
  onAddProject,
  showAddButton = true,
  handleExportProjects
}) => {
  // Local sorting state
  const [sortField, setSortField] = React.useState<"name" | "contractor" | "milestone" | "progress" | null>("name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "contractor" | "milestone" | "progress") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort filtered list
  const sortedProjects = React.useMemo(() => {
    const list = [...(filteredProjects || [])];
    if (!sortField) return list;

    return list.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortField === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (sortField === "contractor") {
        const cA = (contractors || []).find(c => c.id === a.contractorId)?.name || "";
        const cB = (contractors || []).find(c => c.id === b.contractorId)?.name || "";
        valA = cA.toLowerCase();
        valB = cB.toLowerCase();
      } else if (sortField === "milestone") {
        valA = getMilestoneStatusLabel(a.milestonesCount);
        valB = getMilestoneStatusLabel(b.milestonesCount);
      } else if (sortField === "progress") {
        valA = a.milestonesCount?.completed ?? 0;
        valB = b.milestonesCount?.completed ?? 0;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortField, sortDirection, contractors]);

  // Paginate sorted list locally
  const localPaginatedProjects = React.useMemo(() => {
    const start = (projectPage - 1) * itemsPerPage;
    return sortedProjects.slice(start, start + itemsPerPage);
  }, [sortedProjects, projectPage, itemsPerPage]);

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
      {/* Header Search Area */}
      <div className="p-5 md:p-6 space-y-4 bg-white shrink-0 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Site Registry</h3>
            <p className="text-xs text-slate-400 font-medium">Manage deployment metrics, milestones, and EHS clearance</p>
          </div>
            <div className="flex items-center gap-2">
              {handleExportProjects && (
                <button
                  onClick={handleExportProjects}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg flex items-center gap-2 hover:bg-slate-200 transition-all text-xs font-bold shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  Export Data
                </button>
              )}
              {showAddButton && (
                <button
                  onClick={onAddProject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 transition-all text-xs font-bold shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  Initialize Site
                </button>
              )}
            </div>
        </div>
        
        <div className="relative group max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search network sites by name or region..."
            value={projectSearch}
            onChange={(e) => {
              setProjectSearch(e.target.value);
              setProjectPage(1);
            }}
            className="w-full text-xs pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-400 outline-none transition-all"
          />
        </div>
      </div>

      {/* List Area */}
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {/* Simple Table Layout */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead className="bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 backdrop-blur-xs border-b border-slate-100 z-10">
              <tr>
                <th className="p-4 pl-6 cursor-pointer hover:text-red-600 transition-colors select-none w-[30%]" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">
                    Site Name
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:text-red-600 transition-colors select-none w-[22%]" onClick={() => handleSort("contractor")}>
                  <div className="flex items-center gap-1">
                    Contractor
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:text-red-600 transition-colors select-none w-[28%]" onClick={() => handleSort("milestone")}>
                  <div className="flex items-center gap-1">
                    Current Milestone
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4 pr-6 cursor-pointer hover:text-red-600 transition-colors select-none w-[20%]" onClick={() => handleSort("progress")}>
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {localPaginatedProjects.map((p) => {
                const isSelected = selectedProjectId === (p.id as number);
                const totalM = TOTAL_MILESTONES;
                const completedM = p.milestonesCount?.completed ?? 0;
                const progressPct = totalM > 0 ? Math.min(100, Math.round((completedM / totalM) * 100)) : 0;
                
                const projectContractor = (contractors || []).find(c => c.id === p.contractorId);

                // Derive milestone status from milestonesCount (avoids needing allMilestones fetch)
                const currentMilestoneTitle = getMilestoneStatusLabel(p.milestonesCount);
                const currentMilestoneStatus = getMilestoneStatusBadge(p.milestonesCount);

                return (
                  <tr 
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`group cursor-pointer transition-colors hover:bg-slate-50/40 ${
                      isSelected ? "bg-red-50/20" : ""
                    }`}
                  >
                    {/* Site Name */}
                    <td className="p-4 pl-6 truncate">
                      <div className="flex items-start gap-3 truncate">
                        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                          progressPct === 100 ? "bg-emerald-500" : "bg-red-500"
                        }`} />
                        <div className="space-y-0.5 truncate">
                          <span className={`text-slate-900 font-bold text-xs group-hover:text-red-600 transition-colors block truncate ${isSelected ? "text-red-600" : ""}`}>
                            {highlightText(p.name, projectSearch)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate block">
                            {projectContractor?.name || "Unassigned Region"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contractor */}
                    <td className="p-4 truncate">
                      {projectContractor ? (
                        <div className="space-y-0.5 truncate">
                          <span className="text-xs font-bold text-slate-700 block truncate">
                            {projectContractor.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {projectContractor.contactPerson}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unassigned Partner</span>
                      )}
                    </td>

                    {/* Current Milestone */}
                    <td className="p-4 truncate">
                      <div className="space-y-1 truncate">
                        <span className="font-bold text-slate-700 block truncate" title={currentMilestoneTitle}>
                          {currentMilestoneTitle}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                          currentMilestoneStatus === "Completed" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : currentMilestoneStatus === "In Progress"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : currentMilestoneStatus === "Blocked"
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {currentMilestoneStatus}
                        </span>
                      </div>
                    </td>

                    {/* Status (completed milestone/12 in %) */}
                    <td className="p-4 pr-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-800 font-bold">
                            {completedM} / {totalM}
                          </span>
                          <span className={`font-black ${progressPct >= 100 ? "text-emerald-600" : "text-slate-600"}`}>
                            {progressPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              progressPct >= 100 ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            style={{ width: `${progressPct}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProjects.length === 0 && (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active sites found</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">Try refining your search terms or verify that your safety logs are updated.</p>
          </div>
        )}
      </div>

      {/* Pagination Area */}
      {filteredProjects.length > 0 && (
        <PaginationControls
          currentPage={projectPage}
          setCurrentPage={setProjectPage}
          totalItems={sortedProjects.length}
          itemsPerPage={itemsPerPage}
          label="entries"
          className="bg-white"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
            <span className="opacity-70">Show:</span>
            <select 
              value={itemsPerPage} 
              onChange={(e) => {
                setItemsPerPage(safeNumber(e.target.value));
                setProjectPage(1);
              }}
              className="bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-bold outline-none px-2 py-1 cursor-pointer transition-colors text-sm"
            >
              {[5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </PaginationControls>
      )}
    </div>
  );
};
