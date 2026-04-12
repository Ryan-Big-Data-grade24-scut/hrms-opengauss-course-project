# Cloud Deployment Evaluation

这份文档回答 3 个问题：

1. 我们是否需要云服务器
2. 学校是否明确要求上云
3. 如果要上云，什么样的选择更适合这个仓库

## 1. 当前结论

### 1.1 是否必须上云

从正式课程要求看，目前没有证据表明“必须上云部署”。

正式要求强调的是：

- 基于 `openGauss`
- 完成数据库应用系统
- 提交代码、文档、数据库文件、演示视频

本地材料里虽然有：

- `01-1 在ECS上安装部署openGauss数据库指导手册.docx`
- `01-6 在ECS上安装部署极简版openGauss数据库指导手册.docx`
- `华为云账号注册指导(1).pdf`

这些说明“上云路径是被支持的”，但不等于“上云是硬要求”。

## 1.2 是否有必要评估上云

有必要，但不是为了替代本地开发，而是为了：

- 让数据库和 AI 助手长期在线
- 避免你关机后整个环境熄火
- 让组员共享一个更稳定的测试地址

结论：

- 本地 Docker 仍然是主开发环境
- 云端更适合作为“共享测试 / 演示 / 稳定运行面”

## 2. 我们要什么样的云环境

如果为这个仓库选云环境，优先级应是：

1. CLI 友好
2. 官方文档清晰
3. 价格低
4. 支持稳定运行数据库或应用
5. 尽量不把团队绑定进复杂控制台流程

## 3. 当前可行候选

## 3.1 华为云

优点：

- 和课程语境最贴近
- 课程材料里已经有 ECS 和账号注册指导
- 提供 CLI

官方资料：

- Huawei Cloud CLI User Guide  
  https://support.huaweicloud.com/intl/en-us/ally-visitor-1-usermanual-hcli/Cloud%20Command%20Line%20Interface%20User%20Guide.pdf

判断：

- 如果你们想最大化贴合课程语境，华为云是最自然候选
- 但目前仓库内没有证据表明学校已明确给你们发放云资源或代金券

## 3.2 Oracle Cloud Infrastructure

优点：

- 官方一直保留 `Always Free` 资源
- 有正式 CLI
- 对个人/小项目长期在线比较友好

官方资料：

- Oracle Cloud Infrastructure Free Tier  
  https://www.oracle.com/cloud/free/
- OCI CLI  
  https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm

判断：

- 如果你们只想找“稳定便宜甚至免费”的长期在线主机，OCI 很值得评估
- 但课程语境贴合度不如华为云

## 3.3 AWS

优点：

- 文档和 CLI 很成熟

缺点：

- 免费层通常有时间限制，不适合把“长期稳定在线”完全压在它上面

官方资料：

- AWS Free Tier  
  https://aws.amazon.com/free/
- AWS CLI User Guide  
  https://docs.aws.amazon.com/cli/

判断：

- 可用，但不是你们当前最优

## 3.4 Fly.io

优点：

- 应用部署体验简单

缺点：

- 官方明确写了没有真正意义上的 free tier，而是 free trial
- 且没有软性费用上限提醒

官方资料：

- Cost Management on Fly.io  
  https://fly.io/docs/about/cost-management/

判断：

- 不适合作为你们当前默认选择

## 4. 我建议的现实方案

### 方案 A：当前最稳

- 开发环境：本地 Docker + openGauss
- 共享演示环境：暂不上云，先把接口和页面做完整

适用条件：

- 时间紧
- 重点是交作业
- 不想额外处理云端运维

### 方案 B：最均衡

- 开发环境：本地 Docker + openGauss
- 演示环境：单独上一个云主机
- 上云对象：
  - 后端
  - 前端
  - 数据库二选一：
    - 继续云主机自建 openGauss
    - 或把数据库仍留在本地 / 后续再迁

适用条件：

- 你们确实需要长期在线地址
- 组员需要稳定联调

### 方案 C：课程贴合优先

- 优先评估华为云 ECS
- 若有账号、券、学校资源，就走华为云

适用条件：

- 老师偏好更强
- 你们愿意多做一点部署运维

## 5. 当前建议

我建议你们现在不要立刻把主精力切到云部署，而是：

1. 先完成本地稳定闭环
2. 再确认组里是否真的需要长期在线地址
3. 再确认学校是否提供华为云资源
4. 若需要，再优先评估华为云 ECS 和 OCI Always Free

## 6. 当前最关键的未确认问题

到目前为止，仍未确认：

- 学校是否提供华为云账号额度
- 老师是否明确要求部署到云端
- AI 助手是否真的需要在线推理服务，还是本地演示即可

因此，现阶段最稳策略是：

> 不把上云当作前置阻塞项，而把它作为第二阶段决策项。
