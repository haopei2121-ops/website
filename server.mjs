import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = process.env.PORT || 8765;

function rate(text, labels) {
  for (const label of labels) {
    const match = new RegExp(label + '[^\\d%]{0,120}(\\d+(?:\\.\\d+)?\\s*%)', 'i').exec(text);
    if (match) return match[1].replace(/\s/g, '');
  }
  return '—';
}

async function getFund(code) {
  const response = await fetch(`https://fundf10.eastmoney.com/jjfl_${code}.html`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FundFeeLens/1.0)' }
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  const html = await response.text();
  if (!html || /页面不存在|基金代码错误|访问受限/i.test(html)) throw new Error('fund not found');
  const title = (/<title>\s*([^<|：:]+?)(?:基金费率|基金档案|_)?\s*[|_]/i.exec(html)?.[1]
    || /<h1[^>]*>\s*([^<]+)/i.exec(html)?.[1] || `基金 ${code}`).trim();
  return {
    code,
    name: title,
    buy: rate(html, ['申购费率', '申购费用']),
    redeem: rate(html, ['赎回费率']),
    service: rate(html, ['销售服务费率', '销售服务费']),
    source: '天天基金公开数据'
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url.pathname === '/api/fund') {
    const code = (url.searchParams.get('code') || '').replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false, error: 'invalid code' })); }
    try { const fund = await getFund(code); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ ok: true, fund })); }
    catch (error) { res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ ok: false, error: '天天基金暂时无法访问' })); }
    return;
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  try { const body = await readFile(join(root, file)); const type = extname(file) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream'; res.writeHead(200, { 'Content-Type': type }); res.end(body); }
  catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, () => console.log(`Fund Fee Lens running at http://localhost:${port}`));
