#!/usr/bin/env node
/* =========================================================
   build.mjs — content/*.md を HTML に変換して index.html に埋め込む
   ---------------------------------------------------------
   各 .md を marked（Markdown → HTML）と KaTeX（数式 → HTML）で
   ビルド時に変換し、index.html 内の
     <article data-md="SECTION"><!-- md:SECTION --> … <!-- /md:SECTION --></article>
   の間へ差し込みます。これにより、配信される index.html 自体に
   本文が HTML として載ります（クローラー・OGP 対策）。
   パネルの表示は従来どおり assets/app.js が行います。

   ローカル実行:  npm install && node scripts/build.mjs
   ========================================================= */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";
import katex from "katex";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "index.html");
const contentDir = join(root, "content");

// 旧クライアント側レンダリングと同じ設定（GFM 表・改行・生 HTML 通過）
marked.setOptions({ gfm: true, breaks: true });

/* ---------- Markdown + LaTeX → HTML ---------- */
function render(raw) {
  // 数式を Markdown 処理から退避（\ や _ を壊さないため）
  const math = [];
  const stash = (tex, display) =>
    "\x00MATH" + (math.push({ tex, display }) - 1) + "\x00";

  const protectedRaw = raw
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => stash(t, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => stash(t, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => stash(t, false))
    .replace(/(?<!\\)\$(?!\s)((?:\\.|[^$\\])+?)(?<!\s)\$/g, (_, t) => stash(t, false));

  let html = marked.parse(protectedRaw);

  html = html.replace(/\x00MATH(\d+)\x00/g, (_, i) => {
    const { tex, display } = math[+i];
    return katex.renderToString(tex.trim(), {
      displayMode: display,
      throwOnError: false,
      strict: false,
    });
  });

  // 非表示の格納領域で画像・iframe が先読みされないようにする
  html = html
    .replace(/<img(?![^>]*\sloading=)/gi, '<img loading="lazy"')
    .replace(/<iframe([^>]*?)\ssrc=/gi, "<iframe$1 data-src=");

  // 外部リンク（http/https）は新しいタブで開く
  html = html.replace(/<a\s([^>]*?)>/gi, (tag, attrs) =>
    /\bhref="https?:\/\//i.test(attrs) && !/\btarget=/i.test(attrs)
      ? `<a ${attrs} target="_blank" rel="noopener noreferrer">`
      : tag
  );

  return html;
}

/* ---------- index.html へ埋め込み ---------- */
let html = await readFile(htmlPath, "utf8");
const files = (await readdir(contentDir)).filter((f) => f.endsWith(".md"));

let injected = 0;
for (const file of files) {
  const section = file.replace(/\.md$/, "");
  const body = render((await readFile(join(contentDir, file), "utf8")).trim());
  const re = new RegExp(
    `(<!-- md:${section} -->)[\\s\\S]*?(<!-- /md:${section} -->)`
  );
  if (!re.test(html)) {
    console.warn(`! ブロックが見つかりません: <!-- md:${section} -->`);
    continue;
  }
  // 置換文字列中の $ が特殊解釈されないよう関数で置換
  html = html.replace(re, (_, open, close) => `${open}\n${body}\n${close}`);
  injected++;
  console.log(`✓ ${file} → data-md="${section}"`);
}

await writeFile(htmlPath, html, "utf8");
console.log(`\n${injected} セクションを index.html に埋め込みました。`);
