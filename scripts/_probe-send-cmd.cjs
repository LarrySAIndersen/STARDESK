const fs = require("fs");
const s = fs.readFileSync(
  "C:/Users/kjaer/AppData/Local/Programs/cursor/resources/app/out/vs/workbench/workbench.desktop.main.js",
  "utf8",
);
const idx = s.indexOf('title:cn(5086,"Send")');
console.log(s.slice(idx - 300, idx + 400));
