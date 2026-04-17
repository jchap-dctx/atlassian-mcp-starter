export default function HomePage() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", lineHeight: 1.5 }}>
      <h1>Atlassian MCP Starter</h1>
      <p>This deployment exposes a Model Context Protocol endpoint for Jira and Confluence.</p>
      <p>
        Use <code>/mcp</code> as the connector URL.
      </p>
    </main>
  );
}
