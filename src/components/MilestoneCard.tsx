import React from "react";
import { 
  X, ShieldCheck, Clock, ChevronDown, ChevronUp, Edit3
} from "lucide-react";
import { Milestone } from "../types";

interface MilestoneCardProps {
  milestone: Milestone;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isActiveGate: boolean;
  canUpdateMilestones: boolean;
  handleUpdateMilestonePrerequisites: (id: number, cleared: string[]) => void;
  handleUpdateMilestoneClearedDependencies?: (id: number, cleared: number[]) => void;
  handleUpdateMilestoneDependencies?: (id: number, dependencies: number[]) => void;
  handleUpdateMilestoneStatus: (id: number, status: Milestone["status"], comments?: string) => void;
  allMilestones: Milestone[];
  milestones: Milestone[];
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  isExpanded,
  onToggleExpand,
  isActiveGate,
  canUpdateMilestones,
  handleUpdateMilestonePrerequisites,
  handleUpdateMilestoneClearedDependencies,
  handleUpdateMilestoneDependencies,
  handleUpdateMilestoneStatus,
  allMilestones,
  milestones,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const m = milestone;

  const milestoneIndex = milestones.findIndex(x => x.id === m.id);
  const isLockedBySubsequent = milestoneIndex !== -1 && milestoneIndex < milestones.length - 1;
  const isCurrentlyEditable = canUpdateMilestones && !isLockedBySubsequent;

  const ehsPrereqs = m.prerequisites || [];
  const depPrereqs = (m.dependencies || []).filter(depId => 
    !milestones.some(x => x.id === depId) && 
    !allMilestones.some(x => x.id === depId)
  );
  const totalPrereqs = ehsPrereqs.length + depPrereqs.length;
  const clearedCount = (m.clearedPrerequisites?.length || 0) + 
    ((m.clearedDependencies || []).filter(d => depPrereqs.includes(d)).length);

  const borderClass = m.status === 'Completed' ? 'border-l-4 border-l-emerald-500' :
                      m.status === 'In Progress' ? 'border-l-4 border-l-amber-500' :
                      m.status === 'Blocked' ? 'border-l-4 border-l-red-500 animate-pulse' :
                      'border-l-4 border-l-slate-300';

  const getStatusBadgeStyles = (status: string) => {
    if (status.startsWith("Blocked")) {
      return "bg-red-50 text-red-700 border-red-100";
    }
    switch (status) {
      case "Planning":
      case "Pending":
      case "Not started":
      case "Not Started":
        return "bg-slate-50 text-slate-600 border-slate-200";
      case "In Progress":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "On Hold":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Blocked":
      case "Delayed":
        return "bg-red-50 text-red-700 border-red-100";
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
    }
  };

