"use client";

import ErrorFallback from "../../components/ErrorFallback";

export default function TechniciansError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Technicians Error" />;
}
