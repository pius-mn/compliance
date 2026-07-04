"use client";

import ErrorFallback from "../../components/ErrorFallback";

export default function SafaricomUsersError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Users Error" />;
}
