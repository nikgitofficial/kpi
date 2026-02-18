"use client";

import { useState, useEffect, useCallback } from "react";

type TxStatus = "No Doc" | "Pending" | "Done";

interface Agent {
  _id: string;
  name: string;
  workspaceEmail: string;
}

interface DocType {
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

function nowTimeStr(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

function fmtDecimal(d: number): string {
  if (!d) return "—";
  return d.toFixed(3);
}

const STATUS_CLASS: Record<TxStatus, string> = {
  "No Doc": "badge-nodoc", "Pending": "badge-pending", "Done": "badge-done",
};

// ── EMAIL GATE ────────────────────────────────────────────────────
function EmailGate({ onEnter }: { onEnter: (email: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = () => {
    const val = input.trim().toLowerCase();
    if (!val) { setError("Please enter your KPI email"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError("Enter a valid email address"); return; }
    setError(""); onEnter(val);
  };
  return (
    <div className="gate-wrap">
      <div className="gate-card">
        <div className="gate-logo">KPI<span>Track</span></div>
        <div className="gate-title">Enter your KPI workspace email</div>
        <div className="gate-sub">All agent transactions will be saved and scoped under this email.</div>
        <div className="gate-field">
          <input className={`gate-input${error ? " gate-input-err" : ""}`} type="email"
            placeholder="team@company.com" value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoFocus />
          {error && <p className="gate-error">{error}</p>}
        </div>
        <button className="gate-btn" onClick={handleSubmit}>Enter Workspace →</button>
        <p className="gate-hint">💡 Use the same email every day — it groups all agent data for your team.</p>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function TrackerPage() {
  const [kpiEmail, setKpiEmail]           = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agents, setAgents]               = useState<Agent[]>([]);
  const [docTypes, setDocTypes]           = useState<DocType[]>([]);
  const [mounted, setMounted]             = useState(false);
  const [now, setNow]                     = useState<Date | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [fetching, setFetching]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [message, setMessage]             = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  // Sidebar tab: "agents" | "doctypes"
  const [sidebarTab, setSidebarTab]       = useState<"agents" | "doctypes">("agents");

  // Agent management
  const [showAddAgent, setShowAddAgent]   = useState(false);
  const [newAgentName, setNewAgentName]   = useState("");
  const [addingAgent, setAddingAgent]     = useState(false);
  const [agentMsg, setAgentMsg]           = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  // DocType management
  const [showAddDocType, setShowAddDocType] = useState(false);
  const [newDocTypeName, setNewDocTypeName] = useState("");
  const [addingDocType, setAddingDocType]   = useState(false);
  const [docTypeMsg, setDocTypeMsg]         = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deletingDocTypeId, setDeletingDocTypeId] = useState<string | null>(null);

  // Form fields
  const [txId, setTxId]           = useState("");
  const [typeOfDoc, setTypeOfDoc] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime]     = useState("");
  const [status, setStatus]       = useState<TxStatus>("Pending");
  const [notes, setNotes]         = useState("");

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    setStartTime(nowTimeStr());
    setEndTime(nowTimeStr());
    const saved = sessionStorage.getItem("kpiEmail");
    if (saved) setKpiEmail(saved);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (message)  { const t = setTimeout(() => setMessage(null),  4000); return () => clearTimeout(t); }
  }, [message]);
  useEffect(() => {
    if (agentMsg) { const t = setTimeout(() => setAgentMsg(null), 4000); return () => clearTimeout(t); }
  }, [agentMsg]);
  useEffect(() => {
    if (docTypeMsg){ const t = setTimeout(() => setDocTypeMsg(null), 4000); return () => clearTimeout(t); }
  }, [docTypeMsg]);

  // ── Fetch agents ──────────────────────────────────────────────
  const fetchAgents = useCallback(async (email: string) => {
    try {
      const res  = await fetch(`/api/agents?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch { /* silent */ }
  }, []);

  // ── Fetch doc types ───────────────────────────────────────────
  const fetchDocTypes = useCallback(async (email: string) => {
    try {
      const res  = await fetch(`/api/doctypes?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const types: DocType[] = data.docTypes || [];
      setDocTypes(types);
      // Set default typeOfDoc to first available
      if (types.length > 0) setTypeOfDoc((prev) => prev || types[0].name);
    } catch { /* silent */ }
  }, []);

  const handleEnterEmail = (email: string) => {
    sessionStorage.setItem("kpiEmail", email);
    setKpiEmail(email);
    fetchAgents(email);
    fetchDocTypes(email);
  };

  const handleChangeEmail = () => {
    sessionStorage.removeItem("kpiEmail");
    setKpiEmail(null);
    setSelectedAgent(null);
    setTransactions([]);
    setActiveTransaction(null);
    setAgents([]);
    setDocTypes([]);
  };

  useEffect(() => {
    if (kpiEmail) { fetchAgents(kpiEmail); fetchDocTypes(kpiEmail); }
  }, [kpiEmail, fetchAgents, fetchDocTypes]);

  // ── Add agent ─────────────────────────────────────────────────
  const handleAddAgent = async () => {
    const trimmed = newAgentName.trim();
    if (!trimmed || !kpiEmail) return;
    setAddingAgent(true);
    try {
      const res  = await fetch("/api/agents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, workspaceEmail: kpiEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setAgentMsg({ text: data.error || "Failed to add agent", type: "error" }); return; }
      setAgentMsg({ text: `✅ "${trimmed}" added! Add another or close.`, type: "success" });
      setNewAgentName("");
      await fetchAgents(kpiEmail);
    } catch { setAgentMsg({ text: "Network error — please try again", type: "error" }); }
    finally { setAddingAgent(false); }
  };

  // ── Delete agent ──────────────────────────────────────────────
  const handleDeleteAgent = async (id: string, name: string) => {
    if (!confirm(`Remove agent "${name}"? This won't delete their transactions.`)) return;
    setDeletingAgentId(id);
    try {
      await fetch("/api/agents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (selectedAgent?._id === id) { setSelectedAgent(null); setTransactions([]); setActiveTransaction(null); }
      await fetchAgents(kpiEmail!);
    } catch { /* silent */ }
    finally { setDeletingAgentId(null); }
  };

  // ── Add doc type ──────────────────────────────────────────────
  const handleAddDocType = async () => {
    const trimmed = newDocTypeName.trim();
    if (!trimmed || !kpiEmail) return;
    setAddingDocType(true);
    try {
      const res  = await fetch("/api/doctypes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, workspaceEmail: kpiEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setDocTypeMsg({ text: data.error || "Failed to add doc type", type: "error" }); return; }
      setDocTypeMsg({ text: `✅ "${trimmed}" added! Add another or close.`, type: "success" });
      setNewDocTypeName("");
      await fetchDocTypes(kpiEmail);
    } catch { setDocTypeMsg({ text: "Network error — please try again", type: "error" }); }
    finally { setAddingDocType(false); }
  };

  // ── Delete doc type ───────────────────────────────────────────
  const handleDeleteDocType = async (id: string, name: string) => {
    if (!confirm(`Remove doc type "${name}"?`)) return;
    setDeletingDocTypeId(id);
    try {
      await fetch("/api/doctypes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      await fetchDocTypes(kpiEmail!);
    } catch { /* silent */ }
    finally { setDeletingDocTypeId(null); }
  };

  // ── Fetch transactions ────────────────────────────────────────
  const fetchTransactions = useCallback(async (agent: Agent, workspaceEmail: string) => {
    setFetching(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/transactions?workspaceEmail=${encodeURIComponent(workspaceEmail)}&name=${encodeURIComponent(agent.name)}&date=${today}&limit=100`);
      const data = await res.json();
      const recs: Transaction[] = data.records || [];
      setTransactions(recs);
      setActiveTransaction(recs.find((t) => !t.endTime) || null);
    } catch { /* silent */ }
    finally { setFetching(false); }
  }, []);

  const handleAgentSelect = (agent: Agent) => {
    setSelectedAgent(agent);
    if (kpiEmail) fetchTransactions(agent, kpiEmail);
  };

  // ── Start transaction ─────────────────────────────────────────
  const handleStart = async () => {
    if (!selectedAgent || !kpiEmail) return;
    if (!txId.trim()) { setMessage({ text: "Enter a Transaction ID", type: "error" }); return; }
    if (!typeOfDoc)   { setMessage({ text: "Select a Type of Doc", type: "error" }); return; }
    if (activeTransaction) { setMessage({ text: "End the current transaction first!", type: "error" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: selectedAgent.name, workspaceEmail: kpiEmail, action: "start", txId: txId.trim(), typeOfDoc, startTime, status, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ text: data.error, type: "error" }); return; }
      setMessage({ text: data.message, type: "success" });
      setTxId(""); setNotes("");
      setStartTime(nowTimeStr()); setEndTime(nowTimeStr());
      await fetchTransactions(selectedAgent, kpiEmail);
    } catch { setMessage({ text: "Network error", type: "error" }); }
    finally { setLoading(false); }
  };

  // ── End transaction ───────────────────────────────────────────
  const handleEnd = async () => {
    if (!selectedAgent || !activeTransaction || !kpiEmail) return;
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: selectedAgent.name, workspaceEmail: kpiEmail, action: "end", transactionId: activeTransaction._id, endTime, status, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ text: data.error, type: "error" }); return; }
      setMessage({ text: data.message, type: "success" });
      setNotes(""); setStatus("Pending"); setEndTime(nowTimeStr());
      await fetchTransactions(selectedAgent, kpiEmail);
    } catch { setMessage({ text: "Network error", type: "error" }); }
    finally { setLoading(false); }
  };

  // ── Delete transaction ────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    setDeletingId(id);
    await fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDeletingId(null);
    if (selectedAgent && kpiEmail) await fetchTransactions(selectedAgent, kpiEmail);
  };

  const clockStr  = mounted && now ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--";
  const clockAMPM = mounted && now ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true  }) : "--:--:-- --";
  const todayDate = mounted && now ? now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";

  const doneTx    = transactions.filter((t) => t.status === "Done").length;
  const pendingTx = transactions.filter((t) => t.status === "Pending").length;
  const noDocTx   = transactions.filter((t) => t.status === "No Doc").length;
  const completedTx = transactions.filter((t) => t.tatMinutes > 0);
  const ahtMins   = completedTx.length > 0 ? completedTx.reduce((s, t) => s + t.tatMinutes, 0) / completedTx.length : 0;

  if (!mounted) return null;

  if (!kpiEmail) return (
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
        .gate-input { width: 100%; background: #f0f2f8; border: 1.5px solid #e2e5f0; border-radius: 8px; padding: 13px 16px; font-family: 'Fira Code', monospace; font-size: 14px; color: #1a1d2e; outline: none; transition: all 0.15s; }
        .gate-input:focus { border-color: #4f46e5; background: #fff; }
        .gate-input-err { border-color: #dc2626 !important; background: #fff5f5 !important; }
        .gate-input::placeholder { color: #8890b0; }
        .gate-error { font-size: 11px; color: #dc2626; margin-top: 6px; font-weight: 600; }
        .gate-btn { width: 100%; padding: 13px; background: #4f46e5; border: none; border-radius: 8px; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; margin-bottom: 16px; }
        .gate-btn:hover { background: #4338ca; }
        .gate-hint { font-size: 11px; color: #8890b0; line-height: 1.5; }
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
          --indigo: #4f46e5; --indigo-lt: #eef2ff;
          --green: #16a34a; --green-lt: #dcfce7;
          --amber: #d97706; --amber-lt: #fef3c7;
          --red: #dc2626; --red-lt: #fee2e2;
          --radius: 10px; --radius-sm: 6px;
          --shadow: 0 1px 3px rgba(0,0,0,0.06); --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
        }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }

        /* TOPBAR */
        .topbar { background: var(--text); color: #fff; padding: 0 20px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; gap: 12px; }
        .topbar-left { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .topbar-logo { font-family: 'Fira Code', monospace; font-size: 15px; font-weight: 600; }
        .topbar-logo span { color: #818cf8; }
        .topbar-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.15); }
        .topbar-label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .workspace-pill { display: flex; align-items: center; gap: 7px; background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.35); border-radius: 20px; padding: 4px 10px 4px 8px; max-width: 280px; }
        .workspace-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; flex-shrink: 0; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .workspace-email { font-family: 'Fira Code', monospace; font-size: 11px; color: #a5b4fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .workspace-change { background: transparent; border: none; color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; padding: 0 0 0 2px; }
        .workspace-change:hover { color: rgba(255,255,255,0.8); }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .clock-time { font-family: 'Fira Code', monospace; font-size: 14px; font-weight: 600; color: #34d399; }
        .clock-ampm { font-family: 'Fira Code', monospace; font-size: 11px; color: rgba(255,255,255,0.3); }
        .eod-link { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); border-radius: var(--radius-sm); padding: 5px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.65); text-decoration: none; transition: all 0.15s; font-weight: 600; }
        .eod-link:hover { background: rgba(255,255,255,0.15); color: #fff; }

        /* LAYOUT */
        .layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 52px); }

        /* SIDEBAR */
        .sidebar { background: var(--surface); border-right: 1.5px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }

        /* Sidebar tabs */
        .sidebar-tabs { display: flex; border-bottom: 1.5px solid var(--border); flex-shrink: 0; }
        .sidebar-tab { flex: 1; padding: 10px 6px; background: transparent; border: none; cursor: pointer; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-3); transition: all 0.15s; border-bottom: 2px solid transparent; margin-bottom: -1.5px; }
        .sidebar-tab:hover { color: var(--text-2); background: var(--surface-2); }
        .sidebar-tab.active { color: var(--indigo); border-bottom-color: var(--indigo); }

        .sidebar-panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
        .sidebar-panel-header { padding: 12px 16px 8px; flex-shrink: 0; }
        .add-btn { width: 100%; padding: 7px 10px; background: var(--indigo-lt); border: 1.5px dashed #c7d2fe; border-radius: var(--radius-sm); color: var(--indigo); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s; text-align: center; }
        .add-btn:hover { background: #e0e7ff; border-color: var(--indigo); }

        .add-form { padding: 10px 16px; border-bottom: 1.5px solid var(--border); background: var(--indigo-lt); flex-shrink: 0; }
        .add-input { width: 100%; background: #fff; border: 1.5px solid #c7d2fe; border-radius: var(--radius-sm); padding: 7px 10px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: var(--text); outline: none; margin-bottom: 8px; }
        .add-input:focus { border-color: var(--indigo); }
        .add-actions { display: flex; gap: 6px; }
        .btn-confirm { flex: 1; padding: 6px; background: var(--indigo); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; }
        .btn-confirm:disabled { opacity: 0.5; cursor: wait; }
        .btn-cancel  { flex: 1; padding: 6px; background: transparent; border: 1.5px solid var(--border-2); border-radius: var(--radius-sm); color: var(--text-2); font-size: 11px; font-weight: 700; cursor: pointer; }
        .panel-msg { font-size: 10px; margin-top: 6px; font-weight: 600; padding: 4px 8px; border-radius: 4px; }
        .panel-msg-ok  { color: var(--green); background: var(--green-lt); }
        .panel-msg-err { color: var(--red);   background: var(--red-lt); }

        .sidebar-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .sidebar-item { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.12s; border-left: 3px solid transparent; gap: 8px; }
        .sidebar-item:hover { background: var(--surface-2); }
        .sidebar-item.active { background: var(--indigo-lt); border-left-color: var(--indigo); }
        .sidebar-item-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .item-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--indigo-lt); color: var(--indigo); font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-item.active .item-avatar { background: var(--indigo); color: #fff; }
        .item-doc-icon { width: 30px; height: 30px; border-radius: var(--radius-sm); background: #f0fdf4; color: var(--green); font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1.5px solid #bbf7d0; }
        .item-name { font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-item.active .item-name { color: var(--indigo); }
        .del-item-btn { background: transparent; border: none; color: transparent; font-size: 11px; cursor: pointer; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; transition: all 0.15s; }
        .sidebar-item:hover .del-item-btn { color: var(--text-3); }
        .del-item-btn:hover { background: var(--red-lt); color: var(--red) !important; }
        .del-item-btn:disabled { opacity: 0.3; cursor: wait; }
        .sidebar-empty { padding: 20px 16px; text-align: center; font-size: 11px; color: var(--text-3); line-height: 1.6; }

        /* MAIN */
        .main { padding: 22px; overflow-y: auto; background: var(--bg); }
        .no-agent { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 10px; text-align: center; }
        .no-agent-icon { font-size: 44px; opacity: 0.15; }
        .no-agent-text { font-size: 13px; color: var(--text-3); }

        .agent-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .agent-avatar-lg { width: 42px; height: 42px; border-radius: 50%; background: var(--indigo); color: #fff; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .agent-fullname { font-size: 19px; font-weight: 800; letter-spacing: -0.5px; }
        .agent-date-str { font-size: 11px; color: var(--text-3); font-family: 'Fira Code', monospace; margin-top: 2px; }

        .stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; }
        .stat-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 13px 14px; box-shadow: var(--shadow); }
        .stat-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); margin-bottom: 5px; }
        .stat-value { font-family: 'Fira Code', monospace; font-size: 20px; font-weight: 600; letter-spacing: -1px; line-height: 1; }
        .stat-card.s-done    .stat-value { color: var(--green); }
        .stat-card.s-pending .stat-value { color: var(--amber); }
        .stat-card.s-nodoc   .stat-value { color: var(--red); }
        .stat-card.s-aht     .stat-value { font-size: 15px; color: var(--indigo); }

        .content-grid { display: grid; grid-template-columns: 290px 1fr; gap: 14px; align-items: start; }

        /* FORM */
        .form-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
        .form-card-header { padding: 12px 16px; border-bottom: 1.5px solid var(--border); background: var(--surface-2); }
        .form-card-title { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-2); }
        .active-tx-banner { background: #eef2ff; border-bottom: 1.5px solid #c7d2fe; padding: 11px 16px; display: flex; align-items: center; justify-content: space-between; }
        .active-tx-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--indigo); margin-bottom: 2px; }
        .active-tx-id { font-family: 'Fira Code', monospace; font-size: 14px; font-weight: 600; color: var(--indigo); }
        .active-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--indigo); animation: pulse 1s infinite; flex-shrink: 0; }
        .form-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); }
        .field-input, .field-select, .field-textarea { background: var(--surface-2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 8px 11px; font-family: 'Fira Code', monospace; font-size: 13px; color: var(--text); outline: none; transition: all 0.15s; width: 100%; }
        .field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--indigo); background: #fff; }
        .field-textarea { height: 58px; resize: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; }
        .no-doctype-hint { font-size: 11px; color: var(--amber); background: var(--amber-lt); border: 1px solid #fcd34d; border-radius: var(--radius-sm); padding: 8px 10px; }
        .status-row { display: flex; gap: 5px; }
        .status-opt { flex: 1; padding: 7px 4px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; border: 1.5px solid; cursor: pointer; transition: all 0.15s; background: transparent; text-align: center; }
        .so-nodoc   { border-color: #fca5a5; color: #dc2626; }
        .so-nodoc.sel, .so-nodoc:hover   { background: var(--red-lt);   border-color: var(--red); }
        .so-pending { border-color: #fcd34d; color: #d97706; }
        .so-pending.sel, .so-pending:hover { background: var(--amber-lt); border-color: var(--amber); }
        .so-done    { border-color: #86efac; color: #16a34a; }
        .so-done.sel, .so-done:hover    { background: var(--green-lt); border-color: var(--green); }
        .btn-start { width: 100%; padding: 11px; background: var(--indigo); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn-start:hover:not(:disabled) { background: #4338ca; }
        .btn-start:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-end { width: 100%; padding: 11px; background: var(--green); border: none; border-radius: var(--radius-sm); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn-end:hover:not(:disabled) { background: #15803d; }
        .btn-end:disabled { opacity: 0.4; cursor: not-allowed; }
        .toast { padding: 9px 13px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; animation: slideDown 0.2s ease; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        .toast-ok  { background: var(--green-lt); border: 1.5px solid #86efac; color: var(--green); }
        .toast-err { background: var(--red-lt);   border: 1.5px solid #fca5a5; color: var(--red); }

        /* TABLE */
        .table-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
        .table-card-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1.5px solid var(--border); background: var(--surface-2); }
        .table-card-title { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-2); }
        .table-scroll { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 680px; font-size: 12px; }
        thead { background: var(--surface-2); }
        th { padding: 9px 11px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); border-bottom: 1.5px solid var(--border); white-space: nowrap; }
        td { padding: 9px 11px; border-bottom: 1px solid var(--surface-2); white-space: nowrap; vertical-align: middle; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:hover td { background: #f8f9ff; }
        tbody tr.row-active td { background: #eef2ff !important; }
        .td-mono { font-family: 'Fira Code', monospace; font-size: 11px; color: var(--text-2); }
        .td-id   { font-family: 'Fira Code', monospace; font-weight: 600; color: var(--text); }
        .td-tat  { font-family: 'Fira Code', monospace; color: var(--indigo); font-weight: 600; }
        .td-dec  { font-family: 'Fira Code', monospace; color: var(--text-3); font-size: 11px; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        .badge::before { content: ''; width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; }
        .badge-nodoc   { background: var(--red-lt);   color: var(--red);   border: 1px solid #fca5a5; }
        .badge-nodoc::before   { background: var(--red); }
        .badge-pending { background: var(--amber-lt); color: var(--amber); border: 1px solid #fcd34d; }
        .badge-pending::before { background: var(--amber); animation: pulse 1.5s infinite; }
        .badge-done    { background: var(--green-lt); color: var(--green); border: 1px solid #86efac; }
        .badge-done::before    { background: var(--green); }
        .badge-active  { background: #eef2ff; color: var(--indigo); border: 1px solid #c7d2fe; }
        .badge-active::before  { background: var(--indigo); animation: pulse 1s infinite; }
        .del-btn { background: transparent; border: 1px solid transparent; color: var(--text-3); padding: 3px 8px; border-radius: var(--radius-sm); font-size: 10px; cursor: pointer; transition: all 0.15s; font-weight: 600; }
        .del-btn:hover { background: var(--red-lt); border-color: #fca5a5; color: var(--red); }
        .del-btn:disabled { opacity: 0.3; cursor: wait; }
        .empty-state { padding: 44px; text-align: center; }
        .empty-icon  { font-size: 28px; opacity: 0.2; margin-bottom: 8px; }
        .empty-text  { font-size: 11px; color: var(--text-3); letter-spacing: 1px; text-transform: uppercase; }
        .loading-dots { display: inline-flex; gap: 5px; padding: 36px; justify-content: center; width: 100%; }
        .loading-dots span { width: 5px; height: 5px; background: var(--border-2); border-radius: 50%; animation: ld 0.8s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes ld { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }

        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { flex-direction: column; max-height: 300px; border-right: none; border-bottom: 1.5px solid var(--border); }
          .content-grid { grid-template-columns: 1fr; }
          .stats-row { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      {/* TOPBAR */}
      <nav className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">KPI<span>Track</span></div>
          <div className="topbar-sep" />
          <div className="topbar-label">TX Log</div>
        </div>
        <div className="topbar-right">
          <div className="workspace-pill">
            <span className="workspace-dot" />
            <span className="workspace-email">{kpiEmail}</span>
            <button className="workspace-change" onClick={handleChangeEmail} title="Change workspace">✕</button>
          </div>
          <span className="clock-time">{clockStr}</span>
          <span className="clock-ampm">{clockAMPM}</span>
          <a href="/eod" className="eod-link">📊 EOD</a>
        </div>
      </nav>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          {/* Tabs */}
          <div className="sidebar-tabs">
            <button className={`sidebar-tab${sidebarTab === "agents" ? " active" : ""}`} onClick={() => setSidebarTab("agents")}>
              👤 Agents ({agents.length})
            </button>
            <button className={`sidebar-tab${sidebarTab === "doctypes" ? " active" : ""}`} onClick={() => setSidebarTab("doctypes")}>
              📄 Doc Types ({docTypes.length})
            </button>
          </div>

          {/* AGENTS PANEL */}
          {sidebarTab === "agents" && (
            <div className="sidebar-panel">
              <div className="sidebar-panel-header">
                <button className="add-btn" onClick={() => { setShowAddAgent((v) => !v); setAgentMsg(null); }}>
                  {showAddAgent ? "✕ Cancel" : "+ Add Agent"}
                </button>
              </div>

              {showAddAgent && (
                <div className="add-form">
                  <input className="add-input" placeholder="Full name, e.g. Juan Dela Cruz"
                    value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddAgent()} autoFocus />
                  <div className="add-actions">
                    <button className="btn-confirm" onClick={handleAddAgent} disabled={addingAgent || !newAgentName.trim()}>
                      {addingAgent ? "Adding…" : "Add"}
                    </button>
                    <button className="btn-cancel" onClick={() => { setShowAddAgent(false); setNewAgentName(""); setAgentMsg(null); }}>Cancel</button>
                  </div>
                  {agentMsg && <div className={`panel-msg ${agentMsg.type === "success" ? "panel-msg-ok" : "panel-msg-err"}`}>{agentMsg.text}</div>}
                </div>
              )}

              <div className="sidebar-list">
                {agents.length === 0
                  ? <div className="sidebar-empty">No agents yet.<br />Click <strong>+ Add Agent</strong> to add one.</div>
                  : agents.map((agent) => {
                      const initials = agent.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                      const isActive = selectedAgent?._id === agent._id;
                      return (
                        <button key={agent._id} className={`sidebar-item${isActive ? " active" : ""}`} onClick={() => handleAgentSelect(agent)}>
                          <div className="sidebar-item-left">
                            <div className="item-avatar">{initials}</div>
                            <div className="item-name">{agent.name}</div>
                          </div>
                          <button className="del-item-btn" disabled={deletingAgentId === agent._id}
                            onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent._id, agent.name); }}
                            title="Remove agent">
                            {deletingAgentId === agent._id ? "…" : "✕"}
                          </button>
                        </button>
                      );
                    })
                }
              </div>
            </div>
          )}

          {/* DOC TYPES PANEL */}
          {sidebarTab === "doctypes" && (
            <div className="sidebar-panel">
              <div className="sidebar-panel-header">
                <button className="add-btn" onClick={() => { setShowAddDocType((v) => !v); setDocTypeMsg(null); }}>
                  {showAddDocType ? "✕ Cancel" : "+ Add Doc Type"}
                </button>
              </div>

              {showAddDocType && (
                <div className="add-form">
                  <input className="add-input" placeholder="e.g. Procurement Guidelines"
                    value={newDocTypeName} onChange={(e) => setNewDocTypeName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDocType()} autoFocus />
                  <div className="add-actions">
                    <button className="btn-confirm" onClick={handleAddDocType} disabled={addingDocType || !newDocTypeName.trim()}>
                      {addingDocType ? "Adding…" : "Add"}
                    </button>
                    <button className="btn-cancel" onClick={() => { setShowAddDocType(false); setNewDocTypeName(""); setDocTypeMsg(null); }}>Cancel</button>
                  </div>
                  {docTypeMsg && <div className={`panel-msg ${docTypeMsg.type === "success" ? "panel-msg-ok" : "panel-msg-err"}`}>{docTypeMsg.text}</div>}
                </div>
              )}

              <div className="sidebar-list">
                {docTypes.length === 0
                  ? <div className="sidebar-empty">No doc types yet.<br />Click <strong>+ Add Doc Type</strong> to add one.</div>
                  : docTypes.map((dt) => (
                      <div key={dt._id} className="sidebar-item" style={{ cursor: "default" }}>
                        <div className="sidebar-item-left">
                          <div className="item-doc-icon">📄</div>
                          <div className="item-name">{dt.name}</div>
                        </div>
                        <button className="del-item-btn" disabled={deletingDocTypeId === dt._id}
                          onClick={() => handleDeleteDocType(dt._id, dt.name)} title="Remove doc type">
                          {deletingDocTypeId === dt._id ? "…" : "✕"}
                        </button>
                      </div>
                    ))
                }
              </div>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="main">
          {!selectedAgent ? (
            <div className="no-agent">
              <div className="no-agent-icon">👤</div>
              <div className="no-agent-text">
                {agents.length === 0 ? "Add your first agent using the sidebar" : "Select an agent from the sidebar to begin"}
              </div>
            </div>
          ) : (
            <>
              <div className="agent-header">
                <div className="agent-avatar-lg">
                  {selectedAgent.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div className="agent-fullname">{selectedAgent.name}</div>
                  <div className="agent-date-str">{todayDate}</div>
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-card"><div className="stat-label">Total TX</div><div className="stat-value">{transactions.length}</div></div>
                <div className="stat-card s-done"><div className="stat-label">Done</div><div className="stat-value">{doneTx}</div></div>
                <div className="stat-card s-pending"><div className="stat-label">Pending</div><div className="stat-value">{pendingTx}</div></div>
                <div className="stat-card s-nodoc"><div className="stat-label">No Doc</div><div className="stat-value">{noDocTx}</div></div>
                <div className="stat-card s-aht">
                  <div className="stat-label">AHT</div>
                  <div className="stat-value">{ahtMins > 0 ? `${String(Math.floor(ahtMins/60)).padStart(2,"0")}:${String(Math.round(ahtMins%60)).padStart(2,"0")}` : "—"}</div>
                </div>
              </div>

              <div className="content-grid">
                {/* FORM */}
                <div className="form-card">
                  <div className="form-card-header">
                    <div className="form-card-title">{activeTransaction ? "⏱ End Transaction" : "▶ Log Transaction"}</div>
                  </div>

                  {activeTransaction && (
                    <div className="active-tx-banner">
                      <div>
                        <div className="active-tx-label">Active</div>
                        <div className="active-tx-id">#{activeTransaction.txId}</div>
                        <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2, fontFamily: "Fira Code" }}>
                          {activeTransaction.typeOfDoc} · started {activeTransaction.startTime}
                        </div>
                      </div>
                      <div className="active-dot" />
                    </div>
                  )}

                  <div className="form-body">
                    {!activeTransaction && (
                      <>
                        <div className="field">
                          <div className="field-label">Transaction ID</div>
                          <input className="field-input" placeholder="e.g. 2504770" value={txId}
                            onChange={(e) => setTxId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleStart()} />
                        </div>
                        <div className="field">
                          <div className="field-label">Type of Doc</div>
                          {docTypes.length === 0 ? (
                            <div className="no-doctype-hint">⚠ No doc types yet. Add one in the <strong>Doc Types</strong> tab.</div>
                          ) : (
                            <select className="field-select" value={typeOfDoc} onChange={(e) => setTypeOfDoc(e.target.value)}>
                              {docTypes.map((dt) => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="field">
                          <div className="field-label">Start Time</div>
                          <input className="field-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                      </>
                    )}

                    {activeTransaction && (
                      <div className="field">
                        <div className="field-label">End Time</div>
                        <input className="field-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                      </div>
                    )}

                    <div className="field">
                      <div className="field-label">Status</div>
                      <div className="status-row">
                        {(["No Doc","Pending","Done"] as TxStatus[]).map((s) => (
                          <button key={s} className={`status-opt so-${s === "No Doc" ? "nodoc" : s.toLowerCase()}${status === s ? " sel" : ""}`} onClick={() => setStatus(s)}>{s}</button>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <div className="field-label">Notes</div>
                      <textarea className="field-textarea" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>

                    {!activeTransaction
                      ? <button className="btn-start" onClick={handleStart} disabled={loading || docTypes.length === 0}>▶ Start Transaction</button>
                      : <button className="btn-end"   onClick={handleEnd}   disabled={loading}>◼ End Transaction</button>
                    }

                    {message && <div className={`toast ${message.type === "success" ? "toast-ok" : "toast-err"}`}>{message.text}</div>}
                  </div>
                </div>

                {/* TABLE */}
                <div className="table-card">
                  <div className="table-card-header">
                    <span className="table-card-title">Today&apos;s Log</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "Fira Code" }}>{transactions.length} transactions</span>
                  </div>
                  {fetching ? (
                    <div className="loading-dots"><span /><span /><span /></div>
                  ) : transactions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📋</div>
                      <div className="empty-text">No transactions logged today</div>
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr><th>#</th><th>ID</th><th>Type of Doc</th><th>Start</th><th>End</th><th>TAT</th><th>Status</th><th>Notes</th><th>Decimal</th><th></th></tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx, i) => {
                            const isActive = !tx.endTime;
                            return (
                              <tr key={tx._id} className={isActive ? "row-active" : ""}>
                                <td className="td-mono" style={{ color: "var(--text-3)" }}>{transactions.length - i}</td>
                                <td className="td-id">{tx.txId}</td>
                                <td style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{tx.typeOfDoc}</td>
                                <td className="td-mono">{tx.startTime}</td>
                                <td className="td-mono">{tx.endTime ?? <span style={{ color: "var(--indigo)", fontSize: 10 }}>ACTIVE</span>}</td>
                                <td className="td-tat">{tx.tatFormatted || "—"}</td>
                                <td><span className={`badge ${isActive ? "badge-active" : STATUS_CLASS[tx.status]}`}>{isActive ? "Active" : tx.status}</span></td>
                                <td style={{ fontSize: 11, color: "var(--text-3)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{tx.notes || "—"}</td>
                                <td className="td-dec">{fmtDecimal(tx.tatDecimal)}</td>
                                <td>
                                  <button className="del-btn" disabled={deletingId === tx._id} onClick={() => handleDelete(tx._id)}>
                                    {deletingId === tx._id ? "…" : "Delete"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}