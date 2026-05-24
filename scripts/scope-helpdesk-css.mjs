import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(
  __dirname,
  "../apps/web/src/components/helpdesk-login/helpdesk-login.css",
);

let css = fs.readFileSync(cssPath, "utf8");

// Prefix bare element/type selectors at rule start with .hd-login
css = css.replace(
  /^(\s*)(header|footer|nav|main|html|\*|h1)(\s*[,{])/gm,
  "$1.hd-login $2$3",
);

// Avoid double prefix
css = css.replace(/\.hd-login \.hd-login/g, ".hd-login");

fs.writeFileSync(cssPath, css);
console.log("Scoped CSS");
