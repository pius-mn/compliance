"use client";

import { useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import ProjectsView from "../../views/ProjectsView";
import type { ProjectsViewProps } from "../../views/ProjectsView";
import { apiFetchPage } from "../../utils/apiFetch";
import { usePageParam } from "../../hooks/usePageParam";
import type { Project } from "../../types";

export default function ProjectsPage() {
  const appState = useApp();
  const [projectPage, setProjectPage] = usePageParam("page", 1);

  const fetchProjectsPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (appState.projectSearch) params.search = appState.projectSearch;
    const result = await apiFetchPage<Project>("/api/v1/projects", projectPage || 1, appState.itemsPerPage || 10, params);
    appState.setProjects(result.data);
  }, [projectPage, appState.itemsPerPage, appState.projectSearch, appState.setProjects]);

  useEffect(() => {
    fetchProjectsPage();
  }, [fetchProjectsPage]);

  // Reset page when search changes
  useEffect(() => {
    setProjectPage(1);
  }, [appState.projectSearch]);

  const viewProps = appState as unknown as ProjectsViewProps;

  return (
    <ProjectsView
      {...viewProps}
      triggerBannerAlert={(type: string, msg: string) => appState.setSysAlert({ type, message: msg })}
      projectSearch={appState.projectSearch}
      setProjectSearch={appState.setProjectSearch}
      projectPage={projectPage}
      setProjectPage={(page: number | ((prev: number) => number)) => {
        if (typeof page === "function") {
          setProjectPage(page(projectPage));
        } else {
          setProjectPage(page);
        }
      }}
      itemsPerPage={appState.itemsPerPage}
      setItemsPerPage={appState.setItemsPerPage}
    />
  );
}
