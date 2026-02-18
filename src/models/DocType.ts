// models/DocType.ts
import mongoose, { Schema, models, model } from "mongoose";

const DocTypeSchema = new Schema(
  {
    name:           { type: String, required: true, trim: true },
    workspaceEmail: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

// One doc type name per workspace
DocTypeSchema.index({ name: 1, workspaceEmail: 1 }, { unique: true });

export default models.DocType || model("DocType", DocTypeSchema);