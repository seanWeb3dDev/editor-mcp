/**
 * 工具栏操作工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommand } from "../connection/ws-server.js";
import { z } from "zod";
import type { ToolLogger } from "./index.js";

/**
 * 注册工具栏操作工具
 */
export function registerToolbarTools(server: McpServer, logger?: ToolLogger) {

    // toggle_light_helper 工具
    server.registerTool(
        "toggle_light_helper",
        {
            title: "切换灯光辅助显示",
            description: `显示或隐藏灯光辅助线。灯光辅助线用于可视化灯光的方向和范围，帮助用户在编辑时更直观地调整灯光位置。`,
            inputSchema: {
                projectId: z.string().describe("连接 ID"),
                visible: z.boolean().describe("true=显示, false=隐藏"),
            },
        },
        async ({ projectId, visible }) => {
            logger?.("toggle_light_helper", { projectId, visible });
            try {
                const result = await sendCommand(projectId, "toggleTool", {
                    toolKey: "toggleLightHelper",
                    value: visible,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    isError: true,
                };
            }
        }
    );

    // toggle_grid 工具
    server.registerTool(
        "toggle_grid",
        {
            title: "切换网格显示",
            description: `显示或隐藏场景网格。网格是地面上的参考线，帮助用户判断物体的位置和大小。`,
            inputSchema: {
                projectId: z.string().describe("连接 ID"),
                visible: z.boolean().describe("true=显示, false=隐藏"),
            },
        },
        async ({ projectId, visible }) => {
            logger?.("toggle_grid", { projectId, visible });
            try {
                const result = await sendCommand(projectId, "toggleTool", {
                    toolKey: "toggleGrid",
                    value: visible,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    isError: true,
                };
            }
        }
    );

    // toggle_shader_preview 工具
    server.registerTool(
        "toggle_shader_preview",
        {
            title: "切换着色器预览",
            description: `开启或关闭特效预览。开启后会实时渲染材质特效（如水面波纹、火焰、流光等），关闭则显示基础材质以提高性能。`,
            inputSchema: {
                projectId: z.string().describe("连接 ID"),
                enabled: z.boolean().describe("true=开启特效预览, false=关闭"),
            },
        },
        async ({ projectId, enabled }) => {
            logger?.("toggle_shader_preview", { projectId, enabled });
            try {
                const result = await sendCommand(projectId, "toggleTool", {
                    toolKey: "toggleShaderPreview",
                    value: enabled,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    isError: true,
                };
            }
        }
    );

    // toggle_animation 工具
    server.registerTool(
        "toggle_animation",
        {
            title: "切换动画播放",
            description: `开启或关闭全局动画。开启后场景中所有模型的动画会同时播放，关闭则暂停所有动画。`,
            inputSchema: {
                projectId: z.string().describe("连接 ID"),
                enabled: z.boolean().describe("true=播放全局动画, false=暂停"),
            },
        },
        async ({ projectId, enabled }) => {
            logger?.("toggle_animation", { projectId, enabled });
            try {
                const result = await sendCommand(projectId, "toggleTool", {
                    toolKey: "toggleAnimation",
                    value: enabled,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    isError: true,
                };
            }
        }
    );

    // toggle_single_show 工具
    server.registerTool(
        "toggle_single_show",
        {
            title: "切换单体显示",
            description: `开启或关闭单独显示模式。开启后仅显示当前选中的物体，隐藏其他所有物体，方便查看和编辑单个物体。`,
            inputSchema: {
                projectId: z.string().describe("连接 ID"),
                enabled: z.boolean().describe("true=开启单独显示, false=关闭"),
            },
        },
        async ({ projectId, enabled }) => {
            logger?.("toggle_single_show", { projectId, enabled });
            try {
                const result = await sendCommand(projectId, "toggleTool", {
                    toolKey: "toggleSingleShow",
                    value: enabled,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    isError: true,
                };
            }
        }
    );

    // toggle_model_animation 工具
    server.registerTool(
        "toggle_model_animation",
        {
            title: "切换单个模型的动画播放",
            description: `切换指定模型上一个或多个动画的播放/暂停状态。当前正在播放的动画会被暂停，当前暂停的动画会被播放。

动画 clip 的 UUID 可通过 get_object_detail 返回的 animations.value 数组获取。`,
            inputSchema: {
                projectId: z.string().describe("连接 ID"),
                objectId: z.string().describe("模型 UUID"),
                clipUuids: z.array(z.string()).describe("要切换的动画 clip UUID 列表"),
            },
        },
        async ({ projectId, objectId, clipUuids }) => {
            logger?.("toggle_model_animation", { projectId, objectId, clipUuids });
            try {
                const result = await sendCommand(projectId, "toggleModelAnimation", {
                    objectId,
                    clipUuids,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    isError: true,
                };
            }
        }
    );

}
