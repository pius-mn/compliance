import React, { ReactNode } from "react";
import { X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";

interface DrawerProps {
  show: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string; // e.g., "lg:w-[600px]"
}

/**
 * Generic Drawer component for side-sheets and mobile bottom-sheets.
 */
export const Drawer: React.FC<DrawerProps> = ({
  show,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "lg:w-[600px]"
}) => {
  useScrollLock(show);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] transition-opacity duration-500 ${
          show ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div 
        className={`fixed right-0 bottom-0 top-0 w-full ${width} bg-white shadow-2xl z-[210] transition-all duration-500 ease-in-out transform ${
          show ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-y-0 lg:translate-x-full"
        } flex flex-col rounded-t-[32px] lg:rounded-l-[40px] lg:rounded-tr-none overflow-hidden`}
      >
        {/* Top Decorative Bar */}
        <div className="h-1.5 w-full bg-[#E61C24] shrink-0"></div>

        {/* Header */}
        <div className="px-6 py-8 md:px-10 md:py-10 flex items-start justify-between shrink-0">
          <div className="space-y-2">
            <h3 className="text-2xl md:text-3xl font-black text-slate-950 uppercase italic tracking-tighter leading-none">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                {subtitle}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-1 md:px-2 custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 md:p-10 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};
