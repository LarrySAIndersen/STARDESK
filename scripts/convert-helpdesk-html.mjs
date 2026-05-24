import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const compDir = path.join(root, "STARDESK/apps/web/src/components/helpdesk-login");

const html = fs.readFileSync(path.join(root, "star_helpdesk_landing.html"), "utf8");
const bodyMatch = html.match(/<body>([\s\S]*?)<script>/);
if (!bodyMatch) throw new Error("body not found");

let body = bodyMatch[1];

body = body.replace(
  /<a href="#main-content" class="skip-link">[\s\S]*?<\/a>\s*/,
  "",
);
body = body.replace(/onclick="toggleTheme\(\)"/g, 'data-hd-action="toggle-theme"');
body = body.replace(
  /onclick="[^"]*showView\('([^']+)'\)[^"]*"/g,
  'data-hd-view="$1"',
);
body = body.replace(/onclick="alert\([^"]*\)"/g, 'data-hd-action="noop"');
body = body.replace(
  /onclick="[^"]*sendBotMessage[^"]*"/g,
  'data-hd-action="noop"',
);
body = body.replace(/onclick="[^"]*runSearch[^"]*"/g, 'data-hd-action="noop"');
body = body.replace(/onclick="[^"]*filterTickets[^"]*"/g, 'data-hd-action="noop"');
body = body.replace(/onclick="[^"]*submitTicketPage[^"]*"/g, 'data-hd-action="noop"');
body = body.replace(/\sonkeydown="[^"]*"/g, "");

fs.writeFileSync(path.join(compDir, "helpdesk-login-static.html"), body.trim());

const escaped = JSON.stringify(body.trim());
fs.writeFileSync(
  path.join(compDir, "helpdesk-login-static.ts"),
  `export const HELPDESK_LOGIN_HTML = ${escaped} as const;\n`,
);

console.log("Regenerated static HTML + TS");
