import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  TOOLS,
  handleToolCall
} from "./src/index.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const MCP_PATH = "/mcp";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Requested-With, mcp-session-id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > 1024 * 1024) {
      throw new Error("Request body too large");
    }

    chunks.push(chunk);
  }

  if (size === 0) {
    return undefined;
  }

  return JSON.parse(
    Buffer.concat(chunks).toString("utf8")
  );
}

function getUserApiKey(req) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match || !match[1].startsWith("afp_")) {
    return null;
  }

  return match[1];
}

async function handleMcpRequest(req, res) {
  setCorsHeaders(res);

  const apiKey = getUserApiKey(req);
  const mockMode = process.env.ALIASFLEET_MOCK === "true";
  const devNoAuth = process.env.ALIASFLEET_DEV_NO_AUTH === "true";
  const isBypass = mockMode || devNoAuth || process.env.NODE_ENV !== "production";

  if (!apiKey && !isBypass) {
    res.writeHead(401, {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="AliasFleet"'
    });

    res.end(JSON.stringify({
      error: "A valid AliasFleet API key (afp_...) is required."
    }));

    return;
  }

  // Normalize Accept header for MCP Streamable HTTP transport
  if (!req.headers.accept || !req.headers.accept.includes("text/event-stream")) {
    req.headers.accept = "application/json, text/event-stream";
  }

  let body;

  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400, {
      "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
      error: "Invalid or oversized JSON request."
    }));

    return;
  }

  // Create an isolated server for this stateless request
  const server = new Server(
    {
      name: "aliasfleet",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({
      tools: TOOLS
    })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      try {
        return await handleToolCall(
          request.params.name,
          request.params.arguments || {},
          apiKey
        );
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error.message || "AliasFleet API request failed."
          }],
          isError: true
        };
      }
    }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);

  await transport.handleRequest(req, res, body);
}

const httpServer = createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname.replace(/\/+$/, "") || "/";

  // Public health endpoint for Railway
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
      status: "ok",
      service: "aliasfleet-mcp",
      version: "1.0.0"
    }));

    return;
  }

  // Friendly browser inspection endpoint for /mcp
  if (req.method === "GET" && pathname === MCP_PATH) {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
      status: "active",
      service: "aliasfleet-mcp",
      version: "1.0.0",
      transport: "streamable-http",
      endpoint: "/mcp",
      message: "AliasFleet Model Context Protocol (MCP) Streamable HTTP endpoint is active. Connect via MCP clients or send HTTP POST with JSON-RPC 2.0 payloads."
    }, null, 2));

    return;
  }

  if (pathname === MCP_PATH && req.method === "POST") {
    try {
      await handleMcpRequest(req, res);
    } catch (error) {
      console.error("MCP request failed:", error.message);

      if (!res.headersSent) {
        res.writeHead(500, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
          error: "Internal MCP server error."
        }));
      } else if (!res.writableEnded) {
        res.end();
      }
    }

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify({
    error: "Not found"
  }));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`AliasFleet MCP listening on ${HOST}:${PORT}`);
  console.log(`MCP endpoint: /mcp`);
  console.log(`Health endpoint: /health`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});

export default httpServer;
