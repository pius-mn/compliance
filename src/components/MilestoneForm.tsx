import React from "react";
import { X, Calendar, ClipboardCheck, ChevronDown, Check } from "lucide-react";

interface MilestoneFormProps {
  show: boolean;
  onClose: () => void;
  newMilestone: Record<string, unknown>;
  setNewMilestone: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  handleCreateMilestone: (e: React.FormEvent) => void;
  actionLoading: boolean;
  predefinedMilestones: string[];
  projectName: string;
  milestonesCount: number;
}

export const MilestoneForm: React.FC<MilestoneFormProps> = ({
  show,
  onClose,
  newMilestone,
  setNewMilestone,
  handleCreateMilestone,
  actionLoading,
  predefinedMilestones,
  projectName,
  milestonesCount,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-mobile-bottom">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Top Accent Strip */}
        <div className="h-1 bg-red-600 w-full"></div>

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Add New Milestone</h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Site: <span className="text-slate-600 font-bold">{projectName}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateMilestone} className="p-5 space-y-4">
          {/* Operational Stage Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-red-600" />
              Operational Stage
            </label>
            <div className="relative">
              <select
                value={newMilestone.title as string}
                onChange={(e) => setNewMilestone({...newMilestone, title: e.target.value})}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none appearance-none cursor-pointer pr-10"
                required
              >
                <option value="" disabled>Select predefined stage...</option>
                {(predefinedMilestones || []).slice(milestonesCount, milestonesCount + 1).map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
                {/* Fallback if all are completed or none found */}
                {(predefinedMilestones || []).length <= milestonesCount && (
                  <option value="Custom Site Milestone">Custom Site Milestone</option>
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Target Completion Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-red-600" />
              Target Completion
            </label>
            <input
              type="date"
              value={newMilestone.dueDate as string}
              onChange={(e) => setNewMilestone({...newMilestone, dueDate: e.target.value})}
              className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
              required
            />
          </div>

          {/* Actions Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save Checkpoint
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
