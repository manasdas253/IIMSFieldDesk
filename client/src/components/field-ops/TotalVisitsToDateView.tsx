import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, RefreshCw } from "lucide-react";
import { indiaDateString } from "@shared/fieldOps";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { formatINR } from "./Reports";

type Outputs = inferRouterOutputs<AppRouter>;
type VisitRow = Outputs["fieldOps"]["reports"]["allVisitsToDate"]["rows"][number];
const PAGE_SIZE = 25;

function dateLabel(date: string) {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function outcomeTone(value: string) {
  if (/no-show|no response|pending|unplanned/i.test(value)) return "warning";
  if (/visited|positive|closed/i.test(value)) return "good";
  return "neutral";
}

function LoadingVisits() {
  return <div className="report-loading" aria-label="Loading all visits"><div className="skeleton skeleton-wide" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div>;
}

export default function TotalVisitsToDateView({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(1);
  const visits = trpc.fieldOps.reports.allVisitsToDate.useQuery({ page, pageSize: PAGE_SIZE });
  const data = visits.data;
  const total = data?.totalVisits ?? 0;
  const currentPage = data?.page ?? page;
  const totalPages = data?.totalPages ?? 1;
  const firstRow = data?.rows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * PAGE_SIZE, total);

  return <div className="view-stack">
    <div className="page-heading">
      <div><p className="eyebrow">FIELD VISITS</p><h1>All visits to date</h1><p className="page-subtitle">Daily Visit Log entries through {dateLabel(data?.to ?? indiaDateString())}.</p></div>
      <button type="button" className="button button-secondary" onClick={onBack}><ArrowLeft size={15} /> Overview</button>
    </div>
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">DAILY VISIT LOG</p><h2>Visit history</h2></div><span className="panel-count">{visits.isLoading ? "Loading…" : visits.isError ? "—" : `${total.toLocaleString("en-IN")} ${total === 1 ? "visit" : "visits"}`}</span></div>
      {visits.isLoading ? <LoadingVisits /> : visits.isError ? <div className="error-block"><strong>Couldn’t load visit details.</strong><span>Check your connection and try again.</span><button type="button" className="button button-secondary button-small" onClick={() => void visits.refetch()}><RefreshCw size={14} /> Retry</button></div> : total === 0 ? <div className="empty-state"><div className="empty-mark">—</div><strong>No visits logged yet</strong><p>Daily Visit Log entries through today will appear here.</p></div> : <>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Employee</th><th>Customer</th><th>Location</th><th>Purpose</th><th>Outcome</th><th>Travel cost</th></tr></thead>
          <tbody>{data?.rows.map((row: VisitRow) => <tr key={row.id}>
            <td>{dateLabel(row.visitDate)}</td>
            <td><strong className="table-primary-text">{row.employeeName}</strong></td>
            <td>{row.customerName}</td>
            <td><span className="table-location"><MapPin size={13} />{row.location}</span></td>
            <td>{row.purpose}</td>
            <td><span className={`status-badge ${outcomeTone(row.outcome)}`}><i />{row.outcome}</span></td>
            <td><strong className="amount-cell">{formatINR(row.travelCost)}</strong></td>
          </tr>)}</tbody>
        </table></div>
        <div className="table-footer"><span>Showing {firstRow}–{lastRow} of {total.toLocaleString("en-IN")}</span><div className="pagination"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
      </>}
    </section>
  </div>;
}
