/**
 * 工具注册
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSceneTools } from "./scene.js";
import { registerObjectTools } from "./object.js";
import { registerToolbarTools } from "./toolbar.js";

export type ToolLogger = (toolName: string, args: Record<string, unknown>) => void;

/**
 * 注册所有工具到 MCP Server
 * @param server MCP Server 实例
 * @param logger 可选的日志函数，用于记录工具调用
 */
export function registerTools(server: McpServer, logger?: ToolLogger) {
  registerSceneTools(server, logger);
  registerObjectTools(server, logger);
  registerToolbarTools(server, logger);
}