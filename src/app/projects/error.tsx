"use client";

import ErrorFallback from "../../components/ErrorFallback";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Projects Error" />;
}
