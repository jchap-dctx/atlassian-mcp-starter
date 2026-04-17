import "dotenv/config";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createServer } from "../server.mjs";

export const config = {
  runtime: "nodejs",
};

const VERIFY_SSL = (process.env.ATLASSIAN_VERIFY_SSL ?? "true").toLowerCase() === "true";

export default async function handler(req, res) {
  if (!VERIFY_SSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
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
  } finally {
    transport.close();
    await server.close();
  }
}
