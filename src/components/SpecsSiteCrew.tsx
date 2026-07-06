import React from "react";
import { Plus, X } from "lucide-react";
import { Project, User, Role, Contractor, TechnicianProfile } from "../types";

interface SpecsSiteCrewProps {
  project: Project;
  user: User | null;
  contractors?: Contractor[];
  allUsers: User[];
  technicians: TechnicianProfile[];
  handleUpdateProjectTechnicians?: (projectId: number, assignedTechnicianIds: number[]) => Promise<void>;
  handleAssignProject?: (
    projectId: number,
    updates: {
      contractorId?: number | null;
      projectLeadId?: number | null;
      ehsOfficerId?: number | null;
    }
  ) => Promise<void>;
}

export const SpecsSiteCrew: React.FC<SpecsSiteCrewProps> = ({
  project,
  user,
  contractors,
  allUsers,
  technicians,
  handleUpdateProjectTechnicians,
  handleAssignProject,
}) => {
  const isTechnician = user?.role === Role.Technician;
  const contractorObj = (contractors || []).find(c => c && (c.id === project.contractorId));
  const projectLeadObj = (allUsers || []).find(u => u && u.id === project.projectLeadId);
  const ehsLeadObj = (allUsers || []).find(u => u && u.id === project.ehsOfficerId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-xs space-y-6">
        
        {/* Grid 2-columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Parameters & Partner */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Technical Parameters</h4>
              <div className="space-y-2">
                {!isTechnician && (
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg text-xs">
                    <span className="text-slate-500">Allocated Budget</span>
                    <span className="font-bold text-slate-900">
                      {project.budget ? `KES ${project.budget.toLocaleString()}` : "Unallocated"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg text-xs">
                  <span className="text-slate-500">Rollout Fiber Scope</span>
                  <span className="font-bold text-slate-900">
                    {project.rolloutDistance ? `${project.rolloutDistance} KM` : "0.0 KM"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg text-xs">
                  <span className="text-slate-500">Timeline Scope</span>
                  <span className="font-bold text-slate-900">{project.startDate || "N/A"} to {project.endDate || "N/A"}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assigned Network Partner</h4>
              {contractorObj ? (
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">{contractorObj.name}</span>
                    <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded">Partner</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600 pt-1.5 border-t border-slate-200/60">
                    <div className="flex justify-between"><span>Contact:</span><span className="font-semibold text-slate-800">{contractorObj.contactPerson}</span></div>
                    <div className="flex justify-between"><span>Email:</span><a href={`mailto:${contractorObj.email}`} className="text-red-600 hover:underline">{contractorObj.email}</a></div>
                    <div className="flex justify-between"><span>Phone:</span><span className="font-semibold text-slate-800">{contractorObj.phone}</span></div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No network partner allocated to this site location.</p>
              )}

              {(user?.role === Role.SafaricomProjectAssigner || user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomProjectCreator) && (
                <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-1.5">
                  <label className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Reassign Contractor Partner</label>
                  <select
                    value={project.contractorId || "unassigned"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (handleAssignProject) {
                        const numVal = val === "unassigned" ? null : Number(val);
                        handleAssignProject(project.id, {
                          contractorId: numVal
                        });
                      }
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg p-2 outline-none cursor-pointer transition-all"
                  >
                    <option value="unassigned">Unassigned (None)</option>
                    {(contractors || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Oversight Leaders */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Safaricom Oversight Leaders</h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <div className="w-8 h-8 rounded bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center shrink-0">PL</div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-800">{projectLeadObj?.name || "Unassigned"}</h5>
                    <p className="text-[10px] text-slate-500">Safaricom Project Lead</p>
                  </div>
                </div>

                {(user?.role === Role.SafaricomProjectAssigner || user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomProjectCreator) && (
                  <div className="pl-11 pr-2 pb-1">
                    <select
                      value={project.projectLeadId || "unassigned"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (handleAssignProject) {
                          handleAssignProject(project.id, {
                            projectLeadId: val === "unassigned" ? null : Number(val)
                          });
                        }
                      }}
                      className="w-full text-[11px] bg-slate-50/50 border border-slate-200 rounded px-2 py-1 outline-none cursor-pointer text-slate-600"
                    >
                      <option value="unassigned">Assign Project Lead...</option>
                      {(allUsers || [])
                        .filter(u => u.role === Role.SafaricomProjectCreator || u.role === Role.SafaricomAdmin)
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0">EH</div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-800">{ehsLeadObj?.name || "Unassigned"}</h5>
                    <p className="text-[10px] text-slate-500">Safaricom EHS Officer</p>
                  </div>
                </div>

                {(user?.role === Role.SafaricomProjectAssigner || user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomProjectCreator) && (
                  <div className="pl-11 pr-2 pb-1">
                    <select
                      value={project.ehsOfficerId || "unassigned"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (handleAssignProject) {
                          handleAssignProject(project.id, {
                            ehsOfficerId: val === "unassigned" ? null : Number(val)
                          });
                        }
                      }}
                      className="w-full text-[11px] bg-slate-50/50 border border-slate-200 rounded px-2 py-1 outline-none cursor-pointer text-slate-600"
                    >
                      <option value="unassigned">Assign EHS Officer...</option>
                      {(allUsers || [])
                        .filter(u => u.role === Role.SafaricomEHSOfficer || u.role === Role.SafaricomAdmin)
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Active Site Crew & Roster */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authorized Crew & Technicians</h4>
                {(user?.role === Role.ContractorManager || user?.role === Role.ContractorEHSOfficer) && (
                  <div className="relative">
                    <select
                      value=""
                      onChange={(e) => {
                        const techId = Number(e.target.value);
                        if (!isNaN(techId) && handleUpdateProjectTechnicians) {
                          const currentIds = project.assignedTechnicianIds || [];
                          const updated = [...currentIds, techId];
                          handleUpdateProjectTechnicians(project.id, updated);
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer pr-6 appearance-none outline-none text-slate-500"
                    >
                      <option value="" disabled>+ Authorize Crew</option>
                      {(technicians || [])
                        .filter(t => t && !(project.assignedTechnicianIds || []).includes(t.id) && t.overallEhsScore === 100)
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} (HSE: {t.overallEhsScore}%)
                          </option>
                        ))}
                    </select>
                    <Plus className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                )}
              </div>

              {((technicians || []).filter(t => t && (project.assignedTechnicianIds || []).includes(t.id))).length === 0 ? (
                <div className="p-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center">
                  <p className="text-xs font-semibold text-slate-400">No Authorized Crew</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Authorize qualified technicians to perform site deployment activities.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {((technicians || []).filter(t => t && (project.assignedTechnicianIds || []).includes(t.id))).map(t => {
                    const isCompliant = t.overallEhsScore >= 70;
                    return (
                      <div key={t.id} className="bg-slate-50/50 p-2 rounded-lg border border-slate-200/50 flex items-center justify-between hover:bg-slate-50 hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isCompliant ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'
                          }`}>
                            {t.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-bold text-slate-900 truncate">{t.name}</h5>
                            <span className={`text-[9px] font-semibold px-1 rounded ${
                              isCompliant ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                            }`}>
                              HSE: {t.overallEhsScore}%
                            </span>
                          </div>
                        </div>
                        
                        {(user?.role === Role.ContractorManager || user?.role === Role.ContractorEHSOfficer) && (
                          <button
                            onClick={() => {
                              if (handleUpdateProjectTechnicians) {
                                const currentIds = project.assignedTechnicianIds || [];
                                const updated = currentIds.filter(id => id !== t.id);
                                handleUpdateProjectTechnicians(project.id, updated);
                              }
                            }}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all cursor-pointer"
                            title="De-authorize Crew Member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
