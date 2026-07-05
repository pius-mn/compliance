import React from "react";
import toast from "react-hot-toast";
import { Camera, Plus, AlertTriangle, ShieldCheck, Image as ImageIcon, Calendar, Eye, Trash2, Save } from "lucide-react";
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

function getActivityLevel(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const LEVEL_COLORS: Record<number, string> = {
  0: "bg-slate-100",
  1: "bg-emerald-200",
  2: "bg-emerald-400",
  3: "bg-emerald-600",
};

interface DayActivity {
  date: string;
  dateObj: Date;
  photos: SitePhoto[];
  hazard: string;
  solution: string;
}

export const DailyActivities: React.FC<DailyActivitiesProps> = ({
  project,
  user,
  sitePhotos,
  deleteSitePhoto,
  setLightboxPhoto,
  actualRef,
}) => {
  // Build activity map grouped by date (from description JSON or uploadDate)
  const activityMap = React.useMemo(() => {
    const map = new Map<string, DayActivity>();
    const projectPhotos = (sitePhotos || []).filter(ph => ph && ph.projectId === project.id);

    for (const ph of projectPhotos) {
      // Try to get the activity date from description JSON first (supports past-date uploads)
      let dateKey = "";
      if (ph.description && ph.description.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(ph.description);
          if (parsed.date) dateKey = parsed.date;
        } catch {}
      }
      if (!dateKey) {
        dateKey = ph.uploadDate ? ph.uploadDate.split("T")[0] : "";
      }
      if (!dateKey) continue;

      let entry = map.get(dateKey);
      if (!entry) {
        entry = {
          date: dateKey,
          dateObj: new Date(dateKey),
          photos: [],
          hazard: "",
          solution: "",
        };
        map.set(dateKey, entry);
      }
      entry.photos.push(ph);

      // Parse description JSON for hazard/solution
      if (ph.description && ph.description.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(ph.description);
          if (parsed.hazard) entry.hazard = parsed.hazard;
          if (parsed.solution) entry.solution = parsed.solution;
        } catch {}
      }
    }
    return map;
  }, [sitePhotos, project.id]);

  // Selected date
  const [selectedDate, setSelectedDate] = React.useState<string>(() => {
    // Default to today or the most recent activity date
    const today = new Date().toISOString().split("T")[0];
    if (activityMap.has(today)) return today;
    const dates = Array.from(activityMap.keys()).sort().reverse();
    return dates[0] || today;
  });

  // Hazard/solution input state for the selected day
  const [hazardInput, setHazardInput] = React.useState("");
  const [solutionInput, setSolutionInput] = React.useState("");

  // AI analysis state
  const [aiScore, setAiScore] = React.useState<number | null>(null);
  const [aiMissedItems, setAiMissedItems] = React.useState<string[] | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = React.useState(false);

  // Toast notifications now handled by react-hot-toast (global Toaster in AppLayout)

  // Photos loaded per-date from the API (same as notes)
  const [currentDayPhotos, setCurrentDayPhotos] = React.useState<SitePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = React.useState(false);

  // Sync inputs when selected date changes — load notes AND photos from the server
  React.useEffect(() => {
    const day = activityMap.get(selectedDate);
    // Load persisted notes from the server
    (async () => {
      try {
        const res = await apiFetchJson(`/api/v1/daily-notes?projectId=${project.id}&date=${selectedDate}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.hazard) {
            setHazardInput(data.hazard);
          } else {
            setHazardInput(day?.hazard || "");
          }
          if (data && data.solution) {
            setSolutionInput(data.solution);
          } else {
            setSolutionInput(day?.solution || "");
          }
          // Load existing AI analysis
          if (data && data.aiScore !== null && data.aiScore !== undefined) {
            setAiScore(data.aiScore);
          } else {
            setAiScore(null);
          }
          if (data && data.aiMissedItems) {
            setAiMissedItems(data.aiMissedItems);
          } else {
            setAiMissedItems(null);
          }
        } else {
          setHazardInput(day?.hazard || "");
          setSolutionInput(day?.solution || "");
          setAiScore(null);
          setAiMissedItems(null);
        }
      } catch {
        setHazardInput(day?.hazard || "");
        setSolutionInput(day?.solution || "");
        setAiScore(null);
        setAiMissedItems(null);
      }
    })();

    // Load photos for the selected date from the API (same pattern as notes)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotosLoading(true);
    (async () => {
      try {
        const res = await apiFetchJson(`/api/v1/site-photos?projectId=${project.id}&date=${selectedDate}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentDayPhotos(Array.isArray(data) ? data : []);
        } else {
          setCurrentDayPhotos(day?.photos || []);
        }
      } catch {
        setCurrentDayPhotos(day?.photos || []);
      } finally {
        setPhotosLoading(false);
      }
    })();
  }, [selectedDate, activityMap, project.id]);

  // Generate last 28 days (4 weeks) for the graph
  const calendarDays = React.useMemo(() => {
    const days: { date: string; dateObj: Date; activity: DayActivity | null }[] = [];
    const today = new Date();
    // Start from 27 days ago to get 28 days total
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      days.push({
        date: dateKey,
        dateObj: d,
        activity: activityMap.get(dateKey) || null,
      });
    }
    return days;
  }, [activityMap]);

  // Organize into weeks (groups of 7 days)
  const weeks = React.useMemo(() => {
    const result: typeof calendarDays[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Current selected day data — use per-date fetched photos instead of prop-filtered
  const selectedDay = activityMap.get(selectedDate);
  const selectedDateObj = new Date(selectedDate);
  const displayPhotos = currentDayPhotos.length > 0 ? currentDayPhotos : (selectedDay?.photos || []);



  const canEdit = user?.role !== Role.Technician;

  // Photo preview loading state
  const [loadedPrevs, setLoadedPrevs] = React.useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-xs space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-red-600" />
              Daily Activity Log
            </h4>
            <p className="text-xs text-slate-500">Track daily site activities, hazards, and photo evidence</p>
          </div>
        </div>

        {/* GitHub-style Contribution Graph */}
        <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Last 28 Days Activity
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>Less</span>
              {[0, 1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[level]} border border-slate-200/50`}
                />
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
                    <span className="text-[9px] text-slate-400 font-medium">{DAY_NAMES[rowIdx]}</span>
                  </div>
                ))}
              </div>

              {/* Weeks grid */}
              <div className="flex gap-1">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1">
                    {/* Month label for first column of each month */}
                    {week[0] && week[0].dateObj.getDate() <= 7 && (
                      <span className="text-[9px] text-slate-400 font-medium pb-0.5 block">
                        {MONTH_NAMES[week[0].dateObj.getMonth()]}
                      </span>
                    )}
                    {week.map((day) => {
                      const hasNotes = !!(day.activity?.hazard || day.activity?.solution);
                      const photoCount = day.activity ? day.activity.photos.length : 0;
                      const activityScore = photoCount + (hasNotes ? 1 : 0);
                      const level = getActivityLevel(activityScore);
                      const isToday = day.date === new Date().toISOString().split("T")[0];
                      const isSelected = day.date === selectedDate;

                      return (
                        <button
                          key={day.date}
                          onClick={() => setSelectedDate(day.date)}
                          title={`${day.date}${photoCount > 0 ? ` - ${photoCount} photo(s)` : ""}${hasNotes ? " - Hazards logged ⚠️" : " - No activity"}`}
                          className={`w-4 h-4 rounded-sm ${LEVEL_COLORS[level]} border transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-red-400 hover:ring-offset-1 ${
                            isSelected
                              ? "ring-2 ring-red-500 ring-offset-1 scale-110"
                              : isToday && activityScore === 0
                                ? "border-red-300 border-dashed"
                                : "border-slate-200/50"
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Day Panel */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Day header */}
          <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-slate-900">
                {selectedDateObj.toLocaleDateString("en-KE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {displayPhotos.length > 0 && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {displayPhotos.length} photo{displayPhotos.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => actualRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload Photo
                </button>
              )}
            </div>
          </div>

          {/* Hazard & Solution Section */}
          <div className="p-4 space-y-3 bg-white">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Hazards Identified
              </label>
              <textarea
                placeholder="Describe any hazards, risks, or safety concerns observed on site today..."
                value={hazardInput}
                onChange={(e) => setHazardInput(e.target.value)}
                disabled={!canEdit}
                className="w-full p-3 text-xs bg-amber-50/30 border border-amber-200 rounded-lg focus:bg-white focus:border-amber-500 outline-none transition-all h-20 resize-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Containment Solutions Applied
              </label>
              <textarea
                placeholder="Describe the corrective actions and containment measures implemented..."
                value={solutionInput}
                onChange={(e) => setSolutionInput(e.target.value)}
                disabled={!canEdit}
                className="w-full p-3 text-xs bg-emerald-50/30 border border-emerald-200 rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all h-20 resize-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* AI Analysis Results */}
            {aiScore !== null && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    AI Hazard-Solution Rating
                  </span>
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                    aiScore >= 80 ? "bg-emerald-50 text-emerald-700" :
                    aiScore >= 50 ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {aiScore}%
                  </span>
                </div>
                {aiMissedItems && aiMissedItems.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-wider">Missing Elements</p>
                    <ul className="space-y-0.5">
                      {aiMissedItems.map((item, i) => (
                        <li key={i} className="text-[10px] text-slate-600 flex items-start gap-1">
                          <span className="text-red-400 mt-0.5 shrink-0">•</span>
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
                  onClick={async () => {
                    if (!hazardInput?.trim() && !solutionInput?.trim()) return;
                    setAiAnalyzing(true);
                    try {
                      // 1. Run AI analysis
                      let score: number | null = null;
                      let missedItems: string[] | null = null;
                      let aiError = false;
                      try {
                        const aiRes = await apiFetchJson(`/api/v1/daily-notes/analyze`, {
                          method: "POST",
                          body: { hazard: hazardInput, solution: solutionInput },
                        });
                        if (aiRes.ok) {
                          const aiData = await aiRes.json();
                          score = aiData.score;
                          missedItems = aiData.missedItems;
                          setAiScore(score);
                          setAiMissedItems(missedItems);
                        } else {
                          aiError = true;
                        }
                      } catch (e) {
                        console.error("AI analysis failed:", e);
                        aiError = true;
                      }

                      // 2. Save notes with AI results
                      await apiFetchJson(`/api/v1/daily-notes`, {
                        method: "PUT",
                        body: {
                          projectId: project.id,
                          date: selectedDate,
                          hazard: hazardInput,
                          solution: solutionInput,
                          aiScore: score,
                          aiMissedItems: missedItems,
                        },
                      });

                      // 3. Show toast
                      if (aiError) {
                        toast.error("Notes saved, but AI rating unavailable");
                      } else {
                        toast.success(`Notes saved — AI rating: ${score}%`);
                      }
                    } catch (e) {
                      console.error("Failed to save notes:", e);
                      toast.error("Failed to save notes");
                    } finally {
                      setAiAnalyzing(false);
                    }
                  }}
                  disabled={aiAnalyzing || (!hazardInput?.trim() && !solutionInput?.trim())}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {aiAnalyzing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Save Notes</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Photos for Selected Day — loaded per-date from the API */}
          {photosLoading && (
            <div className="px-4 pb-4 border-t border-slate-100 bg-white">
              <div className="pt-4 flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span className="text-[10px] text-slate-400 font-medium">Loading photos...</span>
              </div>
            </div>
          )}
          {!photosLoading && displayPhotos.length > 0 && (
            <div className="px-4 pb-4 border-t border-slate-100 bg-white">
              <div className="pt-3 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Site Photos & Evidence
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {displayPhotos.map((ph) => (
                  <div
                    key={ph.id}
                    className="group bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col"
                  >
                    <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
                      {loadedPrevs[ph.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ph.photoData || (ph as unknown as Record<string, unknown>).url as string}
                          alt="Site photo"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-2 text-center space-y-1">
                          <ImageIcon className="w-5 h-5 text-slate-500" />
                          <p className="text-[9px] text-slate-400">Preview hidden</p>
                          <button
                            onClick={() => setLoadedPrevs(prev => ({ ...prev, [ph.id]: true }))}
                            className="px-2 py-0.5 bg-red-600/90 hover:bg-red-600 text-white rounded text-[9px] font-bold transition-all cursor-pointer"
                          >
                            Load
                          </button>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setLoadedPrevs(prev => ({ ...prev, [ph.id]: true }));
                            setLightboxPhoto(ph);
                          }}
                          className="p-1.5 bg-white text-slate-800 rounded-lg hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => deleteSitePhoto(ph.id)}
                            className="p-1.5 bg-white text-red-600 rounded-lg hover:bg-red-50 shadow-xs transition-all cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 text-[9px] text-slate-400 font-medium flex items-center justify-between">
                      <span className="truncate">{ph.uploadedByUserName}</span>
                      <span>{new Date(ph.uploadDate).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!photosLoading && displayPhotos.length === 0 && !hazardInput && !solutionInput && (
            <div className="p-8 text-center space-y-2 bg-white">
              <Camera className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-400">No Activity Recorded</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Upload photos and log hazards for this day to track site activity.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Toasts are rendered globally by react-hot-toast Toaster in AppLayout */}
    </div>
  );
};
