import 'groq-sdk/shims/node';
import { Groq } from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export function assertEnv() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY 環境変数が設定されていません。.env を確認してください。');
  }
}

// Cache heavy, constant bits to reduce per-request overhead
let cachedBaseHTML = null;
let cachedSystemPrompt = null;

function loadBaseHTML() {
  if (cachedBaseHTML) return cachedBaseHTML;
  const templatePath = path.join(process.cwd(), 'templates', 'base.html');
  cachedBaseHTML = fs.readFileSync(templatePath, 'utf-8');
  return cachedBaseHTML;
}

function buildSystemPrompt(baseHTML) {
  // Build once; base.html rarely changes during a single server run
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = `ベースHTMLを入力ユーザーのリテラシーに最適化したデザイン・レイアウト・配置・サイズ・コピー文章を自由に変更して完全なHTMLを出力してください。商品名とカート機能は保持。\n\n--- BASE_HTML_START ---\n${baseHTML}\n--- BASE_HTML_END ---`;
  return cachedSystemPrompt;
}

// Reuse a single client (connection pooling/keep-alive)
let groqClient = null;
function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export async function generateHTML(
  userInput,
  {
    onToken,
    model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    temperature = process.env.GROQ_TEMPERATURE ? parseFloat(process.env.GROQ_TEMPERATURE) : 1,
    top_p = process.env.GROQ_TOP_P ? parseFloat(process.env.GROQ_TOP_P) : 1,
    hedgeDelayMs = process.env.GROQ_HEDGE_MS ? parseInt(process.env.GROQ_HEDGE_MS, 10) : 0,
    hedgeModel = process.env.GROQ_HEDGE_MODEL || model,
  } = {}
) {
  assertEnv();

  const baseHTML = loadBaseHTML();

  // Mock mode: stream template as-is for offline testing
  if (process.env.GROQ_MOCK === '1') {
    let html = '';
    const header = `<!-- MOCK STREAM: persona=${userInput} -->\n`;
    const full = header + baseHTML;
    const step = 256;
    for (let i = 0; i < full.length; i += step) {
      const chunk = full.slice(i, i + step);
      if (onToken) onToken(chunk);
      html += chunk;
      // small delay to emulate streaming
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 5));
    }
    return html;
  }

  const groq = getGroqClient();

  async function streamOnce({ useModel, controller, onFirstToken }) {
    const chat = await groq.chat.completions.create(
      {
        messages: [
          { role: 'system', content: buildSystemPrompt(baseHTML) },
          { role: 'user', content: userInput },
        ],
        model: useModel,
        temperature,
        top_p,
        stream: true,
      },
      { signal: controller.signal }
    );
    let produced = 0;
    let htmlPart = '';
    try {
      for await (const chunk of chat) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        if (!content) continue;
        produced += content.length;
        if (produced > 0 && onFirstToken) {
          onFirstToken();
          onFirstToken = null; // fire once
        }
        if (onToken) onToken(content);
        htmlPart += content;
      }
    } catch (e) {
      // If aborted, swallow
      if (e?.name !== 'AbortError') throw e;
    }
    return htmlPart;
  }

  if (hedgeDelayMs > 0) {
    // Hedged requests: start primary, if no first token within delay, start backup.
    const primaryCtrl = new AbortController();
    const backupCtrl = new AbortController();
    let winner = null; // 'primary' | 'backup'
    let fullHTML = '';

    const primaryPromise = streamOnce({
      useModel: model,
      controller: primaryCtrl,
      onFirstToken: () => {
        if (!winner) {
          winner = 'primary';
          // Abort backup if it started
          backupCtrl.abort();
        }
      },
    }).then((part) => {
      if (winner === 'primary') fullHTML += part;
    });

    let backupStarted = false;
    let backupPromise = null;
    const maybeStartBackup = async () => {
      if (winner || backupStarted) return;
      backupStarted = true;
      await streamOnce({
        useModel: hedgeModel,
        controller: backupCtrl,
        onFirstToken: () => {
          if (!winner) {
            winner = 'backup';
            // Abort primary
            primaryCtrl.abort();
          }
        },
      }).then((part) => {
        if (winner === 'backup') fullHTML += part;
      });
    };

    // Start backup after delay if no winner yet
    const timer = setTimeout(() => { backupPromise = maybeStartBackup(); }, hedgeDelayMs);

    await Promise.race([
      (async () => {
        await primaryPromise;
        if (!winner) winner = 'primary';
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, hedgeDelayMs + 10)); // give backup a chance to start
      })(),
    ]);

    // Wait for both streams to settle (one may be aborted)
    clearTimeout(timer);
    await Promise.allSettled([primaryPromise, backupPromise ?? Promise.resolve()]);
    return fullHTML;
  }

  // Single-stream (default)
  let html = '';
  await streamOnce({
    useModel: model,
    controller: new AbortController(),
    onFirstToken: null,
  }).then((part) => { html += part; });
  return html;
}

export function saveHTML(html, { outputDir = path.join(process.cwd(), 'output'), prefix = 'generated-page' } = {}) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}-${timestamp}.html`;
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, html);
  return outputPath;
}

// Lightweight warmup to reduce cold-start TTFB
export async function warmup({
  model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
} = {}) {
  try {
    assertEnv();
    const groq = getGroqClient();
    await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'ok' },
      ],
      model,
      max_tokens: 1,
      temperature: 0,
      stream: false,
    });
    return true;
  } catch (e) {
    // warmup is best-effort; log and continue
    console.warn('Groq warmup skipped:', e?.message || e);
    return false;
  }
}
