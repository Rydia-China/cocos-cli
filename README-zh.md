# Lunaverse Build Runner

Lunaverse CI 打包链路使用的内部构建 runner。

这个包不是公开 SDK，也不是通用开发工具。`cocos` 二进制命令仅为兼容 Moonshort 现有构建脚本保留。

## CI 安装

```bash
npm install -g mobai-lv-build-runner@0.0.1-alpha.25
cocos --version
```

## 🛠️ 开发

### 开发模式

```bash
# 构建项目
npm run build

# 链接到全局
npm link

# 测试命令
cocos --help
```

### 故障排除

1. **命令找不到**

   ```bash
   npm list -g --depth=0
   npm unlink -g cocos-cli
   npm link
   ```

2. **编译错误**

   ```bash
   npm run build:clear
   npm run build
   ```

3. **调试模式**

   ```bash
   cocos --debug build --project ./my-project
   ```

## 🔧 开发工具

```bash
# 下载开发工具
npm run download-tools

# 更新仓库依赖
npm run update:repos
```

## 🧪 测试

### 单元测试

```bash
# 运行所有单元测试
npm test

# 监听模式运行测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 静默运行测试
npm run test:quiet
```

### E2E 测试

```bash
# 运行 E2E 测试
npm run test:e2e

# 调试模式运行 E2E 测试（保留测试项目）
npm run test:e2e:debug

# 检查 E2E 测试覆盖率
npm run check:e2e-coverage

# 生成 E2E 覆盖率 HTML 报告
npm run check:e2e-coverage:report
```

### 运行所有测试

```bash
# 运行所有测试（单元 + E2E）
npm run test:all
```

查看更多测试详情：

- [单元测试文档](tests/README.md)
- [E2E 测试文档](e2e/README.md)

## 📖 文档

- [快速开始指南](docs/zh/quick-start.md)
- [工具下载指南](docs/zh/download-tools.md)
- [Commands 文档](docs/zh/commands.md)
- [构建平台适配包开发指南](docs/zh/build-platform.md)

## 🤝 贡献代码

我们欢迎贡献！请查看我们的[贡献指南](CONTRIBUTING.md)开始参与。

该指南涵盖：

- 开发工作流和项目构建
- 运行和编写测试
- 代码风格和格式化
- 调试技巧
- 提交 Pull Request

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情。
