#!/usr/bin/env node
/* =========================================================
   build.mjs — content/*.md を index.html に埋め込む
   ---------------------------------------------------------
   各 .md の中身を、index.html 内の
     <script type="text/markdown" data-md="SECTION"> ... </script>
   ブロックへ差し込みます。Markdown のレンダリングは
   ブラウザ側（marked.js）で行うため、ここでは生の Markdown を
   そのまま埋め込みます。

   ローカル実行:  node scripts/build.mjs
   ========================================================= */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "index.html");
const contentDir = join(root, "content");

const escapeForScript = (s) =>
  // </script> がソースに現れても壊れないよう保険
  s.replace(/<\/script>/gi, "<\\/script>");

let html = await readFile(htmlPath, "utf8");
const files = (await readdir(contentDir)).filter((f) => f.endsWith(".md"));

let injected = 0;
for (const file of files) {
  const section = file.replace(/\.md$/, "");
  const md = escapeForScript((await readFile(join(contentDir, file), "utf8")).trim());
  const re = new RegExp(
    `(<script type="text/markdown" data-md="${section}">)[\\s\\S]*?(</script>)`
  );
  if (!re.test(html)) {
    console.warn(`! ブロックが見つかりません: data-md="${section}"`);
    continue;
  }
  html = html.replace(re, `$1\n${md}\n$2`);
  injected++;
  console.log(`✓ ${file} → data-md="${section}"`);
}

await writeFile(htmlPath, html, "utf8");
console.log(`\n${injected} セクションを index.html に埋め込みました。`);
