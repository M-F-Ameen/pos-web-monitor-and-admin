import { Button } from "../Button";
import "./TablePagination.css";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  previousLabel?: string;
  nextLabel?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
  previousLabel = "السابق",
  nextLabel = "التالي",
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  return (
    <div
      className={["table-pagination", className].filter(Boolean).join(" ")}
      aria-label="ترقيم الصفحات"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="table-pagination__button"
        disabled={safeCurrentPage === 1}
        onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
      >
        {previousLabel}
      </Button>
      <span className="table-pagination__status">
        صفحة {safeCurrentPage} من {safeTotalPages}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="table-pagination__button"
        disabled={safeCurrentPage === safeTotalPages}
        onClick={() =>
          onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))
        }
      >
        {nextLabel}
      </Button>
    </div>
  );
}
