import React from "react";
import { X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";

export interface PhotoLightboxProps {
  /** Image source URL (can be base64 or path) */
  src: string;
  /** Called when the user closes the lightbox */
  onClose: () => void;
  /** Alt text for the image */
  alt?: string;
  /** Optional content rendered below the image (metadata, caption, etc.) */
  children?: React.ReactNode;
}

/**
 * Reusable full-screen lightbox for image previews.
 * Features:
 * - Dark backdrop with blur
 * - Scroll lock while open
 * - Close button (X) top-right
 * - Click-outside-to-close
 * - Centred image with max-width/max-height constraints
 * - Optional children rendered below the image for metadata
 */
export function PhotoLightbox({ src, onClose, alt = "Image preview", children }: PhotoLightboxProps) {
  useScrollLock(true);

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-xs z-[300] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-2.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer z-10"
      >
        <X className="w-5 h-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl object-contain border border-white/10"
        onClick={(e) => e.stopPropagation()}
      />
      {children && (
        <div className="mt-4 text-center max-w-lg text-white space-y-1" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}
