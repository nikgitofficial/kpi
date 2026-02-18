// app/api/doctypes/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import DocType from "@/models/DocType";

// GET — list all doc types for a workspace
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const workspaceEmail = searchParams.get("email")?.trim().toLowerCase();

    if (!workspaceEmail)
      return NextResponse.json({ error: "email required" }, { status: 400 });

    const docTypes = await DocType.find({ workspaceEmail }).sort({ createdAt: 1 });
    return NextResponse.json({ docTypes });
  } catch (err) {
    console.error("GET /api/doctypes error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — create a new doc type
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { name, workspaceEmail } = await req.json();

    if (!name?.trim())
      return NextResponse.json({ error: "Doc type name is required" }, { status: 400 });
    if (!workspaceEmail?.trim())
      return NextResponse.json({ error: "workspaceEmail is required" }, { status: 400 });

    const trimmedName = name.trim();
    const normalEmail = workspaceEmail.trim().toLowerCase();

    const existing = await DocType.findOne({ name: trimmedName, workspaceEmail: normalEmail });
    if (existing)
      return NextResponse.json({ error: `"${trimmedName}" already exists` }, { status: 409 });

    const docType = await DocType.create({ name: trimmedName, workspaceEmail: normalEmail });
    return NextResponse.json({ docType, message: `✅ "${trimmedName}" added` }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/doctypes error:", err);
    if (err.code === 11000)
      return NextResponse.json({ error: "Doc type already exists" }, { status: 409 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — remove a doc type
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const { id } = await req.json();
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });

    const deleted = await DocType.findByIdAndDelete(id);
    if (!deleted)
      return NextResponse.json({ error: "Doc type not found" }, { status: 404 });

    return NextResponse.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/doctypes error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}