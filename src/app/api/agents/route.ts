// app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Agent from "@/models/Agent";

// GET — list all agents for a workspace email
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const workspaceEmail = searchParams.get("email")?.trim().toLowerCase();

    if (!workspaceEmail)
      return NextResponse.json({ error: "email required" }, { status: 400 });

    const agents = await Agent.find({ workspaceEmail }).sort({ createdAt: 1 });
    return NextResponse.json({ agents });
  } catch (err) {
    console.error("GET /api/agents error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — create a new agent for a workspace
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { name, workspaceEmail } = body;

    if (!name?.trim())
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    if (!workspaceEmail?.trim())
      return NextResponse.json({ error: "workspaceEmail is required" }, { status: 400 });

    const trimmedName  = name.trim();
    const normalEmail  = workspaceEmail.trim().toLowerCase();

    // Check for duplicate manually so we give a friendly message
    const existing = await Agent.findOne({ name: trimmedName, workspaceEmail: normalEmail });
    if (existing)
      return NextResponse.json({ error: `Agent "${trimmedName}" already exists in this workspace` }, { status: 409 });

    const agent = await Agent.create({ name: trimmedName, workspaceEmail: normalEmail });
    return NextResponse.json({ agent, message: `✅ Agent "${trimmedName}" added` }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/agents error:", err);
    // Fallback for race-condition duplicate key
    if (err.code === 11000)
      return NextResponse.json({ error: "Agent with that name already exists" }, { status: 409 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — remove an agent by id
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const { id } = await req.json();
    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });

    const deleted = await Agent.findByIdAndDelete(id);
    if (!deleted)
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    return NextResponse.json({ message: "Agent deleted" });
  } catch (err) {
    console.error("DELETE /api/agents error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}