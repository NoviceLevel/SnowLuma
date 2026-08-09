import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const inputPath = path.resolve(process.argv[2] ?? "src/deobfuscated.js");
const outputPath = path.resolve(process.argv[3] ?? inputPath);
const npxCache = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData/Local"), "npm-cache", "_npx");
const webcrackPackage = fs.readdirSync(npxCache, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(npxCache, entry.name, "node_modules", "webcrack", "package.json"))
  .find(candidate => fs.existsSync(candidate));

if (!webcrackPackage) throw new Error("webcrack is not available in the local npm cache");

const require = createRequire(webcrackPackage);
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");
const randomName = /^_0x[0-9a-f]+$/i;

function unwrap(node) {
  while (t.isAwaitExpression(node) || t.isTSAsExpression?.(node) || t.isParenthesizedExpression(node)) node = node.argument ?? node.expression;
  return node;
}

function memberName(node) {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  if (!node.computed && t.isIdentifier(node.property)) return node.property.name;
  if (node.computed && t.isStringLiteral(node.property)) return node.property.value;
  return null;
}

function cleanBase(value, fallback = "value") {
  if (!value || randomName.test(value)) return fallback;
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^[0-9]+/, "");
  if (!cleaned || ["get", "set", "call", "map", "find", "filter", "valueOf", "toString"].includes(cleaned)) return fallback;
  return cleaned[0].toLowerCase() + cleaned.slice(1);
}

function inferObject(node) {
  const keys = node.properties
    .filter(property => t.isObjectProperty(property) || t.isObjectMethod(property))
    .map(property => t.isIdentifier(property.key) ? property.key.name : t.isStringLiteral(property.key) ? property.key.value : "");
  const has = (...names) => names.every(name => keys.includes(name));
  if (has("connected", "automationRunning")) return "status";
  if (has("feel", "hunger", "clean")) return "values";
  if (has("strength", "intelligence", "charm")) return "attributes";
  if (has("storyId", "remainingSeconds")) return "story";
  if (has("uin", "petId")) return "account";
  if (has("host", "port")) return "serverOptions";
  if (has("method", "headers", "body")) return "requestOptions";
  if (has("type", "pid")) return "event";
  if (has("code", "message")) return "errorResult";
  if (has("recursive")) return "mkdirOptions";
  return "result";
}

function inferCall(node) {
  const name = t.isIdentifier(node.callee) ? node.callee.name : memberName(node.callee);
  const names = {
    String: "text", Number: "number", Boolean: "flag", parseProtobufFields: "fields",
    normalizeConfig: "config", createLogger: "logger", createRuntimeAdapter: "runtime",
    getConfig: "config", snapshot: "snapshot", accountStatus: "account",
    queryValues: "values", queryOwnPetProfile: "profile", queryOtherPet: "pet",
    queryOtherValues: "values", queryFoodInventory: "foodInventory", queryBathInventory: "bathInventory",
    queryStoryStatus: "story", queryInteractionHistory: "interactions", queryMedalGallery: "medals",
    readJsonBody: "body", renderIndexHtml: "indexHtml", createWebServer: "server",
    join: "joinedPath", dirname: "directory", extname: "extension", resolve: "resolvedPath",
    trim: "text", toLowerCase: "text", toUpperCase: "text", replace: "text", replaceAll: "text",
    map: "items", filter: "items", slice: "items", concat: "items", find: "item",
    keys: "keys", entries: "entries", now: "timestamp", getTime: "timestamp",
    statSync: "stat", readFileSync: "contents", stringify: "json", parse: "parsed"
  };
  if (name && names[name]) return names[name];
  if (name?.startsWith("query")) return cleanBase(name.slice(5), "result");
  if (name?.startsWith("get") && name.length > 3) return cleanBase(name.slice(3), "value");
  if (name?.startsWith("create") && name.length > 6) return cleanBase(name.slice(6), "result");
  return "result";
}

function inferInitializer(node) {
  node = unwrap(node);
  if (!node) return null;
  if (t.isObjectExpression(node)) return inferObject(node);
  if (t.isArrayExpression(node)) return "items";
  if (t.isStringLiteral(node) || t.isTemplateLiteral(node)) return "text";
  if (t.isNumericLiteral(node) || t.isBigIntLiteral(node)) return "number";
  if (t.isBooleanLiteral(node)) return "flag";
  if (t.isRegExpLiteral(node)) return "pattern";
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) return "handler";
  if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) return inferCall(node);
  if (t.isNewExpression(node)) {
    const name = t.isIdentifier(node.callee) ? node.callee.name : "value";
    return { Map: "map", Set: "set", Date: "date", URL: "url", Uint8Array: "bytes", DataView: "dataView", TextDecoder: "decoder" }[name] ?? cleanBase(name);
  }
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) return cleanBase(memberName(node));
  if (t.isIdentifier(node)) return cleanBase(node.name);
  if (t.isBinaryExpression(node)) return ["+", "+="].includes(node.operator) ? "combined" : "number";
  if (t.isLogicalExpression(node) || t.isConditionalExpression(node)) return "value";
  return null;
}

