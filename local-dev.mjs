import "dotenv/config";

import http from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createServer } from "./server.mjs";

const VERIFY_SSL = (process.env.ATLASSIAN_VERIFY_SSL ?? "true").toLowerCase() === "true";
const MCP_TRANSPORT = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
const MCP_HOST = process.env.MCP_HOST ?? "127.0.0.1";
const MCP_PORT = Number(process.env.MCP_PORT ?? "8000");

async function main() {
  if (!VERIFY_SSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  if (MCP_TRANSPORT === "stdio") {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  if (MCP_TRANSPORT !== "streamable-http") {
    throw new Error('MCP_TRANSPORT must be "stdio" or "streamable-http"');
  }

  const httpServer = http.createServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end("Not found");
      return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } finally {
      transport.close();
      await server.close();
    }
  });

  httpServer.listen(MCP_PORT, MCP_HOST, () => {
    console.error(`MCP server listening at http://${MCP_HOST}:${MCP_PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
