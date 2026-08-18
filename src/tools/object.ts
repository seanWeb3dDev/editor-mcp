/**
 * 物体添加相关工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommand } from "../connection/ws-server.js";
import { z } from "zod";
import type { ToolLogger } from "./index.js";

/**
 * 注册物体添加相关工具
 */
export function registerObjectTools(server: McpServer, logger?: ToolLogger) {
  // add_object 工具
  server.registerTool(
    "add_object",
    {
      title: "添加物体到场景",
      description: `添加新物体到场景中。

**何时使用**：当用户需要在场景中添加灯光、文本、粒子、几何体、辅助线等新物体时调用此工具。

**重要说明**：
- 当添加组（subtype='group'）时，必须指定 type 参数来确定添加到哪个类型的组中：
  - type='light' + subtype='group' → 添加到灯光组
  - type='text' + subtype='group' → 添加到文本组
  - type='particle' + subtype='group' → 添加到粒子组
  - type='model' + subtype='group' → 添加到场景根节点
  - type='helperLine' + subtype='group' → 添加到辅助线组

**可选参数**：
- \`name\`：物体名称，覆盖默认名称（如 \`name="设备组3个属性"\`）
- \`parentUuid\`：父节点 UUID，支持任意已存在的 Object3D / Group / Scene，覆盖默认父节点。常用于构建复合结构（如设备文本模板：在「设备组」容器下创建多个「设备属性」行容器，在「设备名文本」下创建「文本背景」Mesh）。存在性校验 + 禁止挂到自身下。

**支持的类型**：
| type | subtype | 说明 |
|------|---------|------|
| light | group | 灯光组 |
| light | AmbientLight | 环境光 |
| light | DirectionalLight | 直线光（默认配置）|
| light | SpotLight | 聚光灯（默认配置）|
| light | PointLight | 点光源 |
| light | HemisphereLight | 半球光 |
| **预设灯光** | | |
| light | DirectionalLight_high | 高精直线光（大场景，4096精度）|
| light | DirectionalLight_medium | 标准直线光（1024精度）|
| light | DirectionalLight_room | 小场景直线光（室内，50范围）|
| light | SpotLight_normal | 范围光（一般聚光灯）|
| light | SpotLight_spot | 射灯（垂直向下照射）|
| text | group | 文本组 |
| text | text | 文本 |
| particle | group | 粒子组 |
| particle | particle | 粒子 |
| model | group | 模型组（添加到场景根节点）|
| model | BoxGeometry | 正方体 |
| model | PlaneGeometry | 平面 |
| model | SphereGeometry | 球体 |
| model | CylinderGeometry | 圆柱体 |
| model | HollowedPlaneGeometry | 回形面 |
| model | PlaneGeometry_mirror | 镜面 |
| model | HollowedPlaneGeometry_mirror | 回形镜面 |
| helperLine | group | 辅助线组 |
| helperLine | helperLine | 辅助线 |

**返回值**：
- 成功：返回 data.objectId 为新物体的 UUID，可直接用于后续的 update_object、select_object、delete_object、set_material 等工具
- 失败：返回 error.code 和 error.message 说明失败原因`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        type: z.enum(["light", "text", "particle", "model", "helperLine"]).describe("物体类型"),
        subtype: z.string().describe("物体子类型，如 DirectionalLight、text、particle、BoxGeometry 等"),
        name: z.string().optional().describe("可选：物体名称（覆盖默认名称），如 '设备组3个属性'"),
        parentUuid: z.string().optional().describe("可选：父节点 UUID，支持任意已存在的 Object3D / Group / Scene，覆盖默认父节点"),
      },
    },
    async ({ projectId, type, subtype, name, parentUuid }) => {
      logger?.("add_object", { projectId, type, subtype, name, parentUuid });
      try {
        const result = await sendCommand(projectId, "addObject", {
          type,
          subtype,
          name,
          parentUuid,
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

  // delete_object 工具
  server.registerTool(
    "delete_object",
    {
      title: "删除物体",
      description: `删除场景中的指定物体。

**注意**：
- 被锁定的物体（isLocked=true）无法删除
- 删除操作可通过 Ctrl+Z 撤销`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("要删除的物体 UUID"),
      },
    },
    async ({ projectId, objectId }) => {
      logger?.("delete_object", { projectId, objectId });
      try {
        const result = await sendCommand(projectId, "deleteObject", {
          objectId,
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

  // set_state 工具
  server.registerTool(
    "set_state",
    {
      title: "设置物体状态",
      description: `设置物体状态。状态用于存储物体的动态属性，可在运行时被修改。

**状态结构**：
- key: 状态名称（如 "开关"、"温度"、"运行状态"）
- type: 状态类型（boolean / number / string）
- value: 状态值

**示例**：
- 布尔值：{ key: "开关", type: "boolean", value: true }
- 数字：{ key: "温度", type: "number", value: 100 }
- 字符串：{ key: "运行状态", type: "string", value: "正常" }`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 UUID"),
        state: z.object({
          key: z.string().describe("状态名称"),
          type: z.enum(["boolean", "number", "string"]).describe("状态类型"),
          value: z.union([z.boolean(), z.number(), z.string()]).describe("状态值"),
        }).describe("状态对象"),
      },
    },
    async ({ projectId, objectId, state }) => {
      logger?.("set_state", { projectId, objectId, state });
      try {
        const result = await sendCommand(projectId, "setState", {
          objectId,
          state,
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

  // delete_state 工具
  server.registerTool(
    "delete_state",
    {
      title: "删除物体状态",
      description: `删除物体的指定状态。

**注意**：
- 只删除指定 key 的状态，不影响其他状态
- 删除后物体的 userData.state 中不再包含该状态

**文本对象歧义**：若文本对象的 \`preText\` 中包含 \`@{stateKey}@\` 占位符引用了该状态，用户可能是想仅移除引用（用 update_object 改 preText）而非彻底删除状态本身，操作前请先澄清意图。`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("物体 UUID"),
        key: z.string().describe("要删除的状态名称"),
      },
    },
    async ({ projectId, objectId, key }) => {
      logger?.("delete_state", { projectId, objectId, key });
      try {
        const result = await sendCommand(projectId, "deleteState", {
          objectId,
          key,
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

  // duplicate_object 工具
  server.registerTool(
    "duplicate_object",
    {
      title: "复制物体",
      description: `复制场景中的物体。

**复制类型**：
- 普通复制（deep=false）：共享材质引用，修改原物体材质会影响新物体
- 深度复制（deep=true）：复制材质，新物体拥有独立的材质副本

**特殊处理**：
- 辅助点（HelperDot）：执行插入点逻辑，在当前点后添加新点
- 镜面（Reflector）：不能复制

**注意**：
- 复制后的物体会有新的 UUID
- 新物体继承原物体名称
- 新物体添加到与原物体相同的父级`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("要复制的物体 UUID"),
        deep: z.boolean().optional().default(false).describe("是否深度复制材质（默认 false）"),
        position: z.object({
          x: z.number().optional().describe("X 坐标偏移"),
          y: z.number().optional().describe("Y 坐标偏移"),
          z: z.number().optional().describe("Z 坐标偏移"),
        }).optional().describe("复制后的位置偏移"),
      },
    },
    async ({ projectId, objectId, deep, position }) => {
      logger?.("duplicate_object", { projectId, objectId, deep, position });
      try {
        const result = await sendCommand(projectId, "duplicateObject", {
          objectId,
          options: {
            deep,
            position,
          },
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

  // move_object 工具
  server.registerTool(
    "move_object",
    {
      title: "移动物体到指定父节点下",
      description: `修改物体的层级关系（移动到另一个 Group/Scene 下），或调整物体在同一父节点下的排列顺序。

**何时使用**：
- 把物体挂到指定 Group 下（语义化分组整理）
- 调整物体在父节点 children 中的顺序（影响渲染层级或场景树显示顺序）

**参数说明**：
- objectId：要移动的物体 UUID
- parentUuid：目标父节点 UUID（可以是任意 Group / Scene 根节点）
- index：插入到父节点 children 的索引位置
  - 省略或传 -1：追加到末尾
  - 传 0：插到第一个位置
  - 传 N：插到第 N 个位置（超出范围会自动截断到末尾）

**限制**：
- 不能把物体移动到自身或它的子孙节点下（会导致循环）
- 移动会改变场景树结构，但不改变物体的世界坐标位置（position 是相对父节点的局部坐标）
- 如果希望物体世界坐标不变，需要在移动后手动调整 position

**撤销**：可通过 Ctrl+Z 撤销`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        objectId: z.string().describe("要移动的物体 UUID"),
        parentUuid: z.string().describe("目标父节点 UUID（Group 或 Scene 根节点）"),
        index: z.number().optional().describe("插入到父节点 children 的索引，-1 或省略表示追加到末尾"),
      },
    },
    async ({ projectId, objectId, parentUuid, index }) => {
      logger?.("move_object", { projectId, objectId, parentUuid, index });
      try {
        const result = await sendCommand(projectId, "moveObject", {
          objectId,
          parentUuid,
          index,
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

  // generate_from_helper_line 工具
  server.registerTool(
    "generate_from_helper_line",
    {
      title: "从辅助线生成物体",
      description: `基于辅助线生成 3D 物体。

**何时使用**：当用户需要沿辅助线路径生成管道、箭头路径、粒子发射器等效果时调用。

**前置条件**：目标必须是辅助线（helperLine 组中的物体），且至少包含 2 个控制点。

**生成类型**：
- pipe：沿路径生成管状几何体，适用于管线、线缆
- path：沿路径生成带单向箭头指示线，适用于导航、路径指引
- arrow：沿路径生成双向箭头，适用于双向标记
- particle：在第一个控制点创建粒子发射器，朝最后一个控制点方向发射

**注意**：生成后原辅助线不会被删除，生成的物体添加到场景根节点（粒子添加到粒子组）。`,
      inputSchema: {
        projectId: z.string().describe("连接 ID"),
        helperLineUuid: z.string().describe("辅助线 UUID"),
        generateType: z.enum(["pipe", "path", "arrow", "particle"]).describe("生成类型"),
      },
    },
    async ({ projectId, helperLineUuid, generateType }) => {
      logger?.("generate_from_helper_line", { projectId, helperLineUuid, generateType });
      try {
        const result = await sendCommand(projectId, "generateFromHelperLine", {
          helperLineUuid,
          generateType,
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
}
