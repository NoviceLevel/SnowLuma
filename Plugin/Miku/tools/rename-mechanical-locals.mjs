/**
 * Fast semantic renamer for mechanical locals (argN/valueN/…).
 * Direct AST identifier edits + file-wide unique names.
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
  .filter((e) => e.isDirectory())
  .map((e) => path.join(npxCache, e.name, "node_modules", "webcrack", "package.json"))
  .find((p) => fs.existsSync(p));
if (!webcrackPackage) throw new Error("Need webcrack npx cache for @babel/*");

const require = createRequire(webcrackPackage);
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const WEAK = /^(?:arg|value|item|items|story|target|config|error|field|loginInfo|foodInventory|bathInventory|values|progress|errorResult)\d+$/;
const TOP = { yt: "extractPacketHex", _: "extractImageUrl", Vt: "stripMarkdown", ot: "parseMedal", Qt: "parseInteractionText", H: "parseCatalogItem" };

const RESERVED = new Set("break,case,catch,class,const,continue,default,delete,do,else,export,extends,false,finally,for,function,if,import,in,instanceof,let,new,null,return,super,switch,this,throw,true,try,typeof,var,void,while,with,yield,enum,await,arguments,eval,undefined,NaN,Infinity,module,exports,require,process,Buffer,console,Promise,Map,Set,Date,JSON,Math,Error,Object,Array,String,Number,Boolean,RegExp,Symbol,BigInt,Uint8Array,fs,os,path,http,readline,fileURLToPath,randomBytes,timingSafeEqual".split(","));

const FN_PARAMS = {
  isAutoPetId: ["petId"], writeJsonAtomically: ["filePath", "value"], backupCorruptFile: ["filePath", "error"],
  extractPacketHex: ["payload"], extractImageUrl: ["parts"], stripMarkdown: ["text"],
  parseMedal: ["bytes", "acquired", "equipped"], parseInteractionText: ["raw"], parseCatalogItem: ["bytes", "extra"],
  parseRewardAmount: ["rewardText"], parseDurationSeconds: ["durationText"], compareRewardPerSecond: ["left", "right"],
  parseFatigueStatus: ["warningText"], randomDelaySeconds: ["minMinutes", "maxMinutes", "random"],
  rotateSchoolAttribute: ["config", "rotationIndex"], selectSchoolOrWork: ["config", "values", "counts"],
  fatigueAction: ["config", "fatigue"], clearFinishedStoryDisplay: ["story", "settled"],
  isIrrecoverableSettleError: ["error"], compareEmployableFriends: ["left", "right"],
  isAdventureWindowOpen: ["config", "now"], decideNextTask: ["config", "values", "counts", "now"],
  isWithinTimeWindow: ["nowHhmm", "startHhmm", "endHhmm"], normalizeTimeOfDay: ["value", "fallback"],
  normalizeConfig: ["input"], lowestSchoolAttribute: ["config", "values"],
  selectSchoolAttribute: ["config", "values", "rotationIndex"], attributeSnapshot: ["values"],
  compactTask: ["item"], telemetryDelta: ["before", "after"], delaySeconds: ["seconds"],
  bytesToHex: ["bytes"], hexToBytes: ["hex"], buildPacketEnvelope: ["command", "subCommand", "body"],
  concatBytes: ["chunks"], encodeVarint: ["value"], encodeVarintField: ["fieldNumber", "value"],
  encodeBytesField: ["fieldNumber", "bytes"], encodeStringField: ["fieldNumber", "text"],
  decodeVarint: ["bytes", "offset"], parseProtobufFields: ["bytes"], getProtobufFields: ["fields", "fieldNumber"],
  getVarintField: ["fields", "fieldNumber"], getBytesField: ["fields", "fieldNumber"],
  getStringField: ["fields", "fieldNumber"], getFloatField: ["fields", "fieldNumber"],
  sendJson: ["response", "statusCode", "payload"], readJsonBody: ["request"],
  resolveStaticAssetPath: ["webuiPath", "assetPath"], isAuthorizedRequest: ["request", "expectedToken"],
  renderIndexHtml: ["webuiPath", "runtimeName", "apiToken"], createWebServer: ["plugin", "options"],
  parsePort: ["value", "fallback"], normalizeWebHost: ["host"], formatLogError: ["error"],
  createLogger: ["options"], normalizeOneBotUrl: ["url"],
};

const METHOD_PARAMS = {
  ProgressStore: {
    constructor: ["filePath"], rollover: ["dateKey"], count: ["kind"], increment: ["kind"],
    advanceSchoolRotation: ["every"], setPending: ["kind", "storyId", "metadata"], confirmPending: ["storyId"],
    storyWasSettled: ["storyId"], markStorySettled: ["storyId"], storyWasDismissed: ["storyId"],
    dismissStory: ["storyId"], setBlock: ["key", "reason", "seconds"], activeBlock: ["key"],
    clearBlock: ["key"], targetWasVisited: ["targetId"], markTargetVisited: ["targetId"],
    recordAttributes: ["values"], recordTelemetry: ["entry"],
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
  OneBotHttpClient: { constructor: ["options"], call: ["action", "params"], request: ["pathName", "init"] },
};

const CALL_NAMES = {
  String: "text", Number: "number", Boolean: "flag", parseProtobufFields: "fields", normalizeConfig: "config",
  getConfig: "config", snapshot: "snapshot", accountStatus: "account", queryValues: "petValues",
  queryOwnPetProfile: "profile", queryOtherPet: "otherPet", queryOtherValues: "otherValues",
  queryFoodInventory: "foodInventory", queryBathInventory: "bathInventory", queryBathItems: "bathItems",
  queryStory: "story", queryFatigueStatus: "fatigue", querySchoolCourses: "courses", querySchoolStage: "stage",
  queryWorkOverview: "workOverview", queryWorkJobs: "jobs", queryAdventures: "adventures",
  selectSchoolCourse: "course", selectWorkJob: "job", selectSchoolAttribute: "attribute",
  startSchool: "schoolStory", startWork: "workStory", startAdventure: "adventureStory",
  buyFood: "foodPurchase", buyBathItem: "bathPurchase", findEmployableFriend: "hireCandidate",
  visitCandidates: "candidates", friendCandidates: "friends", callAction: "actionResult",
  createDailyProgress: "progressState", currentDateKey: "dateKey", join: "joinedPath", dirname: "directory",
  readFileSync: "fileContents", stringify: "jsonText", parse: "parsed", encodeVarintField: "encodedField",
  encodeBytesField: "encodedField", encodeStringField: "encodedField", concatBytes: "bytes",
  buildPacketEnvelope: "envelope", bytesToHex: "hex", hexToBytes: "rawBytes", getVarintField: "varint",
  getBytesField: "fieldBytes", getStringField: "fieldText", getFloatField: "floatValue",
  getProtobufFields: "matchedFields", extractPacketHex: "packetHex", extractImageUrl: "imageUrl",
  stripMarkdown: "plainText", parseCatalogItem: "catalogItem", parseMedal: "medal",
  parseRewardAmount: "rewardAmount", parseDurationSeconds: "durationSeconds", parseFatigueStatus: "fatigue",
  decideNextTask: "nextTask", selectSchoolOrWork: "taskKind", fatigueAction: "forcedAction",
  randomDelaySeconds: "delaySeconds", rotateSchoolAttribute: "attribute", attributeSnapshot: "attributes",
  compactTask: "taskSummary", telemetryDelta: "delta", clearFinishedStoryDisplay: "displayStory",
  targetLabel: "label", storyKind: "kind", activeBlock: "block", markPendingMissing: "missingSince",
  isAutoPetId: "isAuto", createApiToken: "apiToken", createWebServer: "server", renderIndexHtml: "indexHtml",
  readJsonBody: "requestBody", map: "mappedItems", filter: "filteredItems", slice: "slicedItems",
  flatMap: "flatItems", find: "foundItem", trim: "trimmed", replace: "replaced", padStart: "padded",
  now: "timestamp", keys: "keyList", values: "valueList",
};

const MEMBER_NAMES = {
  length: "count", message: "message", code: "errorCode", body: "responseBody", petId: "petId",
  storyId: "storyId", counts: "counts", pending: "pending", gold: "gold", hunger: "hunger",
  clean: "cleanLevel", feel: "mood", biscuits: "biscuits", bathBall: "bathBall", soap: "soap",
  finished: "finished", remainingSeconds: "remainingSeconds", uin: "uin", kind: "kind", tier: "tier",
  reward: "reward", duration: "duration", name: "itemName", canDo: "canDo", warning: "warning",
  subEventType: "subEventType", careerType: "careerType", user_id: "userId", group_id: "groupId",
  nickname: "nickname", remark: "remark", dataPath: "dataPath", configPath: "configPath",
  adapterName: "adapterName",
};

function memberName(node) {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  if (!node.computed && t.isIdentifier(node.property)) return node.property.name;
  if (node.computed && t.isStringLiteral(node.property)) return node.property.value;
  return null;
}

function cleanBase(value, fallback = "temp") {
  if (!value) return fallback;
  let cleaned = String(value).replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "");
  if (!cleaned || WEAK.test(cleaned)) return fallback;
  if ("get,set,call,map,find,filter,valueOf,toString,length,name,type,value".split(",").includes(cleaned)) return fallback;
  return cleaned[0].toLowerCase() + cleaned.slice(1);
}

function unwrap(node) {
  let guard = 0;
  while (node && (t.isAwaitExpression(node) || t.isParenthesizedExpression(node)) && guard++ < 8) {
    node = node.argument ?? node.expression;
  }
  return node;
}

function fnName(fnPath) {
  const node = fnPath.node;
  if (t.isClassMethod(node) || t.isObjectMethod(node)) {
    if (node.kind === "constructor") return "constructor";
    if (t.isIdentifier(node.key)) return node.key.name;
  }
  if (node.id?.name) return node.id.name;
  const parent = fnPath.parentPath;
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) return parent.node.id.name;
  return null;
}

function classNameOf(fnPath) {
  return fnPath.findParent((p) => p.isClassDeclaration() || p.isClassExpression())?.node.id?.name ?? null;
}

function inferObject(node) {
  const keys = [];
  for (const p of node.properties) {
    if (t.isObjectProperty(p) || t.isObjectMethod(p)) {
      keys.push(t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : "");
    }
  }
  const has = (...ns) => ns.every((n) => keys.includes(n));
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
  if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
    const name = t.isIdentifier(node.callee) ? node.callee.name : memberName(node.callee);
    if (name && CALL_NAMES[name]) return CALL_NAMES[name];
    if (name?.startsWith("query")) return cleanBase(name.slice(5), "queryResult");
    if (name?.startsWith("get") && name.length > 3) return cleanBase(name.slice(3), "got");
    if (name?.startsWith("parse")) return cleanBase(name.slice(5), "parsed");
    if (name?.startsWith("select")) return cleanBase(name.slice(6), "selected");
    if (name?.startsWith("start")) return cleanBase(name.slice(5), "started");
    if (name?.startsWith("encode")) return "encoded";
    return "temp";
  }
  if (t.isNewExpression(node)) {
    const name = t.isIdentifier(node.callee) ? node.callee.name : "temp";
    return {
      Map: "map", Set: "set", Date: "date", URL: "url", Uint8Array: "bytes",
      ProgressStore: "progressStore", AutomationController: "scheduler", QQPetApi: "api",
      QQPetError: "petError", OneBotError: "oneBotError", OneBotHttpClient: "httpClient", Promise: "promise",
    }[name] ?? cleanBase(name, "instance");
  }
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    const prop = memberName(node);
    return (prop && MEMBER_NAMES[prop]) || cleanBase(prop, "member");
  }
  if (t.isIdentifier(node)) return cleanBase(node.name, "ref");
  if (t.isBinaryExpression(node)) {
    if (node.operator === "+") return "combined";
    if (["===", "!==", "==", "!=", "<", ">", "<=", ">="].includes(node.operator)) return "matches";
    return "number";
  }
  if (t.isUnaryExpression(node)) return node.operator === "!" ? "flag" : "temp";
  // Avoid deep recursion on logical/conditional trees — just pick a stable label.
  if (t.isLogicalExpression(node) || t.isConditionalExpression(node)) return "temp";
  return null;
}

function inferRefs(binding) {
  const props = [];
  let asError = binding.path.parentPath?.isCatchClause() === true;
  for (const ref of binding.referencePaths) {
    const parent = ref.parentPath;
    if (!parent) continue;
    if ((parent.isMemberExpression() || parent.isOptionalMemberExpression()) && parent.node.object === ref.node) {
      const name = memberName(parent.node);
      if (name) props.push(name);
    }
    if (parent.isBinaryExpression({ operator: "instanceof" }) && parent.node.left === ref.node) asError = true;
  }
  const has = (...ns) => ns.some((n) => props.includes(n));
  if (asError) return "error";
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

function arrayElementIndex(pattern, idNode) {
  return pattern.elements.findIndex((el) => {
    if (el === idNode) return true;
    if (t.isRestElement(el) && el.argument === idNode) return true;
    if (t.isAssignmentPattern(el) && el.left === idNode) return true;
    return false;
  });
}

function inferTupleName(init, index) {
  init = unwrap(init);
  if (!init) return null;
  if (t.isIdentifier(init) && /packet/i.test(init.name)) {
    return ["commandName", "command", "subCommand"][index] ?? `packetPart${index + 1}`;
  }
  if (t.isMemberExpression(init) && t.isIdentifier(init.object, { name: "PACKETS" })) {
    return ["commandName", "command", "subCommand"][index] ?? `packetPart${index + 1}`;
  }
  if (t.isCallExpression(init)) {
    const callee = t.isIdentifier(init.callee) ? init.callee.name : memberName(init.callee);
    if (callee === "decodeVarint") return ["varint", "nextOffset"][index] ?? `decoded${index + 1}`;
    if (callee === "all" || (t.isMemberExpression(init.callee) && memberName(init.callee) === "all")) {
      return ["profile", "petValues", "story", "foodInventory", "bathInventory"][index] ?? `part${index + 1}`;
    }
  }
  return null;
}

function inferBinding(binding) {
  const idPath = binding.path;
  const idNode = binding.identifier;

  // catch (error) { ... }
  // Some Babel versions bind catch params with path=CatchClause (parentKey handler on TryStatement).
  if (
    idPath.isCatchClause?.()
    || idPath.parentPath?.isCatchClause()
    || idPath.parent?.type === "CatchClause"
    || (idPath.parentKey === "handler" && idPath.parentPath?.isTryStatement())
  ) {
    return "error";
  }

  if (binding.kind === "param") {
    const fnPath = idPath.getFunctionParent();
    if (!fnPath) return "arg";
    const index = fnPath.node.params.indexOf(idNode);
    if (index < 0) return inferRefs(binding) ?? "arg";
    const name = fnName(fnPath);
    const cls = classNameOf(fnPath);
    if (cls && name && METHOD_PARAMS[cls]?.[name]?.[index]) return METHOD_PARAMS[cls][name][index];
    if (name && FN_PARAMS[name]?.[index]) return FN_PARAMS[name][index];
    const parent = fnPath.parentPath;
    if (parent?.isCallExpression() || parent?.isOptionalCallExpression()) {
      const method = memberName(parent.node.callee) ?? (t.isIdentifier(parent.node.callee) ? parent.node.callee.name : null);
      if (method === "sort") return index === 0 ? "left" : "right";
      if (["map", "filter", "find", "findIndex", "some", "every", "forEach", "flatMap"].includes(method)) {
        return index === 0 ? "item" : "index";
      }
      if (method === "reduce") return index === 0 ? "accumulator" : "item";
    }
    return inferRefs(binding) ?? (index === 0 ? "input" : `input${index + 1}`);
  }

  // const [a, b] = init  (binding.path may be VariableDeclaration / VariableDeclarator)
  const declarators = [];
  if (idPath.isVariableDeclarator()) declarators.push(idPath.node);
  else if (idPath.isVariableDeclaration()) declarators.push(...idPath.node.declarations);
  else if (idPath.parentPath?.isVariableDeclarator()) declarators.push(idPath.parentPath.node);

  for (const declarator of declarators) {
    if (t.isArrayPattern(declarator.id)) {
      const index = arrayElementIndex(declarator.id, idNode);
      if (index >= 0) return inferTupleName(declarator.init, index) ?? `part${index + 1}`;
    }
    if (t.isObjectPattern(declarator.id)) {
      for (const prop of declarator.id.properties) {
        if (t.isRestElement(prop) && prop.argument === idNode) return "rest";
        if (t.isObjectProperty(prop) && (prop.value === idNode || (t.isAssignmentPattern(prop.value) && prop.value.left === idNode))) {
          if (t.isIdentifier(prop.key)) return cleanBase(prop.key.name, "prop");
          if (t.isStringLiteral(prop.key)) return cleanBase(prop.key.value, "prop");
        }
      }
    }
    if (t.isIdentifier(declarator.id) && declarator.id === idNode) {
      return inferRefs(binding) ?? inferInit(declarator.init) ?? "temp";
    }
  }

  // let a; [a, b] = decodeVarint(...)
  for (const violation of binding.constantViolations) {
    if (!violation.isAssignmentExpression()) continue;
    const left = violation.node.left;
    if (t.isArrayPattern(left)) {
      const index = left.elements.findIndex((el) => t.isIdentifier(el) && (el === idNode || el.name === idNode.name));
      if (index >= 0) {
        const inferred = inferTupleName(violation.node.right, index);
        if (inferred) return inferred;
      }
    }
  }

  // Destructuring via Identifier path inside patterns
  if (idPath.parentPath?.isObjectProperty()) {
    const prop = idPath.parentPath.node;
    if (prop.value === idNode || (t.isAssignmentPattern(prop.value) && prop.value.left === idNode)) {
      if (t.isIdentifier(prop.key)) return cleanBase(prop.key.name, "prop");
      if (t.isStringLiteral(prop.key)) return cleanBase(prop.key.value, "prop");
    }
  }
  if (idPath.parentPath?.isRestElement() && idPath.parentPath.parentPath?.isObjectPattern()) return "rest";
  if (idPath.parentPath?.isArrayPattern()) {
    const declarator = idPath.findParent((p) => p.isVariableDeclarator());
    const index = arrayElementIndex(idPath.parentPath.node, idNode);
    if (index >= 0 && declarator) return inferTupleName(declarator.node.init, index) ?? `part${index + 1}`;
  }

  if (idPath.parentPath?.isVariableDeclarator()) {
    return inferRefs(binding) ?? inferInit(idPath.parentPath.node.init) ?? "temp";
  }
  return inferRefs(binding) ?? "temp";
}

function allocate(base, usedNames, counters) {
  let cleaned = cleanBase(base, "temp");
  if (RESERVED.has(cleaned) || WEAK.test(cleaned)) cleaned = `${cleaned}Value`;
  // Avoid bare names that become mechanical when digits are appended (item2, values3, …).
  if (!usedNames.has(cleaned) && !WEAK.test(cleaned)) {
    usedNames.add(cleaned);
    return cleaned;
  }
  let i = counters.get(cleaned) ?? 2;
  let name = `${cleaned}_${i}`;
  while (usedNames.has(name) || WEAK.test(name)) {
    i += 1;
    name = `${cleaned}_${i}`;
  }
  counters.set(cleaned, i + 1);
  usedNames.add(name);
  return name;
}

function functionRootPath(binding) {
  return binding.path.getFunctionParent() ?? binding.path.findParent((p) => p.isProgram());
}

function renameLVal(node, oldName, next) {
  if (!node) return;
  if (t.isIdentifier(node)) {
    if (node.name === oldName) node.name = next;
    return;
  }
  if (t.isAllocationExpression?.(node)) return;
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) return;
  if (t.isAssignmentPattern(node)) {
    renameLVal(node.left, oldName, next);
    return;
  }
  if (t.isRestElement(node)) {
    renameLVal(node.argument, oldName, next);
    return;
  }
  if (t.isArrayPattern(node)) {
    for (const element of node.elements) renameLVal(element, oldName, next);
    return;
  }
  if (t.isObjectPattern(node)) {
    for (const prop of node.properties) {
      if (t.isRestElement(prop)) renameLVal(prop.argument, oldName, next);
      else if (t.isObjectProperty(prop)) renameLVal(prop.value, oldName, next);
    }
  }
}

function applyRename(binding, next) {
  const oldName = binding.identifier.name;
  binding.identifier.name = next;
  for (const ref of binding.referencePaths) {
    if (ref.node?.type === "Identifier") ref.node.name = next;
  }
  for (const violation of binding.constantViolations) {
    if (violation.isAssignmentExpression()) {
      renameLVal(violation.node.left, oldName, next);
    } else if (violation.isUpdateExpression() && t.isIdentifier(violation.node.argument)) {
      if (violation.node.argument.name === oldName || violation.node.argument.name === next) {
        violation.node.argument.name = next;
      }
    } else if (violation.isVariableDeclarator?.()) {
      renameLVal(violation.node.id, oldName, next);
    } else {
      // ForFor* and other LHS forms
      renameLVal(violation.node.left ?? violation.node.id ?? violation.node, oldName, next);
    }
  }
}

const t0 = Date.now();
process.stderr.write(`parse ${inputPath}\n`);
const source = fs.readFileSync(inputPath, "utf8");
const ast = parser.parse(source, { sourceType: "module" });

// Collect renames first (do not mutate during collection), then apply.
const pending = [];
const seenBindings = new Set();

traverse(ast, {
  Program(programPath) {
    for (const [from, to] of Object.entries(TOP)) {
      const binding = programPath.scope.bindings[from];
      if (binding && !seenBindings.has(binding)) {
        seenBindings.add(binding);
        pending.push([binding, to]);
      }
    }
  },
  Scopable: {
    exit(scopePath) {
      const names = Object.keys(scopePath.scope.bindings).filter((n) => WEAK.test(n));
      names.sort((a, b) => {
        const ba = scopePath.scope.bindings[a];
        const bb = scopePath.scope.bindings[b];
        const ra = ba.kind === "param" || ba.path.parentPath?.isCatchClause() ? 0 : 1;
        const rb = bb.kind === "param" || bb.path.parentPath?.isCatchClause() ? 0 : 1;
        return ra - rb || a.localeCompare(b);
      });
      for (const name of names) {
        const binding = scopePath.scope.bindings[name];
        if (seenBindings.has(binding)) continue;
        seenBindings.add(binding);
        pending.push([binding, null]);
      }
    },
  },
});

process.stderr.write(`collected ${pending.length} bindings in ${Date.now() - t0}ms\n`);

// Per-function taken names: reuse config/error/packet across functions; unique inside one function.
const poolByRoot = new WeakMap();
const MODULE_NAMES = new Set(Object.values(TOP));
traverse(ast, {
  Program(path) {
    for (const name of Object.keys(path.scope.bindings)) {
      if (!WEAK.test(name)) MODULE_NAMES.add(name);
    }
  },
});

function poolFor(binding) {
  const root = functionRootPath(binding);
  const key = root ?? binding.scope;
  if (!poolByRoot.has(key)) {
    const usedNames = new Set([...RESERVED, ...MODULE_NAMES]);
    const counters = new Map();
    if (root) {
      const seedScope = (scope) => {
        for (const name of Object.keys(scope.bindings)) {
          if (!WEAK.test(name)) usedNames.add(name);
        }
      };
      seedScope(root.scope);
      root.traverse({
        Function(path) {
          if (path !== root) path.skip();
        },
        Scopable(path) {
          if (path.isFunction() && path !== root) return;
          seedScope(path.scope);
        },
      });
    }
    poolByRoot.set(key, { usedNames, counters });
  }
  return poolByRoot.get(key);
}

let renamed = 0;
function renameEntry(binding, preset) {
  if (!preset && !WEAK.test(binding.identifier.name)) return;
  const pool = poolFor(binding);
  const next = preset ?? allocate(inferBinding(binding), pool.usedNames, pool.counters);
  if (binding.identifier.name === next) {
    pool.usedNames.add(next);
    return;
  }
  applyRename(binding, next);
  pool.usedNames.add(next);
  renamed += 1;
}

for (const [binding, preset] of pending) {
  if (preset || binding.kind === "param" || binding.path.parentPath?.isCatchClause()) {
    renameEntry(binding, preset);
  }
}
for (const [binding, preset] of pending) {
  if (!(preset || binding.kind === "param" || binding.path.parentPath?.isCatchClause())) {
    renameEntry(binding, preset);
  }
}
process.stderr.write(`  renamed ${renamed}\n`);

process.stderr.write(`renamed ${renamed} in ${Date.now() - t0}ms, generate...\n`);
const output = generate(ast, { comments: true, compact: false, jsescOption: { minimal: true } }, source).code;
fs.writeFileSync(outputPath, output.endsWith("\n") ? output : `${output}\n`, "utf8");
const remaining = output.match(/\b(?:arg|value|item|items|story|target|config|error|field|loginInfo|foodInventory|bathInventory|values)\d+\b/g) ?? [];
process.stdout.write(JSON.stringify({
  renamed,
  ms: Date.now() - t0,
  remainingMechanical: remaining.length,
  remainingUnique: [...new Set(remaining)].slice(0, 15),
}, null, 2) + "\n");