  return (
    <div 
      className={`bg-white rounded-xl border border-slate-200/85 transition-all overflow-hidden shadow-xs hover:border-slate-300 ${borderClass} ${
        isActiveGate ? 'ring-1 ring-red-500/15 shadow-xs' : ''
      }`}
    >
      {/* Card Row Summary Info */}
      <div 
        onClick={onToggleExpand}
        className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer select-none"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-slate-900 truncate max-w-[280px]">
              {m.title}
            </h4>
            {isActiveGate && (
              <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded-sm border border-red-100">
                Active Gate
              </span>
            )}
            <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${getStatusBadgeStyles(m.status)}`}>
              {m.status}
            </span>
            {isLockedBySubsequent && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-sm border border-slate-200 flex items-center gap-1 uppercase tracking-wider">
                🔒 Locked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 line-clamp-1">{m.description || "No milestone description provided."}</p>
        </div>

        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-500">Target Date</p>
            <p className="text-xs font-bold text-slate-800">{m.dueDate || "Not Set"}</p>
          </div>
          
          {/* Compliance progress bubble */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-500">Checklist</p>
              <p className="text-xs font-bold text-slate-800">{clearedCount} / {totalPrereqs}</p>
            </div>
            <div className="p-1 hover:bg-slate-50 rounded text-slate-400">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </div>

      {/* Card Expanded Detail Section */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4 bg-slate-50/30 space-y-4">
          {isLockedBySubsequent && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2.5 text-amber-850">
              <span className="text-sm shrink-0">🔒</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Locked Checkpoint</p>
                <p className="text-[10px] font-medium leading-normal mt-0.5 text-amber-700">This milestone is frozen because a subsequent milestone has been added to the rollout. It cannot be edited or updated.</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prerequisites EHS Checklists */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                EHS Compliance & Clearances
              </p>
              
              {(m.prerequisites && m.prerequisites.length > 0) || (depPrereqs.length > 0) ? (
                <div className="space-y-1.5">
                  {m.prerequisites?.map((prereq) => {
                    const isCleared = m.clearedPrerequisites?.includes(prereq);
                    return (
                      <label
                        key={prereq}
                        className="flex items-center gap-2.5 p-2 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-all border border-slate-200/60"
                      >
                        <input
                          type="checkbox"
                          checked={isCleared}
                          disabled={!isCurrentlyEditable}
                          onChange={() => {
                            const currentCleared = m.clearedPrerequisites || [];
                            const updated = isCleared
                              ? currentCleared.filter((p) => p !== prereq)
                              : [...currentCleared, prereq];
                            handleUpdateMilestonePrerequisites(m.id, updated);
                          }}
                          className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                        />
                        <span className={`text-xs font-medium ${isCleared ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {prereq}
                        </span>
                      </label>
                    );
                  })}

                  {depPrereqs.map((depPrereq) => {
                    const isCleared = m.clearedDependencies?.includes(depPrereq);
                    return (
                      <label
                        key={depPrereq}
                        className="flex items-center gap-2.5 p-2 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-all border border-indigo-100"
                        title="Dependency constraint to resolve before proceeding"
                      >
                        <input
                          type="checkbox"
                          checked={isCleared}
                          disabled={!isCurrentlyEditable}
                          onChange={() => {
                            if (handleUpdateMilestoneClearedDependencies) {
                              const currentCleared = m.clearedDependencies || [];
                              const updated = isCleared
                                ? currentCleared.filter((d) => d !== depPrereq)
                                : [...currentCleared, depPrereq];
                              handleUpdateMilestoneClearedDependencies(m.id, updated);
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className={`text-xs font-medium ${isCleared ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          Dependency: <span className="font-semibold text-indigo-600">{depPrereq}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No specific EHS pre-requisites attached to this gateway.</p>
              )}
            </div>

            {/* Dependencies / Status Controls */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                Pre-requisite Blockers
              </p>
              
              {m.dependencies && m.dependencies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {m.dependencies.map((depId) => {
                    const depMilestone = milestones.find((x) => x.id === depId);
                    return (
                      <div
                        key={depId}
                        className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50/50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100"
                      >
                        <span className="truncate max-w-[150px]" title={depMilestone ? depMilestone.title : String(depId)}>
                          {depMilestone ? depMilestone.title : depId}
                        </span>
                        {isCurrentlyEditable && handleUpdateMilestoneDependencies && (
                          <button
                            onClick={() => {
                              const updatedDeps = m.dependencies.filter((id) => id !== depId);
                              handleUpdateMilestoneDependencies(m.id, updatedDeps);
                            }}
                            className="hover:bg-red-50 hover:text-red-600 rounded p-0.5 text-slate-400 transition-colors cursor-pointer"
                            title="Remove dependency"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No external gate blockers configured.</p>
              )}

              {isCurrentlyEditable && handleUpdateMilestoneDependencies && (
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && handleUpdateMilestoneDependencies) {
                        const currentDeps = m.dependencies || [];
                        if (!currentDeps.includes(val)) {
                          handleUpdateMilestoneDependencies(m.id, [...currentDeps, val]);
                        }
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none text-slate-500 hover:bg-slate-50 cursor-pointer appearance-none animate-none"
                  >
                    <option value="" disabled>+ Add Dependency Block</option>
                    {["Rollout Distance Approval", "Way Leave Clearance", "Site Access Permission", "Permits & Regulatory Approval", "Material Procurement Lead Time"]
                      .filter((dep) => !(m.dependencies || []).includes(Number(dep)))
                      .map((dep) => (
                        <option key={dep} value={dep}>
                          {dep}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Status and Notes Logging */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gate Status Dropdown Selector */}
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Set Gate Status</label>
              <select
                value={m.status}
                disabled={!isCurrentlyEditable}
                onChange={(e) => {
                  const nextStatus = e.target.value as Milestone["status"];
                  handleUpdateMilestoneStatus(m.id, nextStatus, m.statusComments || "");
                }}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-700 font-medium focus:border-red-500 focus:ring-1 focus:ring-red-500 cursor-pointer"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>

            {/* Status Change transition logs */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  Transition & Safety Logs
                </label>
                {m.statusComments && (
                  <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">Saved</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 flex">
                  <textarea
                    defaultValue={m.statusComments || ""}
                    disabled={!isEditing}
                    placeholder="Record status updates, safety waivers, or engineering notes..."
                    className={`flex-1 p-2 text-xs text-slate-700 rounded-lg outline-none transition-all h-9 resize-none border ${
                      isEditing 
                        ? "bg-white border-red-500 ring-1 ring-red-500" 
                        : "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                    id={`doc-note-${m.id}`}
                  />
                </div>
                {isCurrentlyEditable && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        if (isEditing) {
                          // Cancel & restore previous comment value
                          const textarea = document.getElementById(`doc-note-${m.id}`) as HTMLTextAreaElement | null;
                          if (textarea) {
                            textarea.value = m.statusComments || "";
                          }
                        }
                        setIsEditing(!isEditing);
                      }}
                      className={`px-3 border rounded-lg text-xs font-bold h-9 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        isEditing 
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300" 
                          : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                      title={isEditing ? "Cancel / Lock Editing" : "Unlock / Edit Log"}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isEditing ? "Lock" : "Edit"}</span>
                    </button>
                    {isEditing && (
                      <button
                        onClick={() => {
                          const textarea = document.getElementById(`doc-note-${m.id}`) as HTMLTextAreaElement | null;
                          if (textarea) {
                            handleUpdateMilestoneStatus(m.id, m.status, textarea.value);
                            setIsEditing(false);
                          }
                        }}
                        className="px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold h-9 transition-colors cursor-pointer flex items-center gap-1 shadow-sm hover:shadow"
                      >
                        <span>Save</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
