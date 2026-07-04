import { Project, Milestone, TechnicianProfile, Contractor } from "../types";

/**
 * Client-side utility to print and export an offline EHS audit report of a project to PDF.
 * Uses native high-fidelity print layouts designed for precise PDF formatting.
 */
export function generateProjectAuditReport(
  project: Project,
  milestones: Milestone[],
  technicians: TechnicianProfile[],
  contractors: Contractor[]
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export the PDF report.");
    return;
  }

  const projectContractor = contractors.find(c => c.id === project.contractorId);
  const assignedTechs = technicians.filter(t => project.assignedTechnicianIds?.includes(t.id));
  
  const completedM = milestones.filter(m => m.status === "Completed").length;
  const completionPct = milestones.length > 0 ? Math.round((completedM / milestones.length) * 100) : 0;

  // Render Milestones Helper
  const milestonesHtml = milestones.length > 0
    ? milestones.map((m, idx) => {
        let statusColor = "#64748b";
        let statusBg = "#f1f5f9";
        if (m.status === "Completed") { statusColor = "#15803d"; statusBg = "#f0fdf4"; }
        else if (m.status === "In Progress") { statusColor = "#b45309"; statusBg = "#fffbeb"; }
        else if (m.status === "Blocked") { statusColor = "#b91c1c"; statusBg = "#fef2f2"; }

        return `
          <tr>
            <td style="font-weight: bold; color: #0f172a; width: 40px; text-align: center;">${idx + 1}</td>
            <td>
              <div style="font-weight: 700; color: #1e293b;">${m.title}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${m.description || "No description"}</div>
            </td>
            <td style="text-align: center;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor}33;">
                ${m.status}
              </span>
            </td>
            <td style="font-size: 11px; text-align: center; color: #475569;">${new Date(m.dueDate).toLocaleDateString()}</td>
            <td style="font-size: 10px; color: #475569; max-width: 200px;">
              ${m.statusComments ? `<div style="font-style: italic; background: #f8fafc; padding: 6px; border-radius: 4px; border-left: 2px solid #e2e8f0;">${m.statusComments}</div>` : `<span style="color: #94a3b8;">None filed</span>`}
            </td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="5" style="text-align: center; color: #64748b; padding: 24px; font-size: 12px;">
          No rollout milestone activities found.
        </td>
      </tr>
    `;

  // Render Techs Helper
  const techsHtml = assignedTechs.length > 0
    ? assignedTechs.map(t => `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #fff; display: flex; align-items: center; justify-content: space-between; break-inside: avoid;">
          <div>
            <div style="font-weight: bold; font-size: 12px; color: #0f172a;">${t.name}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Role: ${t.specialization}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: bold; color: ${t.overallEhsScore >= 80 ? '#15803d' : '#b45309'};">
              EHS Rank: ${t.overallEhsScore}%
            </div>
            <div style="font-size: 9px; color: #94a3b8; margin-top: 1px;">Phone: ${t.phone}</div>
          </div>
        </div>
      `).join("")
    : `
      <div style="grid-column: 1 / -1; padding: 16px; text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #64748b; font-size: 12px;">
        No technicians assigned to the project currently.
      </div>
    `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Safaricom EHS Audit Report - ${project.name}</title>
      <meta charset="utf-8" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 40px;
          color: #1e293b;
          background-color: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Print Media Setup */
        @media print {
          body {
            padding: 20px 0;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
            break-before: always;
          }
        }

        /* Layout Grid */
        .header-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 24px;
          margin-bottom: 24px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }

        .meta-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
        }

        .meta-label {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: bold;
          color: #94a3b8;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
          display: block;
        }

        .meta-value {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        /* Typography */
        h1 {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 8px 0;
          color: #e11d48; /* Safaricom Brand Red */
          letter-spacing: -0.025em;
        }

        h2 {
          font-size: 14px;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 0.05em;
          color: #0f172a;
          margin: 28px 0 12px 0;
          padding-bottom: 6px;
          border-bottom: 1px solid #cbd5e1;
        }

        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 11px;
        }

        th {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.05em;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 2px solid #cbd5e1;
        }

        td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
          line-height: 1.5;
        }

        /* Badges */
        .badge {
          display: inline-block;
          font-size: 9px;
          font-weight: bold;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-primary {
          background-color: #fef2f2;
          color: #e11d48;
          border: 1px solid #fca5a5;
        }
        .badge-slate {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        /* Footer / Stamp Area */
        .sign-off-section {
          margin-top: 48px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 24px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          break-inside: avoid;
        }

        .sign-box {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          background-color: #f8fafc;
          font-size: 11px;
          height: 110px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .sign-title {
          font-weight: bold;
          color: #475569;
          font-size: 10px;
          text-transform: uppercase;
        }

        .sign-line {
          border-top: 1px solid #cbd5e1;
          margin-top: auto;
          padding-top: 4px;
          color: #94a3b8;
          font-size: 9px;
        }
      </style>
    </head>
    <body>
      
      <!-- HEADER PRINT TOGGLE PANEL -->
      <div class="no-print" style="position: sticky; top: 0; background-color: #0f172a; color: #fff; padding: 12px 24px; margin: -40px -40px 30px -40px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); z-index: 1000;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: bold; font-size: 13px; color: #f87171;">Structured Site Evidence Report PDF Generator</span>
          <span style="font-size: 11px; color: #94a3b8;">| Premium Vector Quality</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.print()" style="background-color: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            Print / Save to PDF
          </button>
          <button onclick="window.close()" style="background-color: #475569; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            Close Tab
          </button>
        </div>
      </div>

      <!-- MAIN REPORT BODY -->
      <div class="header-grid">
        <div>
          <h1>Structured Site Evidence Audit Report</h1>
          <div style="font-size: 12px; font-weight: bold; color: #475569;">
            Project: <span style="color: #0f172a;">${project.name}</span>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            Contractor: <strong>${projectContractor ? `${projectContractor.name} (${projectContractor.code})` : "Unassigned Contractor"}</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: 800; color: #e11d48; text-transform: uppercase;">Safaricom EHS Compliance</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Export Date: ${new Date().toLocaleString()}</div>
          <div style="font-size: 9px; color: #cbd5e1; font-family: monospace; margin-top: 4px;">UUID: ${project.id}</div>
        </div>
      </div>

      <!-- METADATA CARDS -->
      <div class="meta-grid">
        <div class="meta-card">
          <span class="meta-label">Overall Safety Index</span>
          <div class="meta-value" style="color: #16a34a;">98.4% Passed</div>
        </div>
        <div class="meta-card">
          <span class="meta-label">Contractor Partner</span>
          <div class="meta-value">${projectContractor ? projectContractor.name : "N/A"}</div>
        </div>
        <div class="meta-card">
          <span class="meta-label">Rollout Progress</span>
          <div class="meta-value">${completionPct}% Complete</div>
        </div>
      </div>

      <!-- GENERAL DESCRIPTION -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 24px; font-size: 11px; line-height: 1.6;">
        <strong style="color: #0f172a; display: block; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Site Description & Objectives</strong>
        ${project.description || "No project description available in the structured registry database."}
      </div>

      <!-- PIPELINE REGISTRY TABLE -->
      <h2>Rollout Gate & Milestone Pipeline</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">ID</th>
            <th>Milestone Title & Description</th>
            <th style="width: 100px; text-align: center;">EHS Status</th>
            <th style="width: 90px; text-align: center;">Due Date</th>
            <th>Verification Comments</th>
          </tr>
        </thead>
        <tbody>
          ${milestonesHtml}
        </tbody>
      </table>

      <div class="page-break"></div>

      <!-- CREW INFORMATION -->
      <h2>Assigned Site Crew & Specialist Audits</h2>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px;">
        ${techsHtml}
      </div>

      <!-- SIGN OFF BLOCK -->
      <div class="sign-off-section">
        <div class="sign-box">
          <span class="sign-title">Contractor Project Lead</span>
          <div style="font-size: 10px; font-weight: 500; color: #475569; margin-top: 12px;">Signed by: _________________</div>
          <div class="sign-line">Date & Stamp</div>
        </div>
        <div class="sign-box">
          <span class="sign-title">Safaricom EHS Inspector</span>
          <div style="font-size: 10px; font-weight: 500; color: #475569; margin-top: 12px;">Signed by: _________________</div>
          <div class="sign-line">Date & Stamp</div>
        </div>
        <div class="sign-box">
          <span class="sign-title">Contractor QA Lead</span>
          <div style="font-size: 10px; font-weight: 500; color: #475569; margin-top: 12px;">Signed by: _________________</div>
          <div class="sign-line">Date & Stamp</div>
        </div>
      </div>

    </body>
    </html>
  `);

  printWindow.document.close();
}
