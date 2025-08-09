import { assertEnv, generateHTML, saveHTML } from './lib/generator.js';

try {
  assertEnv();
} catch (e) {
  console.error('エラー:', e.message);
  console.error('.envファイルに GROQ_API_KEY=your_api_key_here を追加してください。');
  process.exit(1);
}

async function generateAndOpen(userInput) {
  try {
    console.log(`HTML生成開始: ${userInput}`);
    const html = await generateHTML(userInput, { onToken: (t) => process.stdout.write(t) });
    const outputPath = saveHTML(html);
    console.log(`\n\n✅ HTMLファイルが保存されました: ${outputPath}`);
    console.log(`🌐 ブラウザで以下のファイルを開いてください:`);
    console.log(`   file://${outputPath}`);

    const { exec } = await import('child_process');
    exec(`open "${outputPath}"`, (error) => {
      if (!error) {
        console.log(`🚀 ブラウザで自動的に開きました！`);
      }
    });
    return html;
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

const userInput = process.argv.slice(2).join(' ') || 'デフォルトユーザー';
generateAndOpen(userInput);

