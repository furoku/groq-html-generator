import express from 'express';
import { generateHTML, saveHTML, assertEnv, warmup } from './lib/generator.js';

const app = express();
const port = process.env.PORT || 3000;

try {
  assertEnv();
} catch (e) {
  console.error('エラー:', e.message);
  console.error('.envファイルに GROQ_API_KEY=your_api_key_here を追加してください。');
  process.exit(1);
}

// 静的ファイルの提供
app.use('/output', express.static('docs/output'));
app.use('/templates', express.static('templates'));

// ヘルスチェック用エンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 診断: 登録済みルートの一覧を返す
function listRoutes(app) {
  const routes = [];
  if (!app || !app._router || !app._router.stack) return routes;
  app._router.stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      routes.push({ path: layer.route.path, methods });
    }
  });
  return routes;
}

app.get('/routes', (req, res) => {
  res.status(200).json({ routes: listRoutes(app) });
});

// ストリーミング配信ルート
app.get('/stream', async (req, res) => {
  const userInput = req.query.input || '一般的なユーザー';
  const shouldSave = req.query.save === 'true';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering if present
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  // Transfer-Encoding は Content-Length 未設定時に自動で chunked になる
  let html = '';
  try {
    // Immediately send a small pre-chunk to reduce perceived TTFB
    res.write('<!-- streaming -->\n');
    await generateHTML(userInput, {
      onToken: (t) => {
        html += t;
        res.write(t);
      }
    });
    if (shouldSave) {
      const outputPath = saveHTML(html, { userInput });
      console.log(`HTMLファイルが保存されました: ${outputPath}`);
    }
    res.end();
  } catch (error) {
    console.error('ストリーミング中にエラー:', error.message);
    res.write(`\n<!-- Error: ${String(error.message)} -->`);
    res.end();
  }
});