function inferReferences(binding) {
  const properties = [];
  for (const reference of binding.referencePaths) {
    const parent = reference.parentPath;
    if ((parent.isMemberExpression() || parent.isOptionalMemberExpression()) && parent.node.object === reference.node) {
      const name = memberName(parent.node);
      if (name) properties.push(name);
    }
    if (parent.isBinaryExpression({ operator: "instanceof" }) && parent.node.left === reference.node) return "error";
  }
  const has = (...names) => names.some(name => properties.includes(name));
  if (has("message", "stack") && has("code")) return "error";
  if (has("intervalSeconds", "enabled", "autoStart", "hungerThreshold")) return "config";
  if (has("feel", "hunger", "clean", "gold")) return "values";
  if (has("biscuits", "shrimp")) return "foodInventory";
  if (has("soap", "bathBall")) return "bathInventory";
  if (has("storyId", "remainingSeconds", "finished")) return "story";
  if (has("wireType")) return "field";
  if (has("user_id", "nickname")) return "loginInfo";
  if (has("uin", "petId", "kind")) return "target";
  if (has("push", "map", "filter", "length")) return "items";
  return null;
}

function inferParameter(binding) {
  const identifierPath = binding.path;
  if (identifierPath.parentPath?.isCatchClause()) return "error";
  const functionPath = identifierPath.getFunctionParent();
  if (!functionPath) return "arg";
  const index = functionPath.node.params.indexOf(identifierPath.node);
  const parent = functionPath.parentPath;
  if (parent?.isNewExpression() && t.isIdentifier(parent.node.callee, { name: "Promise" })) return index === 0 ? "resolve" : "reject";
  if (parent?.isCallExpression() || parent?.isOptionalCallExpression()) {
    const method = memberName(parent.node.callee);
    if (method === "reduce") return index === 0 ? "accumulator" : index === 1 ? "item" : "index";
    if (method === "sort") return index === 0 ? "left" : "right";
    if (["map", "filter", "find", "findLastIndex", "some", "every", "forEach"].includes(method)) return index === 0 ? "item" : index === 1 ? "index" : "items";
  }
  return inferReferences(binding) ?? `arg${index + 1}`;
}

function inferBinding(binding) {
  const identifierPath = binding.path;
  if (identifierPath.parentPath?.isCatchClause() || binding.kind === "param") return inferParameter(binding);
  if (identifierPath.parentPath?.isVariableDeclarator()) {
    const declarator = identifierPath.parentPath.node;
    return inferInitializer(declarator.init) ?? inferReferences(binding) ?? "value";
  }
  if (identifierPath.parentPath?.isClassDeclaration()) return "ClassValue";
  if (identifierPath.parentPath?.isFunctionDeclaration()) return "helper";
  return inferReferences(binding) ?? "value";
}

const usedNames = new Set();
const nameCounters = new Map();

function allocate(base) {
  base = cleanBase(base);
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }
  let index = nameCounters.get(base) ?? 2;
  while (usedNames.has(base + index)) index += 1;
  nameCounters.set(base, index + 1);
  usedNames.add(base + index);
  return base + index;
}

const source = fs.readFileSync(inputPath, "utf8");
const ast = parser.parse(source, { sourceType: "module" });
let renamed = 0;

traverse(ast, {
  Identifier(identifierPath) {
    if (!randomName.test(identifierPath.node.name)) usedNames.add(identifierPath.node.name);
  }
});

traverse(ast, {
  Scopable: {
    exit(scopePath) {
      for (const name of Object.keys(scopePath.scope.bindings)) {
        if (!randomName.test(name)) continue;
        const binding = scopePath.scope.bindings[name];
        const replacement = allocate(inferBinding(binding));
        scopePath.scope.rename(name, replacement);
        renamed += 1;
      }
    }
  }
});

const output = generate(ast, { comments: true, jsescOption: { minimal: true } }, source).code + "\n";
fs.writeFileSync(outputPath, output, "utf8");
const remaining = (output.match(/\b_0x[0-9a-f]+\b/gi) ?? []).length;
process.stdout.write(JSON.stringify({ renamed, remaining }) + "\n");
