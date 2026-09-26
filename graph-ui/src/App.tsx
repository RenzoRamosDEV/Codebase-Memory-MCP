import { useCallback, useEffect, useState } from "react";
import { Waypoints, FolderGit2, SlidersHorizontal } from "lucide-react";
import { GraphTab } from "./components/GraphTab";
import { StatsTab } from "./components/StatsTab";
import { ControlTab } from "./components/ControlTab";
import type { TabId } from "./lib/types";
import { useUiMessages } from "./lib/i18n";

const TAB_IDS: TabId[] = ["graph", "stats", "control"];
const TAB_ICONS: Record<TabId, typeof Waypoints> = {
  graph: Waypoints,
  stats: FolderGit2,
  control: SlidersHorizontal,
};

interface RouteState {
  tab: TabId;
  project: string | null;
}

/* Read the active tab + selected project from the URL query string so the
 * current view survives refreshes and can be bookmarked or shared. */
function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get("tab");
  const tab = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : "stats";
  const project = params.get("project");
  return { tab, project: project ? project : null };
}

/* Build the canonical URL for a route, preserving the path and hash. */
function routeUrl(tab: TabId, project: string | null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (project) params.set("project", project);
  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}

export function App() {
  const t = useUiMessages();
  const [route, setRoute] = useState<RouteState>(readRoute);
  const [version, setVersion] = useState<string | null>(null);
  const { tab: activeTab, project: selectedProject } = route;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ui-config")
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (!cancelled && typeof config?.version === "string" && config.version) {
          setVersion(config.version);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Normalize the URL on first load so it always carries the current route. */
  useEffect(() => {
    const initial = readRoute();
    window.history.replaceState(null, "", routeUrl(initial.tab, initial.project));
  }, []);

  /* Sync state when the user navigates with the browser back/forward buttons. */
  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* Change the route and push a history entry (skips no-op navigations). */
  const navigate = useCallback((tab: TabId, project: string | null) => {
    const url = routeUrl(tab, project);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (url === current) return;
    window.history.pushState(null, "", url);
    setRoute({ tab, project });
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: "graph", label: t.tabs.graph },
    { id: "stats", label: t.tabs.projects },
    { id: "control", label: t.tabs.control },
  ];

  const activeTabInfo = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="h-screen flex bg-background text-foreground">
      {/* Icon rail — persistent navigation */}
      <nav className="w-[84px] shrink-0 bg-sidebar border-r border-border flex flex-col items-center py-5 gap-7">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-primary flex items-center justify-center font-serif font-bold text-[16px] text-primary-foreground">
          C
        </div>
        <div className="flex flex-col gap-2.5">
          {tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id];
            const disabled = tab.id === "graph" && !selectedProject;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id, tab.id === "stats" ? null : selectedProject)}
                disabled={disabled}
                title={disabled ? "Select a project first" : tab.label}
                className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all ${
                  disabled
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : active
                      ? "bg-primary/16 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={18} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-7 border-b border-border">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[16px] font-semibold">{activeTabInfo.label}</span>
            {version && (
              <span className="text-[10px] font-mono text-muted-foreground/70" title="Server version">
                {version.startsWith("v") ? version : `v${version}`}
              </span>
            )}
          </div>

          {selectedProject && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-border/60">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t.graph.selectedLabel}
              </span>
              <span className="text-[11px] text-primary font-mono truncate max-w-[300px]">
                {selectedProject}
              </span>
              <button
                onClick={() => navigate("stats", null)}
                className="text-muted-foreground/60 hover:text-foreground text-[12px] ml-1 transition-colors"
              >
                ×
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 min-h-0">
          {activeTab === "graph" ? (
            <GraphTab project={selectedProject} />
          ) : activeTab === "control" ? (
            <ControlTab />
          ) : (
            <StatsTab
              onSelectProject={(p) => navigate("graph", p)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
