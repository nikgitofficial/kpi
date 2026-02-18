"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type TxStatus = "No Doc" | "Pending" | "Done";

interface Agent {
  _id: string;
  name: string;
  workspaceEmail: string;
}

interface Transaction {
  _id: string;
  agentName: string;
  workspaceEmail: string;
  month: string;
  date: string;
  txId: string;
  typeOfDoc: string;
  startTime: string;
  endTime: string | null;
  tatMinutes: number;
  tatDecimal: number;
  tatFormatted: string;
  status: TxStatus;
  notes: string;
}

interface AgentEOD {
  name: string;
  totalHandlingTime: string;
  totalHandlingMins: number;
  done: number;
  pending: number;
  noDoc: number;
  totalTransactions: number;
  ahtPerTransaction: string;
  ahtMins: number;
  transactions: Transaction[];
}

function minsToHMS(mins: number): string {
  if (!mins || mins <= 0) return "-";
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
}

function buildAgentEOD(agents: Agent[], records: Transaction[]): AgentEOD[] {
  return agents.map((agent) => {
    const agentRecs = records.filter(
      (r) => r.agentName === agent.name && r.workspaceEmail === agent.workspaceEmail
    );
    const completed = agentRecs.filter((r) => r.tatMinutes > 0);
    const totalMins = completed.reduce((s, r) => s + r.tatMinutes, 0);
    const ahtMins   = completed.length > 0 ? totalMins / completed.length : 0;
    return {
      name:              agent.name,
      totalHandlingTime: minsToHMS(totalMins),
      totalHandlingMins: totalMins,
      done:              agentRecs.filter((r) => r.status === "Done").length,
      pending:           agentRecs.filter((r) => r.status === "Pending").length,
      noDoc:             agentRecs.filter((r) => r.status === "No Doc").length,
      totalTransactions: agentRecs.length,
      ahtPerTransaction: minsToHMS(ahtMins),
      ahtMins,
      transactions:      agentRecs,
    };
  });
}

const STATUS_CLASS: Record<TxStatus, string> = {
  "No Doc": "badge-nodoc", "Pending": "badge-pending", "Done": "badge-done",
};

