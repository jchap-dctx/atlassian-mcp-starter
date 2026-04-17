export const metadata = {
  title: "Atlassian MCP Starter",
  description: "Remote MCP server for Jira and Confluence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
