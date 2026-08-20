# 拾光后期

一个面向普通摄影爱好者的 AI 图片后期网页。用户上传照片、选择视觉场景并补充文字或修改要求，服务端会先运行对应的视觉工作流分析照片，再调用火山方舟 Seedream 完成图片编辑。

线上体验：[拾光后期](https://sk9rtqqg06hvqm0nm4sl7.apigateway-cn-beijing.volceapi.com/)

## 体验邀请码

打开线上网页后，可复制以下邀请码使用。邀请码可以重复使用，请勿滥用共享体验额度。

```text
98D30A0F
```

## 功能

- 10 种可手动选择的图片处理场景
- 原图与固定风格案例对照预览
- 支持横版、竖版、方形与原图比例
- 支持海报文字与固定文字位置
- 支持基于上一版结果继续修改
- 默认 Seedream 4.5，失败时依次切换 4.0 和 5.0 Lite
- 可配置多个可重复使用的邀请码，校验通过后才会调用付费模型

## 本地运行

需要 Node.js 22.13 或更高版本，以及已开通对应模型的火山方舟 API Key。

```bash
npm install
cp .env.example .env.local
npm run dev
```

在 `.env.local` 中填写：

```dotenv
ARK_API_KEY=你的方舟APIKey
ARK_SKILL_MODEL=doubao-seed-2-0-lite-260428
ARK_IMAGE_MODELS=doubao-seedream-4-5-251128,doubao-seedream-4-0-250828,doubao-seedream-5-0-lite-260128
GENERATION_ACCESS_CODES=邀请码一,邀请码二
```

`.env.local` 已被 Git 忽略，请勿把真实 API Key 或非公开邀请码提交到仓库。上方邀请码是项目维护者主动公开的共享体验码。

## 验证与构建

```bash
npm run lint
npm test
npm run build:vefaas
```

## veFaaS 部署

项目包含针对火山引擎 veFaaS 的构建和 Node.js 启动适配：

- 构建命令：`npm run build:vefaas`
- 输出目录：`dist`
- 云端启动命令：`node --no-warnings --experimental-loader ./vefaas-cloudflare-loader.mjs ./vefaas-server.mjs`
- 服务端口：`3000`

方舟 API Key、模型配置和服务端邀请码列表应通过 veFaaS 环境变量设置；除主动公开的共享体验码外，不应把私密配置写入仓库。

## Skill 实现与第三方内容

项目同时包含开源工作流适配和独立功能实现。第三方示例图片及其许可证信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本项目不提供第三方仓库中许可证未明确允许复制的私有提示词或素材。
