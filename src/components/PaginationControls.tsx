import React from "react";

interface PaginationControlsProps {
  /** Current active page (1-indexed) */
  currentPage: number;
  /** Callback to change the page */
  setCurrentPage: (page: number) => void;
  /** Total number of items across all pages (from server or array length) */
  totalItems: number;
  /** Number of items displayed per page */
  itemsPerPage: number;
  /** Optional label for what's being counted (default: "entries") */
  label?: string;
  /** Optional extra classes for the container */
  className?: string;
  /** Optional content rendered before the info text on the left side */
  children?: React.ReactNode;
  /** Number of page buttons to show on each side of the current page (default: 1) */
  siblingCount?: number;
}

function getPageNumbers(currentPage: number, totalPages: number, siblingCount: number): (number | "ellipsis")[] {
  const totalPageNumbers = siblingCount * 2 + 5;

  // If total pages fit within the window, show all
  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    // More pages on the right side
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    // More pages on the left side
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
    return [1, "ellipsis", ...rightRange];
  }

  // Ellipsis on both sides
  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", totalPages];
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  setCurrentPage,
  totalItems,
  itemsPerPage,
  label = "entries",
  className = "",
  children,
  siblingCount = 1,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pageNumbers = getPageNumbers(currentPage, totalPages, siblingCount);

  const btnBase =
    "px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors cursor-pointer select-none";
  const btnInactive =
    "text-slate-600 bg-white border-slate-300 hover:bg-slate-50";
  const btnActive =
    "text-white bg-[#18863A] border-[#18863A] hover:bg-[#156e2f]";
  const btnDisabled = "disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div
      className={`px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 ${className}`}
    >
      {/* Info text — always visible */}
      <span className="text-xs sm:text-sm text-slate-500 flex items-center gap-3">
        {children}
        Showing {startItem} to {endItem} of {totalItems} {label}
      </span>

      {/* Controls row */}
      <div className="flex items-center justify-center sm:justify-end gap-1.5">
        {/* Previous button */}
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`${btnBase} ${btnInactive} ${btnDisabled}`}
        >
          Previous
        </button>

        {/* Page number buttons — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1.5">
          {pageNumbers.map((page, idx) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-slate-400 select-none">
                …
              </span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`${btnBase} ${btnDisabled} ${
                  page === currentPage ? btnActive : btnInactive
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`${btnBase} ${btnInactive} ${btnDisabled}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};
