#!/usr/bin/env node
/**
 * Sonar S6759: wrap `type FooProps = { ... }` with Readonly<>.
 * Safe-only — does not touch inline param types or JSX.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../apps/web/src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function balanceBraces(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function wrapTypeAliasProps(content) {
  let out = "";
  let i = 0;
  const re = /^type\s+(\w+)\s*=\s*\{/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const start = m.index;
    out += content.slice(i, start);
    const braceOpen = content.indexOf("{", m.index);
    const header = content.slice(start, braceOpen);
    if (header.includes("Readonly<")) {
      out += content.slice(start, braceOpen + 1);
      i = braceOpen + 1;
      re.lastIndex = i;
      continue;
    }
    out += `type ${m[1]} = Readonly<{`;
    i = braceOpen + 1;
    const close = balanceBraces(content, braceOpen);
    if (close === -1) {
      out += content.slice(i);
      return out;
    }
    out += content.slice(i, close + 1);
    out += ">";
    i = close + 1;
    re.lastIndex = i;
  }
  out += content.slice(i);
  return out;
}

function fixFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const updated = wrapTypeAliasProps(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, "utf8");
    return true;
  }
  return false;
}

const files = walk(ROOT);
let changed = 0;
for (const f of files) {
  if (fixFile(f)) {
    changed++;
    console.log("updated", path.relative(ROOT, f));
  }
}
console.log(`done: ${changed}/${files.length} tsx files`);
