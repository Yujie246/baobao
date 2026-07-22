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

## 宝宝音色

语音使用腾讯云 TTS 的超自然聊天童声 `502007 智小虎`。浏览器只访问站内 `POST /api/tts`，腾讯云密钥由服务端读取，不会打包进前端；未配置或请求失败时自动使用设备中文语音，页面流程不会中断。

本地调试时复制 `.env.example` 为 `.env.local`，填写腾讯云访问密钥：

```bash
TENCENTCLOUD_SECRET_ID=你的SecretId
TENCENTCLOUD_SECRET_KEY=你的SecretKey
```

部署到 Vercel 时，在项目的 `Settings > Environment Variables` 中添加同名的两个变量，然后重新部署。无需 GPU、Python、Docker 或常驻语音服务器。正式使用前需要在腾讯云语音合成控制台开通服务并领取对应资源包。

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
