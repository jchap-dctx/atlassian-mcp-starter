import { createMcpHandler } from "mcp-handler";

import { registerTools } from "../../../server.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const VERIFY_SSL = (process.env.ATLASSIAN_VERIFY_SSL ?? "true").toLowerCase() === "true";

if (!VERIFY_SSL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