// メインルート - statusパラメータがある場合は直接生成
app.get('/', async (req, res) => {
  const status = req.query.status;
  
  // statusパラメータがある場合は直接HTML生成
  if (status) {
    try {
      console.log(`直接生成開始: ${status}`);
      const generatedHTML = await generateHTML(status);
      
      // オプションでファイルも保存（デフォルトはfalse）
      const saveFile = req.query.save === 'true';
      if (saveFile) {
        const outputPath = saveHTML(generatedHTML, { userInput: status });
        console.log(`HTMLファイルも保存されました: ${outputPath}`);
      }
      
      // 直接HTMLを表示
      res.send(generatedHTML);
      return;
    } catch (error) {
      console.error('生成エラー:', error.message);
      res.status(500).send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; padding: 40px; text-align: center; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h1 style="color: #e74c3c;">⚠️ エラーが発生しました</h1>
          <p style="color: #666; margin: 20px 0;">${error.message}</p>
          <a href="/" style="color: #3498db; text-decoration: none;">← ホームに戻る</a>
        </div>
      `);
      return;
    }
  }
  
  // statusパラメータがない場合は従来のフォーム画面
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Groq HTML Generator</title>
        <style>
            body { 
                font-family: 'Helvetica Neue', Arial, sans-serif; 
                max-width: 800px; 
                margin: 50px auto; 
                padding: 20px;
                background: #f5f5f5;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            h1 { 
                color: #333; 
                text-align: center;
                margin-bottom: 30px;
            }
            form { 
                margin-bottom: 30px; 
            }
            input[type="text"] { 
                width: 100%; 
                padding: 15px; 
                font-size: 16px; 
                border: 2px solid #ddd; 
                border-radius: 8px;
                margin-bottom: 15px;
                box-sizing: border-box;
            }
            button { 
                background: linear-gradient(135deg, #ff6b9d, #ffa726);
                color: white; 
                padding: 15px 30px; 
                font-size: 16px; 
                border: none; 
                border-radius: 8px; 
                cursor: pointer;
                width: 100%;
                font-weight: bold;
            }
            button:hover { 
                opacity: 0.9; 
            }
            .examples {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
            }
            .example {
                margin: 10px 0;
                padding: 10px;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                border: 1px solid #eee;
            }
            .example:hover {
                background: #ff6b9d11;
                border-color: #ff6b9d;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Groq HTML Generator</h1>
            <form action="/generate" method="get">
                <input 
                    type="text" 
                    name="input" 
                    placeholder="ユーザー情報を入力してください（例: 人間の姫を愛したゴブリン、彼女に化粧品を送りたい）"
                    required
                >
                <button type="submit">HTMLページを生成</button>
                <div style="display:flex; gap:12px; align-items:center; margin-top:10px;">
                  <button type="button" id="streamBtn" style="flex:1; background:#6a78d1;">ストリーミングで生成</button>
                  <label style="display:flex; align-items:center; gap:6px; color:#555;">
                    <input type="checkbox" id="streamSave"> 保存
                  </label>
                </div>
            </form>
            
            <div class="examples">
                <h3>💡 フォームで生成:</h3>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    人間の姫を愛したゴブリン、彼女に化粧品を送りたい
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    4歳の子ども、大好きなお母さんにプレゼントを送りたい
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    時間から逃れてきたタイムトラベラー、現代の美容に興味津々
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    宇宙人、地球の化粧品文化を研究中、友好的な接触を希望
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    魔法使いの弟子、師匠への謝罪の贈り物を探している
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    AIロボット、人間らしさを学ぶため美容に関心を持つ
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    猫カフェの猫店長、お客様への感謝を表したい
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    夢の中の住人、現実世界の美しさに憧れる
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    200歳のバンパイア、現代のトレンドに追いつきたい
                </div>
                <div class="example" onclick="document.querySelector('input[name=input]').value = this.textContent">
                    異世界から来た王子様、地球の化粧品を故郷に持ち帰りたい
                </div>
                
                <h3 style="margin-top: 30px;">📄 ベースページ:</h3>
                <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px; border: 1px solid #007bff;">
                    <a href="/templates/base.html" target="_blank" style="color: #007bff; text-decoration: none; font-weight: bold;">
                        http://localhost:3000/templates/base.html
                    </a>
                    <br><small style="color: #666;">カスタマイズ前のベースHTMLページ</small>
                </div>

                <h3 style="margin-top: 30px;">🔗 ストリーミングで直接アクセス:</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=人間の姫を愛したゴブリン、彼女に化粧品を送りたい" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=人間の姫を愛したゴブリン、彼女に化粧品を送りたい
                    </a>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=4歳の子ども、大好きなお母さんにプレゼントを送りたい" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=4歳の子ども、大好きなお母さんにプレゼントを送りたい
                    </a>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=時間から逃れてきたタイムトラベラー、現代の美容に興味津々" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=時間から逃れてきたタイムトラベラー、現代の美容に興味津々
                    </a>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=宇宙人、地球の化粧品文化を研究中、友好的な接触を希望" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=宇宙人、地球の化粧品文化を研究中、友好的な接触を希望
                    </a>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=魔法使いの弟子、師匠への謝罪の贈り物を探している" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=魔法使いの弟子、師匠への謝罪の贈り物を探している
                    </a>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=AIロボット、人間らしさを学ぶため美容に関心を持つ&save=true" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=AIロボット、人間らしさを学ぶため美容に関心を持つ&save=true
                    </a>
                    <br><small style="color: #666;">&save=true でファイルも保存</small>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
                    <a href="/stream?input=200歳のバンパイア、現代のトレンドに追いつきたい" target="_blank" style="color: #007bff; text-decoration: none;">
                        /stream?input=200歳のバンパイア、現代のトレンドに追いつきたい
                    </a>
                </div>
            </div>
        </div>
        <script>
          (function(){
            const btn = document.getElementById('streamBtn');
            if (!btn) return;
            btn.addEventListener('click', function(){
              const inputEl = document.querySelector('input[name="input"]');
              const saveEl = document.getElementById('streamSave');
              const val = (inputEl && inputEl.value || '').trim();
              if (!val) return;
              const save = (saveEl && saveEl.checked) ? '&save=true' : '';
              location.href = '/stream?input=' + encodeURIComponent(val) + save;
            });
          })();
        </script>
    </body>
    </html>
  `);
});

// HTML生成ルート
app.get('/generate', async (req, res) => {
  const userInput = req.query.input || '一般的なユーザー';
  
  try {
    console.log(`HTML生成開始: ${userInput}`);
    
    // ローディング画面を表示
    res.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>生成中...</title>
          <style>
              body { 
                  font-family: 'Helvetica Neue', Arial, sans-serif; 
                  display: flex; 
                  justify-content: center; 
                  align-items: center; 
                  height: 100vh; 
                  margin: 0;
                  background: #f5f5f5;
              }
              .loading { 
                  text-align: center; 
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              }
              .spinner { 
                  border: 4px solid #f3f3f3; 
                  border-top: 4px solid #ff6b9d; 
                  border-radius: 50%; 
                  width: 50px; 
                  height: 50px; 
                  animation: spin 1s linear infinite; 
                  margin: 0 auto 20px;
              }
              @keyframes spin { 
                  0% { transform: rotate(0deg); } 
                  100% { transform: rotate(360deg); } 
              }
              h2 { color: #333; margin: 0; }
              p { color: #666; margin: 10px 0 0 0; }
          </style>
      </head>
      <body>
          <div class="loading">
              <div class="spinner"></div>
              <h2>HTMLページを生成中...</h2>
              <p>入力: ${userInput}</p>
              <p>しばらくお待ちください...</p>
          </div>
          <script>
              setTimeout(() => {
                  window.location.href = '/result?input=${encodeURIComponent(userInput)}';
              }, 3000);
          </script>
      </body>
      </html>
    `);
    res.end();
    
  } catch (error) {
    res.status(500).send(`
      <h1>エラーが発生しました</h1>
      <p>${error.message}</p>
      <a href="/">戻る</a>
    `);
  }
});

// 結果表示ルート
app.get('/result', async (req, res) => {
  const userInput = req.query.input || '一般的なユーザー';
  
  try {
    const generatedHTML = await generateHTML(userInput);
    const outputPath = saveHTML(generatedHTML, { userInput });
    console.log(`HTMLファイルが保存されました: ${outputPath}`);
    
    // 生成されたHTMLを直接表示
    res.send(generatedHTML);
    
  } catch (error) {
    res.status(500).send(`
      <h1>エラーが発生しました</h1>
      <p>${error.message}</p>
      <a href="/">戻る</a>
    `);
  }
});

// サーバーを起動する関数
function startServer(portToTry) {
  const server = app.listen(portToTry, '0.0.0.0', () => {
    const address = server.address();
    console.log(`🚀 Groq HTML Generator が起動しました!`);
    console.log(`📱 ブラウザで http://localhost:${address.port} にアクセスしてください`);
    console.log(`📱 または http://127.0.0.1:${address.port} でもアクセス可能です`);
    console.log('');
    console.log('💡 使用方法:');
    console.log('   1. ブラウザでフォームにユーザー情報を入力');
    console.log('   2. 「HTMLページを生成」ボタンをクリック');
    console.log('   3. 生成されたページがブラウザに表示されます');
    console.log('');
    console.log('⌨️  CLI版を使用する場合: npm run cli "ユーザー情報"');
    // Best-effort warmup to cut first-request latency
    setTimeout(() => {
      warmup().then((ok) => ok && console.log('🔥 Groq モデルをウォームアップしました')).catch(() => {});
    }, 10);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ ポート ${portToTry} は既に使用中です。`);
      server.close(() => {
        startServer(portToTry + 1); // 別のポートで再試行
      });
    } else {
      console.error('サーバー起動エラー:', err);
    }
  });
}

// Optional manual warmup endpoint
app.get('/warm', async (_req, res) => {
  const ok = await warmup();
  res.status(ok ? 200 : 500).json({ ok });
});

// サーバー開始
startServer(port);
