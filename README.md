# Groq HTML Generator

ユーザーの入力に基づいてHTMLページを動的に生成するNode.jsアプリケーションです。

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 環境変数の設定:
- `.env.example`を`.env`にコピー
- `GROQ_API_KEY`に実際のAPIキーを設定

3. 実行:
```bash
npm start
```

または、コマンドライン引数でユーザー入力を指定:
```bash
node index.js "男性、来週彼女が誕生日"
```

## 機能

- Groq APIを使用してHTMLページを生成
- カスタマイズ可能なベースHTMLテンプレート
- 生成されたHTMLファイルの自動保存
- ストリーミング出力

## 出力

生成されたHTMLファイルは `output/` ディレクトリに保存されます。