# Atlassian MCP Starter

Small read-only Node.js MCP starter for Jira Data Center / Server and Confluence Data Center / Server.

This project is meant to help you prove three things in order:

1. Your account can call the Jira and Confluence REST APIs.
2. A local Node.js MCP server can wrap those APIs successfully.
3. The same server can later be deployed behind HTTPS and connected to ChatGPT Enterprise as a custom MCP app.

## What This Server Exposes

- `search`
- `fetch`
- `search_jira`
- `get_jira_issue`
- `search_confluence`
- `get_confluence_page`

The generic `search` and `fetch` tools make it easier to adapt this for ChatGPT app usage later. The explicit Jira and Confluence tools make local testing simpler.

## Files

- `server.mjs` - shared MCP server logic
- `app.mjs` - local development entrypoint
- `app/api/[transport]/route.js` - Vercel / Next.js MCP endpoint
- `.env.example` - environment variable template
- `package.json` - Node dependencies and scripts
- `vercel.json` - Vercel routing

## 1. Create PATs

You will usually need a personal access token for Jira and one for Confluence.

Atlassian says users can create their own PATs and they inherit that user's existing permissions:

- Jira PAT docs: <https://developer.atlassian.com/server/jira/platform/personal-access-token/>
- Atlassian PAT overview: <https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html>

If your company disabled PATs globally, you will need Atlassian admin help.

## 2. Copy the Environment Template

```bash
cd /Users/jchap/Repos/codex/dctx/atlassian-mcp-starter
cp .env.example .env
```

Fill in:

- `JIRA_BASE_URL`
- `JIRA_PAT`
- `CONFLUENCE_BASE_URL`
- `CONFLUENCE_PAT`

Notes:

- Use the full base URL, for example `https://jira.company.com`
- Do not include a trailing slash

## 3. Install Dependencies

```bash
npm install
```

## 4. Prove Your REST Access First

Do this before you even run the MCP server.

Jira:

```bash
curl -H "Authorization: Bearer $JIRA_PAT" \
  "$JIRA_BASE_URL/rest/api/2/myself"
```

Jira search:

```bash
curl -G \
  -H "Authorization: Bearer $JIRA_PAT" \
  --data-urlencode 'jql=project = YOURPROJECT ORDER BY updated DESC' \
  --data-urlencode 'maxResults=5' \
  "$JIRA_BASE_URL/rest/api/2/search"
```

Confluence:

```bash
curl -H "Authorization: Bearer $CONFLUENCE_PAT" \
  "$CONFLUENCE_BASE_URL/rest/api/content?limit=5"
```

If these fail, stop there and solve the API auth or network issue first.

## 5. Run the MCP Server Locally

Option A: stdio mode for local MCP testing

```bash
npm start
```

Option B: HTTP mode for a remotely reachable endpoint later

```bash
MCP_TRANSPORT=streamable-http MCP_HOST=0.0.0.0 MCP_PORT=8000 npm start
```

If you want to mimic the Vercel route locally after deployment prep:

```bash
npx vercel dev
```

## 6. Test the Tools

Quick local checks:

- `search_jira("login error")`
- `get_jira_issue("ABC-123")`
- `search_confluence("runbook")`
- `get_confluence_page("123456")`

You can also connect to the server with any MCP client that supports local stdio or streamable HTTP transport.

## 7. When You Want ChatGPT Enterprise To Use It

Localhost is only good for proving the code works. ChatGPT Enterprise will need a remotely reachable endpoint.

Typical next hosting choices:

- an internal VM behind a company reverse proxy
- a small container or app service with HTTPS
- a DMZ-hosted service that can still reach Jira and Confluence internally

OpenAI's docs say remote MCP servers are connected over the Internet / public Internet:

- <https://platform.openai.com/docs/mcp/>
- <https://platform.openai.com/docs/guides/tools-connectors-mcp>

For Vercel, the MCP endpoint path in this starter is:

```text
https://your-deployment-url.vercel.app/mcp
```

That is the URL you would use later in ChatGPT or Codex.

## Common Gotchas

- PATs may be disabled by Atlassian admins.
- Your laptop may reach Jira on VPN, but a cloud host may not.
- Self-signed internal TLS certs may require custom CA trust.
- Some Jira or Confluence fields may not be visible to your user even if the issue/page exists.
- ChatGPT workspace admins may still need to enable developer mode or allow custom MCP apps.
- Vercel must have the same environment variables set in the project settings:
  - `JIRA_BASE_URL`
  - `JIRA_PAT`
  - `CONFLUENCE_BASE_URL`
  - `CONFLUENCE_PAT`

## Suggested First Prompt Once Connected

After you connect this as a custom MCP app in ChatGPT, try:

```text
Search Jira and Confluence for references to "release checklist" and summarize the most relevant results with citations.
```
