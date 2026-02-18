// models/Agent.ts
import mongoose, { Schema, models, model } from "mongoose";

const AgentSchema = new Schema(
  {
    name:           { type: String, required: true, trim: true },
    workspaceEmail: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

AgentSchema.index({ name: 1, workspaceEmail: 1 }, { unique: true });

export default models.Agent || model("Agent", AgentSchema);