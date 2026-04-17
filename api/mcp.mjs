import "dotenv/config";

import { createMcpHandler } from "mcp-handler";

import { registerTools } from "../server.mjs";

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

export async function GET(req) {
  return handler(req);
}

export async function POST(req) {
  return handler(req);
}

export async function DELETE(req) {
  return handler(req);
}

export default async function legacyHandler(req, res) {
  if (!VERIFY_SSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  try {
    const response = await handler(req);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const body = await response.text();
    res.end(body);
  } catch (error) {
    console.error("Error handling MCP request", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        }),
      );
    }
  }
}
