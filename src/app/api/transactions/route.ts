// app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";

// ── HELPERS ─────────────────────────────────────────────────────
function getMonth(dateStr: string): string {
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return months[new Date(dateStr).getMonth()];
}

function calcTatMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function fmtTat(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
}

function tatDecimal(mins: number): number {
  return Math.round((mins / 60) * 1000) / 1000;
}

// ── GET ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    // workspaceEmail SCOPES all queries — required for data isolation
    const workspaceEmail = searchParams.get("workspaceEmail")?.trim().toLowerCase();
    const agentName      = searchParams.get("name")?.trim();
    const date           = searchParams.get("date");
    const from           = searchParams.get("from");
    const to             = searchParams.get("to");
    const month          = searchParams.get("month");
    const page           = parseInt(searchParams.get("page")  || "1");
    const limit          = parseInt(searchParams.get("limit") || "200");

    if (!workspaceEmail)
      return NextResponse.json({ error: "workspaceEmail required" }, { status: 400 });

    const query: Record<string, unknown> = { workspaceEmail };
    if (agentName) query.agentName = { $regex: `^${agentName}$`, $options: "i" };
    if (date)      query.date = date;
    if (month)     query.month = month;
    if (from || to) {
      query.date = {};
      if (from) (query.date as Record<string,string>).$gte = from;
      if (to)   (query.date as Record<string,string>).$lte = to;
    }

    const total   = await Transaction.countDocuments(query);
    const records = await Transaction.find(query)
      .sort({ date: -1, startTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({ records, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { agentName, workspaceEmail, action, transactionId } = body;

    if (!agentName || !workspaceEmail)
      return NextResponse.json({ error: "agentName and workspaceEmail required" }, { status: 400 });

    const name            = agentName.trim();
    const normalizedEmail = workspaceEmail.trim().toLowerCase();
    const now             = new Date();
    const todayStr        = now.toISOString().split("T")[0];

    // ── START ─────────────────────────────────────────────
    if (action === "start") {
      const { txId, typeOfDoc, startTime, status, notes, date } = body;
      if (!txId || !typeOfDoc || !startTime)
        return NextResponse.json({ error: "txId, typeOfDoc and startTime required" }, { status: 400 });

      const useDate = date || todayStr;
      const tx = await Transaction.create({
        agentName:    name,
        workspaceEmail: normalizedEmail,
        month:        getMonth(useDate),
        date:         useDate,
        txId:         txId.trim(),
        typeOfDoc:    typeOfDoc.trim(),
        startTime,
        endTime:      null,
        status:       status || "Pending",
        notes:        notes  || "",
        tatMinutes:   0,
        tatDecimal:   0,
        tatFormatted: "",
      });

      return NextResponse.json({ message: `✅ Transaction #${txId} started`, transaction: tx, action: "start" });
    }

    // ── END ───────────────────────────────────────────────
    if (action === "end") {
      const { endTime, status, notes } = body;
      if (!transactionId || !endTime)
        return NextResponse.json({ error: "transactionId and endTime required" }, { status: 400 });

      const tx = await Transaction.findById(transactionId);
      if (!tx)       return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      if (tx.endTime) return NextResponse.json({ error: "Already ended" }, { status: 400 });

      const mins      = calcTatMinutes(tx.startTime, endTime);
      tx.endTime      = endTime;
      tx.status       = status || tx.status;
      tx.notes        = notes  ?? tx.notes;
      tx.tatMinutes   = mins;
      tx.tatDecimal   = tatDecimal(mins);
      tx.tatFormatted = fmtTat(mins);
      await tx.save();

      return NextResponse.json({ message: `🏁 Done — TAT: ${fmtTat(mins)}`, transaction: tx, action: "end" });
    }

    // ── UPDATE ────────────────────────────────────────────
    if (action === "update") {
      if (!transactionId)
        return NextResponse.json({ error: "transactionId required" }, { status: 400 });

      const tx = await Transaction.findById(transactionId);
      if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { status, notes, typeOfDoc, txId, startTime, endTime } = body;
      if (status    !== undefined) tx.status    = status;
      if (notes     !== undefined) tx.notes     = notes;
      if (typeOfDoc !== undefined) tx.typeOfDoc = typeOfDoc;
      if (txId      !== undefined) tx.txId      = txId;

      const newStart = startTime ?? tx.startTime;
      const newEnd   = endTime   ?? tx.endTime;
      if (newStart && newEnd) {
        const mins      = calcTatMinutes(newStart, newEnd);
        tx.startTime    = newStart;
        tx.endTime      = newEnd;
        tx.tatMinutes   = mins;
        tx.tatDecimal   = tatDecimal(mins);
        tx.tatFormatted = fmtTat(mins);
      }

      await tx.save();
      return NextResponse.json({ message: "Updated", transaction: tx, action: "update" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await Transaction.findByIdAndDelete(id);
    return NextResponse.json({ message: "Deleted" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}