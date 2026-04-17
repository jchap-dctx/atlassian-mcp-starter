import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const JIRA_BASE_URL = stripTrailingSlash(process.env.JIRA_BASE_URL ?? "");
const JIRA_PAT = process.env.JIRA_PAT ?? "";
const CONFLUENCE_BASE_URL = stripTrailingSlash(process.env.CONFLUENCE_BASE_URL ?? "");
const CONFLUENCE_PAT = process.env.CONFLUENCE_PAT ?? "";

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

function safeGet(data, ...path) {
  let current = data;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function summarizeText(value, limit = 800) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 3)}...`;
}

async function requestJson(baseUrl, token, path, params = {}) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: headers(token),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  return response.json();
}

async function jiraRequest(path, params = {}) {
  const baseUrl = requireEnv("JIRA_BASE_URL", JIRA_BASE_URL);
  const token = requireEnv("JIRA_PAT", JIRA_PAT);
  return requestJson(baseUrl, token, path, params);
}

async function confluenceRequest(path, params = {}) {
  const baseUrl = requireEnv("CONFLUENCE_BASE_URL", CONFLUENCE_BASE_URL);
  const token = requireEnv("CONFLUENCE_PAT", CONFLUENCE_PAT);
  return requestJson(baseUrl, token, path, params);
}

function jiraIssueUrl(issueKey) {
  return `${JIRA_BASE_URL}/browse/${issueKey}`;
}

function confluencePageUrl(pageId) {
  return `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${pageId}`;
}

function formatJiraIssue(issue) {
  const fields = issue.fields ?? {};
  const issueKey = issue.key ?? "";

  return {
    kind: "jira_issue",
    id: `jira:${issueKey}`,
    key: issueKey,
    url: issueKey ? jiraIssueUrl(issueKey) : "",
    summary: fields.summary,
    status: safeGet(fields, "status", "name"),
    issue_type: safeGet(fields, "issuetype", "name"),
    project: safeGet(fields, "project", "key"),
    assignee: safeGet(fields, "assignee", "displayName"),
    reporter: safeGet(fields, "reporter", "displayName"),
    updated: fields.updated,
    description: summarizeText(fields.description),
  };
}

function formatConfluencePage(page) {
  const pageId = String(page.id ?? "");
  const bodyStorage = safeGet(page, "body", "storage", "value");

  return {
    kind: "confluence_page",
    id: `confluence:${pageId}`,
    page_id: pageId,
    url: pageId ? confluencePageUrl(pageId) : "",
    title: page.title,
    space: safeGet(page, "space", "key"),
    version: safeGet(page, "version", "number"),
    body_excerpt: summarizeText(bodyStorage),
  };
}

function buildJiraJql(query) {
  const escaped = query.replace(/"/g, '\\"').trim();
  if (!escaped) {
    throw new Error("Query must not be empty.");
  }

  return `summary ~ "\\"${escaped}\\"" OR description ~ "\\"${escaped}\\"" ORDER BY updated DESC`;
}

function buildConfluenceCql(query) {
  const escaped = query.replace(/"/g, '\\"').trim();
  if (!escaped) {
    throw new Error("Query must not be empty.");
  }

  return `type = page AND siteSearch ~ "${escaped}" ORDER BY lastModified DESC`;
}

async function searchJira(query, maxResults) {
  const data = await jiraRequest("/rest/api/2/search", {
    jql: buildJiraJql(query),
    maxResults: clamp(maxResults, 1, 20),
    fields: "summary,status,issuetype,project,assignee,reporter,updated,description",
  });

  return {
    source: "jira",
    query,
    results: (data.issues ?? []).map(formatJiraIssue),
  };
}

async function getJiraIssue(issueKey) {
  const data = await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}`, {
    fields: "summary,status,issuetype,project,assignee,reporter,updated,description",
  });

  return formatJiraIssue(data);
}

async function searchConfluence(query, maxResults) {
  const data = await confluenceRequest("/rest/api/search", {
    cql: buildConfluenceCql(query),
    limit: clamp(maxResults, 1, 20),
    expand: "space,version",
  });

  return {
    source: "confluence",
    query,
    results: (data.results ?? [])
      .map((item) => item.content ?? {})
      .filter((content) => content.id)
      .map((content) => ({
        kind: "confluence_page",
        id: `confluence:${content.id}`,
        page_id: String(content.id),
        url: confluencePageUrl(String(content.id)),
        title: content.title,
        space: safeGet(content, "space", "key"),
        version: safeGet(content, "version", "number"),
      })),
  };
}

async function getConfluencePage(pageId) {
  const data = await confluenceRequest(`/rest/api/content/${encodeURIComponent(pageId)}`, {
    expand: "body.storage,space,version",
  });

  return formatConfluencePage(data);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function textResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function registerTools(server) {
  server.tool(
    "search_jira",
    "Search Jira issues visible to the current user.",
    {
      query: z.string().min(1),
      max_results: z.number().int().min(1).max(20).default(5),
    },
    async ({ query, max_results }) => textResult(await searchJira(query, max_results)),
  );

  server.tool(
    "get_jira_issue",
    "Fetch a Jira issue by key, for example ABC-123.",
    {
      issue_key: z.string().min(1),
    },
    async ({ issue_key }) => textResult(await getJiraIssue(issue_key)),
  );

  server.tool(
    "search_confluence",
    "Search Confluence pages visible to the current user.",
    {
      query: z.string().min(1),
      max_results: z.number().int().min(1).max(20).default(5),
    },
    async ({ query, max_results }) => textResult(await searchConfluence(query, max_results)),
  );

  server.tool(
    "get_confluence_page",
    "Fetch a Confluence page by numeric page id.",
    {
      page_id: z.string().min(1),
    },
    async ({ page_id }) => textResult(await getConfluencePage(page_id)),
  );

  server.tool(
    "search",
    "Search Jira, Confluence, or both and return unified results.",
    {
      query: z.string().min(1),
      source: z.enum(["all", "jira", "confluence"]).default("all"),
      max_results: z.number().int().min(1).max(20).default(8),
    },
    async ({ query, source, max_results }) => {
      const results = [];

      if (source === "all" || source === "jira") {
        const jiraResults = await searchJira(query, max_results);
        for (const item of jiraResults.results) {
          results.push({
            id: item.id,
            title: `[Jira] ${item.key}: ${item.summary ?? ""}`,
            url: item.url,
            metadata: item,
          });
        }
      }

      if (source === "all" || source === "confluence") {
        const confluenceResults = await searchConfluence(query, max_results);
        for (const item of confluenceResults.results) {
          results.push({
            id: item.id,
            title: `[Confluence] ${item.title ?? ""}`,
            url: item.url,
            metadata: item,
          });
        }
      }

      return textResult({ results: results.slice(0, clamp(max_results, 1, 20)) });
    },
  );

  server.tool(
    "fetch",
    "Fetch a unified Jira or Confluence item by id, for example jira:ABC-123 or confluence:12345.",
    {
      item_id: z.string().min(1),
    },
    async ({ item_id }) => {
      const [source, rawId] = item_id.split(":", 2);
      if (!source || !rawId) {
        throw new Error("item_id must look like jira:ABC-123 or confluence:12345");
      }

      if (source === "jira") {
        return textResult(await getJiraIssue(rawId));
      }

      if (source === "confluence") {
        return textResult(await getConfluencePage(rawId));
      }

      throw new Error("Unsupported item source. Use jira: or confluence:.");
    },
  );
}

export function createServer() {
  const server = new McpServer({
    name: "atlassian-mcp-starter",
    version: "0.1.0",
  });

  registerTools(server);
  return server;
}
