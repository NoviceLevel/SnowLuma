import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const sourcePath = path.resolve(process.argv[2] ?? "index.mjs");
const npxCache = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData/Local"), "npm-cache", "_npx");
const webcrackPackage = fs.readdirSync(npxCache, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(npxCache, entry.name, "node_modules", "webcrack", "package.json"))
  .find(candidate => fs.existsSync(candidate));

if (!webcrackPackage) {
  throw new Error("webcrack is not available in the local npm cache");
}

const require = createRequire(webcrackPackage);
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const renames = {
  _0x76eee6: "fs",
  _0x342875: "os",
  _0x1845f8: "path",
  _0x33bce7: "readline",
  _0x3a867d: "fileURLToPath",
  _0x579f67: "http",
  _0x2bd5f3: "DEFAULT_CONFIG_VALUES",
  R: "DEFAULT_CONFIG",
  xt: "NUMERIC_CONFIG_KEYS",
  G: "normalizeConfig",
  kt: "isAutoPetId",
  K: "EMPTY_DAILY_COUNTS",
  gt: "currentDateKey",
  Z: "createDailyProgress",
  Ot: "ProgressStore",
  S: "concatBytes",
  F: "encodeVarint",
  g: "encodeVarintField",
  P: "encodeBytesField",
  m: "encodeStringField",
  j: "decodeVarint",
  p: "parseProtobufFields",
  M: "getProtobufFields",
  y: "getVarintField",
  x: "getBytesField",
  d: "getStringField",
  q: "getFloatField",
  rt: "buildPacketEnvelope",
  Dt: "bytesToHex",
  qt: "hexToBytes",
  E: "QQPetError",
  f: "PACKETS",
  Gt: "QQPetApi",
  ct: "delaySeconds",
  z: "ATTRIBUTE_ROTATION",
  Kt: "AutomationController",
  _0x137b50: "INITIAL_CONFIG",
  _0x127f0b: "EMPTY_ACCOUNT_STATUS",
  _0x2f88cc: "INITIAL_STATUS_CONFIG",
  _0x32769a: "INITIAL_STATUS",
  Yt: "QQPetPlugin",
  mt: "RuntimeAdapter",
  Xt: "NapCatRuntimeAdapter",
  Zt: "SnowLumaRuntimeAdapter",
  te: "detectRuntimeKind",
  ee: "createRuntimeAdapter",
  se: "DEFAULT_LOG_MAX_BYTES",
  ie: "DEFAULT_LOG_BACKUPS",
  dt: "MAX_LOG_ERROR_LENGTH",
  W: "formatLogError",
  ne: "createLogger",
  L: "OneBotError",
  re: "normalizeOneBotUrl",
  oe: "OneBotHttpClient",
  ae: "MAX_REQUEST_BODY_BYTES",
  ce: "CONTENT_TYPES",
  O: "sendJson",
  pt: "readJsonBody",
  ue: "serveStaticFile",
  le: "renderIndexHtml",
  he: "createWebServer",
  ft: "pluginDir",
  de: "parsePort",
  Y: "isDesktopMode",
  J: "sendDesktopEvent",
  pe: "normalizeWebHost",
  fe: "main"
};

const localRenames = {
  _0x2629d2: "input",
  _0x2ead40: "normalized",
  _0x5738c3: "config",
  _0x3fb59c: "source",
  _0x463b69: "key",
  _0x32f9ac: "value",
  _0x663cbf: "numericKey",
  _0x133431: "numericValue",
  _0x5cf915: "client",
  _0x5e056a: "requestedKind",
  _0xf70aa5: "version",
  _0x55d091: "detectedKind",
  _0x5ce9ca: "runtimeKind",
  _0x3ec5da: "value",
  _0x2b09e0: "url",
  _0x1761ff: "options",
  _0x46a45b: "fetchImpl",
  _0x241433: "action",
  _0x475360: "params",
  _0x3b5c5d: "headers",
  _0x285409: "response",
  _0x5ecd45: "error",
  _0x3cbf13: "message",
  _0x425c4e: "payload",
  _0x522193: "retcode",
  _0x5ee346: "wording",
  _0x5c897c: "dataDir",
  _0x567d9b: "options",
  _0x4b3546: "logDir",
  _0x4e02fe: "logPath",
  _0x1a4ba7: "maxBytes",
  _0x73d926: "backups",
  _0x388adf: "now",
  _0x3cbcb8: "writeFailureReported",
  _0x345069: "error",
  _0x54d139: "message",
  _0x2ea512: "response",
  _0x511290: "statusCode",
  _0x4ebcf6: "payload",
  _0x168992: "body",
  _0x41b984: "request",
  _0x424271: "chunks",
  _0x236cc8: "totalBytes",
  _0x12cd42: "chunk",
  _0x285fa: "buffer",
  _0x4be17e: "response",
  _0x3359a9: "filePath",
  _0x2c8242: "stat",
  _0x31246a: "webuiPath",
  _0x4fc8c7: "runtimeName",
  _0x4a4fce: "appMtime",
  _0x488169: "plugin",
  _0x398893: "options",
  _0x2d636d: "indexHtml",
  _0x38570d: "request",
  _0x4c31d7: "response",
  _0x47f19a: "method",
  _0x28197a: "url",
  _0x46bb35: "assetPath",
  _0xee504d: "envName",
  _0x2f580a: "defaultPort",
  _0x39d75f: "allowZero",
  _0x39438f: "port",
  _0x58e413: "minimum",
  _0x2489c8: "event",
  _0x1dad80: "host",
  _0x24b0bf: "normalizedHost",
  _0x357f5e: "oneBotUrl",
  _0x164999: "requestedRuntime",
  _0xf66803: "oneBotClient",
  _0x28ea56: "runtime",
  _0x2a6599: "loginInfo",
  _0x5bb904: "uin",
  _0x22384a: "dataRoot",
  _0x5b075c: "accountDataDir",
  _0xaa2f6e: "logger",
  _0x612fbc: "pluginContext",
  _0x31870e: "action",
  _0x59a377: "params",
  _0x37d1d8: "plugin",
  _0x1421a4: "webHost",
  _0x10310f: "webPort",
  _0x21d8fd: "webuiPath",
  _0x157b02: "server",
  _0x3c3aca: "resolve",
  _0x54e976: "reject",
  _0x131bed: "actualPort",
  _0x30282d: "webUrl",
  _0x26d595: "stopping",
  _0x327ecc: "shutdown",
  _0xb0f7f4: "error",
  _0x4e17c7: "message"
};

const source = fs.readFileSync(sourcePath, "utf8");
const ast = parser.parse(source, { sourceType: "module" });

const allRenames = { ...renames, ...localRenames };

traverse(ast, {
  Scopable(scopePath) {
    for (const from of Object.keys(scopePath.scope.bindings)) {
      const to = allRenames[from];
      if (to && !scopePath.scope.hasOwnBinding(to)) {
        scopePath.scope.rename(from, to);
      }
    }
  },
  UnaryExpression(expressionPath) {
    const { node } = expressionPath;
    if (node.operator === "!" && node.argument.type === "NumericLiteral" && (node.argument.value === 0 || node.argument.value === 1)) {
      expressionPath.replaceWith({ type: "BooleanLiteral", value: node.argument.value === 0 });
    }
  }
});

const output = generate(ast, { comments: true, jsescOption: { minimal: true } }, source).code + "\n";
fs.writeFileSync(sourcePath, output, "utf8");
