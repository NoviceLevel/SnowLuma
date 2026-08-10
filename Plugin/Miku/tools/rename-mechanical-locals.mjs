/**
 * Rename mechanical locals (argN / valueN / itemN / …) to semantic names.
 * Uses file-wide unique names (config, config2, …) to avoid shadowing bugs,
 * and direct AST edits instead of scope.rename for speed.
 *
 * Usage: node tools/rename-mechanical-locals.mjs [input] [output]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const inputPath = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../index.mjs"));
const outputPath = path.resolve(process.argv[3] ?? inputPath);

const npxCache = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData/Local"), "npm-cache", "_npx");
const webcrackPackage = fs.readdirSync(npxCache, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(npxCache, entry.name, "node_modules", "webcrack", "package.json"))
  .find((candidate) => fs.existsSync(candidate));
if (!webcrackPackage) throw new Error("webcrack/@babel not found in npx cache");

const require = createRequire(webcrackPackage);
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const WEAK = /^(?:arg|value|item|items|story|target|config|error|field|loginInfo|foodInventory|bathInventory|values|progress|errorResult)\d+$/;
const TOP_LEVEL = {
  yt: "extractPacketHex",
  _: "extractImageUrl",
  Vt: "stripMarkdown",
  ot: "parseMedal",
  Qt: "parseInteractionText",
  H: "parseCatalogItem",
};

const RESERVED = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
  "do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import",
  "in", "instanceof", "let", "new", "null", "return", "super", "switch", "this", "throw",
  "true", "try", "typeof", "var", "void", "while", "with", "yield", "enum", "await",
  "arguments", "eval", "undefined", "NaN", "Infinity", "module", "exports", "require",
  "process", "Buffer", "console", "Promise", "Map", "Set", "Date", "JSON", "Math", "Error",
  "Object", "Array", "String", "Number", "Boolean", "RegExp", "Symbol", "BigInt", "Uint8Array",
  "fs", "os", "path", "http", "readline", "fileURLToPath", "randomBytes", "timingSafeEqual",
]);

const FN_PARAMS = {
  isAutoPetId: ["petId"],
  writeJsonAtomically: ["filePath", "value"],
  backupCorruptFile: ["filePath", "error"],
  extractPacketHex: ["payload"],
  extractImageUrl: ["parts"],
  stripMarkdown: ["text"],
  parseMedal: ["bytes", "acquired", "equipped"],
  parseInteractionText: ["raw"],
  parseCatalogItem: ["bytes", "extra"],
  parseRewardAmount: ["rewardText"],
  parseDurationSeconds: ["durationText"],
  compareRewardPerSecond: ["left", "right"],
  parseFatigueStatus: ["warningText"],
  randomDelaySeconds: ["minMinutes", "maxMinutes", "random"],
  rotateSchoolAttribute: ["config", "rotationIndex"],
  selectSchoolOrWork: ["config", "values", "counts"],
  fatigueAction: ["config", "fatigue"],
  clearFinishedStoryDisplay: ["story", "settled"],
  isIrrecoverableSettleError: ["error"],
  compareEmployableFriends: ["left", "right"],
  isAdventureWindowOpen: ["config", "now"],
  decideNextTask: ["config", "values", "counts", "now"],
  isWithinTimeWindow: ["nowHhmm", "startHhmm", "endHhmm"],
  normalizeTimeOfDay: ["value", "fallback"],
  normalizeConfig: ["input"],
  lowestSchoolAttribute: ["config", "values"],
  selectSchoolAttribute: ["config", "values", "rotationIndex"],
  attributeSnapshot: ["values"],
  compactTask: ["item"],
  telemetryDelta: ["before", "after"],
  delaySeconds: ["seconds"],
  bytesToHex: ["bytes"],
  hexToBytes: ["hex"],
  buildPacketEnvelope: ["command", "subCommand", "body"],
  concatBytes: ["chunks"],
  encodeVarint: ["value"],
  encodeVarintField: ["fieldNumber", "value"],
  encodeBytesField: ["fieldNumber", "bytes"],
  encodeStringField: ["fieldNumber", "text"],
  decodeVarint: ["bytes", "offset"],
  parseProtobufFields: ["bytes"],
  getProtobufFields: ["fields", "fieldNumber"],
  getVarintField: ["fields", "fieldNumber"],
  getBytesField: ["fields", "fieldNumber"],
  getStringField: ["fields", "fieldNumber"],
  getFloatField: ["fields", "fieldNumber"],
  sendJson: ["response", "statusCode", "payload"],
  readJsonBody: ["request"],
  resolveStaticAssetPath: ["webuiPath", "assetPath"],
  isAuthorizedRequest: ["request", "expectedToken"],
  renderIndexHtml: ["webuiPath", "runtimeName", "apiToken"],
  createWebServer: ["plugin", "options"],
  parsePort: ["value", "fallback"],
  normalizeWebHost: ["host"],
  formatLogError: ["error"],
  createLogger: ["options"],
  normalizeOneBotUrl: ["url"],
};

const METHOD_PARAMS = {
  ProgressStore: {
    constructor: ["filePath"], rollover: ["dateKey"], count: ["kind"], increment: ["kind"],
    advanceSchoolRotation: ["every"], setPending: ["kind", "storyId", "metadata"],
    confirmPending: ["storyId"], storyWasSettled: ["storyId"], markStorySettled: ["storyId"],
    storyWasDismissed: ["storyId"], dismissStory: ["storyId"], setBlock: ["key", "reason", "seconds"],
    activeBlock: ["key"], clearBlock: ["key"], targetWasVisited: ["targetId"],
    markTargetVisited: ["targetId"], recordAttributes: ["values"], recordTelemetry: ["entry"],
  },
  QQPetApi: {
    constructor: ["ctx", "petId"], sendPacket: ["packet", "body"], sendOidb: ["packet", "body"],
    feedOther: ["uin", "petId"], washOther: ["uin", "itemId"], buyFood: ["count"],
    buyBathItem: ["itemId", "count"], useBathItem: ["itemId"], querySchoolCourses: ["stage"],
    selectSchoolCourse: ["attribute", "subEventType"], startSchool: ["attribute", "subEventType"],
    selectWorkJob: ["careerType", "jobSubEvent"], startWork: ["careerType", "jobSubEvent", "hire"],
    startAdventure: ["optionName"], settleStory: ["storyId"], visitOther: ["uin"],
    queryOtherPet: ["uin", "kind"], queryOtherValues: ["petId"], queryWorkJobs: ["careerType"],
  },
  AutomationController: {
    constructor: ["host", "progress"], blocked: ["config", "actionLabel"], decide: ["config", "values"],
    actionArray: ["payload"], callAction: ["action", "params"], targetLabel: ["target"],
    visitCandidates: ["config"], findEmployableFriend: ["client", "config"],
    maybeVisit: ["client", "config", "foodInventory", "bathInventory"], storyKind: ["storyId"],
    handleMissingPending: ["config", "pending"], handleStory: ["client", "config", "story"],
    recordTaskTelemetry: ["pending", "status", "afterValues"],
    publish: ["profile", "fatigue", "values", "story", "foodInventory", "bathInventory"],
    queryProfile: ["client"], loop: ["generation"],
  },
  QQPetPlugin: {
    constructor: ["runtimeName"], init: ["context"], updateConfig: ["partial"],
    updateStatus: ["patch"], log: ["message"],
  },
  OneBotHttpClient: {
    constructor: ["options"], call: ["action", "params"], request: ["pathName", "init"],
  },
};

function unwrap(node) {
  while (t.isAwaitExpression(node) || t.isParenthesizedExpression(node)) node = node.argument ?? node.expression;
  return node;
}

function memberName(node) {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  if (!node.computed && t.isIdentifier(node.property)) return node.property.name;
  if (node.computed && t.isStringLiteral(node.property)) return node.property.value;
  return null;
}

function cleanBase(value, fallback = "temp") {
  if (!value) return fallback;
  let cleaned = String(value).replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "");
  if (!cleaned) return fallback;
  if (["get", "set", "call", "map", "find", "filter", "valueOf", "toString", "length", "name", "type", "value"].includes(cleaned)) {
    return fallback;
  }
  if (WEAK.test(cleaned)) return fallback;
  return cleaned[0].toLowerCase() + cleaned.slice(1);
}

function fnName(functionPath) {
  const node = functionPath.node;
  if (t.isClassMethod(node) || t.isObjectMethod(node)) {
    if (node.kind === "constructor") return "constructor";
    if (t.isIdentifier(node.key)) return node.key.name;
  }
  if (node.id?.name) return node.id.name;
  const parent = functionPath.parentPath;
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) return parent.node.id.name;
  return null;
}

function className(functionPath) {
  return functionPath.findParent((p) => p.isClassDeclaration() || p.isClassExpression())?.node.id?.name ?? null;
}

function inferObject(node) {
  const keys = node.properties
    .filter((p) => t.isObjectProperty(p) || t.isObjectMethod(p))
    .map((p) => (t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : ""));
  const has = (...names) => names.every((n) => keys.includes(n));
  if (has("recursive")) return "mkdirOptions";
  if (has("feel", "hunger", "clean")) return "petValues";
  if (has("strength", "intelligence", "charm")) return "attributes";
  if (has("storyId", "remainingSeconds")) return "storyInfo";
  if (has("uin", "petId")) return "petTarget";
  if (has("biscuits", "shrimp")) return "foodInventory";
  if (has("soap", "bathBall")) return "bathInventory";
  if (has("fatigued", "tier")) return "fatigue";
  if (has("cmd", "data")) return "packetRequest";
  if (has("command", "subCommand")) return "oidbResult";
  if (has("bought", "costGold")) return "foodPurchase";
  if (has("result", "orderId", "succeeded")) return "bathPurchase";
  if (has("courses", "careers")) return "catalogs";
  if (keys.includes("activity")) return "statusPatch";
  return "record";
}

function inferCall(node) {
  const name = t.isIdentifier(node.callee) ? node.callee.name : memberName(node.callee);
  const table = {
    String: "text", Number: "number", Boolean: "flag", parseProtobufFields: "fields",
    normalizeConfig: "config", getConfig: "config", snapshot: "snapshot", accountStatus: "account",
    queryValues: "petValues", queryOwnPetProfile: "profile", queryOtherPet: "otherPet",
    queryOtherValues: "otherValues", queryFoodInventory: "foodInventory",
    queryBathInventory: "bathInventory", queryBathItems: "bathItems", queryStory: "story",
    queryFatigueStatus: "fatigue", querySchoolCourses: "courses", querySchoolStage: "stage",
    queryWorkOverview: "workOverview", queryWorkJobs: "jobs", queryAdventures: "adventures",
    selectSchoolCourse: "course", selectWorkJob: "job", selectSchoolAttribute: "attribute",
    startSchool: "schoolStory", startWork: "workStory", startAdventure: "adventureStory",
    buyFood: "foodPurchase", buyBathItem: "bathPurchase", findEmployableFriend: "hireCandidate",
    visitCandidates: "candidates", friendCandidates: "friends", callAction: "actionResult",
    createDailyProgress: "progressState", currentDateKey: "dateKey", join: "joinedPath",
    dirname: "directory", readFileSync: "fileContents", stringify: "jsonText", parse: "parsed",
    encodeVarintField: "encodedField", encodeBytesField: "encodedField", encodeStringField: "encodedField",
    concatBytes: "bytes", buildPacketEnvelope: "envelope", bytesToHex: "hex", hexToBytes: "rawBytes",
    getVarintField: "varint", getBytesField: "fieldBytes", getStringField: "fieldText",
    getFloatField: "floatValue", getProtobufFields: "matchedFields", extractPacketHex: "packetHex",
    extractImageUrl: "imageUrl", stripMarkdown: "plainText", parseCatalogItem: "catalogItem",
    parseMedal: "medal", parseRewardAmount: "rewardAmount", parseDurationSeconds: "durationSeconds",
    parseFatigueStatus: "fatigue", decideNextTask: "nextTask", selectSchoolOrWork: "taskKind",
    fatigueAction: "forcedAction", randomDelaySeconds: "delaySeconds",
    rotateSchoolAttribute: "attribute", attributeSnapshot: "attributes", compactTask: "taskSummary",
    telemetryDelta: "delta", clearFinishedStoryDisplay: "displayStory", targetLabel: "label",
    storyKind: "kind", activeBlock: "block", markPendingMissing: "missingSince",
    isAutoPetId: "isAuto", createApiToken: "apiToken", createWebServer: "server",
    renderIndexHtml: "indexHtml", readJsonBody: "requestBody", map: "mappedItems",
    filter: "filteredItems", slice: "slicedItems", flatMap: "flatItems", find: "foundItem",
    trim: "trimmed", replace: "replaced", padStart: "padded", now: "timestamp",
  };
  if (name && table[name]) return table[name];
  if (name?.startsWith("query")) return cleanBase(name.slice(5), "queryResult");
  if (name?.startsWith("get") && name.length > 3) return cleanBase(name.slice(3), "got");
  if (name?.startsWith("parse")) return cleanBase(name.slice(5), "parsed");
  if (name?.startsWith("select")) return cleanBase(name.slice(6), "selected");
  if (name?.startsWith("start")) return cleanBase(name.slice(5), "started");
  if (name?.startsWith("encode")) return "encoded";
  return "temp";
}

function isPacketSource(node) {
  node = unwrap(node);
  if (!node) return false;
  if (t.isIdentifier(node) && /packet|Packet/i.test(node.name)) return true;
  return t.isMemberExpression(node) && t.isIdentifier(node.object, { name: "PACKETS" });
}

function inferInit(node) {
  node = unwrap(node);
  if (!node) return null;
  if (t.isObjectExpression(node)) return inferObject(node);
  if (t.isArrayExpression(node)) return "list";
  if (t.isStringLiteral(node) || t.isTemplateLiteral(node)) return "text";
  if (t.isNumericLiteral(node)) return "number";
  if (t.isBooleanLiteral(node)) return "flag";
  if (t.isRegExpLiteral(node)) return "pattern";
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) return "handler";
  if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) return inferCall(node);
  if (t.isNewExpression(node)) {
    const name = t.isIdentifier(node.callee) ? node.callee.name : "temp";
    return {
      Map: "map", Set: "set", Date: "date", URL: "url", Uint8Array: "bytes",
      ProgressStore: "progressStore", AutomationController: "scheduler", QQPetApi: "api",
      QQPetError: "petError", OneBotError: "oneBotError", OneBotHttpClient: "httpClient",
      Promise: "promise", TextDecoder: "decoder",
    }[name] ?? cleanBase(name, "instance");
  }
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    const prop = memberName(node);
    const table = {
      length: "count", message: "message", code: "errorCode", body: "responseBody",
      petId: "petId", storyId: "storyId", counts: "counts", pending: "pending",
      gold: "gold", hunger: "hunger", clean: "cleanLevel", feel: "mood",
      biscuits: "biscuits", bathBall: "bathBall", soap: "soap", finished: "finished",
      remainingSeconds: "remainingSeconds", uin: "uin", kind: "kind", tier: "tier",
      reward: "reward", duration: "duration", name: "itemName", canDo: "canDo",
      warning: "warning", subEventType: "subEventType", careerType: "careerType",
      user_id: "userId", group_id: "groupId", nickname: "nickname", remark: "remark",
      dataPath: "dataPath", configPath: "configPath", adapterName: "adapterName",
    };
    return (prop && table[prop]) || cleanBase(prop, "member");
  }
  if (t.isIdentifier(node)) return cleanBase(node.name, "ref");
  if (t.isBinaryExpression(node)) {
    if (["+", "+="].includes(node.operator)) return "combined";
    if (["===", "!==", "==", "!=", "<", ">", "<=", ">="].includes(node.operator)) return "matches";
    return "number";
  }
  if (t.isUnaryExpression(node)) return node.operator === "!" ? "flag" : "temp";
  if (t.isLogicalExpression(node)) return inferInit(node.left) ?? inferInit(node.right) ?? "temp";
  if (t.isConditionalExpression(node)) return inferInit(node.consequent) ?? inferInit(node.alternate) ?? "temp";
  return null;
}

function inferRefs(binding) {
  const props = [];
  let asError = false;
  for (const ref of binding.referencePaths) {
    const parent = ref.parentPath;
    if ((parent.isMemberExpression() || parent.isOptionalMemberExpression()) && parent.node.object === ref.node) {
      const name = memberName(parent.node);
      if (name) props.push(name);
    }
    if (parent.isBinaryExpression({ operator: "instanceof" }) && parent.node.left === ref.node) asError = true;
  }
  const has = (...names) => names.some((n) => props.includes(n));
  if (asError || binding.path.parentPath?.isCatchClause()) return "error";
  if (has("intervalSeconds", "enabled", "autoStart", "hungerThreshold", "adventureEnabled")) return "config";
  if (has("feel", "hunger", "clean", "gold", "strength", "intelligence", "charm")) return "petValues";
  if (has("biscuits", "shrimp")) return "foodInventory";
  if (has("soap", "bathBall")) return "bathInventory";
  if (has("storyId", "remainingSeconds", "finished", "durationSeconds")) return "story";
  if (has("wireType")) return "field";
  if (has("user_id", "nickname", "remark")) return "loginInfo";
  if (has("uin") && (has("petId") || has("kind") || has("level") || has("name"))) return "target";
  if (has("fatigued", "tier", "benefitRate")) return "fatigue";
  if (has("push", "map", "filter", "forEach", "flatMap", "find", "some")) return "list";
  if (has("bonus", "totalReward")) return "hireCandidate";
  if (has("canDo", "subEventType", "reward", "duration")) return "catalogItem";
  if (has("petName")) return "profile";
  return null;
}

function patternName(binding) {
  const idPath = binding.path;
  if (idPath.parentPath?.isObjectProperty()) {
    const prop = idPath.parentPath.node;
    if (prop.value === idPath.node || (t.isAssignmentPattern(prop.value) && prop.value.left === idPath.node)) {
      if (t.isIdentifier(prop.key)) return cleanBase(prop.key.name, "prop");
      if (t.isStringLiteral(prop.key)) return cleanBase(prop.key.value, "prop");
    }
  }
  if (idPath.parentPath?.isRestElement() && idPath.parentPath.parentPath?.isObjectPattern()) return "rest";
  const declarator = idPath.findParent((p) => p.isVariableDeclarator());
  if (declarator && t.isArrayPattern(declarator.node.id)) {
    const index = declarator.node.id.elements.findIndex((el) => {
      if (el === idPath.node) return true;
      if (t.isRestElement(el) && el.argument === idPath.node) return true;
      if (t.isAssignmentPattern(el) && el.left === idPath.node) return true;
      return false;
    });
    if (index >= 0 && isPacketSource(declarator.node.init)) {
      return ["commandName", "command", "subCommand"][index] ?? `packetPart${index + 1}`;
    }
    if (index >= 0) {
      const init = unwrap(declarator.node.init);
      if (t.isCallExpression(init) && memberName(init.callee) === "all") {
        return ["profile", "petValues", "story", "foodInventory", "bathInventory"][index] ?? `part${index + 1}`;
      }
      return `part${index + 1}`;
    }
  }
  return null;
}

function paramName(binding) {
  const idPath = binding.path;
  if (idPath.parentPath?.isCatchClause()) return "error";
  const functionPath = idPath.getFunctionParent();
  if (!functionPath) return "arg";
  const index = functionPath.node.params.indexOf(idPath.node);
  if (index < 0) return inferRefs(binding) ?? "arg";
  const name = fnName(functionPath);
  const cls = className(functionPath);
  if (cls && name && METHOD_PARAMS[cls]?.[name]?.[index]) return METHOD_PARAMS[cls][name][index];
  if (name && FN_PARAMS[name]?.[index]) return FN_PARAMS[name][index];
  const parent = functionPath.parentPath;
  if (parent?.isNewExpression() && t.isIdentifier(parent.node.callee, { name: "Promise" })) {
    return index === 0 ? "resolve" : "reject";
  }
  if (parent?.isCallExpression() || parent?.isOptionalCallExpression()) {
    const method = memberName(parent.node.callee) ?? (t.isIdentifier(parent.node.callee) ? parent.node.callee.name : null);
    if (method === "reduce") return index === 0 ? "accumulator" : index === 1 ? "item" : "index";
    if (method === "sort") return index === 0 ? "left" : "right";
    if (["map", "filter", "find", "findIndex", "some", "every", "forEach", "flatMap"].includes(method)) {
      return index === 0 ? "item" : index === 1 ? "index" : "array";
    }
  }
  return inferRefs(binding) ?? (index === 0 ? "input" : `input${index + 1}`);
}

function inferBinding(binding) {
  if (binding.path.parentPath?.isCatchClause() || binding.kind === "param") return paramName(binding);
  const fromPattern = patternName(binding);
  if (fromPattern) return fromPattern;
  if (binding.path.parentPath?.isVariableDeclarator()) {
    return inferRefs(binding) ?? inferInit(binding.path.parentPath.node.init) ?? "temp";
  }
  return inferRefs(binding) ?? "temp";
}

const usedNames = new Set(RESERVED);
const nameCounters = new Map();

function allocate(base) {
  let cleaned = cleanBase(base, "temp");
  if (RESERVED.has(cleaned) || WEAK.test(cleaned)) cleaned = `${cleaned}Value`;
  if (!usedNames.has(cleaned)) {
    usedNames.add(cleaned);
    return cleaned;
  }
  let index = nameCounters.get(cleaned) ?? 2;
  while (usedNames.has(cleaned + index) || WEAK.test(cleaned + index)) index += 1;
  nameCounters.set(cleaned, index + 1);
  const name = cleaned + index;
  usedNames.add(name);
  return name;
}

function applyRename(binding, next) {
  binding.identifier.name = next;
  for (const ref of binding.referencePaths) {
    if (ref.node?.type === "Identifier") ref.node.name = next;
  }
  for (const violation of binding.constantViolations) {
    if (violation.isAssignmentExpression() && t.isIdentifier(violation.node.left)) {
      violation.node.left.name = next;
    } else if (violation.isUpdateExpression() && t.isIdentifier(violation.node.argument)) {
      violation.node.argument.name = next;
    } else if (violation.isUnaryExpression({ operator: "delete" }) && t.isIdentifier(violation.node.argument)) {
      violation.node.argument.name = next;
    }
  }
}

const started = Date.now();
process.stderr.write(`parsing ${inputPath}\n`);
const source = fs.readFileSync(inputPath, "utf8");
const ast = parser.parse(source, { sourceType: "module" });

let renamed = 0;

// Reserve all existing non-weak names.
traverse(ast, {
  Identifier(path) {
    const name = path.node.name;
    if (!WEAK.test(name) && !Object.prototype.hasOwnProperty.call(TOP_LEVEL, name)) {
      usedNames.add(name);
    }
  },
});

// Top-level short helpers.
traverse(ast, {
  Program(programPath) {
    for (const [from, to] of Object.entries(TOP_LEVEL)) {
      const binding = programPath.scope.bindings[from];
      if (!binding) continue;
      usedNames.add(to);
      applyRename(binding, to);
      renamed += 1;
      process.stderr.write(`  top ${from} -> ${to}\n`);
    }
  },
});

// Mechanical locals, innermost scopes first.
traverse(ast, {
  Scopable: {
    exit(scopePath) {
      const names = Object.keys(scopePath.scope.bindings).filter((name) => WEAK.test(name));
      names.sort((a, b) => {
        const ba = scopePath.scope.bindings[a];
        const bb = scopePath.scope.bindings[b];
        const ra = ba.kind === "param" || ba.path.parentPath?.isCatchClause() ? 0 : 1;
        const rb = bb.kind === "param" || bb.path.parentPath?.isCatchClause() ? 0 : 1;
        return ra - rb || a.localeCompare(b);
      });
      for (const name of names) {
        const binding = scopePath.scope.bindings[name];
        if (!binding || !WEAK.test(binding.identifier.name)) continue;
        const next = allocate(inferBinding(binding));
        applyRename(binding, next);
        renamed += 1;
      }
    },
  },
});

process.stderr.write(`renamed ${renamed} in ${Date.now() - started}ms, generating...\n`);
const output = generate(ast, { comments: true, compact: false, jsescOption: { minimal: true } }, source).code;
fs.writeFileSync(outputPath, output.endsWith("\n") ? output : `${output}\n`, "utf8");

const remaining = output.match(/\b(?:arg|value|item|items|story|target|config|error|field|loginInfo|foodInventory|bathInventory|values)\d+\b/g) ?? [];
process.stdout.write(`${JSON.stringify({
  renamed,
  ms: Date.now() - started,
  remainingMechanical: remaining.length,
  remainingUnique: [...new Set(remaining)].slice(0, 20),
}, null, 2)}\n`);
