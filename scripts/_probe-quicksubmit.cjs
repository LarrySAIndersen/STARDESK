const fs = require("fs");
const s = fs.readFileSync(
  "C:/Users/kjaer/AppData/Local/Programs/cursor/resources/app/out/vs/workbench/workbench.desktop.main.js",
  "utf8",
);
const k = "composer.quickAgentSubmit";
let idx = 0;
let n = 0;
while ((idx = s.indexOf(k, idx + 1)) >= 0 && n < 10) {
  console.log("---", n, idx);
  console.log(s.slice(idx - 100, idx + 800));
  n++;
}
