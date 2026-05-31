/**
 * ============================================================================
 * workflow-guidance — 激活式金字塔工作流模式
 * ============================================================================
 *
 * 核心理念（来自用户的"激活层"比喻）：
 *
 *   上下文窗口是"线性变换层"——所有计算在 latent space 完成，
 *   连续、可逆、无状态。纯靠 return 传递内容，信号逐层衰减。
 *
 *   写盘是"激活函数"——把 latent 计算不可逆地映射到持久存储，
 *   产生结构性质变。每个 Agent 独立落盘 = 每个神经元独立激活。
 *
 * 模式规则（Activation Pattern）：
 *
 *   1. 每个 Agent 用 Write 工具直接写文件到磁盘
 *   2. Agent 的 return 只返回 {path, byteSize, summary} 元数据
 *   3. 主流程只追踪路径、校验完整性、记录血缘
 *   4. 下一阶段 Agent 从磁盘 Read 上一阶段的输出
 *   5. 绝对禁止 .substring() 截断——内容直接落盘，不经 return
 *
 * 金字塔分层策略（Pyramid Model）：
 *
 *   底层大工作量打好基础 → 上一层读下一层的产出 → 逐层迭代升级
 *   每一层的输出是下一层的输入（通过磁盘，而非上下文窗口）
 *
 *   典型分层：
 *     Layer 1: 数据/SQL（最底层，工作量最大）
 *     Layer 2: 后端服务
 *     Layer 3: API 路由
 *     Layer 4: 前端页面（最上层）
 *
 * Windows 注意事项：
 *   - taskkill /F /IM python.exe 可能杀不干净僵尸进程
 *    ！！！必须用 netstat -ano | grep PORT 找到 PID 再逐个 taskkill /F /PID
 *   - Git Bash 会把 Unix 路径（/usr/local/...）转成 Windows 路径（C:/Program Files/Git/...）
 *     用 MSYS2_ARG_CONV_EXCL="*" 或 sh -c 来规避
 *   - Docker exec 需要 -e LD_LIBRARY_PATH=... 环境变量
 *
 * DB4AI 注意事项：
 *   - PREDICT BY 的 FEATURES 不支持子查询
 *   - 模型训练和预测的 feature 列表必须完全一致
 *   - COALESCE 默认值必须贯穿整个 COMPOSITE 公式
 *
 * 使用方法：
 *   在 workflow script 的每个 agent prompt 末尾附加：
 *
 *   "【落盘指令】将完整输出写入 {filePath}。
 *    使用 Write 工具保存。完成后 return 只返回文件路径和摘要。"
 *
 *   然后在主流程中收集路径：
 *   const results = [agent1, agent2, ...].filter(Boolean);
 *   const paths = results.map(r => r.split('\n')[0].trim());
 *   return { files: paths, ... };
 *
 * ============================================================================
 */

module.exports = {
  name: 'workflow-guidance',
  description: '激活式金字塔工作流模式：Agent Write 落盘 → 逐层迭代 → 零截断',
  version: '2.0.0',
  patterns: {
    activation: {
      description: 'Agent 直接 Write 到磁盘，不通过 return 传递内容',
      rule: '每个 Agent 用 Write 工具写文件，return 只传路径元数据',
    },
    pyramid: {
      description: '底层→上层逐层迭代，每层输出是下一层输入',
      rule: 'Layer N 的 Agent Write 文件 → Layer N+1 的 Agent Read 该文件',
    },
    port_zombie_prevention: {
      description: 'Windows 下杀死所有僵尸进程再启动',
      rule: 'netstat -ano | grep PORT → taskkill /F /PID 逐个杀 → 确认端口空闲 → 启动',
    },
    db4ai_predict: {
      description: 'DB4AI PREDICT BY 不支持子查询作为 FEATURES',
      rule: '只传模型训练时的原始特征列，子查询结果放在 SELECT 中而非 FEATURES 内',
    },
  },
};
