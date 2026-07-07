import React, { useState, useMemo, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Camera,
  Plus,
  AlertTriangle,
  ShieldCheck,
  Image as ImageIcon,
  Calendar,
  Eye,
  Trash2,
  Save,
  type LucideIcon,
} from "lucide-react";
import { SitePhoto, User, Role, Project } from "../types";
import { apiFetchJson } from "../utils/apiFetch";

interface DailyActivitiesProps {
  project: Project;
  user: User | null;
  sitePhotos: SitePhoto[];
  deleteSitePhoto: (id: number) => void;
  setLightboxPhoto: (photo: SitePhoto | null) => void;
  actualRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function getActivityLevel(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

// --- Lookup maps over inline ternary chains. Each includes a dark: pairing
// so the two themes stay defined in one place instead of drifting apart. ---

const LEVEL_COLORS: Record<number, string> = {
  0: "bg-slate-100 dark:bg-slate-800",
  1: "bg-emerald-200 dark:bg-emerald-900/70",
  2: "bg-emerald-400 dark:bg-emerald-700",
  3: "bg-emerald-600 dark:bg-emerald-500",
};

function getAiScoreClasses(score: number) {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  if (score >= 50) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
}

function getPhotoSrc(photo: SitePhoto): string {
  return photo.photoData || ((photo as unknown as Record<string, unknown>).url as string) || "";
}

interface DayActivity {
  date: string;
  dateObj: Date;
  photos: SitePhoto[];
  hazard: string;
  solution: string;
}

interface CalendarDay {
  date: string;
  dateObj: Date;
  activity: DayActivity | null;
}

// --- Shared request helper. Every call site previously repeated its own
// try/catch + res.ok + res.json() dance; centralizing it here means new
// endpoints cost one line instead of six, and failures are handled the
// same way everywhere (return null, let the caller supply a fallback). ---

async function apiRequest<T = unknown>(
  url: string,
  options?: { method?: string; body?: unknown }
): Promise<T | null> {
  try {
    const res = await apiFetchJson(url, options);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface DailyNotesResponse {
  hazard?: string;
  solution?: string;
  aiScore?: number | null;
  aiMissedItems?: string[] | null;
}

interface AnalyzeResponse {
  score: number | null;
  missedItems: string[] | null;
}

// --- Single contribution-graph cell, memoized. Without this, every re-render
// of the parent (e.g. a keystroke in the hazard/solution textareas) rebuilds
// all 28 day buttons even though none of their derived data changed. ---

interface DayCellProps {
  day: CalendarDay;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
}

const DayCell = React.memo(function DayCell({ day, isToday, isSelected, onSelect }: DayCellProps) {
  const hasNotes = !!(day.activity?.hazard || day.activity?.solution);
  const photoCount = day.activity ? day.activity.photos.length : 0;
  const activityScore = photoCount + (hasNotes ? 1 : 0);
  const level = getActivityLevel(activityScore);

  return (
    <button
      onClick={() => onSelect(day.date)}
      title={`${day.date}${photoCount > 0 ? ` - ${photoCount} photo(s)` : ""}${hasNotes ? " - Hazards logged ⚠️" : " - No activity"}`}
      className={`w-4 h-4 rounded-sm ${LEVEL_COLORS[level]} border transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-red-400 hover:ring-offset-1 dark:hover:ring-offset-slate-950 ${
        isSelected
          ? "ring-2 ring-red-500 ring-offset-1 dark:ring-offset-slate-950 scale-110"
          : isToday && activityScore === 0
            ? "border-red-300 dark:border-red-500/60 border-dashed"
            : "border-slate-200/50 dark:border-slate-700/50"
      }`}
    />
  );
});

// --- The "Last 28 Days" contribution graph, extracted so its own memoized
// DayCells (and the weeks/legend markup around them) don't get rebuilt as
// part of the much larger Daily Activities render tree. ---

interface ContributionGraphProps {
  weeks: CalendarDay[][];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const ContributionGraph = React.memo(function ContributionGraph({ weeks, selectedDate, onSelectDate }: ContributionGraphProps) {
  const today = todayKey();

  return (
    <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Last 28 Days Activity
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span>Less</span>
          {[0, 1, 2, 3].map((level) => (
            <div key={level} className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[level]} border border-slate-200/50 dark:border-slate-700/50`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-fit">
          {/* Day labels column */}
          <div className="flex flex-col gap-1 pr-2 pt-0">
            {[0, 2, 4].map((rowIdx) => (
              <div key={rowIdx} className="h-4 flex items-center">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">{DAY_NAMES[rowIdx]}</span>
              </div>
            ))}
          </div>

          {/* Weeks grid */}
          <div className="flex gap-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {/* Month label for first column of each month */}
                {week[0] && week[0].dateObj.getDate() <= 7 && (
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium pb-0.5 block">
                    {MONTH_NAMES[week[0].dateObj.getMonth()]}
                  </span>
                )}
                {week.map((day) => (
                  <DayCell
                    key={day.date}
                    day={day}
                    isToday={day.date === today}
                    isSelected={day.date === selectedDate}
                    onSelect={onSelectDate}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- Small shared spinner + label, used for the photos-loading state and
// the AI-analyzing button state so the markup and timing read the same. ---

const SpinnerLabel = React.memo(function SpinnerLabel({ label }: { label: string }) {
  return (
    <div className="pt-4 flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{label}</span>
    </div>
  );
});

// --- Generic empty-state block, reused wherever a section has nothing to
// show yet, so copy/icon are the only things that vary between call sites. ---

const EmptyState = React.memo(function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 text-center space-y-2 bg-white dark:bg-slate-900">
      <Icon className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">{description}</p>
    </div>
  );
});

// --- Hazard/solution textareas are identical apart from color, icon, label
// and placeholder — a single variant-driven component replaces two nearly
// duplicate JSX blocks and one lookup map replaces the duplicated classNames. ---

type NoteVariant = "hazard" | "solution";

const NOTE_FIELD_CONFIG: Record<
  NoteVariant,
  { label: string; icon: LucideIcon; placeholder: string; labelClass: string; fieldClass: string }
> = {
  hazard: {
    label: "Hazards Identified",
    icon: AlertTriangle,
    placeholder: "Describe any hazards, risks, or safety concerns observed on site today...",
    labelClass: "text-amber-700 dark:text-amber-400",
    fieldClass:
      "bg-amber-50/30 border-amber-200 focus:border-amber-500 dark:bg-amber-500/10 dark:border-amber-500/30 dark:focus:border-amber-400",
  },
  solution: {
    label: "Containment Solutions Applied",
    icon: ShieldCheck,
    placeholder: "Describe the corrective actions and containment measures implemented...",
    labelClass: "text-emerald-700 dark:text-emerald-400",
    fieldClass:
      "bg-emerald-50/30 border-emerald-200 focus:border-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:focus:border-emerald-400",
  },
};

interface NoteFieldProps {
  variant: NoteVariant;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const NoteField = React.memo(function NoteField({ variant, value, onChange, disabled }: NoteFieldProps) {
  const cfg = NOTE_FIELD_CONFIG[variant];
  const Icon = cfg.icon;
  return (
    <div className="space-y-1">
      <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cfg.labelClass}`}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </label>
      <textarea
        placeholder={cfg.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full p-3 text-xs border rounded-lg outline-none transition-all h-20 resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed ${cfg.fieldClass}`}
      />
    </div>
  );
});

// --- Single site-photo tile, memoized. Previously inline in the grid map,
// so typing in either textarea (state on the parent) re-rendered every
// photo tile, including its hover overlay and preview-image element. ---

interface PhotoCardProps {
  photo: SitePhoto;
  isLoaded: boolean;
  canEdit: boolean;
  onLoad: (id: number) => void;
  onView: (photo: SitePhoto) => void;
  onDelete: (id: number) => void;
}

const PhotoCard = React.memo(function PhotoCard({ photo, isLoaded, canEdit, onLoad, onView, onDelete }: PhotoCardProps) {
  return (
    <div className="group bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col">
      <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
        {isLoaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPhotoSrc(photo)}
            alt="Site photo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-2 text-center space-y-1">
            <ImageIcon className="w-5 h-5 text-slate-500" />
            <p className="text-[9px] text-slate-400">Preview hidden</p>
            <button
              onClick={() => onLoad(photo.id)}
              className="px-2 py-0.5 bg-red-600/90 hover:bg-red-600 text-white rounded text-[9px] font-bold transition-all cursor-pointer"
            >
              Load
            </button>
          </div>
        )}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5">
          <button
            onClick={() => { onLoad(photo.id); onView(photo); }}
            className="p-1.5 bg-white text-slate-800 rounded-lg hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canEdit && (
            <button
              onClick={() => onDelete(photo.id)}
              className="p-1.5 bg-white text-red-600 rounded-lg hover:bg-red-50 shadow-xs transition-all cursor-pointer"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-2 text-[9px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
        <span className="truncate">{photo.uploadedByUserName}</span>
        <span>{new Date(photo.uploadDate).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
});

// --- Parses a photo's description JSON exactly once (previously parsed
// twice per photo: once for the date, once for hazard/solution). ---

function parsePhotoMeta(ph: SitePhoto): { date: string; hazard?: string; solution?: string } {
  let date = "";
  let hazard: string | undefined;
  let solution: string | undefined;

  if (ph.description && ph.description.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(ph.description);
      if (parsed.date) date = parsed.date;
      if (parsed.hazard) hazard = parsed.hazard;
      if (parsed.solution) solution = parsed.solution;
    } catch {
      // malformed JSON in description — fall through to uploadDate below
    }
  }
  if (!date) {
    date = ph.uploadDate ? ph.uploadDate.split("T")[0] : "";
  }
  return { date, hazard, solution };
}

export const DailyActivities: React.FC<DailyActivitiesProps> = ({
  project,
  user,
  sitePhotos,
  deleteSitePhoto,
  setLightboxPhoto,
  actualRef,
}) => {
  const canEdit = user?.role !== Role.Technician;

  // Build activity map grouped by date (from description JSON or uploadDate)
  const activityMap = useMemo(() => {
    const map = new Map<string, DayActivity>();
    const projectPhotos = (sitePhotos || []).filter((ph) => ph && ph.projectId === project.id);

    for (const ph of projectPhotos) {
      const { date: dateKey, hazard, solution } = parsePhotoMeta(ph);
      if (!dateKey) continue;

      let entry = map.get(dateKey);
      if (!entry) {
        entry = { date: dateKey, dateObj: new Date(dateKey), photos: [], hazard: "", solution: "" };
        map.set(dateKey, entry);
      }
      entry.photos.push(ph);
      if (hazard) entry.hazard = hazard;
      if (solution) entry.solution = solution;
    }
    return map;
  }, [sitePhotos, project.id]);

  // Selected date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today or the most recent activity date
    const today = todayKey();
    if (activityMap.has(today)) return today;
    const dates = Array.from(activityMap.keys()).sort().reverse();
    return dates[0] || today;
  });

  // Hazard/solution input state for the selected day
  const [hazardInput, setHazardInput] = useState("");
  const [solutionInput, setSolutionInput] = useState("");

  // AI analysis state
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiMissedItems, setAiMissedItems] = useState<string[] | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Photos loaded per-date from the API (same as notes)
  const [currentDayPhotos, setCurrentDayPhotos] = useState<SitePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  // Photo preview loading state
  const [loadedPrevs, setLoadedPrevs] = useState<Record<string, boolean>>({});

  // Sync inputs when selected date changes — load notes AND photos from the
  // server concurrently. An `ignore` flag guards against race conditions:
  // if the user flips through dates quickly, a slow response for a stale
  // date can no longer clobber the state for whatever date is now selected.
  useEffect(() => {
    let ignore = false;
    const day = activityMap.get(selectedDate);

    (async () => {
      const data = await apiRequest<DailyNotesResponse>(
        `/api/v1/daily-notes?projectId=${project.id}&date=${selectedDate}`
      );
      if (ignore) return;
      setHazardInput(data?.hazard ?? day?.hazard ?? "");
      setSolutionInput(data?.solution ?? day?.solution ?? "");
      setAiScore(data?.aiScore ?? null);
      setAiMissedItems(data?.aiMissedItems ?? null);
    })();

    (async () => {
      setPhotosLoading(true);
      const data = await apiRequest<SitePhoto[]>(
        `/api/v1/site-photos?projectId=${project.id}&date=${selectedDate}`
      );
      if (ignore) return;
      setCurrentDayPhotos(Array.isArray(data) ? data : day?.photos || []);
      setPhotosLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, [selectedDate, activityMap, project.id]);

  // Generate last 28 days (4 weeks) for the graph
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    // Start from 27 days ago to get 28 days total
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      days.push({ date: dateKey, dateObj: d, activity: activityMap.get(dateKey) || null });
    }
    return days;
  }, [activityMap]);

  // Organize into weeks (groups of 7 days)
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Current selected day data — use per-date fetched photos instead of prop-filtered
  const selectedDay = activityMap.get(selectedDate);
  const selectedDateObj = useMemo(() => new Date(selectedDate), [selectedDate]);
  const displayPhotos = currentDayPhotos.length > 0 ? currentDayPhotos : selectedDay?.photos || [];

  const handleMarkPhotoLoaded = useCallback((id: number) => {
    setLoadedPrevs((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const handleViewPhoto = useCallback(
    (photo: SitePhoto) => {
      setLightboxPhoto(photo);
    },
    [setLightboxPhoto]
  );

  const handleSaveNotes = useCallback(async () => {
    if (!hazardInput?.trim() && !solutionInput?.trim()) return;
    setAiAnalyzing(true);

    const analysis = await apiRequest<AnalyzeResponse>(`/api/v1/daily-notes/analyze`, {
      method: "POST",
      body: { hazard: hazardInput, solution: solutionInput },
    });
    setAiScore(analysis?.score ?? null);
    setAiMissedItems(analysis?.missedItems ?? null);

    const saved = await apiRequest(`/api/v1/daily-notes`, {
      method: "PUT",
      body: {
        projectId: project.id,
        date: selectedDate,
        hazard: hazardInput,
        solution: solutionInput,
        aiScore: analysis?.score ?? null,
        aiMissedItems: analysis?.missedItems ?? null,
      },
    });

    setAiAnalyzing(false);

    if (saved === null) {
      toast.error("Failed to save notes");
    } else if (analysis === null) {
      toast.error("Notes saved, but AI rating unavailable");
    } else {
      toast.success(`Notes saved — AI rating: ${analysis.score}%`);
    }
  }, [hazardInput, solutionInput, project.id, selectedDate]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-slate-950 dark:text-slate-50 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-red-600" />
              Daily Activity Log
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Track daily site activities, hazards, and photo evidence</p>
          </div>
        </div>

        {/* GitHub-style Contribution Graph */}
        <ContributionGraph weeks={weeks} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {/* Selected Day Panel */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Day header */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {selectedDateObj.toLocaleDateString("en-KE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {displayPhotos.length > 0 && (
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {displayPhotos.length} photo{displayPhotos.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => actualRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload Photo
                </button>
              )}
            </div>
          </div>

          {/* Hazard & Solution Section */}
          <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
            <NoteField variant="hazard" value={hazardInput} onChange={setHazardInput} disabled={!canEdit} />
            <NoteField variant="solution" value={solutionInput} onChange={setSolutionInput} disabled={!canEdit} />

            {/* AI Analysis Results */}
            {aiScore !== null && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    AI Hazard-Solution Rating
                  </span>
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded ${getAiScoreClasses(aiScore)}`}>
                    {aiScore}%
                  </span>
                </div>
                {aiMissedItems && aiMissedItems.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Missing Elements</p>
                    <ul className="space-y-0.5">
                      {aiMissedItems.map((item, i) => (
                        <li key={i} className="text-[10px] text-slate-600 dark:text-slate-300 flex items-start gap-1">
                          <span className="text-red-400 dark:text-red-500 mt-0.5 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {canEdit && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveNotes}
                  disabled={aiAnalyzing || (!hazardInput?.trim() && !solutionInput?.trim())}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {aiAnalyzing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save Notes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Photos for Selected Day — loaded per-date from the API */}
          {photosLoading && (
            <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <SpinnerLabel label="Loading photos..." />
            </div>
          )}
          {!photosLoading && displayPhotos.length > 0 && (
            <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="pt-3 pb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Site Photos & Evidence
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {displayPhotos.map((ph) => (
                  <PhotoCard
                    key={ph.id}
                    photo={ph}
                    isLoaded={!!loadedPrevs[ph.id]}
                    canEdit={canEdit}
                    onLoad={handleMarkPhotoLoaded}
                    onView={handleViewPhoto}
                    onDelete={deleteSitePhoto}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!photosLoading && displayPhotos.length === 0 && !hazardInput && !solutionInput && (
            <EmptyState
              icon={Camera}
              title="No Activity Recorded"
              description="Upload photos and log hazards for this day to track site activity."
            />
          )}
        </div>
      </div>
      {/* Toasts are rendered globally by react-hot-toast Toaster in AppLayout */}
    </div>
  );
};
