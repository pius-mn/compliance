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
  const { projectSearch, itemsPerPage, setProjects } = appState;
  const [projectPage, setProjectPage] = usePageParam("page", 1);

  const fetchProjectsPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (projectSearch) params.search = projectSearch;
    const result = await apiFetchPage<Project>("/api/v1/projects", projectPage || 1, itemsPerPage || 10, params);
    setProjects(result.data);
  }, [projectPage, projectSearch, itemsPerPage, setProjects]);

  useEffect(() => {
    fetchProjectsPage();
  }, [fetchProjectsPage]);

  // Reset page when search changes
  useEffect(() => {
    setProjectPage(1);
  }, [projectSearch, setProjectPage]);

  const viewProps = appState as unknown as ProjectsViewProps;

  return (
    <ProjectsView
      {...viewProps}
      triggerBannerAlert={appState.triggerBannerAlert}
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
