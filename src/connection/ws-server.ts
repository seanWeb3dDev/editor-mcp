/**
 * WebSocket Server - 管理编辑器连接
 *
 * 支持两种消息：
 *   1) 命令响应：{ id, result, error } —— 对应 sendCommand 的请求
 *   2) 事件推送：{ type: "event", projectId, event, data } —— 编辑器主动推的事件
 */

import { WebSocketServer, WebSocket } from "ws";

// 存储已连接的编辑器
const connectedEditors = new Map<string, WebSocket>();

let wsServer: WebSocketServer | null = null;

// 待响应请求：requestId -> { resolve, reject, timer }
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};
const pendingRequests = new Map<string, PendingRequest>();

// 事件订阅：event -> Set<handler>
// 订阅者只关心特定事件，handler 接收 (projectId, data)
type EventHandler = (projectId: string, data: unknown) => void;
const eventSubscribers = new Map<string, Set<EventHandler>>();

/**
 * 订阅某类事件（返回取消订阅函数）
 */
export function onEditorEvent(
  event: string,
  handler: EventHandler
): () => void {
  let set = eventSubscribers.get(event);
  if (!set) {
    set = new Set();
    eventSubscribers.set(event, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
    if (set!.size === 0) eventSubscribers.delete(event);
  };
}

/**
 * 启动 WebSocket Server
 */
export function startWebSocketServer(port: number) {
  wsServer = new WebSocketServer({ port });

  wsServer.on("connection", (ws, req) => {
    // 从 URL 解析 projectId
    const url = new URL(req.url || "", `http://localhost`);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      console.error("Connection rejected: no projectId");
      ws.close();
      return;
    }

    // 存储连接（重复 ID 覆盖：新连接踢掉旧连接）
    const existing = connectedEditors.get(projectId);
    if (existing) {
      console.error(`Connection replaced: projectId=${projectId}`);
      existing.close();
    }
    connectedEditors.set(projectId, ws);
    console.error(`Editor connected: projectId=${projectId}`);

    // 持久消息监听：按 id 分发到 pendingRequests，按 type=event 分发到 eventSubscribers
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        // 事件消息：编辑器主动推送（如 model.loaded）
        if (message.type === "event" && typeof message.event === "string") {
          const handlers = eventSubscribers.get(message.event);
          if (handlers && handlers.size > 0) {
            for (const handler of handlers) {
              try {
                handler(message.projectId || projectId, message.data);
              } catch (err) {
                console.error(`Event handler error (${message.event}):`, err);
              }
            }
          }
          return;
        }

        // 命令响应消息：按 id 匹配 pendingRequests
        if (message.id) {
          const pending = pendingRequests.get(message.id);
          if (pending) {
            pendingRequests.delete(message.id);
            clearTimeout(pending.timer);
            if (message.error) {
              pending.reject(new Error(
                typeof message.error === "string" ? message.error : JSON.stringify(message.error)
              ));
            } else {
              pending.resolve(message.result);
            }
          } else {
            console.error(`Received response for unknown requestId: ${message.id}`);
          }
          return;
        }

        console.error("Unknown message format:", message);
      } catch (error) {
        console.error("Parse error:", error);
      }
    });

    // 处理断开
    ws.on("close", () => {
      connectedEditors.delete(projectId);
      console.error(`Editor disconnected: projectId=${projectId}`);
    });
  });

  console.error(`WebSocket server listening on port ${port}`);
}

/**
 * 关闭 WebSocket Server
 */
export async function closeWebSocketServer() {
  if (wsServer) {
    // 关闭所有连接
    for (const ws of connectedEditors.values()) {
      ws.close();
    }
    connectedEditors.clear();

    // 拒绝所有待响应请求
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("WebSocket server is closing"));
    }
    pendingRequests.clear();

    // 清空事件订阅
    eventSubscribers.clear();

    // 关闭服务器
    wsServer.close();
    wsServer = null;
  }
}

/**
 * 获取已连接的项目列表
 */
export function getConnectedProjects(): string[] {
  return Array.from(connectedEditors.keys());
}

/**
 * 检查指定连接 ID 是否有已连接的编辑器（仅查表，不发送命令）
 */
export function isProjectConnected(projectId: string): boolean {
  return connectedEditors.has(projectId);
}

/**
 * 向指定项目发送命令并等待响应
 * @param timeoutMs 超时毫秒数，默认 10000，最长建议 300000（5 分钟）
 */
export async function sendCommand(
  projectId: string,
  command: string,
  params: Record<string, unknown>,
  timeoutMs: number = 10000
): Promise<unknown> {
  const ws = connectedEditors.get(projectId);
  if (!ws) {
    throw new Error(`Project ${projectId} not connected`);
  }

  // 生成唯一请求 ID
  const requestId = `${command}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const message = {
    id: requestId,
    command,
    params,
  };

  // 发送命令
  ws.send(JSON.stringify(message));

  // 等待响应：注册到 pendingRequests，由 on("message") 分发
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Command ${command} timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timer });
  });
}