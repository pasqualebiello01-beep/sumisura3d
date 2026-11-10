// Copia style.css (minimizzato) dentro index.html, così la home non aspetta un file CSS separato.
// Uso: node tools/inline-css.mjs   (va rilanciato ogni volta che modifichi assets/css/style.css)
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const css = readFileSync(root + "assets/css/style.css", "utf8");

let min;
try {
  min = execFileSync("esbuild", ["--loader=css", "--minify"], { input: css, encoding: "utf8" });
} catch {
  // senza esbuild: minimizzazione semplice
  min = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,>])\s*/g, "$1").replace(/;}/g, "}").trim();
}

const file = root + "index.html";
let html = readFileSync(file, "utf8");
const block = `<style id="css-in-pagina">${min.trim()}</style>`;
if (html.includes('<style id="css-in-pagina">')) {
  html = html.replace(/<style id="css-in-pagina">[\s\S]*?<\/style>/, () => block);
} else if (html.includes('<link rel="stylesheet" href="assets/css/style.css">')) {
  html = html.replace('<link rel="stylesheet" href="assets/css/style.css">', () => block);
} else {
  throw new Error("Non trovo dove inserire il CSS in index.html");
}
writeFileSync(file, html);
console.log(`CSS inserito in index.html (${min.length} caratteri)`);
