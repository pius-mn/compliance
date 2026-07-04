import React, { useEffect, useState } from "react";
import {
  FileText, Calendar, AlertTriangle, ShieldCheck,
  Search, X, TrendingUp, TrendingDown, BarChart3
} from "lucide-react";
import { User } from "../types";
import { apiFetchJson } from "../utils/apiFetch";

interface EnrichedDailyNote {
  id: number;
  projectId: number;
  projectName: string;
  contractorId: number | null;
  date: string;
  hazard: string;
  solution: string;
  updatedAt: string;
  aiScore: number | null;
  aiMissedItems: string[] | null;
  aiAnalyzedAt: string | null;
}

interface DailyNotesHistoryProps {
  user: User | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DailyNotesHistory: React.FC<DailyNotesHistoryProps> = (_props) => {
  const [notes, setNotes] = useState<EnrichedDailyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score" | "project">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [minScore, setMinScore] = useState<number>(0);
  const [showOnlyAnalyzed, setShowOnlyAnalyzed] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetchJson("/api/v1/daily-notes");
        if (res.ok) {
          const data = await res.json();
          setNotes(Array.isArray(data) ? data : []);
        } else {
          setError("Failed to load daily notes history.");
        }
      } catch {
        setError("Network error loading daily notes.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const filtered = notes
    .filter(n => {
      if (search) {
        const q = search.toLowerCase();
        if (!n.projectName.toLowerCase().includes(q) &&
            !n.hazard.toLowerCase().includes(q) &&
            !n.solution.toLowerCase().includes(q)) return false;
      }
      if (minScore > 0 && (n.aiScore === null || n.aiScore < minScore)) return false;
      if (showOnlyAnalyzed && n.aiScore === null) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = a.date.localeCompare(b.date);
      else if (sortBy === "score") cmp = (a.aiScore ?? -1) - (b.aiScore ?? -1);
      else if (sortBy === "project") cmp = a.projectName.localeCompare(b.projectName);
      return sortDir === "desc" ? -cmp : cmp;
    });

  const avgScore = filtered.length
    ? Math.round(filtered.reduce((s, n) => s + (n.aiScore ?? 0), 0) / filtered.length)
    : 0;
  const analyzedCount = filtered.filter(n => n.aiScore !== null).length;
  const lowScoreCount = filtered.filter(n => n.aiScore !== null && n.aiScore < 50).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8">
        <div className="flex items-center justify-center gap-2 py-12">
          <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading daily notes history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-50 text-indigo-700 rounded border border-indigo-100 uppercase tracking-widest font-mono">
                Management Analysis
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-slate-900 uppercase flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-indigo-600" /> Daily Hazard & Solution Logs
            </h3>
            <p className="text-[10.5px] text-slate-500 max-w-2xl leading-relaxed">
              Complete history of all daily hazard identification and containment solution entries with AI-powered effectiveness ratings across all projects.
            </p>
          </div>
        </div>

        {/* Mini KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Entries</span>
            <p className="text-lg font-black text-slate-900 mt-0.5">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg AI Rating</span>
            <p className={`text-lg font-black mt-0.5 flex items-center gap-1 ${
              avgScore >= 80 ? "text-emerald-600" : avgScore >= 50 ? "text-amber-600" : "text-red-600"
            }`}>
              {analyzedCount > 0 ? `${avgScore}%` : "—"}
              {analyzedCount > 0 && avgScore >= 70 ? <TrendingUp className="w-4 h-4" /> :
               analyzedCount > 0 ? <TrendingDown className="w-4 h-4" /> : null}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">AI Analyzed</span>
            <p className="text-lg font-black text-slate-900 mt-0.5">
              {analyzedCount}
              <span className="text-xs font-medium text-slate-400 ml-1">/ {filtered.length}</span>
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Low Scores (&lt;50)</span>
            <p className={`text-lg font-black mt-0.5 ${lowScoreCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {lowScoreCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, hazards, solutions..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="sm:col-span-2">
          <select
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 font-medium"
          >
            <option value={0}>All Scores</option>
            <option value={30}>≥ 30%</option>
            <option value={50}>≥ 50%</option>
            <option value={70}>≥ 70%</option>
            <option value={80}>≥ 80%</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyAnalyzed}
              onChange={e => setShowOnlyAnalyzed(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] font-semibold text-slate-500">AI analyzed only</span>
          </label>
        </div>

        <div className="sm:col-span-4 flex items-center justify-end gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Sort:</span>
          {(["date", "score", "project"] as const).map(f => (
            <button
              key={f}
              onClick={() => toggleSort(f)}
              className={`px-2 py-1 text-[10px] rounded-lg font-bold transition flex items-center gap-0.5 cursor-pointer ${
                sortBy === f
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {sortBy === f && (sortDir === "desc" ? " ↓" : " ↑")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="p-8 text-center">
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-400">No daily note entries found</p>
          <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
            Start logging hazards and solutions in the Daily Activities tab of any project to populate this analysis view.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
              <tr>
                <th className="p-3 pl-5">Date</th>
                <th className="p-3">Project</th>
                <th className="p-3">Hazard Identified</th>
                <th className="p-3">Containment Solution</th>
                <th className="p-3 text-center">AI Rating</th>
                <th className="p-3">Missing Elements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(note => (
                <tr key={note.id} className="hover:bg-slate-50/40 transition">
                  <td className="p-3 pl-5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(note.date + "T00:00:00").toLocaleDateString("en-KE", {
                        month: "short", day: "numeric", year: "numeric"
                      })}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-slate-800">{note.projectName}</span>
                  </td>
                  <td className="p-3 max-w-[200px]">
                    <div className="flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-slate-600 line-clamp-2 text-[11px]">{note.hazard || "—"}</span>
                    </div>
                  </td>
                  <td className="p-3 max-w-[200px]">
                    <div className="flex items-start gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-slate-600 line-clamp-2 text-[11px]">{note.solution || "—"}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {note.aiScore !== null ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-black ${
                          note.aiScore >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          note.aiScore >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {note.aiScore}%
                        </span>
                        {note.aiAnalyzedAt && (
                          <span className="text-[8px] text-slate-400 font-mono">
                            {new Date(note.aiAnalyzedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="p-3 max-w-[220px]">
                    {note.aiMissedItems && note.aiMissedItems.length > 0 ? (
                      <ul className="space-y-0.5">
                        {note.aiMissedItems.map((item, i) => (
                          <li key={i} className="text-[10px] text-red-600 flex items-start gap-1">
                            <span className="text-red-300 mt-0.5">•</span>
                            <span className="line-clamp-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-[10px] text-slate-400">
        <span>{filtered.length} entry{filtered.length !== 1 ? "ies" : "y"} · {analyzedCount} with AI analysis</span>
        <span>Last updated: {notes.length > 0 ? new Date(notes[0].updatedAt).toLocaleString() : "—"}</span>
      </div>
    </div>
  );
};
