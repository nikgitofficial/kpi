"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  status: "No Doc" | "Pending" | "Done";
  notes: string;
}

interface AgentStats {
  name: string;
  totalTx: number;
  done: number;
  pending: number;
  noDoc: number;
  totalMinutes: number;
  ahtMinutes: number;
  completionRate: number;
}

interface DailyTrend {
  date: string;
  total: number;
  done: number;
  pending: number;
  noDoc: number;
  avgAht: number;
}

interface DocTypeStats {
  name: string;
  count: number;
  avgTat: number;
}

function EmailGate({ onEnter }: { onEnter: (email: string) => void }) {
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
        <div className="gate-title">Analytics Dashboard</div>
        <div className="gate-sub">Enter your workspace email to view performance analytics.</div>
        <div className="gate-field">
          <input className={`gate-input${error ? " gate-input-err" : ""}`} type="email"
            placeholder="team@company.com" value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoFocus />
          {error && <p className="gate-error">{error}</p>}
        </div>
        <button className="gate-btn" onClick={handleSubmit}>View Analytics →</button>
      </div>
    </div>
  );
}

function minsToHMS(mins: number): string {
  if (!mins || mins <= 0) return "-";
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

export default function AnalyticsPage() {
  const [workspaceEmail, setWorkspaceEmail] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [now, setNow] = useState(new Date());
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
    setAgents([]);
    setTransactions([]);
  };

  const fetchAgents = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/agents?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch { /* silent */ }
  }, []);

  const fetchTransactions = useCallback(async (email: string, from: string, to: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?workspaceEmail=${encodeURIComponent(email)}&from=${from}&to=${to}&limit=5000`);
      const data = await res.json();
      setTransactions(data.records || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (workspaceEmail) {
      fetchAgents(workspaceEmail);
      fetchTransactions(workspaceEmail, dateFrom, dateTo);
    }
  }, [workspaceEmail, dateFrom, dateTo, fetchAgents, fetchTransactions]);

  const dateLabel = `${new Date(dateFrom + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${new Date(dateTo + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const fileSlug = `Analytics_${workspaceEmail?.split("@")[0]}_${dateFrom}_to_${dateTo}`;

  // ── EXPORT HANDLERS ───────────────────────────────────────────
  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const summaryData = [
        ["Performance Analytics Report"],
        [`Period: ${dateLabel}`],
        [`Workspace: ${workspaceEmail}`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ["Metric", "Value"],
        ["Total Transactions", totalTx],
        ["Done", totalDone],
        ["Pending", totalPending],
        ["No Doc", totalNoDoc],
        ["Average AHT", minsToHMS(overallAht)],
        ["Completion Rate", `${completionRate.toFixed(1)}%`],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      ws1["!cols"] = [{ wch: 24 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Summary");

      const agentData = [
        ["Agent Statistics"],
        [`Period: ${dateLabel}`],
        [],
        ["Agent Name", "Total TX", "Done", "Pending", "No Doc", "AHT", "Completion Rate"],
        ...agentStats.sort((a, b) => b.totalTx - a.totalTx).map((a) => [
          a.name,
          a.totalTx,
          a.done,
          a.pending,
          a.noDoc,
          minsToHMS(a.ahtMinutes),
          `${a.completionRate.toFixed(1)}%`,
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(agentData);
      ws2["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Agent Stats");

      const docData = [
        ["Doc Type Statistics"],
        [`Period: ${dateLabel}`],
        [],
        ["Type", "Count", "Avg TAT"],
        ...docTypeStats.map((dt) => [dt.name, dt.count, minsToHMS(dt.avgTat)]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(docData);
      ws3["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Doc Types");

      const dailyData = [
        ["Daily Transaction Trends"],
        [`Period: ${dateLabel}`],
        [],
        ["Date", "Total", "Done", "Pending", "No Doc", "Avg AHT"],
        ...dailyTrends.map((d) => [d.date, d.total, d.done, d.pending, d.noDoc, minsToHMS(d.avgAht)]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(dailyData);
      ws4["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Daily Trends");

      XLSX.writeFile(wb, `${fileSlug}.xlsx`);
    } catch (e) {
      console.error("Excel export error:", e);
      alert("Excel export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const el = reportRef.current;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f5f6fa",
        logging: false,
      });

      const imgW = 210;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pdf = new jsPDF({ orientation: imgH > imgW ? "p" : "l", unit: "mm", format: "a4" });

      const pageH = pdf.internal.pageSize.getHeight();
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

  // ── COMPUTE ANALYTICS ─────────────────────────────────────────
  const agentStats: AgentStats[] = agents.map((agent) => {
    const agentTx = transactions.filter((t) => t.agentName === agent.name);
    const completed = agentTx.filter((t) => t.tatMinutes > 0);
    const totalMins = completed.reduce((s, t) => s + t.tatMinutes, 0);
    const ahtMins = completed.length > 0 ? totalMins / completed.length : 0;
    const done = agentTx.filter((t) => t.status === "Done").length;
    return {
      name: agent.name,
      totalTx: agentTx.length,
      done,
      pending: agentTx.filter((t) => t.status === "Pending").length,
      noDoc: agentTx.filter((t) => t.status === "No Doc").length,
      totalMinutes: totalMins,
      ahtMinutes: ahtMins,
      completionRate: agentTx.length > 0 ? (done / agentTx.length) * 100 : 0,
    };
  });

  const dailyMap = new Map<string, DailyTrend>();
  transactions.forEach((t) => {
    if (!dailyMap.has(t.date)) {
      dailyMap.set(t.date, { date: t.date, total: 0, done: 0, pending: 0, noDoc: 0, avgAht: 0 });
    }
    const day = dailyMap.get(t.date)!;
    day.total++;
    if (t.status === "Done") day.done++;
    else if (t.status === "Pending") day.pending++;
    else day.noDoc++;
  });
  dailyMap.forEach((day) => {
    const dayTx = transactions.filter((t) => t.date === day.date && t.tatMinutes > 0);
    day.avgAht = dayTx.length > 0 ? dayTx.reduce((s, t) => s + t.tatMinutes, 0) / dayTx.length : 0;
  });
  const dailyTrends = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const docTypeMap = new Map<string, { count: number; totalTat: number }>();
  transactions.filter((t) => t.tatMinutes > 0).forEach((t) => {
    if (!docTypeMap.has(t.typeOfDoc)) {
      docTypeMap.set(t.typeOfDoc, { count: 0, totalTat: 0 });
    }
    const dt = docTypeMap.get(t.typeOfDoc)!;
    dt.count++;
    dt.totalTat += t.tatMinutes;
  });
  const docTypeStats: DocTypeStats[] = Array.from(docTypeMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    avgTat: data.count > 0 ? data.totalTat / data.count : 0,
  })).sort((a, b) => b.count - a.count);

  const totalTx = transactions.length;
  const completedTx = transactions.filter((t) => t.tatMinutes > 0);
  const totalDone = transactions.filter((t) => t.status === "Done").length;
  const totalPending = transactions.filter((t) => t.status === "Pending").length;
  const totalNoDoc = transactions.filter((t) => t.status === "No Doc").length;
  const overallAht = completedTx.length > 0 ? completedTx.reduce((s, t) => s + t.tatMinutes, 0) / completedTx.length : 0;
  const completionRate = totalTx > 0 ? (totalDone / totalTx) * 100 : 0;

  const clockStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

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
      <EmailGate onEnter={handleEnterEmail} />
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
          --indigo: #4f46e5; --green: #16a34a; --amber: #d97706; --red: #dc2626;
          --radius: 10px; --shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; }

        .topbar { background: var(--text); color: #fff; padding: 0 24px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; gap: 16px; }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .topbar-logo { font-family: 'Fira Code', monospace; font-size: 15px; font-weight: 600; }
        .topbar-logo span { color: #818cf8; }
        .topbar-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.15); }
        .topbar-label { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); }
        .workspace-pill { display: flex; align-items: center; gap: 7px; background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.35); border-radius: 20px; padding: 4px 10px 4px 8px; max-width: 240px; }
        .workspace-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .workspace-email { font-family: 'Fira Code', monospace; font-size: 11px; color: #a5b4fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .workspace-change { background: transparent; border: none; color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; padding: 0 0 0 2px; }
        .workspace-change:hover { color: rgba(255,255,255,0.8); }
        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .clock-time { font-family: 'Fira Code', monospace; font-size: 15px; font-weight: 600; color: #34d399; }
        .back-link { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 5px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.7); text-decoration: none; font-weight: 600; }
        .back-link:hover { background: rgba(255,255,255,0.15); color: #fff; }

        .export-bar { display: flex; align-items: center; gap: 8px; }
        .export-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 13px; border-radius: 6px;
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

        .page { max-width: 1280px; margin: 0 auto; padding: 28px 24px 80px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
        .page-title { font-size: 26px; font-weight: 800; letter-spacing: -1px; }
        .page-subtitle { font-size: 12px; color: var(--text-3); margin-top: 3px; font-family: 'Fira Code', monospace; }
        .page-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .date-picker-wrap { display: flex; align-items: center; gap: 10px; }
        .date-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-3); }
        .date-input { background: var(--surface); border: 1.5px solid var(--border); border-radius: 6px; padding: 8px 12px; font-family: 'Fira Code', monospace; font-size: 13px; color: var(--text); outline: none; }
        .date-input:focus { border-color: var(--indigo); }

        .overview-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
        .ov-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 16px 14px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .ov-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }
        .ov-total::after { background: var(--indigo); }
        .ov-done::after { background: var(--green); }
        .ov-pending::after { background: var(--amber); }
        .ov-nodoc::after { background: var(--red); }
        .ov-aht::after { background: #0891b2; }
        .ov-rate::after { background: #7c3aed; }
        .ov-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); margin-bottom: 6px; }
        .ov-value { font-family: 'Fira Code', monospace; font-size: 24px; font-weight: 600; line-height: 1; letter-spacing: -1px; }
        .ov-total .ov-value { color: var(--indigo); }
        .ov-done .ov-value { color: var(--green); }
        .ov-pending .ov-value { color: var(--amber); }
        .ov-nodoc .ov-value { color: var(--red); }
        .ov-aht .ov-value { color: #0891b2; font-size: 16px; }
        .ov-rate .ov-value { color: #7c3aed; font-size: 18px; }

        .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
        .grid-1 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px; }

        .chart-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
        .chart-header { padding: 14px 18px; border-bottom: 1.5px solid var(--border); background: var(--surface-2); display: flex; align-items: center; justify-content: space-between; }
        .chart-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-2); }
        .chart-count { font-size: 11px; font-family: 'Fira Code', monospace; color: var(--text-3); }
        .chart-body { padding: 20px; }

        .bar-chart { display: flex; flex-direction: column; gap: 12px; }
        .bar-item { display: flex; align-items: center; gap: 12px; }
        .bar-label { width: 120px; font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
        .bar-visual { flex: 1; height: 28px; position: relative; background: var(--surface-2); border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--indigo); border-radius: 4px; transition: width 0.3s; display: flex; align-items: center; justify-content: flex-end; padding: 0 8px; }
        .bar-value { font-size: 11px; font-weight: 700; color: #fff; font-family: 'Fira Code', monospace; }

        .line-chart { height: 240px; position: relative; }
        .line-svg { width: 100%; height: 100%; }
        .line-path { fill: none; stroke: var(--indigo); stroke-width: 2; }
        .line-dot { fill: var(--indigo); }
        .line-grid { stroke: var(--border); stroke-width: 1; stroke-dasharray: 3 3; }

        .legend { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--text-2); }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

        .table { width: 100%; border-collapse: collapse; }
        .table thead { background: var(--surface-2); }
        .table th { padding: 9px 11px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); border-bottom: 1.5px solid var(--border); white-space: nowrap; }
        .table td { padding: 9px 11px; border-bottom: 1px solid var(--surface-2); font-size: 12px; white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: #f8f9ff; }
        .td-name { font-weight: 700; color: var(--text); }
        .td-mono { font-family: 'Fira Code', monospace; font-size: 11px; color: var(--text-2); }
        .td-center { text-align: center; }

        .loading-state { padding: 48px; text-align: center; }
        .loading-dots { display: inline-flex; gap: 5px; }
        .loading-dots span { width: 6px; height: 6px; background: var(--border-2); border-radius: 50%; animation: ld 0.8s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes ld { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }

        .empty-state { padding: 44px; text-align: center; }
        .empty-icon { font-size: 36px; opacity: 0.15; margin-bottom: 10px; }
        .empty-text { font-size: 12px; color: var(--text-3); letter-spacing: 1px; }

        .export-overlay { position: fixed; inset: 0; background: rgba(26,29,46,0.55); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(3px); }
        .export-overlay-card { background: #fff; border-radius: 14px; padding: 32px 40px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .export-overlay-icon { font-size: 36px; margin-bottom: 12px; }
        .export-overlay-text { font-size: 14px; font-weight: 700; color: #1a1d2e; margin-bottom: 4px; }
        .export-overlay-sub { font-size: 12px; color: #8890b0; }

        @media (max-width: 768px) {
          .overview-grid { grid-template-columns: repeat(3, 1fr); }
          .grid-2 { grid-template-columns: 1fr; }
          .export-bar { flex-wrap: wrap; }
        }
      `}</style>

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
          <div className="topbar-label">Analytics</div>
        </div>
        <div className="topbar-right">
          <div className="workspace-pill">
            <span className="workspace-dot" />
            <span className="workspace-email">{workspaceEmail}</span>
            <button className="workspace-change" onClick={handleChangeEmail}>✕</button>
          </div>
          <span className="clock-time">{clockStr}</span>
          <a href="/eod" className="back-link">📊 EOD</a>
          <a href="/" className="back-link">← TX Log</a>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">Performance Analytics</div>
            <div className="page-subtitle">Data insights & trends</div>
          </div>
          <div className="page-header-right">
            <div className="date-picker-wrap">
              <span className="date-label">From</span>
              <input className="date-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="date-label">To</span>
              <input className="date-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="export-bar">
              <button className="export-btn export-btn-excel" onClick={handleExportExcel} disabled={!!exporting || transactions.length === 0}>
                📊 Export Excel
              </button>
              <button className="export-btn export-btn-pdf" onClick={handleExportPDF} disabled={!!exporting || transactions.length === 0}>
                📄 Export PDF
              </button>
              <button className="export-btn export-btn-shot" onClick={handleScreenshot} disabled={!!exporting || transactions.length === 0}>
                📸 Screenshot
              </button>
            </div>
          </div>
        </div>

        <div ref={reportRef}>
        {loading ? (
          <div className="loading-state"><div className="loading-dots"><span /><span /><span /></div></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-text">No data available for selected period</div>
          </div>
        ) : (
          <>
            <div className="overview-grid">
              <div className="ov-card ov-total"><div className="ov-label">Total TX</div><div className="ov-value">{totalTx}</div></div>
              <div className="ov-card ov-done"><div className="ov-label">Done</div><div className="ov-value">{totalDone}</div></div>
              <div className="ov-card ov-pending"><div className="ov-label">Pending</div><div className="ov-value">{totalPending}</div></div>
              <div className="ov-card ov-nodoc"><div className="ov-label">No Doc</div><div className="ov-value">{totalNoDoc}</div></div>
              <div className="ov-card ov-aht"><div className="ov-label">Avg AHT</div><div className="ov-value">{minsToHMS(overallAht)}</div></div>
              <div className="ov-card ov-rate"><div className="ov-label">Completion</div><div className="ov-value">{completionRate.toFixed(1)}%</div></div>
            </div>

            <div className="grid-2">
              <div className="chart-card">
                <div className="chart-header">
                  <span className="chart-title">Agent Performance</span>
                  <span className="chart-count">{agents.length} agents</span>
                </div>
                <div className="chart-body">
                  <div className="bar-chart">
                    {agentStats.sort((a, b) => b.totalTx - a.totalTx).slice(0, 8).map((agent) => {
                      const maxTx = Math.max(...agentStats.map((a) => a.totalTx));
                      const pct = maxTx > 0 ? (agent.totalTx / maxTx) * 100 : 0;
                      return (
                        <div key={agent.name} className="bar-item">
                          <div className="bar-label" title={agent.name}>{agent.name}</div>
                          <div className="bar-visual">
                            <div className="bar-fill" style={{ width: `${pct}%` }}>
                              <span className="bar-value">{agent.totalTx}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <span className="chart-title">Doc Type Distribution</span>
                  <span className="chart-count">{docTypeStats.length} types</span>
                </div>
                <div className="chart-body">
                  <div className="bar-chart">
                    {docTypeStats.slice(0, 8).map((dt) => {
                      const maxCnt = Math.max(...docTypeStats.map((d) => d.count));
                      const pct = maxCnt > 0 ? (dt.count / maxCnt) * 100 : 0;
                      return (
                        <div key={dt.name} className="bar-item">
                          <div className="bar-label" title={dt.name}>{dt.name}</div>
                          <div className="bar-visual">
                            <div className="bar-fill" style={{ width: `${pct}%`, background: "#16a34a" }}>
                              <span className="bar-value">{dt.count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-1">
              <div className="chart-card">
                <div className="chart-header">
                  <span className="chart-title">Daily Transaction Trend</span>
                  <span className="chart-count">{dailyTrends.length} days</span>
                </div>
                <div className="chart-body">
                  {dailyTrends.length > 0 && (
                    <div className="line-chart">
                      <svg className="line-svg" viewBox="0 0 800 240" preserveAspectRatio="none">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line key={i} x1="0" y1={i * 60} x2="800" y2={i * 60} className="line-grid" />
                        ))}
                        <polyline
                          className="line-path"
                          points={dailyTrends.map((d, i) => {
                            const x = (i / (dailyTrends.length - 1)) * 800;
                            const maxTx = Math.max(...dailyTrends.map((t) => t.total), 1);
                            const y = 240 - (d.total / maxTx) * 200;
                            return `${x},${y}`;
                          }).join(" ")}
                        />
                        {dailyTrends.map((d, i) => {
                          const x = (i / (dailyTrends.length - 1)) * 800;
                          const maxTx = Math.max(...dailyTrends.map((t) => t.total), 1);
                          const y = 240 - (d.total / maxTx) * 200;
                          return <circle key={i} cx={x} cy={y} r="3" className="line-dot" />;
                        })}
                      </svg>
                    </div>
                  )}
                  <div className="legend">
                    <div className="legend-item"><span className="legend-dot" style={{ background: "var(--indigo)" }} /> Total Transactions</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="chart-card">
                <div className="chart-header">
                  <span className="chart-title">Agent Statistics</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr><th>Agent</th><th className="td-center">Total</th><th className="td-center">Done</th><th className="td-center">AHT</th><th className="td-center">Rate</th></tr>
                    </thead>
                    <tbody>
                      {agentStats.sort((a, b) => b.totalTx - a.totalTx).map((agent) => (
                        <tr key={agent.name}>
                          <td className="td-name">{agent.name}</td>
                          <td className="td-mono td-center">{agent.totalTx}</td>
                          <td className="td-mono td-center" style={{ color: "var(--green)" }}>{agent.done}</td>
                          <td className="td-mono td-center">{minsToHMS(agent.ahtMinutes)}</td>
                          <td className="td-mono td-center">{agent.completionRate.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <span className="chart-title">Doc Type Avg TAT</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr><th>Type</th><th className="td-center">Count</th><th className="td-center">Avg TAT</th></tr>
                    </thead>
                    <tbody>
                      {docTypeStats.slice(0, 10).map((dt) => (
                        <tr key={dt.name}>
                          <td className="td-name">{dt.name}</td>
                          <td className="td-mono td-center">{dt.count}</td>
                          <td className="td-mono td-center">{minsToHMS(dt.avgTat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}