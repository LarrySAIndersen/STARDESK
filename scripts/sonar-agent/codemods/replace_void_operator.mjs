#!/usr/bin/env node
/**
 * Replace `void expr` with fireAndForget(expr) for Sonar typescript:S3735.
 * Handles multi-arg calls, method chains, and `.catch()` suffixes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const WEB_SRC = path.join(REPO_ROOT, "apps/web/src");
const KANBAN_SRC = path.join(REPO_ROOT, "apps/project-kanban/src");

const IMPORT_LINE = 'import { fireAndForget } from "@/lib/fire-and-forget";';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function hasFireAndForgetImport(source) {
  return /from ["']@\/lib\/fire-and-forget["']/.test(source);
}

function addImport(source) {
  if (hasFireAndForgetImport(source)) return source;
  const bom = source.charCodeAt(0) === 0xfeff ? "\ufeff" : "";
  const body = bom ? source.slice(1) : source;
  const useClient = body.startsWith('"use client"') || body.startsWith("'use client'");
  if (useClient) {
    const nl = body.indexOf("\n");
    return `${bom}${body.slice(0, nl + 1)}\n${IMPORT_LINE}\n${body.slice(nl + 1)}`;
  }
  return `${bom}${IMPORT_LINE}\n${body}`;
}

/** Read a JS expression starting at index; returns text length or null. */
function readExpression(source, start) {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  if (i >= source.length) return null;

  const ch = source[i];
  if (ch === "(") {
    return readBalanced(source, i, "(", ")");
  }
  if (ch === "[") {
    return readBalanced(source, i, "[", "]");
  }
  if (ch === "`") {
    return readTemplateLiteral(source, i);
  }
  if (ch === '"' || ch === "'") {
    return readStringLiteral(source, i);
  }

  // identifier / keyword start
  if (!/[a-zA-Z_$]/.test(ch)) return null;

  let depth = 0;
  let started = false;
  const begin = i;
  while (i < source.length) {
    const c = source[i];
    if (c === "(" || c === "[" || c === "{") {
      const open = c;
      const close = c === "(" ? ")" : c === "[" ? "]" : "}";
      const inner = readBalanced(source, i, open, close);
      if (!inner) return null;
      i += inner.length;
      started = true;
      continue;
    }
    if (c === "`") {
      const lit = readTemplateLiteral(source, i);
      if (!lit) return null;
      i += lit.length;
      started = true;
      continue;
    }
    if (c === '"' || c === "'") {
      const lit = readStringLiteral(source, i);
      if (!lit) return null;
      i += lit.length;
      started = true;
      continue;
    }
    if (/[a-zA-Z0-9_$]/.test(c) || c === "." || c === "?" || c === ":" || c === ">") {
      i += 1;
      started = true;
      continue;
    }
    break;
  }
  return started ? { text: source.slice(begin, i), length: i - begin } : null;
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const c = source[i];
    if (c === "`") {
      const lit = readTemplateLiteral(source, i);
      if (!lit) return null;
      i += lit.length;
      continue;
    }
    if (c === '"' || c === "'") {
      const lit = readStringLiteral(source, i);
      if (!lit) return null;
      i += lit.length;
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return { text: source.slice(start, i + 1), length: i + 1 - start };
    }
    i += 1;
  }
  return null;
}

function readStringLiteral(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return { text: source.slice(start, i + 1), length: i + 1 - start };
    i += 1;
  }
  return null;
}

function readTemplateLiteral(source, start) {
  if (source[start] !== "`") return null;
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === "$" && source[i + 1] === "{") {
      const inner = readBalanced(source, i + 1, "{", "}");
      if (!inner) return null;
      i += 1 + inner.length;
      continue;
    }
    if (source[i] === "`") return { text: source.slice(start, i + 1), length: i + 1 - start };
    i += 1;
  }
  return null;
}

function isVoidReturnType(source, voidIndex) {
  const before = source.slice(Math.max(0, voidIndex - 30), voidIndex);
  return /:\s*$/.test(before) || /\)\s*:\s*$/.test(before);
}

function transformVoidUsages(source) {
  const skipPatterns = [
    /void\s+progressBar\.offsetWidth/,
    /void\s+0\b/,
  ];
  let out = "";
  let i = 0;
  let changed = false;

  while (i < source.length) {
    const voidMatch = source.slice(i).match(/^void\s+/);
    if (!voidMatch || isVoidReturnType(source, i)) {
      out += source[i];
      i += 1;
      continue;
    }

    const exprStart = i + voidMatch[0].length;
    let expr = readExpression(source, exprStart);
    if (!expr) {
      out += source[i];
      i += 1;
      continue;
    }

    let exprEnd = exprStart + expr.length;
    let fullExpr = source.slice(exprStart, exprEnd);

    // Include trailing `.catch(...)` often paired with void
    const after = source.slice(exprEnd);
    const catchMatch = after.match(/^\s*\.catch\s*\([^)]*\)/);
    if (catchMatch) {
      fullExpr += catchMatch[0];
      exprEnd += catchMatch[0].length;
    }

    const original = source.slice(i, exprEnd);
    if (skipPatterns.some((re) => re.test(original))) {
      // layout flush: use getBoundingClientRect instead of void offsetWidth
      if (/void\s+progressBar\.offsetWidth/.test(original)) {
        out += "progressBar.getBoundingClientRect()";
        i = exprEnd;
        changed = true;
        continue;
      }
      out += original;
      i = exprEnd;
      continue;
    }

    out += `fireAndForget(${fullExpr.trim()})`;
    i = exprEnd;
    changed = true;
  }

  return { source: out, changed };
}

let fileCount = 0;
for (const file of [...walk(WEB_SRC), ...walk(KANBAN_SRC)]) {
  if (file.endsWith("fire-and-forget.ts")) continue;
  const before = fs.readFileSync(file, "utf8");
  const { source: after, changed } = transformVoidUsages(before);
  if (!changed) continue;
  let out = after;
  if (/\bfireAndForget\s*\(/.test(out)) {
    out = addImport(out);
  }
  fs.writeFileSync(file, out);
  fileCount += 1;
  console.log("updated", path.relative(REPO_ROOT, file));
}
console.log(`Done — ${fileCount} file(s).`);
