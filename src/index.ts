/**
 * MCP Server 正式版入口
 * 使用 Streamable HTTP 传输方式
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { startWebSocketServer, closeWebSocketServer } from "./connection/ws-server.js";
import { registerTools } from "./tools/index.js";

const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8080", 10);
const WS_PORT = parseInt(process.env.WS_PORT || "3000", 10);

// 创建 Express 应用
const app = express();

/**
 * 创建并配置 McpServer 实例
 * 每次请求创建新实例，确保会话独立性
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "3d-editor-mcp",
    version: "1.0.0",
  });

  registerTools(server, (toolName, args) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Tool called: ${toolName}`);
    console.error(`[${timestamp}] Tool args:`, JSON.stringify(args, null, 2));
  });

  return server;
}

// MCP 端点 - Streamable HTTP（无状态模式）
// 不打印请求级日志，避免 Qoder 20 秒轮询污染终端；工具调用日志由 createServer 内的 logger 输出
app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// 无状态模式下 GET/DELETE 不支持，直接返回 405
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed (stateless mode)" });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed (stateless mode)" });
});

// 启动服务
async function main() {
  // 启动 WebSocket Server（编辑器连接）
  startWebSocketServer(WS_PORT);
  console.error(`WebSocket server started on port ${WS_PORT}`);

  // 启动 HTTP Server（MCP 连接）
  const LISTEN_HOST = process.env.LISTEN_HOST || "0.0.0.0";

  app.listen(HTTP_PORT, LISTEN_HOST, () => {
    console.error(`HTTP server started on ${LISTEN_HOST}:${HTTP_PORT}`);
    console.error(`MCP endpoint: http://${LISTEN_HOST}:${HTTP_PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

// 优雅关闭
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  await closeWebSocketServer();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down...");
  await closeWebSocketServer();
  process.exit(0);
});