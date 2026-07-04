import React, { useState } from "react";
import { UserPlus, X, User as UserIcon, Mail, Phone, Briefcase } from "lucide-react";

interface AddTechnicianFormProps {
  onAdd: (tech: { name: string; email: string; phone: string; specialization: string }) => Promise<void>;
  onClose?: () => void;
  actionLoading: boolean;
}

export const AddTechnicianForm: React.FC<AddTechnicianFormProps> = ({ onAdd, onClose, actionLoading }) => {
  const [tech, setTech] = useState({ name: "", email: "", phone: "", specialization: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd(tech);
    setTech({ name: "", email: "", phone: "", specialization: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-150 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300 relative">
      {onClose && (
        <button 
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-all border border-slate-100 bg-white"
        >
          <X size={16} />
        </button>
      )}

      <div>
        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-[#18863A] border border-emerald-100 mb-3">
          <UserPlus size={20} />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          Register New Technician
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Register a field technician to the contracting crew and assign EHS job roles</p>
      </div>
        
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Technician Name</label>
          <div className="relative mt-1">
            <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Full Name"
              value={tech.name} 
              onChange={(e) => setTech({...tech, name: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] transition-all outline-hidden" 
              required 
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Email Address</label>
          <div className="relative mt-1">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="email" 
              placeholder="email@company.com"
              value={tech.email} 
              onChange={(e) => setTech({...tech, email: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] transition-all outline-hidden" 
              required 
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Phone Number</label>
          <div className="relative mt-1">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="tel" 
              placeholder="+254 700 000000"
              value={tech.phone} 
              onChange={(e) => setTech({...tech, phone: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] transition-all outline-hidden" 
              required 
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Specialization / Core Skill</label>
          <div className="relative mt-1">
            <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="e.g. Fibre Splicing, Tower Climbing"
              value={tech.specialization} 
              onChange={(e) => setTech({...tech, specialization: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] transition-all outline-hidden" 
              required 
            />
          </div>
        </div>
      </div>
      
      <button 
        type="submit" 
        disabled={actionLoading} 
        className="w-full py-3.5 bg-[#18863A] hover:bg-[#156e2f] active:scale-99 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#18863A]/10 mt-2"
      >
        {actionLoading ? "Registering..." : "Complete Registration"}
      </button>
    </form>
  );
};

