/**
 * 场景相关工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommand, getConnectedProjects } from "../connection/ws-server.js";
import { z } from "zod";
import type { ToolLogger } from "./index.js";

/**
 * 注册场景相关工具
 */
export function registerSceneTools(server: McpServer, logger?: ToolLogger) {
  // get_connected_projects 工具
  server.registerTool(
    "get_connected_projects",
    {
      title: "获取已连接项目",
      description: "获取当前已连接到 MCP Server 的所有编辑器实例列表（用户在编辑器顶部栏 MCP 连接时输入的连接 ID），用于确定可以操作的编辑器",
      inputSchema: {},
    },
    async () => {
      logger?.("get_connected_projects", {});
      const projects = getConnectedProjects();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              projects,
              total: projects.length,
              hint: projects.length > 0
                ? "使用 get_scene_info 工具传入 projectId（连接 ID）获取场景信息"
                : "没有编辑器连接，请先在编辑器顶部栏点击 MCP 按钮连接",
            }, null, 2),
          },
        ],
      };
    }
  );

  // get_scene_info 工具
  server.registerTool(
    "get_scene_info",
    {
      title: "获取场景信息",
      description: `获取指定项目场景中所有物体的层级结构数据，包含物体的 ID、名称、类型、材质等信息，同时返回项目绑定的模板标识。

**何时使用**：当需要了解当前场景中有哪些物体、物体之间的层级关系、或者需要获取某个物体的 objectId 以便后续操作时，应首先调用此工具。也可用于检查项目是否已绑定模板（续建/检查场景时需要）。

**返回数据**：
- template: 项目绑定的模板标识（如 "drainage-real"），未设置时为 null
- sceneData: 场景根节点 + children[] 树形结构，每个节点含 uuid、name、type、visible 等字段`,
      inputSchema: {
        projectId: z.string().describe("连接 ID（编辑器 MCP 连接时输入），可通过 get_connected_projects 获取"),
      },
    },
    async ({ projectId }) => {
      logger?.("get_scene_info", { projectId });
      try {
        const result = await sendCommand(projectId, "getSceneInfo", {});
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_object_detail 工具
  server.registerTool(
    "get_object_detail",
    {
      title: "获取物体详情",
      description: `获取指定物体的详细信息。返回数据包含完整元数据（label、value、inputType、writable等），请整理为用户易读格式展示：使用 label 作为属性名，展示 value 值，说明 writable 是否可修改。旋转值需转换为角度（乘以 180/π）。

**position 属性说明**：
- position 是物体的坐标属性，对于简单几何体（单 Mesh）通常等于实际位置
- 对于 GLB 模型，position 可能是 [0,0,0]，但模型实际位置由内部 Mesh 的相对坐标决定
- 当用户需要"模型实际位置"或"把 A 放在 B 上"时，应使用 get_bounding_box 获取包围盒中心`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 ID，可通过 get_scene_info 工具获取"),
      },
    },
    async ({ projectId, objectId }) => {
      logger?.("get_object_detail", { projectId, objectId });
      try {
        const result = await sendCommand(projectId, "getObjectDetail", { objectId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_bounding_box 工具
  server.registerTool(
    "get_bounding_box",
    {
      title: "获取物体包围盒",
      description: `获取物体的世界坐标包围盒信息。

**适用场景**：
- 需要知道某个模型的实际位置（而非 position 属性）
- 把 A 物体放在 B 物体位置上时，使用包围盒中心点
- 将文本标签放在模型上方时，使用 max.y 作为顶部位置

**返回数据**：
- center: 包围盒中心点 [x, y, z]
- min: 最小点 [x, y, z]
- max: 最大点 [x, y, z]
- size: 尺寸 [width, height, depth]`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 UUID"),
      },
    },
    async ({ projectId, objectId }) => {
      logger?.("get_bounding_box", { projectId, objectId });
      try {
        const result = await sendCommand(projectId, "getBoundingBox", { objectId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // select_object 工具
  server.registerTool(
    "select_object",
    {
      title: "选中物体",
      description: "选中场景中的指定物体，会在编辑器中高亮显示。注意：调用前必须先检查物体的 isLocked 属性。如果 isLocked 为 true，请直接告知用户「该物体已被锁定，无法选中」，不要调用此工具。",
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 UUID，可通过 get_scene_info 获取"),
      },
    },
    async ({ projectId, objectId }) => {
      logger?.("select_object", { projectId, objectId });
      try {
        const result = await sendCommand(projectId, "selectObject", { objectId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // update_object 工具
  server.registerTool(
    "update_object",
    {
      title: "更新物体属性",
      description: `修改物体的属性。支持批量修改多个属性。属性路径格式：公共属性直接传属性名（如 position），材质属性带前缀（如 material.color）。调用前先通过 get_object_detail 确认属性是否 writable。

**position 使用策略**：
- 当用户明确要求“修改 position”或“设置坐标”时，直接使用此工具修改 position
- 当用户要求“把 A 放在 B 上”或“移动到某模型位置”时，应先用 get_bounding_box 获取目标模型的包围盒中心，再修改 position
- 不确定时询问用户：是要修改 position 属性，还是要移动到模型实际位置？

**贴图设置**：
- \`material.map\`：设置材质贴图，value 传入图片 URL（如 ground.jpg 的完整 URL）

**文本内容修改**：
- 文本对象的内容字段是 \`preText\`（不是 text），如 \`updates = { preText: "当前：@{num}@" }\`
- \`@{stateKey}@\` 是状态占位符，state 变化时自动刷新

**自动刷新**：被修改的物体若当前被选中，右侧属性面板会自动刷新，无需额外操作。

**调用示例**：
- 移动 + 改名：\`updates = { position: [1, 2, 3], name: "新名称" }\`
- 修改材质颜色：\`updates = { "material.color": "#ff0000" }\`
- 修改几何体半径：\`updates = { "geometry.radius": 5 }\`
- 设置贴图：\`updates = { "material.map": "http://xxx/ground.jpg" }\`
- 修改可见性：\`updates = { visible: false }\`
- 批量修改：\`updates = { position: [0, 5, 0], rotation: [0, 1.57, 0], "material.opacity": 0.5 }\``,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 UUID"),
        updates: z.record(z.any()).describe("属性更新对象，如 { position: [1,2,3], name: 新名称 }"),
      },
    },
    async ({ projectId, objectId, updates }) => {
      logger?.("update_object", { projectId, objectId, updates });
      try {
        const result = await sendCommand(projectId, "updateObject", { objectId, updates });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // save_project 工具
  server.registerTool(
    "save_project",
    {
      title: "保存项目",
      description: `保存编辑器项目。

**保存类型**：
- scene：保存场景数据（glb + json 配置）
- config：只保存配置文件

**注意**：
- 保存操作将数据写入浏览器 IndexedDB
- 工具会等待实际写入完成后才返回结果
- 建议在重要修改后执行保存`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        type: z.enum(["scene", "config"]).optional().default("scene").describe("保存类型（默认 scene）"),
      },
    },
    async ({ projectId, type }) => {
      logger?.("save_project", { projectId, type });
      try {
        const result = await sendCommand(projectId, "saveProject", {
          type,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // export_object 工具
  server.registerTool(
    "export_object",
    {
      title: "导出物体",
      description: `导出指定物体为 GLB/GLTF 文件。

**导出目标判断规则**：
- 场景根节点下的物体 → 导出该物体本身
- 文本 → 导出整个文本组
- 灯光 → 导出整个灯光组
- 粒子 → 导出整个粒子组
- 辅助线 → 导出整个辅助线组

**导出格式**：
- glb（二进制，默认）
- gltf（文本格式）

**注意**：导出操作会触发浏览器下载`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 UUID"),
        format: z.enum(["glb", "gltf"]).optional().default("glb").describe("导出格式（默认 glb）"),
      },
    },
    async ({ projectId, objectId, format }) => {
      logger?.("export_object", { projectId, objectId, format });
      try {
        const result = await sendCommand(projectId, "exportObject", { objectId, format });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // set_material 工具
  server.registerTool(
    "set_material",
    {
      title: "设置物体材质",
      description: `给物体设置材质。

**材质来源**：
- source: 'new' + materialType - 创建新材质并应用
- source: 'object' + sourceObjectUuid - 从其他模型获取材质并应用

**支持的材质类型**：
| 材质类型 | 说明 |
|----------|------|
| BasicMaterial | 基础材质 |
| StandardMaterial | 标准材质 |
| GlassMaterial | 玻璃材质 |
| BrightenMaterial | 高亮材质 |
| FadeMaterial | 渐隐材质 |
| AltitudeMaterial | 高度着色材质 |
| FresnelMaterial | 菲涅尔材质 |
| WaterAMaterial | 水体材质A |
| WaterBMaterial | 水体材质B |
| AirFlowMaterial | 气流特效 |
| FireMaterial | 火焰特效 |
| FlowLightMaterial | 流光特效 |
| RippleMaterial | 波纹特效 |
| ArrowPathMaterial | 箭头路径特效 |
| RadarMaterial | 雷达特效 |
| FlowNoiseMaterial | 流动噪声纹理 |
| NoiseAMaterial | 分型布朗纹理A |

**注意**：
- 目标物体必须是 Mesh 类型
- materialSlot 默认为 0（主材质）`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        targetObjectUuid: z.string().describe("目标物体 UUID"),
        materialSource: z.object({
          source: z.enum(["new", "object"]).describe("材质来源类型"),
          materialType: z.string().optional().describe("材质类型（source='new'时必填）"),
          sourceObjectUuid: z.string().optional().describe("源物体 UUID（source='object'时必填）"),
        }).describe("材质来源配置"),
        materialSlot: z.number().optional().default(0).describe("材质索引（默认 0）"),
      },
    },
    async ({ projectId, targetObjectUuid, materialSource, materialSlot }) => {
      logger?.("set_material", { projectId, targetObjectUuid, materialSource, materialSlot });
      try {
        const result = await sendCommand(projectId, "setMaterial", {
          targetObjectUuid,
          materialSource,
          materialSlot,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // clear_scene 工具
  server.registerTool(
    "clear_scene",
    {
      title: "清空场景",
      description: `清除场景中所有物体。这是一个不可逆的操作，会移除场景中的灯光、文本、粒子、辅助线、模型等所有对象。

**重要提醒**：
- 此操作会清空整个场景，所有物体将被删除
- 操作无法通过 Ctrl+Z 撤销
- 建议在清除前先确认用户意图

**适用场景**：
- 用户明确要求"清空场景"、"删除所有物体"、"清除全部内容"时
- 重新创建场景前需要清理旧内容时`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
      },
    },
    async ({ projectId }) => {
      logger?.("clear_scene", { projectId });
      try {
        const result = await sendCommand(projectId, "clearScene", {});
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
