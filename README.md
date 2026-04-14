# Morphing

AI-native 叙事协作与演化平台原型：元素（Element）为核心，串联关系图、故事组合、脚本/分镜、依赖与版本、以及 AI/视觉占位接口。

## 环境要求

- Python 3.11+（推荐 3.12）
- Node.js 20+ 与 npm
- （可选）Docker，用于本地 PostgreSQL

## 安装与启动

### 后端（FastAPI）

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

默认使用 SQLite：`sqlite:///./morphing.db`（在项目当前工作目录生成 `morphing.db`）。若使用 PostgreSQL，可设置环境变量后启动：

```bash
export DATABASE_URL="postgresql+psycopg2://USER:PASS@localhost:5432/morphing"
uvicorn morphing.main:app --reload --host 127.0.0.1 --port 8000
```

未安装 `psycopg2` 时请先 `pip install psycopg2-binary` 并保证数据库已创建。

启动后：

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：`GET /health`

### 前端（Vite + React）

```bash
cd frontend
npm install
npm run dev
```

开发服务器默认代理 `/api` 到 `http://127.0.0.1:8000`，请先启动后端再打开前端页面。

**Elements 页面布局**：顶部为工具条（按类型快速新建）；左侧为 **完整导航树**（顶层为「全部」与各 **类型** 根结点，展开后为该类型范围内的 Tag 子树）；右侧为主视图。Tag 树规则见 [`docs/tag-tree.md`](docs/tag-tree.md)。

生产构建：

```bash
cd frontend
npm run build
npm run preview   # 可选，本地预览 dist
```

### 可选：本地 PostgreSQL（Docker）

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

将 `DATABASE_URL` 指向该实例后再启动 `uvicorn`。

### 测试（后端）

```bash
cd backend
. .venv/bin/activate
pytest
```

## 占位与待接入能力

以下能力已在接口或元数据中**预留位置**，当前为占位或启发式实现，接入生产服务时需替换实现：

| 领域 | 说明 |
|------|------|
| 大语言模型 | 叙事改写、扩写、Morph 预览正文等为占位；可接 OpenAI / 本地 LLM。 |
| 图像生成 | 视觉层 `metadata.media`、批处理 prompt 为占位；可接 MJ / SD / 厂商 API。 |
| 视频生成 | 同上，未接 Runway / Sora 等真实管线。 |
| 身份认证 | `author` / `voter_id` 等为字符串，未接 OAuth / JWT。 |
| 邮件 / 通知 | 未实现。 |

