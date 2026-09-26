import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjects } from "../hooks/useProjects";
import { colorForLabel } from "../lib/colors";
import { useUiMessages } from "../lib/i18n";
import type { Project, SchemaInfo } from "../lib/types";

interface StatsTabProps {
  onSelectProject: (project: string) => void;
}

/* ── Glowy health dot ───────────────────────────────────── */

function HealthDot({ name }: { name: string }) {
  const t = useUiMessages();
  const [status, setStatus] = useState<"loading" | "healthy" | "corrupt" | "missing">("loading");
  const [info, setInfo] = useState("");

  useEffect(() => {
    fetch(`/api/project-health?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status ?? "corrupt");
        if (d.nodes !== undefined) {
          const sizeMB = ((d.size_bytes ?? 0) / 1024 / 1024).toFixed(1);
          setInfo(`${d.nodes.toLocaleString()} nodes, ${d.edges.toLocaleString()} edges, ${sizeMB} MB`);
        } else if (d.reason) {
          setInfo(d.reason);
        }
      })
      .catch(() => setStatus("corrupt"));
  }, [name]);

  const dotColor =
    status === "healthy" ? "#34d399" :
    status === "missing" ? "#fbbf24" :
    status === "corrupt" ? "#f87171" : "#555";

  const label =
    status === "healthy" ? t.projects.healthHealthy :
    status === "missing" ? t.projects.healthMissing :
    status === "corrupt" ? t.projects.healthCorrupt : t.projects.healthChecking;

  return (
    <div className="group relative inline-flex items-center">
      {/* Glow layer */}
      <span
        className="absolute w-3 h-3 rounded-full animate-pulse opacity-40 blur-[3px]"
        style={{ backgroundColor: dotColor }}
      />
      {/* Dot */}
      <span
        className="relative w-[8px] h-[8px] rounded-full"
        style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
      />
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-20 pointer-events-none">
        <div className="bg-card border border-border/50 rounded-lg px-3 py-2 text-[11px] whitespace-nowrap shadow-xl">
          <p className="font-medium" style={{ color: dotColor }}>{label}</p>
          {info && <p className="text-foreground/35 text-[10px] mt-0.5">{info}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── ADR button + modal ─────────────────────────────────── */

function AdrButton({ project }: { project: string }) {
  const t = useUiMessages();
  const [hasAdr, setHasAdr] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  const fetchAdr = useCallback(async () => {
    try {
      const res = await fetch(`/api/adr?project=${encodeURIComponent(project)}`);
      const data = await res.json();
      setHasAdr(data.has_adr ?? false);
      if (data.content) setContent(data.content);
      if (data.updated_at) setUpdatedAt(data.updated_at);
    } catch { setHasAdr(false); }
  }, [project]);

  useEffect(() => { fetchAdr(); }, [fetchAdr]);

  const save = async (nextContent = content) => {
    setSaving(true);
    try {
      await fetch("/api/adr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, content: nextContent }),
      });
      await fetchAdr();
      setOpen(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (hasAdr === null) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); fetchAdr(); }}
        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
          hasAdr
            ? "bg-accent/15 text-accent hover:bg-accent/25"
            : "bg-white/[0.03] text-foreground/25 hover:text-foreground/40 hover:bg-white/[0.06]"
        }`}
      >
        {hasAdr ? "ADR" : "+ ADR"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-card border border-border/40 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground/90">{t.adr.title}</h3>
                <p className="text-[11px] text-foreground/30 font-mono mt-0.5">{project}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-foreground/20 hover:text-foreground/50 text-[16px] p-1">×</button>
            </div>
            {updatedAt && (
              <p className="text-[10px] text-foreground/20 mb-3">{t.adr.lastUpdated}: {updatedAt}</p>
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"# Architecture Decision Record\n\n## Context\n...\n\n## Decision\n...\n\n## Consequences\n..."}
              className="flex-1 min-h-[300px] bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-foreground font-mono placeholder-foreground/15 outline-none focus:border-primary/30 resize-none leading-relaxed"
            />
            <div className="flex justify-end gap-2 mt-4">
              {hasAdr && (
                <button
                  onClick={async () => {
                    setContent(""); await save("");
                  }}
                  className="px-3 py-2 rounded-lg text-[12px] text-destructive/60 hover:text-destructive hover:bg-destructive/10 font-medium transition-all"
                >
                  {t.common.delete}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-[12px] text-foreground/40 hover:bg-white/[0.04] font-medium transition-all">{t.common.cancel}</button>
              <button onClick={() => save()} disabled={saving} className="px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-[12px] font-medium transition-all disabled:opacity-30">
                {saving ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Create Index Modal ─────────────────────────────────── */

function joinPath(base: string, dir: string): string {
  if (!base || base === "/") return `/${dir}`;
  if (/^[A-Za-z]:[\\/]?$/.test(base)) return `${base[0]}:/${dir}`;
  const slash = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return `${base.replace(/[\\/]+$/, "")}${slash}${dir}`;
}

function CreateIndexModal({ onClose, onCreated }: { onClose: () => void; onCreated: (label: string) => void }) {
  const t = useUiMessages();
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [roots, setRoots] = useState<string[]>(["/"]);
  const [parentPath, setParentPath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  /* Path whose listing is currently shown. Lets the typed-path effect skip a
   * redundant re-fetch after browse() sets currentPath itself. */
  const lastBrowsedRef = useRef<string>("");

  const browse = useCallback(async (path?: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const q = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await fetch(`/api/browse${q}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      lastBrowsedRef.current = data.path ?? "";
      setCurrentPath(data.path ?? "");
      setDirs((data.dirs ?? []).sort());
      setRoots(data.roots ?? ["/"]);
      setParentPath(data.parent ?? "/");
    } catch (e) {
      /* Silent (typed-path) refreshes keep the last good listing instead of
       * flashing an error while the user is still typing a path. */
      if (!silent) setError(e instanceof Error ? e.message : "Browse failed");
    }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { browse(); }, [browse]);
  useEffect(() => { filterRef.current?.focus(); }, []);

  /* Windows only: when the user types a drive path into the Repository path
   * field, refresh the folder listing to match (debounced). On Windows, typing
   * is the way to switch drives, and without this the breadcrumb and path box
   * updated but the directory list stayed stale (e.g. typing "D:/" still showed
   * the previous drive's folders). POSIX navigation is left unchanged. */
  useEffect(() => {
    if (!currentPath || currentPath === lastBrowsedRef.current) return;
    if (!/^[A-Za-z]:/.test(currentPath.replace(/\\/g, "/"))) return;
    const id = setTimeout(() => { void browse(currentPath, { silent: true }); }, 350);
    return () => clearTimeout(id);
  }, [currentPath, browse]);

  const filteredDirs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return dirs;
    return dirs.filter((d) => d.toLowerCase().includes(q));
  }, [dirs, filter]);

  useEffect(() => { setActiveIndex(0); }, [filter, currentPath]);

  const submit = async (path = currentPath) => {
    if (!path) return;
    setSubmitting(true); setError(null);
    try {
      const body: { root_path: string; project_name?: string } = { root_path: path };
      if (projectName.trim()) body.project_name = projectName.trim();
      const res = await fetch("/api/index", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onCreated(projectName.trim() || basename(path)); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  };

  const onFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filteredDirs.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filteredDirs.length > 0) {
      e.preventDefault();
      const dir = filteredDirs.length === 1 ? filteredDirs[0] : filteredDirs[activeIndex];
      if (filteredDirs.length === 1) void submit(joinPath(currentPath, dir));
      else void browse(joinPath(currentPath, dir));
    }
  };

  /* Breadcrumb segments */
  const displayPath = currentPath.replace(/\\/g, "/");
  const segments = displayPath.split("/").filter(Boolean);
  /* A Windows drive path ("C:/Users/rap") has no unified "/" root — its first
   * segment is the drive letter. Build crumb targets accordingly so clicking a
   * segment navigates to a real directory instead of a bogus "/C:/..." path
   * that the backend rejects as "not a directory". */
  const isWinPath = /^[A-Za-z]:$/.test(segments[0] ?? "");
  const crumbPath = (i: number): string => {
    const parts = segments.slice(0, i + 1);
    if (isWinPath) return parts.length === 1 ? `${parts[0]}/` : parts.join("/");
    return "/" + parts.join("/");
  };

  /* Root/drive quick-jump buttons. On Windows the POSIX "/" root is meaningless
   * — browsing it returns an empty listing — so drop it and offer drive roots
   * instead. An older backend may not enumerate drives, so always include the
   * current drive; other drives stay reachable by typing a path. */
  const displayRoots = (() => {
    if (!isWinPath) return roots;
    const drives = Array.from(new Set(
      roots.filter((r) => /^[A-Za-z]:[\\/]?$/.test(r)).map((r) => `${r[0].toUpperCase()}:/`),
    ));
    const curRoot = `${displayPath[0].toUpperCase()}:/`;
    if (!drives.includes(curRoot)) drives.unshift(curRoot);
    return drives;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border/40 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: "min(82vh, 680px)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground/90 mb-1">{t.index.selectRepositoryFolder}</h3>
          <p className="text-[12px] text-foreground/30">{t.index.instructions}</p>
        </div>

        <div className="px-5 pb-3 grid grid-cols-[1fr_220px] gap-3 shrink-0">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-foreground/25 mb-1">{t.index.repositoryPath}</span>
            <input
              aria-label={t.index.repositoryPath}
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && /^[A-Za-z]:/.test(currentPath.replace(/\\/g, "/"))) { e.preventDefault(); void browse(currentPath); } }}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-foreground font-mono outline-none focus:border-primary/40"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-foreground/25 mb-1">{t.index.projectName}</span>
            <input
              aria-label={t.index.projectName}
              value={projectName}
              placeholder={t.index.projectNamePlaceholder}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/40 placeholder:text-foreground/20"
            />
            <span className="block text-[10px] text-foreground/25 mt-1">{t.index.projectNameHelp}</span>
          </label>
        </div>

        <div className="px-5 pb-3 flex items-center gap-2 shrink-0">
          <input
            ref={filterRef}
            value={filter}
            placeholder={t.index.filterFolders}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={onFilterKeyDown}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/40 placeholder:text-foreground/20"
          />
          <div className="flex items-center gap-1">
            {displayRoots.map((root) => (
              <button
                key={root}
                aria-label={t.index.browseRoot(root)}
                onClick={() => browse(root)}
                className="px-2.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-[11px] text-foreground/45 font-mono transition-all"
              >
                {root}
              </button>
            ))}
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="px-5 py-2 border-y border-border/20 flex items-center gap-0.5 overflow-x-auto text-[11px] shrink-0">
          {!isWinPath && (
            <button onClick={() => browse("/")} className="text-primary/60 hover:text-primary shrink-0 transition-colors">/</button>
          )}
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              {(i > 0 || !isWinPath) && <span className="text-foreground/15">/</span>}
              <button
                onClick={() => browse(crumbPath(i))}
                className={`transition-colors ${i === segments.length - 1 ? "text-foreground/70 font-medium" : "text-primary/50 hover:text-primary"}`}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* Directory list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 py-1" data-testid="browse-list">
            {/* Go up */}
            {currentPath !== "/" && (
              <button
                onClick={() => browse(parentPath)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] text-[12px] text-foreground/40 transition-colors"
              >
                <span className="text-foreground/20">↑</span>
                <span>..</span>
              </button>
            )}
            {loading ? (
              <p className="text-foreground/20 text-[12px] text-center py-8">{t.common.loading}</p>
            ) : filteredDirs.length === 0 ? (
              <p className="text-foreground/15 text-[12px] text-center py-8">{t.index.noSubdirectories}</p>
            ) : (
              filteredDirs.map((d, i) => (
                <div
                  key={d}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] transition-colors group ${
                    i === activeIndex ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    aria-label={t.index.browseRoot(d)}
                    onClick={() => browse(joinPath(currentPath, d))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-foreground/60"
                  >
                    <span className="text-foreground/20 group-hover:text-foreground/40">/</span>
                    <span className="truncate">{d}</span>
                  </button>
                  <button
                    aria-label={t.index.indexDirectory(d)}
                    onClick={() => submit(joinPath(currentPath, d))}
                    disabled={submitting}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-[10px] font-medium transition-all disabled:opacity-30"
                  >
                    {t.index.indexThisFolder}
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/20 shrink-0">
          {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 mb-3"><p className="text-destructive text-[11px]">{error}</p></div>}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-foreground/25 font-mono truncate max-w-[250px]">{currentPath}</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-[12px] text-foreground/40 hover:bg-white/[0.04] font-medium transition-all">{t.common.cancel}</button>
              <button onClick={() => submit()} disabled={submitting || !currentPath} className="px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-[12px] font-medium transition-all disabled:opacity-30">
                {submitting ? t.index.starting : t.index.indexThisFolder}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Select scan-root folder modal ──────────────────────── */

function SelectRootModal({ onClose, onSelect }: { onClose: () => void; onSelect: (path: string) => void }) {
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [roots, setRoots] = useState<string[]>(["/"]);
  const [parentPath, setParentPath] = useState("");
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const lastBrowsedRef = useRef<string>("");

  const browse = useCallback(async (path?: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const q = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await fetch(`/api/browse${q}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      lastBrowsedRef.current = data.path ?? "";
      setCurrentPath(data.path ?? "");
      setDirs((data.dirs ?? []).sort());
      setRoots(data.roots ?? ["/"]);
      setParentPath(data.parent ?? "/");
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "No se pudo listar la carpeta");
    }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { browse(); }, [browse]);
  useEffect(() => { filterRef.current?.focus(); }, []);

  useEffect(() => {
    if (!currentPath || currentPath === lastBrowsedRef.current) return;
    if (!/^[A-Za-z]:/.test(currentPath.replace(/\\/g, "/"))) return;
    const id = setTimeout(() => { void browse(currentPath, { silent: true }); }, 350);
    return () => clearTimeout(id);
  }, [currentPath, browse]);

  const filteredDirs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return dirs;
    return dirs.filter((d) => d.toLowerCase().includes(q));
  }, [dirs, filter]);

  useEffect(() => { setActiveIndex(0); }, [filter, currentPath]);

  const choose = (path = currentPath) => {
    if (!path) return;
    onSelect(path);
    onClose();
  };

  const onFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filteredDirs.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filteredDirs.length > 0) {
      e.preventDefault();
      const dir = filteredDirs.length === 1 ? filteredDirs[0] : filteredDirs[activeIndex];
      if (filteredDirs.length === 1) choose(joinPath(currentPath, dir));
      else void browse(joinPath(currentPath, dir));
    }
  };

  const displayPath = currentPath.replace(/\\/g, "/");
  const segments = displayPath.split("/").filter(Boolean);
  const isWinPath = /^[A-Za-z]:$/.test(segments[0] ?? "");
  const crumbPath = (i: number): string => {
    const parts = segments.slice(0, i + 1);
    if (isWinPath) return parts.length === 1 ? `${parts[0]}/` : parts.join("/");
    return "/" + parts.join("/");
  };

  const displayRoots = (() => {
    if (!isWinPath) return roots;
    const drives = Array.from(new Set(
      roots.filter((r) => /^[A-Za-z]:[\\/]?$/.test(r)).map((r) => `${r[0].toUpperCase()}:/`),
    ));
    const curRoot = `${displayPath[0].toUpperCase()}:/`;
    if (!drives.includes(curRoot)) drives.unshift(curRoot);
    return drives;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border/40 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: "min(82vh, 680px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground/90 mb-1">Selecciona una carpeta</h3>
          <p className="text-[12px] text-foreground/30">Elige la carpeta donde guardas tus proyectos — se listarán todas las que tenga dentro.</p>
        </div>

        <div className="px-5 pb-3 flex items-center gap-2 shrink-0">
          <input
            ref={filterRef}
            value={filter}
            placeholder="Filtrar carpetas"
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={onFilterKeyDown}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/40 placeholder:text-foreground/20"
          />
          <div className="flex items-center gap-1">
            {displayRoots.map((root) => (
              <button
                key={root}
                onClick={() => browse(root)}
                className="px-2.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-[11px] text-foreground/45 font-mono transition-all"
              >
                {root}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-2 border-y border-border/20 flex items-center gap-0.5 overflow-x-auto text-[11px] shrink-0">
          {!isWinPath && (
            <button onClick={() => browse("/")} className="text-primary/60 hover:text-primary shrink-0 transition-colors">/</button>
          )}
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5 shrink-0">
              {(i > 0 || !isWinPath) && <span className="text-foreground/15">/</span>}
              <button
                onClick={() => browse(crumbPath(i))}
                className={`transition-colors ${i === segments.length - 1 ? "text-foreground/70 font-medium" : "text-primary/50 hover:text-primary"}`}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 py-1">
            {currentPath !== "/" && (
              <button
                onClick={() => browse(parentPath)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] text-[12px] text-foreground/40 transition-colors"
              >
                <span className="text-foreground/20">↑</span>
                <span>..</span>
              </button>
            )}
            {loading ? (
              <p className="text-foreground/20 text-[12px] text-center py-8">Cargando…</p>
            ) : filteredDirs.length === 0 ? (
              <p className="text-foreground/15 text-[12px] text-center py-8">Sin subcarpetas</p>
            ) : (
              filteredDirs.map((d, i) => (
                <div
                  key={d}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] transition-colors group ${
                    i === activeIndex ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    onClick={() => browse(joinPath(currentPath, d))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-foreground/60"
                  >
                    <span className="text-foreground/20 group-hover:text-foreground/40">/</span>
                    <span className="truncate">{d}</span>
                  </button>
                  <button
                    onClick={() => choose(joinPath(currentPath, d))}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-[10px] font-medium transition-all"
                  >
                    Usar esta carpeta
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="px-5 py-4 border-t border-border/20 shrink-0">
          {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 mb-3"><p className="text-destructive text-[11px]">{error}</p></div>}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-foreground/25 font-mono truncate max-w-[250px]">{currentPath}</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-[12px] text-foreground/40 hover:bg-white/[0.04] font-medium transition-all">Cancelar</button>
              <button onClick={() => choose()} disabled={!currentPath} className="px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-[12px] font-medium transition-all disabled:opacity-30">
                Usar esta carpeta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Index Progress ─────────────────────────────────────── */

function basename(path: string): string {
  const cleaned = path.replace(/[\\/]+$/, "");
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

export function IndexProgress({ onDone, pendingLabel }: { onDone: () => void; pendingLabel?: string | null }) {
  const t = useUiMessages();
  const [jobs, setJobs] = useState<{ slot: number; status: string; path: string; error?: string }[]>([]);
  const [hasActive, setHasActive] = useState(true);
  useEffect(() => {
    if (!hasActive) return;
    const poll = setInterval(async () => {
      try {
        const data = await (await fetch("/api/index-status")).json();
        setJobs(data);
        const stillIndexing = data.some((j: { status: string }) => j.status === "indexing");
        /* Empty list = job not visible: the backend keeps finished jobs listed
           as "done"/"error", so [] mid-index only happens on transient state
           loss (e.g. server restart) — keep polling, don't treat as done. */
        if (data.length > 0 && !stillIndexing) {
          setHasActive(false);
          const hasErrors = data.some((j: { status: string }) => j.status === "error");
          if (!hasErrors) {
            onDone();
          }
        }
      } catch (error) {
        console.error("[IndexProgress] Poll failed:", error);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [onDone, hasActive]);

  const active = jobs.filter((j) => j.status === "indexing");
  const errors = jobs.filter((j) => j.status === "error");

  if (active.length === 0 && errors.length === 0) {
    /* Nothing back from the first poll yet — show the window right away with
     * what we already know (the folder the click just started indexing)
     * instead of a 2s blank gap. */
    if (!pendingLabel) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="font-serif text-[15px] font-semibold text-foreground">Indexando proyecto: {pendingLabel}</p>
              <p className="text-[11px] text-primary font-medium mt-0.5">{t.projects.indexingInProgress}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {active.map((j) => (
          <div key={j.slot} className="flex items-center gap-3.5">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="font-serif text-[15px] font-semibold text-foreground">
                Indexando proyecto: {basename(j.path)}
              </p>
              <p className="text-[11px] text-primary font-medium mt-0.5">{t.projects.indexingInProgress}</p>
              <p className="text-[11px] text-muted-foreground font-mono truncate mt-1">{j.path}</p>
            </div>
          </div>
        ))}
        {errors.map((j) => (
          <div key={j.slot} className="flex items-start gap-3 mt-3 first:mt-0 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive">
            <span className="text-[14px]">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold">{t.projects.indexingFailed}</p>
              <p className="text-[11px] font-mono truncate">{j.path}</p>
              {j.error && <p className="text-[10px] opacity-75 mt-1 font-mono">{j.error}</p>}
            </div>
          </div>
        ))}
        {errors.length > 0 && (
          <div className="flex justify-end mt-4">
            <button
              onClick={onDone}
              className="px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-[11px] font-medium transition-all"
            >
              {t.common.dismiss}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Folder scan: everything under a user-chosen root, indexed or not ── */

const SCAN_ROOT_KEY = "cbm-scan-root";

function loadScanRoot(): string | null {
  try { return localStorage.getItem(SCAN_ROOT_KEY); } catch { return null; }
}
function saveScanRoot(path: string | null) {
  try {
    if (path) localStorage.setItem(SCAN_ROOT_KEY, path);
    else localStorage.removeItem(SCAN_ROOT_KEY);
  } catch { /* ignore */ }
}

type ProjectEntry = { project: Project; schema: SchemaInfo | null };

function normalizePath(path: string): string {
  let p = path.replace(/[\\/]+$/, "");
  /* On ostree-style distros (Fedora Silverblue/CoreOS, this box included) /home
   * is a symlink to /var/home — the backend stores the resolved /var/home/...
   * path while browsing gives back /home/...; treat them as the same folder. */
  if (p.startsWith("/var/home/") || p === "/var/home") p = p.slice(4);
  return p;
}

/* One row: an indexed project (health dot, chips, stats, actions). Used both
 * for entries found under PROJECTS_ROOT and for indexed projects that live
 * elsewhere. */
function IndexedRow({
  p,
  onSelectProject,
  onDelete,
}: {
  p: ProjectEntry;
  onSelectProject: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const totalNodes = p.schema?.node_labels?.reduce((s, l) => s + l.count, 0) ?? 0;
  const totalEdges = p.schema?.edge_types?.reduce((s, t) => s + t.count, 0) ?? 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3.5 min-w-0">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="pt-1 shrink-0"><HealthDot name={p.project.name} /></div>
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="font-serif text-[14px] font-semibold truncate">{p.project.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground truncate block">{p.project.root_path}</span>
          </div>
        </div>
        <button onClick={() => onDelete(p.project.name)} className="w-6 h-6 rounded-md hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive text-[12px] transition-all shrink-0" title="Eliminar índice">
          ✕
        </button>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {p.schema?.node_labels?.map((l) => (
          <span
            key={l.label}
            title={`${l.label} ${l.count.toLocaleString()}`}
            className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold overflow-hidden"
            style={{ backgroundColor: colorForLabel(l.label) + "1a", color: colorForLabel(l.label) }}
          >
            <span className="truncate">{l.label}</span>
            <span className="tabular-nums shrink-0 opacity-70">{l.count.toLocaleString()}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40 mt-auto">
        <span className="font-mono text-[11px] text-muted-foreground/80 tabular-nums truncate">
          {totalNodes.toLocaleString()} nodos · {totalEdges.toLocaleString()} aristas
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <AdrButton project={p.project.name} />
          <button onClick={() => onSelectProject(p.project.name)} className="text-primary text-[12px] font-semibold hover:underline whitespace-nowrap">
            Ver grafo →
          </button>
        </div>
      </div>
    </div>
  );
}

/* One card: a folder under the scan root that has not been indexed yet. */
function UnindexedRow({
  name,
  fullPath,
  indexing,
  onIndex,
}: {
  name: string;
  fullPath: string;
  indexing: boolean;
  onIndex: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3.5 min-w-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="w-[9px] h-[9px] rounded-full bg-muted-foreground/25 shrink-0 mt-[5px]" />
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="font-serif text-[14px] font-semibold text-foreground/60 truncate">{name}</span>
          <span className="font-mono text-[11px] text-muted-foreground truncate block">{fullPath}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40 mt-auto">
        <span className="text-[11px] text-muted-foreground/60">Sin indexar</span>
        <button
          onClick={onIndex}
          disabled={indexing}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold transition-all disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          {indexing ? "Indexando…" : "Indexar"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Stats Tab ─────────────────────────────────────── */

export function StatsTab({ onSelectProject }: StatsTabProps) {
  const t = useUiMessages();
  const { projects, loading, error, refresh } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const [showSelectRoot, setShowSelectRoot] = useState(false);
  const [indexing, setIndexing] = useState(false);

  const [scanRoot, setScanRoot] = useState<string | null>(() => loadScanRoot());
  const [scanDirs, setScanDirs] = useState<string[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanVersion, setScanVersion] = useState(0);
  const [indexingPath, setIndexingPath] = useState<string | null>(null);
  const [indexingLabel, setIndexingLabel] = useState<string | null>(null);

  const chooseScanRoot = useCallback((path: string) => {
    setScanRoot(path);
    saveScanRoot(path);
    setScanDirs(null);
  }, []);

  useEffect(() => {
    if (!scanRoot) { setScanDirs(null); setScanError(null); return; }
    let cancelled = false;
    setScanLoading(true);
    fetch(`/api/browse?path=${encodeURIComponent(scanRoot)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) { setScanError(d.error); setScanDirs([]); }
        else { setScanError(null); setScanDirs((d.dirs ?? []).sort()); }
      })
      .catch(() => { if (!cancelled) { setScanError(`No se pudo leer ${scanRoot}`); setScanDirs([]); } })
      .finally(() => { if (!cancelled) setScanLoading(false); });
    return () => { cancelled = true; };
  }, [scanRoot, scanVersion]);

  const indexedByPath = useMemo(() => {
    const m = new Map<string, ProjectEntry>();
    for (const p of projects) m.set(normalizePath(p.project.root_path), p);
    return m;
  }, [projects]);

  const folderEntries = useMemo(() => {
    if (!scanRoot) return [];
    return (scanDirs ?? []).map((name) => {
      const fullPath = joinPath(scanRoot, name);
      return { name, fullPath, indexed: indexedByPath.get(normalizePath(fullPath)) ?? null };
    });
  }, [scanRoot, scanDirs, indexedByPath]);

  const otherIndexed = useMemo(() => {
    const scannedPaths = new Set(folderEntries.map((f) => normalizePath(f.fullPath)));
    return projects.filter((p) => !scannedPaths.has(normalizePath(p.project.root_path)));
  }, [projects, folderEntries]);

  const aggregate = useMemo(() => {
    let totalNodes = 0, totalEdges = 0;
    for (const p of projects) {
      totalNodes += p.schema?.node_labels?.reduce((s, l) => s + l.count, 0) ?? 0;
      totalEdges += p.schema?.edge_types?.reduce((s, t) => s + t.count, 0) ?? 0;
    }
    return { projects: projects.length, nodes: totalNodes, edges: totalEdges };
  }, [projects]);

  const deleteProject = useCallback(async (name: string) => {
    if (!confirm(t.projects.deleteConfirm(name))) return;
    try { await fetch(`/api/project?name=${encodeURIComponent(name)}`, { method: "DELETE" }); refresh(); } catch { /* */ }
  }, [refresh, t.projects]);

  const indexFolder = useCallback(async (fullPath: string, name: string) => {
    setIndexingPath(fullPath);
    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root_path: fullPath, project_name: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setIndexingLabel(name);
      setIndexing(true);
      refresh();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "No se pudo indexar");
    } finally {
      setIndexingPath(null);
    }
  }, [refresh]);

  return (
    <ScrollArea className="h-full">
      <div className="p-7">
        {projects.length > 0 && (
          <div className="flex gap-4 mb-8">
            {[
              { label: t.tabs.projects, value: aggregate.projects, color: "text-primary" },
              { label: t.projects.nodes, value: aggregate.nodes, color: "text-foreground/80" },
              { label: t.projects.edges, value: aggregate.edges, color: "text-foreground/80" },
            ].map((s) => (
              <div key={s.label} className="flex-1 rounded-2xl border border-border bg-card p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`font-serif text-[26px] font-semibold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {indexing && (
          <IndexProgress
            pendingLabel={indexingLabel}
            onDone={() => { setIndexing(false); setIndexingLabel(null); refresh(); }}
          />
        )}

        {/* Everything found under the chosen scan root, indexed or not */}
        <div className="flex items-center justify-between mb-3">
          {scanRoot ? (
            <h2 className="font-serif text-[16px] font-semibold">
              Proyectos en <span className="font-mono text-[13px] text-muted-foreground">{scanRoot}</span>
            </h2>
          ) : (
            <h2 className="font-serif text-[16px] font-semibold">Proyectos</h2>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSelectRoot(true)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-[12px] text-muted-foreground font-medium transition-all">
              {scanRoot ? "Cambiar carpeta" : "Seleccionar carpeta"}
            </button>
            <button onClick={() => setShowModal(true)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-[12px] text-muted-foreground font-medium transition-all">+ {t.index.newIndex}</button>
            {scanRoot && (
              <button onClick={() => setScanVersion((v) => v + 1)} disabled={scanLoading} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-[12px] text-muted-foreground font-medium transition-all disabled:opacity-30">
                {scanLoading ? "..." : t.common.refresh}
              </button>
            )}
          </div>
        </div>

        {!scanRoot && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 mb-10 text-center">
            <p className="text-muted-foreground text-[13px] mb-3">Elige una carpeta y aquí aparecerán todos los proyectos que tenga dentro, indexados o no.</p>
            <button onClick={() => setShowSelectRoot(true)} className="px-4 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-[12px] font-semibold transition-all">
              Seleccionar carpeta
            </button>
          </div>
        )}

        {scanRoot && scanError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 mb-6"><p className="text-destructive text-[13px]">{scanError}</p></div>
        )}

        {scanRoot && !scanLoading && folderEntries.length === 0 && !scanError && (
          <p className="text-muted-foreground/60 text-[12px] py-6">No hay carpetas en {scanRoot}</p>
        )}

        {scanRoot && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
            {folderEntries.map((entry) =>
              entry.indexed ? (
                <IndexedRow key={entry.fullPath} p={entry.indexed} onSelectProject={onSelectProject} onDelete={deleteProject} />
              ) : (
                <UnindexedRow
                  key={entry.fullPath}
                  name={entry.name}
                  fullPath={entry.fullPath}
                  indexing={indexingPath === entry.fullPath}
                  onIndex={() => indexFolder(entry.fullPath, entry.name)}
                />
              ),
            )}
          </div>
        )}

        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 mb-6"><p className="text-destructive text-[13px]">{error}</p></div>}

        {otherIndexed.length > 0 && (
          <>
            <h2 className="font-serif text-[16px] font-semibold mb-3">Otros proyectos indexados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {otherIndexed.map((p) => (
                <IndexedRow key={p.project.name} p={p} onSelectProject={onSelectProject} onDelete={deleteProject} />
              ))}
            </div>
          </>
        )}

        {scanRoot && !loading && projects.length === 0 && folderEntries.length === 0 && !error && !scanError && (
          <div className="text-center py-20">
            <p className="text-foreground/25 text-[13px] mb-2">{t.projects.noIndexedProjects}</p>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-[12px] font-medium transition-all">{t.projects.indexFirstRepository}</button>
          </div>
        )}
      </div>
      {showModal && (
        <CreateIndexModal
          onClose={() => setShowModal(false)}
          onCreated={(label) => { setIndexingLabel(label); setIndexing(true); refresh(); setScanVersion((v) => v + 1); }}
        />
      )}
      {showSelectRoot && (
        <SelectRootModal
          onClose={() => setShowSelectRoot(false)}
          onSelect={chooseScanRoot}
        />
      )}
    </ScrollArea>
  );
}
