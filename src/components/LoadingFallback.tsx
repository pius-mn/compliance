interface LoadingFallbackProps {
  message?: string;
}

export default function LoadingFallback({
  message = "Loading...",
}: LoadingFallbackProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-5">
        {/* Spinner */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 border-[3px] border-slate-100 rounded-full" />
          <div className="absolute inset-0 border-[3px] border-transparent border-t-[#E61C24] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-[#E61C24] rounded-full animate-pulse" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
            {message}
          </p>
          {/* Loading dots */}
          <div className="flex items-center justify-center gap-1 mt-3">
            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
