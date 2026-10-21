import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp, Download, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  exportValue?: (row: T) => string | number;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  exportName: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export default function DataTable<T>({ rows, columns, exportName, pageSize = 8, emptyTitle = "Nothing to show yet", emptyDescription = "Records will appear here when they are logged.", onRowClick, isRowSelected }: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matches = query ? rows.filter(row => columns.some(column => String(column.exportValue?.(row) ?? column.sortValue?.(row) ?? "").toLocaleLowerCase().includes(query))) : rows;
    const column = columns.find(item => item.key === sortKey);
    if (!column) return matches;
    return [...matches].sort((a, b) => {
      const av = column.sortValue?.(a) ?? column.exportValue?.(a) ?? "";
      const bv = column.sortValue?.(b) ?? column.exportValue?.(b) ?? "";
      const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, rows, search, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportRows = () => filtered.map(row => Object.fromEntries(columns.map(column => [column.label, column.exportValue?.(row) ?? column.sortValue?.(row) ?? ""])));
  const exportCsv = () => {
    const lines = [columns.map(column => csvEscape(column.label)).join(","), ...filtered.map(row => columns.map(column => csvEscape(column.exportValue?.(row) ?? column.sortValue?.(row) ?? "")).join(","))];
    const blob = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${exportName}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows());
    XLSX.utils.book_append_sheet(workbook, sheet, "Report");
    XLSX.writeFile(workbook, `${exportName}.xlsx`);
  };

  return <section className="table-card">
    <div className="table-toolbar">
      <label className="search-box"><Search size={16} /><input aria-label="Search report" placeholder="Search this report" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <div className="export-actions">
        <button type="button" className="export-button" onClick={exportCsv}><Download size={15} /> CSV</button>
        <button type="button" className="export-button" onClick={exportExcel}><FileSpreadsheet size={15} /> Excel</button>
      </div>
    </div>
    {filtered.length === 0 ? <div className="empty-state"><div className="empty-mark">—</div><strong>{rows.length ? "No matching records" : emptyTitle}</strong><p>{rows.length ? "Try changing your search or filters." : emptyDescription}</p></div> : <>
      <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(column => <th key={column.key}><button type="button" className="sort-button" onClick={() => { setSortKey(column.key); setSortDirection(direction => sortKey === column.key && direction === "asc" ? "desc" : "asc"); }} aria-label={`Sort by ${column.label}`}>{column.label}{sortKey === column.key && (sortDirection === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</button></th>)}</tr></thead>
        <tbody>{visible.map((row, index) => <tr key={(row as { id?: number | string }).id ?? index} className={onRowClick ? `map-linked-row${isRowSelected?.(row) ? " map-linked-row-selected" : ""}` : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={onRowClick ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRowClick(row); } } : undefined} tabIndex={onRowClick ? 0 : undefined} aria-selected={onRowClick ? Boolean(isRowSelected?.(row)) : undefined}>{columns.map(column => <td key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>
      <div className="table-footer"><span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><div className="pagination"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
    </>}
  </section>;
}
