import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // ── Ban removed document table fields ──────────────────────────────────────
  // These columns were permanently removed from the `documents` table.
  // Do NOT re-add them to types, DB schema, or any code path.
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name='approvalChainComments']",
          message: "'approvalChainComments' was removed from the documents table. Do not re-add it.",
        },
        {
          selector: "Identifier[name='complianceResult']",
          message: "'complianceResult' was removed from the documents table. Do not re-add it.",
        },
        {
          selector: "Identifier[name='extractedData']",
          message: "'extractedData' was removed from the documents table. Do not re-add it.",
        },
        {
          selector: "Identifier[name='flaggedIssues']",
          message: "'flaggedIssues' was removed from the documents table. Do not re-add it.",
        },
        {
          selector: "Identifier[name='previousVersionId']",
          message: "'previousVersionId' was removed from the documents table. Do not re-add it.",
        },
        // projectId and summary are NOT lint-flagged here — they are too
        // common across the codebase (Project, Milestone, DailyNote, etc.).
        // Guard comments in types.ts and mysql.ts serve as documentation.
      ],
    },
  },
]);

export default eslintConfig;
