"use client";

import ErrorFallback from "../../components/ErrorFallback";

export default function EhsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="EHS Documents Error" />;
}
