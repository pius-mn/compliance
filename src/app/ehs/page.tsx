"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import EhsView from "../../views/EhsView";
import type { EhsViewProps } from "../../views/EhsView";
import { apiFetchPage } from "../../utils/apiFetch";
import { usePageParam } from "../../hooks/usePageParam";
import { getActiveContractorLabel } from "../../utils/helpers";
import type { TechnicianDocument } from "../../types";


export default function EhsPage() {
  const appState = useApp();
  const { docSearch, itemsPerPage, setDocuments } = appState;
  const [docPage, setDocPage] = usePageParam("page", 1);
  const [docsTotal, setDocsTotal] = useState(0);

  const fetchEHSDocsPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (docSearch) params.status = docSearch;
    const result = await apiFetchPage<TechnicianDocument>("/api/v1/ehs/documents", docPage || 1, itemsPerPage || 10, params);
    setDocuments(result.data);
    setDocsTotal(result.total);
  }, [docPage, docSearch, itemsPerPage, setDocuments]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEHSDocsPage();
  }, [fetchEHSDocsPage]);

  const viewProps = appState as unknown as EhsViewProps;

  return (
    <EhsView
      {...viewProps}
      docPage={docPage}
      setDocPage={setDocPage}
      triggerBannerAlert={appState.triggerBannerAlert}
      filteredDocuments={appState.documents || []}
      paginatedDocuments={appState.documents || []}
      documents={appState.documents || []}
      docsTotal={docsTotal}
      getActiveContractorLabel={getActiveContractorLabel}
      filteredContractors={appState.contractors}
      allDocumentTypes={appState.allDocumentTypes || []}
    />
  );
}