function EODEmailGate({ onEnter }: { onEnter: (email: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = () => {
    const val = input.trim().toLowerCase();
    if (!val) { setError("Please enter your workspace email"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError("Enter a valid email address"); return; }
    setError(""); onEnter(val);
  };
  return (
    <div className="gate-wrap">
      <div className="gate-card">
        <div className="gate-logo">KPI<span>Track</span></div>
        <div className="gate-title">EOD Report</div>
        <div className="gate-sub">Enter your workspace email to view your team's end-of-day report.</div>
        <div className="gate-field">
          <input className={`gate-input${error ? " gate-input-err" : ""}`} type="email"
            placeholder="team@company.com" value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoFocus />
          {error && <p className="gate-error">{error}</p>}
        </div>
        <button className="gate-btn" onClick={handleSubmit}>View Report →</button>
      </div>
    </div>
  );
}

export default function EODPage() {
  const [workspaceEmail, setWorkspaceEmail] = useState<string | null>(null);
  const [agents, setAgents]     = useState<Agent[]>([]);
  const [records, setRecords]   = useState<Transaction[]>([]);
  const [loading, setLoading]   = useState(false);
  const [date, setDate]         = useState(new Date().toISOString().split("T")[0]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [now, setNow]           = useState(new Date());
  const [mounted, setMounted]   = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | "screenshot" | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = sessionStorage.getItem("kpiEmail");
    if (saved) setWorkspaceEmail(saved);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleEnterEmail = (email: string) => {
    sessionStorage.setItem("kpiEmail", email);
    setWorkspaceEmail(email);
  };

  const handleChangeEmail = () => {
    sessionStorage.removeItem("kpiEmail");
    setWorkspaceEmail(null);
    setAgents([]); setRecords([]);
  };

  const fetchAgents = useCallback(async (email: string) => {
    try {
      const res  = await fetch(`/api/agents?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch { /* silent */ }
  }, []);

  const fetchAll = useCallback(async (email: string, d: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/transactions?workspaceEmail=${encodeURIComponent(email)}&date=${d}&limit=1000`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (workspaceEmail) { fetchAgents(workspaceEmail); fetchAll(workspaceEmail, date); }
  }, [workspaceEmail, date, fetchAgents, fetchAll]);

  const agentEOD      = buildAgentEOD(agents, records);
  const totalDone     = agentEOD.reduce((s, a) => s + a.done, 0);
  const totalPending  = agentEOD.reduce((s, a) => s + a.pending, 0);
  const totalNoDoc    = agentEOD.reduce((s, a) => s + a.noDoc, 0);
  const totalTx       = agentEOD.reduce((s, a) => s + a.totalTransactions, 0);
  const totalMins     = agentEOD.reduce((s, a) => s + a.totalHandlingMins, 0);
  const completedRecs = records.filter((r) => r.tatMinutes > 0);
  const overallAHT    = completedRecs.length > 0 ? totalMins / completedRecs.length : 0;

  const clockStr  = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const clockAMPM = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const fileSlug  = `EOD_${workspaceEmail?.split("@")[0]}_${date}`;

  // ── EXPORT EXCEL ──────────────────────────────────────────────
  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["Agent Daily Production Report"],
        [`Date: ${dateLabel}`],
        [`Workspace: ${workspaceEmail}`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ["Agent Name", "Total Handling Time", "# Done", "# Pending", "# No Doc", "Total TX", "AHT per TX"],
        ...agentEOD.map((a) => [
          a.name,
          a.totalTransactions > 0 ? a.totalHandlingTime : "-",
          a.done,
          a.pending,
          a.noDoc,
          a.totalTransactions,
          a.ahtMins > 0 ? a.ahtPerTransaction : "-",
        ]),
        [],
        ["TOTAL", minsToHMS(totalMins), totalDone, totalPending, totalNoDoc, totalTx, minsToHMS(overallAHT)],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      ws1["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Summary");

      // Individual agent sheets
      agentEOD.forEach((agent) => {
        if (agent.transactions.length === 0) return;
        const rows = [
          [agent.name],
          [`Date: ${dateLabel}`],
          [],
          ["#", "TX ID", "Type of Doc", "Start Time", "End Time", "TAT", "Status", "TAT Decimal", "Notes"],
          ...agent.transactions.map((tx, i) => [
            agent.transactions.length - i,
            tx.txId,
            tx.typeOfDoc,
            tx.startTime,
            tx.endTime ?? "ACTIVE",
            tx.tatFormatted || "-",
            tx.status,
            tx.tatDecimal > 0 ? tx.tatDecimal.toFixed(3) : "-",
            tx.notes || "-",
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 4 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
        // Sheet name max 31 chars, strip special chars
        const sheetName = agent.name.replace(/[:\\\/\?\*\[\]]/g, "").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `${fileSlug}.xlsx`);
    } catch (e) {
      console.error("Excel export error:", e);
      alert("Excel export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  // ── EXPORT PDF ────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const el = reportRef.current;
      if (!el) return;

      // Temporarily expand all agents for PDF
      const prevExpanded = expandedAgent;
      setExpandedAgent("__all__");
      await new Promise((r) => setTimeout(r, 300));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f5f6fa",
        logging: false,
      });

      setExpandedAgent(prevExpanded);

      const imgW = 210; // A4 width mm
      const imgH = (canvas.height * imgW) / canvas.width;
      const pdf  = new jsPDF({ orientation: imgH > imgW ? "p" : "l", unit: "mm", format: "a4" });

      const pageH  = pdf.internal.pageSize.getHeight();
      let pos = 0;
      while (pos < imgH) {
        if (pos > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, -pos, imgW, imgH);
        pos += pageH;
      }

      pdf.save(`${fileSlug}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  // ── SCREENSHOT ────────────────────────────────────────────────
  const handleScreenshot = async () => {
    setExporting("screenshot");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const el = reportRef.current;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f5f6fa",
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `${fileSlug}_screenshot.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Screenshot error:", e);
      alert("Screenshot failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  if (!mounted) return null;

  if (!workspaceEmail) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f6fa; font-family: 'Plus Jakarta Sans', sans-serif; }
        .gate-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f6fa; padding: 24px; }
        .gate-card { background: #fff; border: 1.5px solid #e2e5f0; border-radius: 16px; padding: 48px 44px; width: 100%; max-width: 440px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); text-align: center; }
        .gate-logo { font-family: 'Fira Code', monospace; font-size: 22px; font-weight: 700; color: #1a1d2e; margin-bottom: 28px; }
        .gate-logo span { color: #4f46e5; }
        .gate-title { font-size: 20px; font-weight: 800; color: #1a1d2e; margin-bottom: 8px; }
        .gate-sub { font-size: 13px; color: #8890b0; margin-bottom: 28px; line-height: 1.6; }
        .gate-field { margin-bottom: 12px; text-align: left; }
        .gate-input { width: 100%; background: #f0f2f8; border: 1.5px solid #e2e5f0; border-radius: 8px; padding: 13px 16px; font-family: 'Fira Code', monospace; font-size: 14px; color: #1a1d2e; outline: none; }
        .gate-input:focus { border-color: #4f46e5; background: #fff; }
        .gate-input-err { border-color: #dc2626 !important; }
        .gate-input::placeholder { color: #8890b0; }
        .gate-error { font-size: 11px; color: #dc2626; margin-top: 6px; font-weight: 600; }
        .gate-btn { width: 100%; padding: 13px; background: #4f46e5; border: none; border-radius: 8px; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .gate-btn:hover { background: #4338ca; }
      `}</style>
      <EODEmailGate onEnter={handleEnterEmail} />
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #f5f6fa; --surface: #ffffff; --surface-2: #f0f2f8;
          --border: #e2e5f0; --border-2: #cdd2e8;
          --text: #1a1d2e; --text-2: #4a4f6a; --text-3: #8890b0;
          --indigo: #4f46e5; --indigo-lt: #eef2ff;
          --green: #16a34a; --green-lt: #dcfce7;
          --amber: #d97706; --amber-lt: #fef3c7;
          --red: #dc2626; --red-lt: #fee2e2;
          --radius: 10px; --radius-sm: 6px;
          --shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }

        /* TOPBAR */
        .topbar { background: var(--text); color: #fff; padding: 0 24px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; gap: 16px; }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .topbar-logo { font-family: 'Fira Code', monospace; font-size: 15px; font-weight: 600; }
        .topbar-logo span { color: #818cf8; }
        .topbar-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.15); }
        .topbar-label { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); }
        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .workspace-pill { display: flex; align-items: center; gap: 7px; background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.35); border-radius: 20px; padding: 4px 10px 4px 8px; max-width: 240px; }
        .workspace-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; flex-shrink: 0; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .workspace-email { font-family: 'Fira Code', monospace; font-size: 11px; color: #a5b4fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .workspace-change { background: transparent; border: none; color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; padding: 0 0 0 2px; }
        .workspace-change:hover { color: rgba(255,255,255,0.8); }
        .clock-time { font-family: 'Fira Code', monospace; font-size: 15px; font-weight: 600; color: #34d399; }
        .clock-ampm { font-family: 'Fira Code', monospace; font-size: 11px; color: rgba(255,255,255,0.35); }
        .back-link { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-sm); padding: 5px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.7); text-decoration: none; font-weight: 600; }
        .back-link:hover { background: rgba(255,255,255,0.15); color: #fff; }

        /* EXPORT BUTTONS */
        .export-bar { display: flex; align-items: center; gap: 8px; }
        .export-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 13px; border-radius: var(--radius-sm);
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          cursor: pointer; border: 1.5px solid; transition: all 0.15s;
          white-space: nowrap;
        }
        .export-btn:disabled { opacity: 0.5; cursor: wait; }
        .export-btn-excel { background: #dcfce7; border-color: #86efac; color: #15803d; }
        .export-btn-excel:hover:not(:disabled) { background: #bbf7d0; border-color: #4ade80; }
        .export-btn-pdf   { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
        .export-btn-pdf:hover:not(:disabled)   { background: #fecaca; border-color: #f87171; }
        .export-btn-shot  { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }
        .export-btn-shot:hover:not(:disabled)  { background: #e0e7ff; border-color: #a5b4fc; }

        /* PAGE */
        .page { max-width: 1140px; margin: 0 auto; padding: 28px 24px 80px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
        .page-title { font-size: 26px; font-weight: 800; letter-spacing: -1px; }
        .page-subtitle { font-size: 12px; color: var(--text-3); margin-top: 3px; font-family: 'Fira Code', monospace; }
        .page-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .date-picker-wrap { display: flex; align-items: center; gap: 10px; }
        .date-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-3); }
        .date-input { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; font-family: 'Fira Code', monospace; font-size: 13px; color: var(--text); outline: none; }
        .date-input:focus { border-color: var(--indigo); }

        /* OVERVIEW */
        .overview-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
        .ov-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 16px 14px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .ov-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }
        .ov-total::after   { background: var(--indigo); }
        .ov-done::after    { background: var(--green); }
        .ov-pending::after { background: var(--amber); }
        .ov-nodoc::after   { background: var(--red); }
        .ov-agents::after  { background: #7c3aed; }
        .ov-aht::after     { background: #0891b2; }
        .ov-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); margin-bottom: 6px; }
        .ov-value { font-family: 'Fira Code', monospace; font-size: 24px; font-weight: 600; line-height: 1; letter-spacing: -1px; }
        .ov-total   .ov-value { color: var(--indigo); }
        .ov-done    .ov-value { color: var(--green); }
        .ov-pending .ov-value { color: var(--amber); }
        .ov-nodoc   .ov-value { color: var(--red); }
        .ov-agents  .ov-value { color: #7c3aed; }
        .ov-aht     .ov-value { color: #0891b2; font-size: 16px; }

        /* MAIN TABLE */
        .main-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
        .main-card-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1.5px solid var(--border); background: var(--surface-2); }
        .main-card-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-2); }

        .agent-table { width: 100%; border-collapse: collapse; }
        .agent-table thead { background: #1e3a5f; }
        .agent-table th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; border-right: 1px solid rgba(255,255,255,0.1); }
        .agent-table th:last-child { border-right: none; }
        .agent-table tbody tr { border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.1s; }
        .agent-table tbody tr:last-child { border-bottom: none; }
        .agent-table tbody tr:hover td { background: #f8f9ff; }
        .agent-table tbody tr.expanded td { background: #eef2ff; }
        .agent-table td { padding: 11px 16px; font-size: 13px; vertical-align: middle; border-right: 1px solid var(--border); }
        .agent-table td:last-child { border-right: none; }
        .td-agent-name { font-weight: 700; }
        .td-handling { font-family: 'Fira Code', monospace; font-size: 12px; color: var(--text-2); }
        .td-done    { font-family: 'Fira Code', monospace; font-weight: 700; color: var(--green); text-align: center; }
        .td-pending { font-family: 'Fira Code', monospace; font-weight: 700; color: var(--amber); text-align: center; }
        .td-nodoc   { font-family: 'Fira Code', monospace; font-weight: 700; color: var(--red); text-align: center; }
        .td-total   { font-family: 'Fira Code', monospace; font-weight: 700; color: var(--indigo); text-align: center; }
        .td-aht     { font-family: 'Fira Code', monospace; font-size: 12px; color: #0891b2; }
        .td-zero    { color: var(--text-3); text-align: center; }
        .td-dash    { color: var(--text-3); font-family: 'Fira Code', monospace; }
        .expand-chevron { display: inline-flex; align-items: center; color: var(--text-3); font-style: normal; font-size: 13px; transition: transform 0.2s; }
        .expand-chevron.open { transform: rotate(180deg); }

        .tx-detail-row td { padding: 0 !important; background: var(--surface-2) !important; border-right: none !important; }
        .tx-detail-inner { padding: 16px 20px; border-top: 1px solid var(--border); }
        .tx-detail-title { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); margin-bottom: 12px; }
        .tx-mini-table { width: 100%; border-collapse: collapse; }
        .tx-mini-table thead { background: #f0f2f8; }
        .tx-mini-table th { padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); border-bottom: 1.5px solid var(--border); white-space: nowrap; }
        .tx-mini-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); font-family: 'Fira Code', monospace; font-size: 11px; color: var(--text-2); border-right: none; }
        .tx-mini-table tbody tr:last-child td { border-bottom: none; }
        .tx-mini-table tbody tr:hover td { background: #fff; }

        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        .badge::before { content: ''; width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; }
        .badge-nodoc   { background: var(--red-lt);   color: var(--red);   border: 1px solid #fca5a5; }
        .badge-nodoc::before   { background: var(--red); }
        .badge-pending { background: var(--amber-lt); color: var(--amber); border: 1px solid #fcd34d; }
        .badge-pending::before { background: var(--amber); }
        .badge-done    { background: var(--green-lt); color: var(--green); border: 1px solid #86efac; }
        .badge-done::before    { background: var(--green); }

        .totals-row td { background: #1e3a5f !important; color: #fff !important; font-weight: 700; padding: 12px 16px; font-family: 'Fira Code', monospace; font-size: 13px; border-top: 2px solid #1e3a5f; border-right: 1px solid rgba(255,255,255,0.1); }
        .totals-row td:last-child { border-right: none; }

        .loading-state { display: flex; justify-content: center; padding: 48px; }
        .loading-dots { display: inline-flex; gap: 5px; }
        .loading-dots span { width: 6px; height: 6px; background: var(--border-2); border-radius: 50%; animation: ld 0.8s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes ld { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }
        .empty-agents { padding: 48px; text-align: center; font-size: 13px; color: var(--text-3); }

        /* Exporting overlay */
        .export-overlay { position: fixed; inset: 0; background: rgba(26,29,46,0.55); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(3px); }
        .export-overlay-card { background: #fff; border-radius: 14px; padding: 32px 40px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .export-overlay-icon { font-size: 36px; margin-bottom: 12px; }
        .export-overlay-text { font-size: 14px; font-weight: 700; color: #1a1d2e; margin-bottom: 4px; }
        .export-overlay-sub { font-size: 12px; color: #8890b0; }

        @media (max-width: 768px) {
          .overview-grid { grid-template-columns: repeat(3, 1fr); }
          .page { padding: 16px 14px 60px; }
          .export-bar { flex-wrap: wrap; }
        }
        @media (max-width: 480px) {
          .overview-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* Export overlay spinner */}
      {exporting && (
        <div className="export-overlay">
          <div className="export-overlay-card">
            <div className="export-overlay-icon">
              {exporting === "excel" ? "📊" : exporting === "pdf" ? "📄" : "📸"}
            </div>
            <div className="export-overlay-text">
              {exporting === "excel" ? "Generating Excel…" : exporting === "pdf" ? "Generating PDF…" : "Taking Screenshot…"}
            </div>
            <div className="export-overlay-sub">Please wait a moment</div>
          </div>
        </div>
      )}

      <nav className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">KPI<span>Track</span></div>
          <div className="topbar-sep" />
          <div className="topbar-label">EOD Report</div>
        </div>
        <div className="topbar-right">
          <div className="workspace-pill">
            <span className="workspace-dot" />
            <span className="workspace-email">{workspaceEmail}</span>
            <button className="workspace-change" onClick={handleChangeEmail}>✕</button>
          </div>
          <span className="clock-time">{clockStr}</span>
          <span className="clock-ampm">{clockAMPM}</span>
          <a href="/analytics" className="back-link">📊 Analytics</a>
          <a href="/" className="back-link">← TX Log</a>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">Agent Daily Production</div>
            <div className="page-subtitle">{dateLabel}</div>
          </div>
          <div className="page-header-right">
            <div className="date-picker-wrap">
              <span className="date-label">Date</span>
              <input className="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {/* Export buttons */}
            <div className="export-bar">
              <button className="export-btn export-btn-excel" onClick={handleExportExcel} disabled={!!exporting || agents.length === 0}>
                📊 Export Excel
              </button>
              <button className="export-btn export-btn-pdf" onClick={handleExportPDF} disabled={!!exporting || agents.length === 0}>
                📄 Export PDF
              </button>
              <button className="export-btn export-btn-shot" onClick={handleScreenshot} disabled={!!exporting || agents.length === 0}>
                📸 Screenshot
              </button>
            </div>
          </div>
        </div>

        {/* Reportable area starts here */}
        <div ref={reportRef}>
          <div className="overview-grid">
            <div className="ov-card ov-total"><div className="ov-label">Total TX</div><div className="ov-value">{totalTx}</div></div>
            <div className="ov-card ov-done"><div className="ov-label">Done</div><div className="ov-value">{totalDone}</div></div>
            <div className="ov-card ov-pending"><div className="ov-label">Pending</div><div className="ov-value">{totalPending}</div></div>
            <div className="ov-card ov-nodoc"><div className="ov-label">No Doc</div><div className="ov-value">{totalNoDoc}</div></div>
            <div className="ov-card ov-agents"><div className="ov-label">Active Agents</div><div className="ov-value">{agentEOD.filter((a) => a.totalTransactions > 0).length}</div></div>
            <div className="ov-card ov-aht"><div className="ov-label">Overall AHT</div><div className="ov-value">{minsToHMS(overallAHT)}</div></div>
          </div>

          <div className="main-card">
            <div className="main-card-header">
              <span className="main-card-title">Agent Daily Production</span>
              <span style={{ fontSize: 11, fontFamily: "Fira Code", color: "var(--text-3)" }}>
                {agents.length} agent{agents.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="loading-state"><div className="loading-dots"><span /><span /><span /></div></div>
            ) : agents.length === 0 ? (
              <div className="empty-agents">No agents found for this workspace. Add agents from the TX Log page.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>AGENT DAILY PRODUCTION</th>
                      <th>⏱ TOTAL Handling Time</th>
                      <th style={{ textAlign: "center" }}># Done</th>
                      <th style={{ textAlign: "center" }}># Pending</th>
                      <th style={{ textAlign: "center" }}># No Doc</th>
                      <th style={{ textAlign: "center" }}>Total Transactions</th>
                      <th>AHT per Transaction</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentEOD.map((agent) => {
                      const isExpanded = expandedAgent === agent.name || expandedAgent === "__all__";
                      const hasData    = agent.totalTransactions > 0;
                      return (
                        <>
                          <tr key={agent.name} className={isExpanded ? "expanded" : ""}
                            onClick={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}>
                            <td className="td-agent-name">{agent.name}</td>
                            <td className="td-handling">{hasData ? agent.totalHandlingTime : <span className="td-dash">-</span>}</td>
                            <td className={hasData && agent.done > 0 ? "td-done" : "td-zero"}>{agent.done}</td>
                            <td className={hasData && agent.pending > 0 ? "td-pending" : "td-zero"}>{agent.pending}</td>
                            <td className={hasData && agent.noDoc > 0 ? "td-nodoc" : "td-zero"}>{agent.noDoc}</td>
                            <td className={hasData ? "td-total" : "td-zero"}>{agent.totalTransactions}</td>
                            <td className="td-aht">{hasData && agent.ahtMins > 0 ? agent.ahtPerTransaction : <span className="td-dash">-</span>}</td>
                            <td style={{ width: 32 }}>{hasData && <em className={`expand-chevron${isExpanded ? " open" : ""}`}>⌄</em>}</td>
                          </tr>

                          {isExpanded && agent.transactions.length > 0 && (
                            <tr className="tx-detail-row" key={`${agent.name}-detail`}>
                              <td colSpan={8}>
                                <div className="tx-detail-inner">
                                  <div className="tx-detail-title">
                                    {agent.name} — {agent.transactions.length} transaction{agent.transactions.length !== 1 ? "s" : ""}
                                  </div>
                                  <table className="tx-mini-table">
                                    <thead>
                                      <tr><th>#</th><th>ID</th><th>Type of Doc</th><th>Start</th><th>End</th><th>TAT</th><th>Status</th><th>Decimal</th><th>Notes</th></tr>
                                    </thead>
                                    <tbody>
                                      {agent.transactions.map((tx, i) => (
                                        <tr key={tx._id}>
                                          <td style={{ color: "var(--text-3)" }}>{agent.transactions.length - i}</td>
                                          <td style={{ fontWeight: 600, color: "var(--text)" }}>{tx.txId}</td>
                                          <td style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{tx.typeOfDoc}</td>
                                          <td>{tx.startTime}</td>
                                          <td>{tx.endTime ?? <span style={{ color: "var(--indigo)" }}>ACTIVE</span>}</td>
                                          <td style={{ color: "var(--indigo)", fontWeight: 600 }}>{tx.tatFormatted || "—"}</td>
                                          <td><span className={`badge ${STATUS_CLASS[tx.status]}`}>{tx.status}</span></td>
                                          <td style={{ color: "var(--text-3)" }}>{tx.tatDecimal > 0 ? tx.tatDecimal.toFixed(3) : "—"}</td>
                                          <td style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{tx.notes || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}

                    <tr className="totals-row">
                      <td>TOTAL</td>
                      <td>{minsToHMS(totalMins)}</td>
                      <td style={{ textAlign: "center", color: "#86efac" }}>{totalDone}</td>
                      <td style={{ textAlign: "center", color: "#fcd34d" }}>{totalPending}</td>
                      <td style={{ textAlign: "center", color: "#fca5a5" }}>{totalNoDoc}</td>
                      <td style={{ textAlign: "center" }}>{totalTx}</td>
                      <td style={{ color: "#7dd3fc" }}>{minsToHMS(overallAHT)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        {/* End reportable area */}
      </div>
    </>
  );
}