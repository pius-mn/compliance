/**
 * Shared constants — safe to import on both client and server.
 * (No server-only module imports here.)
 */

export const PREDEFINED_MILESTONES = [
  "High-Level Design & Feasibility",
  "Site Survey & Route Validation",
  "Permitting & Right of Way (RoW)",
  "Detailed Low-Level Design (LLD)",
  "Procurement of Materials",
  "Civil Works & Trenching",
  "Duct & Pole Installation",
  "Fiber Cable Deployment",
  "Splicing & Termination",
  "Testing & Commissioning (OTDR)",
  "Active Equipment Installation",
  "Ready for Service (RFS) Handover"
];

export const PREDEFINED_PREREQUISITES = [
  "Rollout Distance Approval",
  "Way Leave Clearance",
  "Site Access Permission",
  "Permits & Regulatory Approval",
  "Material Procurement Lead Time"
];

export const TOTAL_MILESTONES = PREDEFINED_MILESTONES.length;
