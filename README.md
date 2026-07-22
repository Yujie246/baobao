# 宝宝饱饱

一个移动端优先的本地 Web 产品：粘贴宝宝辅食视频链接，根据宝宝档案查看适配结论，并进入持续对话式厨房陪做流程。

当前版本使用完整 Mock 数据演示“10 月龄满满 + 宝宝虾滑面”故事，不调用真实 AI。AI 接口统一收口在 `app/ai-gateway.ts`，后续可通过新增 `RemoteAiGateway` 接入真实服务。

## 本地运行

环境要求：Node.js `>= 22.13.0`。

```bash
npm install --cache ./.npm-cache
npm run dev
```

浏览器打开终端显示的本地地址，通常为：

```text
http://localhost:3000
```

- 手机浏览器：全屏移动端界面；
- 桌面浏览器：按手机比例展示完整机身边框、状态栏与固定底部导航，右侧提供仅开发环境使用的场景切换器；
- 首次打开：从三步宝宝档案开始；
- 想直接查看完整故事：进入设置，选择“恢复完整演示数据”。

## 验证

```bash
npm test
```

该命令依次完成：

1. TypeScript 类型检查；
2. ESLint 静态检查；
3. Mock Gateway 与核心数据单元测试；
4. 生产构建；
5. 生产 Worker 首页、深层路由与完整页面覆盖测试。

## Mock 与真实 AI 边界

- `app/mock-data.ts`：唯一业务 Fixture 来源，文件顶部有 `MOCK DATA ONLY` 标记；
- `app/ai-gateway.ts`：`AiGateway` 契约与 `MockAiGateway` 实现；
- 页面组件不直接拼接 Prompt，也不调用模型；
- `app/local-db.ts`：使用 IndexedDB 保存宝宝档案、完整陪做会话、计时、份量调整和反馈；
- Mock 边界只在代码、数据 fixture 和技术文档中标记，产品界面不显示演示按钮或提示。

## 产品与界面规格

- [产品定义.md](./产品定义.md)
- [界面文案与结构.md](./界面文案与结构.md)
- [设计DNA.json](./设计DNA.json)
