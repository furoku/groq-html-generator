import { assertEnv, generateHTML, saveHTML } from './lib/generator.js';

try {
  assertEnv();
} catch (e) {
  console.error('エラー:', e.message);
  console.error('.envファイルに GROQ_API_KEY=your_api_key_here を追加してください。');
  process.exit(1);
}

// ここからCLI本体

// コマンドライン引数からユーザー入力を取得
const userInput = process.argv.slice(2).join(' ') || '男性、来週彼女が誕生日';

console.log('ユーザー入力:', userInput);
console.log('HTMLを生成中...');
console.log('='.repeat(50));

generateHTML(userInput, { onToken: (t) => process.stdout.write(t) })
  .then((html) => {
    const outputPath = saveHTML(html, { userInput });
    console.log(`\n\nHTMLファイルが保存されました: ${outputPath}`);
  })
  .catch((error) => {
    console.error('エラーが発生しました:', error.message);
    if (error.status === 401) {
      console.error('認証エラー: APIキーが無効です。.envファイルを確認してください。');
    }
    process.exit(1);
  });
