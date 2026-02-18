// models/Transaction.ts
import mongoose, { Schema, models, model } from "mongoose";

const TransactionSchema = new Schema(
  {
    agentName:      { type: String, required: true, trim: true },
    // workspaceEmail scopes ALL records — this is the TL/team email used at login
    workspaceEmail: { type: String, required: true, trim: true, lowercase: true },

    month:          { type: String, required: true },
    date:           { type: String, required: true },
    txId:           { type: String, required: true, trim: true },
    typeOfDoc:      { type: String, required: true, trim: true },
    startTime:      { type: String, required: true },
    endTime:        { type: String, default: null },
    tatMinutes:     { type: Number, default: 0 },
    tatDecimal:     { type: Number, default: 0 },
    tatFormatted:   { type: String, default: "" },
    status: {
      type: String,
      enum: ["No Doc", "Pending", "Done"],
      default: "Pending",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index for fast workspace-scoped queries
TransactionSchema.index({ workspaceEmail: 1, date: -1 });
TransactionSchema.index({ workspaceEmail: 1, agentName: 1, date: -1 });

export default models.Transaction || model("Transaction", TransactionSchema);