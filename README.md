# Claude ChatGPT MCP Tool

This is a Model Context Protocol (MCP) tool that allows Claude to interact with the ChatGPT desktop app on macOS.

## Features

- Ask ChatGPT questions directly from Claude
- View ChatGPT conversation history
- Continue existing ChatGPT conversations

## Installation

### Prerequisites

- macOS with M1/M2/M3 chip
- [ChatGPT desktop app](https://chatgpt.com/download) installed
- [Bun](https://bun.sh/) installed
- [Claude desktop app](https://claude.ai/desktop) installed

### Installation Steps

1. Clone this repository:

```bash
git clone https://github.com/syedazharmbnr1/claude-chatgpt-mcp.git
cd claude-chatgpt-mcp
```

2. Install dependencies:

```bash
bun install
```

3. Make sure the script is executable:

```bash
chmod +x index.ts
```

4. Update your Claude Desktop configuration:

Edit your `claude_desktop_config.json` file (located at `~/Library/Application Support/Claude/claude_desktop_config.json`) to include this tool:

```json
"chatgpt-mcp": {
  "command": "/Users/YOURUSERNAME/.bun/bin/bun",
  "args": ["run", "/path/to/claude-chatgpt-mcp/index.ts"]
}
```

Make sure to replace `YOURUSERNAME` with your actual macOS username and adjust the path to where you cloned this repository.

5. Restart Claude Desktop app

6. Grant permissions:
   - Go to System Preferences > Privacy & Security > Privacy
   - Give Terminal (or iTerm) access to Accessibility features
   - You may see permission prompts when the tool is first used

## Usage

Once installed, you can use the ChatGPT tool directly from Claude by asking questions like:

- "Can you ask ChatGPT what the capital of France is?"
- "Show me my recent ChatGPT conversations"
- "Ask ChatGPT to explain quantum computing"

## Troubleshooting

If the tool isn't working properly:

1. Make sure ChatGPT app is installed and you're logged in
2. Verify the path to bun in your claude_desktop_config.json is correct
3. Check that you've granted all necessary permissions
4. Try restarting both Claude and ChatGPT apps

## セキュリティに関する注意点

### ⚠️ アクセシビリティ権限

このツールは、macOSのAppleScriptとSystem Eventsを使用してChatGPTデスクトップアプリを制御します。これには、macOSのアクセシビリティ権限が必要です。この権限を許可すると、スクリプトはシステム上の他のアプリケーションも制御する能力を持つため、信頼できる環境でのみ使用してください。

### セキュリティのベストプラクティス

1. **使用範囲の制限**: このツールは信頼できる環境、できれば専用のマシンでのみ使用してください。
2. **入力の検証**: 外部ソースからの入力をMCP経由でツールに直接渡さないでください。
3. **権限の制限**: このツールを実行するユーザーアカウントには最小限の権限のみを与えてください。
4. **監視**: ツールの使用状況を監視し、異常な動作がないか確認してください。

### 技術的な詳細

このツールは、入力を安全に処理するために複数のセキュリティ対策を実装していますが、AppleScriptとUI自動化の性質上、固有のリスクが存在します。特にプロンプトや会話IDには信頼できないデータを直接渡さないでください。

## License

MIT
