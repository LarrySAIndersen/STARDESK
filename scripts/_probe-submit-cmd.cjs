const fs = require("fs");
const s = fs.readFileSync(
  "C:/Users/kjaer/AppData/Local/Programs/cursor/resources/app/out/vs/workbench/workbench.desktop.main.js",
  "utf8",
);
const needle = "submitChatMaybeAbortCurrent";
let idx = 0;
let n = 0;
while ((idx = s.indexOf(needle, idx + 1)) >= 0 && n < 25) {
  const ctx = s.slice(idx - 200, idx + 100);
  if (
    ctx.includes("executeCommand") ||
    ctx.includes("registerCommand") ||
    ctx.includes(".ID=") ||
    ctx.includes("title:")
  ) {
    console.log("---", n, idx);
    console.log(ctx);
    n++;
  }
}
