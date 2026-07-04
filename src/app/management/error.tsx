"use client";

import ErrorFallback from "../../components/ErrorFallback";

export default function ManagementError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Management Error" />;
}
