/* Miku QQ Pet readable runtime, reconstructed from the upstream release build. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import http from "node:http";
const DEFAULT_CONFIG_VALUES = {
  enabled: true,
  autoStart: true,
  safeMode: false,
  petId: "AUTO",
  intervalSeconds: 15,
  statusRefreshSeconds: 15,
  coinThreshold: 500,
  taskPriority: "school",
  fatigue8HourAction: "rest",
  fatigue12HourAction: "rest",
  careEnabled: true,
  hungerThreshold: 80,
  cleanThreshold: 80,
  autoBuySupplies: true,
  foodPurchaseCount: 10,
  bathPurchaseCount: 10,
  verifyDelaySeconds: 1,
  failureCooldownSeconds: 3600,
  schoolEnabled: true,
  schoolAttribute: "physical",
  schoolRotationEnabled: true,
  schoolRotationEvery: 1,
  courseSubEvent: 0,
  visitEnabled: true,
  visitFriends: true,
  visitStrangers: true,
  visitAutoCare: true,
  visitMaxPerDay: 10,
  visitDelayMinMinutes: 30,
  visitDelayMaxMinutes: 30,
  otherCareDailyExperienceLimit: 0,
  visitCandidateScanLimit: 30,
  visitStrangerGroupIds: "",
  workEnabled: true,
  workCareerType: 0,
  workJobSubEvent: 0,
  workTimesPerDay: 0,
  employFriend: true,
  workFriendScanLimit: 10,
  adventureEnabled: true,
  adventureOption: "",
  adventureStartTime: "20:00",
  adventureTimesPerDay: 3,
  settleRetrySeconds: 60,
  startConfirmSeconds: 45
};
const DEFAULT_CONFIG = DEFAULT_CONFIG_VALUES;
const NUMERIC_CONFIG_KEYS = ["intervalSeconds", "statusRefreshSeconds", "coinThreshold", "hungerThreshold", "cleanThreshold", "foodPurchaseCount", "bathPurchaseCount", "verifyDelaySeconds", "failureCooldownSeconds", "schoolRotationEvery", "courseSubEvent", "visitMaxPerDay", "visitDelayMinMinutes", "visitDelayMaxMinutes", "otherCareDailyExperienceLimit", "visitCandidateScanLimit", "workCareerType", "workJobSubEvent", "workTimesPerDay", "workFriendScanLimit", "adventureTimesPerDay", "settleRetrySeconds", "startConfirmSeconds"];
function normalizeConfig(input) {
  const normalized = {
    ...DEFAULT_CONFIG
  };
  const config = normalized;
  if (!input || typeof input != "object" || Array.isArray(input)) {
    return config;
  }
  const source = input;
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const value = source[key];
    if (typeof DEFAULT_CONFIG[key] == typeof value) {
      config[key] = value;
    }
  }
  for (const numericKey of NUMERIC_CONFIG_KEYS) {
    const numericValue = Number(source[numericKey] ?? config[numericKey]);
    if (Number.isFinite(numericValue)) {
      config[numericKey] = Math.max(0, numericValue);
    }
  }
  if (!["culture", "physical", "art"].includes(config.schoolAttribute)) {
    config.schoolAttribute = "physical";
  }
  if (!["school", "work"].includes(config.taskPriority)) {
    config.taskPriority = "school";
  }
  if (!["rest", "work", "school", "adventure"].includes(config.fatigue8HourAction)) {
    config.fatigue8HourAction = "rest";
  }
  if (!["rest", "work", "school", "adventure"].includes(config.fatigue12HourAction)) {
    config.fatigue12HourAction = "rest";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.adventureStartTime)) {
    config.adventureStartTime = "20:00";
  }
  config.intervalSeconds = Math.max(3, Math.min(300, Math.trunc(config.intervalSeconds)));
  config.statusRefreshSeconds = config.intervalSeconds;
  config.foodPurchaseCount = Math.max(1, Math.trunc(config.foodPurchaseCount));
  config.bathPurchaseCount = Math.max(1, Math.trunc(config.bathPurchaseCount));
  config.schoolRotationEvery = Math.max(1, Math.trunc(config.schoolRotationEvery));
  config.visitDelayMinMinutes = Math.trunc(config.visitDelayMinMinutes);
  config.visitDelayMaxMinutes = Math.max(config.visitDelayMinMinutes, Math.trunc(config.visitDelayMaxMinutes));
  config.otherCareDailyExperienceLimit = Math.trunc(config.otherCareDailyExperienceLimit);
  config.visitCandidateScanLimit = Math.max(1, Math.min(200, Math.trunc(config.visitCandidateScanLimit)));
  config.workFriendScanLimit = Math.max(1, Math.min(200, Math.trunc(config.workFriendScanLimit)));
  return config;
}
function isAutoPetId(arg1) {
  return ["", "AUTO", "YOUR_PET_ID"].includes(String(arg1 ?? "").trim().toUpperCase());
}
const EMPTY_DAILY_COUNTS = {
  school: 0,
  work: 0,
  adventure: 0,
  employed: 0,
  feed: 0,
  wash: 0,
  visitFriend: 0,
  visitStranger: 0,
  careOther: 0
};
function currentDateKey() {
  const value2 = new Date();
  return value2.getFullYear() + "-" + String(value2.getMonth() + 1).padStart(2, "0") + "-" + String(value2.getDate()).padStart(2, "0");
}
function createDailyProgress() {
  const value3 = {
    ...EMPTY_DAILY_COUNTS
  };
  return {
    date: currentDateKey(),
    counts: value3,
    history: [],
    pending: null,
    careBlocks: {},
    settledStoryIds: [],
    dismissedStoryIds: [],
    schoolRotationIndex: 0,
    schoolRotationProgress: 0,
    visitedTargetIds: [],
    attributeBaseline: null,
    dailyExperienceGain: 0
  };
}
class ProgressStore {
  constructor(arg12) {
    const value8 = {
      recursive: true
    };
    this.filePath = arg12;
    fs.mkdirSync(path.dirname(arg12), value8);
    try {
      const value4 = JSON.parse(fs.readFileSync(arg12, "utf8"));
      const {
        pendingReturnVisits: value5,
        ...value6
      } = value4;
      const value7 = {
        ...(value6.counts ?? {})
      };
      delete value7.returnVisit;
      this.state = {
        ...createDailyProgress(),
        ...value6,
        counts: {
          ...EMPTY_DAILY_COUNTS,
          ...value7
        },
        careBlocks: value6.careBlocks ?? {},
        settledStoryIds: value6.settledStoryIds ?? [],
        dismissedStoryIds: value6.dismissedStoryIds ?? [],
        schoolRotationIndex: Math.max(0, Math.trunc(Number(value6.schoolRotationIndex) || 0)),
        schoolRotationProgress: Math.max(0, Math.trunc(Number(value6.schoolRotationProgress) || 0)),
        visitedTargetIds: Array.isArray(value6.visitedTargetIds) ? value6.visitedTargetIds.map(String).slice(-500) : [],
        attributeBaseline: value6.attributeBaseline && typeof value6.attributeBaseline == "object" ? {
          strength: Math.max(0, Number(value6.attributeBaseline.strength) || 0),
          intelligence: Math.max(0, Number(value6.attributeBaseline.intelligence) || 0),
          charm: Math.max(0, Number(value6.attributeBaseline.charm) || 0)
        } : null,
        dailyExperienceGain: Math.max(0, Math.trunc(Number(value6.dailyExperienceGain) || 0))
      };
    } catch {
      this.state = createDailyProgress();
    }
    this.rollover();
    this.save();
  }
  state;
  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2) + "\n", "utf8");
  }
  rollover(arg13 = currentDateKey()) {
    if (this.state.date === arg13) {
      return false;
    } else {
      this.state.history.push({
        date: this.state.date,
        counts: {
          ...this.state.counts
        },
        pending: this.state.pending
      });
      this.state.history = this.state.history.slice(-30);
      this.state = {
        ...this.state,
        date: arg13,
        counts: {
          ...EMPTY_DAILY_COUNTS
        },
        pending: null,
        careBlocks: {},
        visitedTargetIds: [],
        attributeBaseline: null,
        dailyExperienceGain: 0
      };
      this.save();
      return true;
    }
  }
  snapshot() {
    this.rollover();
    return structuredClone(this.state);
  }
  count(arg14) {
    return this.snapshot().counts[arg14] ?? 0;
  }
  increment(arg15) {
    this.rollover();
    this.state.counts[arg15] = (this.state.counts[arg15] ?? 0) + 1;
    this.save();
    return this.state.counts[arg15];
  }
  advanceSchoolRotation(arg16) {
    this.increment("school");
    this.state.schoolRotationProgress += 1;
    if (this.state.schoolRotationProgress >= Math.max(1, Math.trunc(arg16))) {
      this.state.schoolRotationIndex = (this.state.schoolRotationIndex + 1) % 3;
      this.state.schoolRotationProgress = 0;
    }
    this.save();
    return this.state.schoolRotationIndex;
  }
  setPending(arg17, arg2 = "") {
    this.state.pending = {
      kind: arg17,
      createdAt: new Date().toISOString(),
      confirmed: !!arg2,
      storyId: arg2
    };
    this.save();
  }
  confirmPending(arg18) {
    if (this.state.pending) {
      this.state.pending.confirmed = true;
      this.state.pending.storyId = arg18;
      delete this.state.pending.missingSince;
      this.save();
    }
  }
  markPendingSeen() {
    if (this.state.pending?.missingSince) {
      delete this.state.pending.missingSince;
      this.save();
    }
  }
  markPendingMissing() {
    if (this.state.pending) {
      if (!this.state.pending.missingSince) {
        this.state.pending.missingSince = new Date().toISOString();
        this.save();
      }
      return this.state.pending.missingSince;
    } else {
      return null;
    }
  }
  clearPending() {
    const value9 = this.state.pending;
    this.state.pending = null;
    this.save();
    return value9;
  }
  storyWasSettled(arg19) {
    return this.state.settledStoryIds.includes(arg19);
  }
  markStorySettled(arg110) {
    if (!this.state.settledStoryIds.includes(arg110)) {
      this.state.settledStoryIds.push(arg110);
      this.state.settledStoryIds = this.state.settledStoryIds.slice(-100);
      this.save();
    }
  }
  storyWasDismissed(arg111) {
    return this.state.dismissedStoryIds.includes(arg111);
  }
  dismissStory(arg112) {
    if (!this.state.dismissedStoryIds.includes(arg112)) {
      this.state.dismissedStoryIds.push(arg112);
      this.state.dismissedStoryIds = this.state.dismissedStoryIds.slice(-100);
      this.save();
    }
  }
  setBlock(arg113, arg22, arg3) {
    this.state.careBlocks[arg113] = {
      reason: arg22,
      until: Date.now() / 1000 + Math.max(0, arg3)
    };
    this.save();
  }
  activeBlock(arg114) {
    const value10 = this.state.careBlocks[arg114];
    if (value10) {
      if (value10.until <= Date.now() / 1000) {
        delete this.state.careBlocks[arg114];
        this.save();
        return null;
      } else {
        return {
          ...value10
        };
      }
    } else {
      return null;
    }
  }
  clearBlock(arg115) {
    if (this.state.careBlocks[arg115]) {
      delete this.state.careBlocks[arg115];
      this.save();
    }
  }
  targetWasVisited(arg116) {
    return this.snapshot().visitedTargetIds.includes(arg116);
  }
  markTargetVisited(arg117) {
    if (!this.state.visitedTargetIds.includes(arg117)) {
      this.state.visitedTargetIds.push(arg117);
      this.state.visitedTargetIds = this.state.visitedTargetIds.slice(-500);
      this.save();
    }
  }
  recordAttributes(arg118) {
    this.rollover();
    const value13 = {
      strength: Math.max(0, Number(arg118.strength) || 0),
      intelligence: Math.max(0, Number(arg118.intelligence) || 0),
      charm: Math.max(0, Number(arg118.charm) || 0)
    };
    if (!this.state.attributeBaseline) {
      this.state.attributeBaseline = value13;
      this.state.dailyExperienceGain = 0;
    } else {
      const value11 = this.state.attributeBaseline;
      const value12 = ["strength", "intelligence", "charm"];
      if (value12.every(item2 => value13[item2] < value11[item2])) {
        this.state.attributeBaseline = value13;
        this.state.dailyExperienceGain = 0;
      } else {
        this.state.dailyExperienceGain = value12.reduce((accumulator, item3) => accumulator + Math.max(0, value13[item3] - value11[item3]), 0);
      }
    }
    this.save();
    return this.state.dailyExperienceGain;
  }
}
const tt = 16384;
const Mt = 16384;
const Pt = 8000;
const At = 120000;
const Ct = 600000;
const et = 15000;
const st = [15000, 30000, 60000, 120000];
function concatBytes(...arg119) {
  const value14 = arg119.reduce((accumulator2, item4) => accumulator2 + item4.length, 0);
  const value15 = new Uint8Array(value14);
  let value16 = 0;
  for (const items of arg119) {
    value15.set(items, value16);
    value16 += items.length;
  }
  return value15;
}
function encodeVarint(arg120) {
  if (!Number.isSafeInteger(arg120)) {
    throw new Error("varint 不是安全整数: " + arg120);
  }
  let value18 = arg120 < 0 ? BigInt.asUintN(64, BigInt(arg120)) : BigInt(arg120);
  const items2 = [];
  do {
    const value17 = Number(value18 & 0x7fn);
    value18 >>= 0x7n;
    items2.push(value17 | (value18 ? 128 : 0));
  } while (value18);
  return Uint8Array.from(items2);
}
function encodeVarintField(arg121, arg23) {
  return concatBytes(encodeVarint(arg121 << 3), encodeVarint(arg23));
}
function encodeBytesField(arg122, items3) {
  return concatBytes(encodeVarint(arg122 << 3 | 2), encodeVarint(items3.length), items3);
}
function encodeStringField(arg123, arg24) {
  return encodeBytesField(arg123, new TextEncoder().encode(arg24));
}
function decodeVarint(items4, arg25) {
  let value21 = arg25;
  let value22 = 0x0n;
  let value23 = 0x0n;
  while (value21 < items4.length) {
    const value20 = items4[value21++];
    value22 |= BigInt(value20 & 127) << value23;
    if ((value20 & 128) === 0) {
      const value19 = Number(value22);
      if (!Number.isSafeInteger(value19)) {
        throw new Error("protobuf varint 超出安全整数范围");
      }
      return [value19, value21];
    }
    value23 += 0x7n;
    if (value23 > 0x46n) {
      throw new Error("protobuf varint 太长");
    }
  }
  throw new Error("protobuf varint 被截断");
}
function parseProtobufFields(items6) {
  const value30 = new Map();
  let value31 = 0;
  while (value31 < items6.length) {
    let value25;
    [value25, value31] = decodeVarint(items6, value31);
    const value26 = value25 >>> 3;
    const value27 = value25 & 7;
    if (!value26) {
      throw new Error("protobuf 字段号为 0");
    }
    let value28;
    if (value27 === 0) {
      [value28, value31] = decodeVarint(items6, value31);
    } else if (value27 === 1) {
      if (value31 + 8 > items6.length) {
        throw new Error("fixed64 被截断");
      }
      value28 = items6.slice(value31, value31 + 8);
      value31 += 8;
    } else if (value27 === 2) {
      let value24;
      [value24, value31] = decodeVarint(items6, value31);
      if (value31 + value24 > items6.length) {
        throw new Error("length-delimited 字段被截断");
      }
      value28 = items6.slice(value31, value31 + value24);
      value31 += value24;
    } else if (value27 === 5) {
      if (value31 + 4 > items6.length) {
        throw new Error("fixed32 被截断");
      }
      value28 = items6.slice(value31, value31 + 4);
      value31 += 4;
    } else {
      throw new Error("暂不支持 protobuf wire type " + value27);
    }
    const items5 = value30.get(value26) ?? [];
    const value29 = {
      wireType: value27,
      value: value28
    };
    items5.push(value29);
    value30.set(value26, items5);
  }
  return value30;
}
function getProtobufFields(arg124, arg26) {
  return arg124.get(arg26) ?? [];
}
function getVarintField(arg125, arg27, arg32 = 0) {
  const field = arg125.get(arg27)?.[0];
  if (field?.wireType === 0) {
    return Number(field.value);
  } else {
    return arg32;
  }
}
function getBytesField(arg126, arg28) {
  const field2 = arg126.get(arg28)?.[0];
  if (field2?.wireType === 2) {
    return field2.value;
  } else {
    return new Uint8Array();
  }
}
function getStringField(arg127, arg29, arg33 = "") {
  const items7 = getBytesField(arg127, arg29);
  if (items7.length) {
    return new TextDecoder().decode(items7);
  } else {
    return arg33;
  }
}
function getFloatField(arg128, arg210, arg34 = 0) {
  const field3 = arg128.get(arg210)?.[0];
  if (field3?.wireType !== 5) {
    return arg34;
  }
  const value32 = field3.value;
  return new DataView(value32.buffer, value32.byteOffset, 4).getFloat32(0, true);
}
function buildPacketEnvelope(arg129, arg211, arg35) {
  return concatBytes(encodeVarintField(1, arg129), encodeVarintField(2, arg211), encodeBytesField(4, arg35), encodeVarintField(12, 1));
}
function bytesToHex(arg130) {
  return Buffer.from(arg130).toString("hex");
}
function hexToBytes(arg131) {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(arg131)) {
    throw new Error("响应不是有效十六进制");
  }
  return new Uint8Array(Buffer.from(arg131, "hex"));
}
class QQPetError extends Error {
  constructor(arg132, arg212 = "") {
    super(arg132);
    this.code = arg212;
  }
}
function isCareerRequirementError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /135061|\u4f60\u7684\u5ba0\u7269\u8fd8\u672a\u8fbe\u5230\u8be5\u804c\u4e1a\u53c2\u4e0e\u8981\u6c42/.test(message);
}
const PACKETS = {
  ownProfile: ["trpc.qqone.gateway.Gateway.Sso_QQpet_GetProfile", 39410, 1],
  ownPetCache: ["OidbSvcTrpcTcp.0x95e1_0", 38369, 0],
  display: ["OidbSvcTrpcTcp.0x96f2_1", 38642, 1],
  feed: ["OidbSvcTrpcTcp.0x992d_1", 39213, 1],
  feedInventory: ["OidbSvcTrpcTcp.0x9949_1", 39241, 1],
  buyFood: ["OidbSvcTrpcTcp.0x99df_1", 39391, 1],
  bathItems: ["OidbSvcTrpcTcp.0x9bf1_1", 39921, 1],
  bathInventory: ["OidbSvcTrpcTcp.0x9bf2_1", 39922, 1],
  useBathItem: ["OidbSvcTrpcTcp.0x9bf3_1", 39923, 1],
  buyBathItem: ["OidbSvcTrpcTcp.0x9bd0_0", 39888, 0],
  pageRules: ["OidbSvcTrpcTcp.0x96a4_1", 38564, 1],
  storyStatus: ["OidbSvcTrpcTcp.0x975a_1", 38746, 1],
  storySettle: ["OidbSvcTrpcTcp.0x9760_1", 38752, 1],
  overview: ["OidbSvcTrpcTcp.0x9b60_1", 39776, 1],
  catalog: ["OidbSvcTrpcTcp.0x9ab2_1", 39602, 1],
  startStory: ["OidbSvcTrpcTcp.0x975e_1", 38750, 1],
  otherPet: ["OidbSvcTrpcTcp.0x976c_0", 38764, 0],
  reportEvent: ["OidbSvcTrpcTcp.0x96a6_1", 38566, 1],
  medalGallery: ["OidbSvcTrpcTcp.0x9ac3_0", 39619, 0],
  interactionHistory: ["OidbSvcTrpcTcp.0x994d_1", 39245, 1]
};
function yt(arg133) {
  if (typeof arg133 == "string") {
    return arg133;
  }
  if (!arg133 || typeof arg133 != "object") {
    return "";
  }
  const value36 = arg133;
  for (const value35 of ["data", "packet", "hex"]) {
    const value33 = value36[value35];
    if (typeof value33 == "string" && /^(?:[0-9a-fA-F]{2})+$/.test(value33)) {
      return value33;
    }
    const value34 = yt(value33);
    if (value34) {
      return value34;
    }
  }
  return "";
}
function V(arg134) {
  const value37 = "(\\d+(?:\\.\\d+)?)";
  const value38 = arg134.match(new RegExp("(?:总收益|合计|总计)\\D*" + value37))?.[1];
  const value39 = arg134.match(new RegExp("金币\\D*" + value37))?.[1];
  const value40 = arg134.match(new RegExp(value37))?.[1];
  return Number(value38 ?? value39 ?? value40 ?? 0);
}
function _(...arg135) {
  for (const value42 of arg135) {
    const value41 = value42.match(/https:\/\/[^\s\])]+\.(?:png|webp|jpe?g|gif)/i)?.[0];
    if (value41) {
      return value41;
    }
  }
  return "";
}
function Vt(arg136) {
  return arg136.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function ot(arg137, arg213 = true, arg36) {
  const value43 = parseProtobufFields(arg137);
  return {
    id: getVarintField(value43, 1),
    name: getStringField(value43, 2),
    progress: getStringField(value43, 3),
    acquired: arg213,
    category: getStringField(value43, 5),
    imageUrl: _(getStringField(value43, 7)),
    requirement: getStringField(value43, 8),
    description: getStringField(value43, 9),
    ...(arg36 === undefined ? {} : {
      equipped: arg36
    })
  };
}
function Qt(arg138) {
  try {
    const items8 = JSON.parse(arg138);
    if (Array.isArray(items8)) {
      const value45 = items8.map(item5 => {
        if (!item5 || typeof item5 != "object") {
          return "";
        }
        const value44 = item5.text;
        if (typeof value44 == "string") {
          return value44;
        } else {
          return "";
        }
      }).join("").trim();
      if (value45) {
        return value45.replace(/^\d{1,2}:\d{2}\s*/, "");
      }
    }
  } catch {}
  return arg138.trim();
}
function H(arg139, arg214 = {}) {
  const value46 = parseProtobufFields(arg139);
  const value47 = Vt(getStringField(value46, 8));
  return {
    name: getStringField(value46, 1),
    subEventType: getVarintField(value46, 52),
    cost: getStringField(value46, 6),
    duration: getStringField(value46, 7),
    reward: arg214.careerType && /^\d+(?:\.\d+)?$/.test(value47) ? "金币 " + value47 : value47,
    description: getStringField(value46, 10) || getStringField(value46, 14),
    canDo: !!getVarintField(value46, 50),
    unavailableReason: getStringField(value46, 51),
    warning: getStringField(value46, 17),
    iconUrl: _(getStringField(value46, 2)),
    rewardIconUrl: _(getStringField(value46, 8), getStringField(value46, 12), getStringField(value46, 6)),
    ...arg214
  };
}
function Q(arg140) {
  const value48 = Number(arg140.match(/(\d+)\s*小时/)?.[1] ?? 0);
  const value49 = Number(arg140.match(/(\d+)\s*分钟/)?.[1] ?? 0);
  const value50 = Number(arg140.match(/(\d+)\s*秒/)?.[1] ?? 0);
  return value48 * 3600 + value49 * 60 + value50;
}
function at(arg141, arg215) {
  const value52 = Q(arg141.duration);
  const value53 = Q(arg215.duration);
  const value54 = V(arg141.reward);
  const value55 = V(arg215.reward);
  if (value52 > 0 && value53 > 0) {
    const value51 = value55 * value52 - value54 * value53;
    if (value51) {
      return value51;
    }
  } else if (value52 !== value53) {
    if (value52 > 0) {
      return -1;
    } else {
      return 1;
    }
  }
  return value55 - value54;
}
function Ut(arg142) {
  let value56 = arg142.trim();
  const value57 = arg142.match(/[?&]text=([^)&\s]+)/)?.[1];
  if (value57) {
    try {
      value56 = decodeURIComponent(value57);
    } catch {}
  }
  const value58 = arg142 + "\n" + value56;
  const value59 = {
    fatigued: true,
    tier: 12,
    benefitRate: 0.1,
    reason: value56 || "服务器提示已超过 12 小时"
  };
  const value60 = {
    fatigued: true,
    tier: 8,
    benefitRate: 0.25,
    reason: value56 || "服务器提示已超过 8 小时"
  };
  const value61 = {
    fatigued: false,
    tier: 0,
    benefitRate: 1,
    reason: "服务器当前未返回疲劳提示"
  };
  if (/非常累|超出\s*12\s*小时|降低至\s*10%/.test(value58)) {
    return value59;
  } else if (/疲惫|超出\s*8\s*小时|收益减少|降低至\s*25%/.test(value58)) {
    return value60;
  } else {
    return value61;
  }
}
class QQPetApi {
  constructor(arg143, arg216) {
    this.ctx = arg143;
    this.petId = arg216;
  }
  otherPetMobileAvailable = null;
  async sendPacket(arg144, arg217) {
    const [value64] = arg144;
    let value65;
    try {
      value65 = await this.ctx.actions.call("send_packet", {
        cmd: value64,
        data: bytesToHex(arg217)
      }, this.ctx.adapterName, this.ctx.pluginManager.config);
    } catch (value62) {
      throw new QQPetError("OneBot send_packet 失败：" + String(value62));
    }
    const value66 = yt(value65);
    if (!value66) {
      throw new QQPetError(value64 + " 返回空响应或未知响应结构");
    }
    try {
      return hexToBytes(value66);
    } catch (value63) {
      throw new QQPetError(value64 + " 响应无法解析：" + String(value63));
    }
  }
  async sendOidb(arg145, arg218) {
    const [value67, value68, value69] = arg145;
    const value70 = await this.sendPacket(arg145, buildPacketEnvelope(value68, value69, arg218));
    const value71 = parseProtobufFields(value70);
    const value72 = getVarintField(value71, 1) === value68 && getVarintField(value71, 2) === value69;
    const value73 = value72 ? getVarintField(value71, 3) : 0;
    if (value73) {
      throw new QQPetError(value67 + " OIDB errorCode=" + value73);
    }
    return {
      command: value68,
      subCommand: value69,
      errorCode: value73,
      body: value72 ? getBytesField(value71, 4) : value70,
      raw: value70
    };
  }
  async queryOwnPetProfile() {
    const [value82, value83, value84] = PACKETS.ownProfile;
    const value85 = await this.sendPacket(PACKETS.ownProfile, buildPacketEnvelope(value83, value84, new Uint8Array()));
    let value86 = parseProtobufFields(value85);
    if (getVarintField(value86, 1) === value83 && getVarintField(value86, 2) === value84) {
      const value74 = getVarintField(value86, 3);
      if (value74) {
        throw new QQPetError(value82 + " OIDB errorCode=" + value74);
      }
      value86 = parseProtobufFields(getBytesField(value86, 4));
    }
    const items12 = getBytesField(value86, 1);
    const value87 = items12.length ? parseProtobufFields(items12) : value86;
    const value88 = getStringField(value87, 8).trim();
    if (value88) {
      const items9 = getBytesField(value87, 13);
      const value75 = items9.length ? parseProtobufFields(items9) : new Map();
      const items10 = getBytesField(value87, 14);
      const value76 = items10.length ? parseProtobufFields(items10) : new Map();
      const value77 = getVarintField(value87, 6);
      const value78 = getProtobufFields(value76, 1).filter(item6 => item6.wireType === 2).map(item7 => ot(item7.value, true, true));
      return {
        petId: value88,
        name: getStringField(value87, 1).trim(),
        birthdayAt: getVarintField(value87, 4),
        gender: value77 === 1 ? "男" : value77 === 2 ? "女" : "未知",
        species: getStringField(value87, 11).trim(),
        personality: getStringField(value87, 7).trim(),
        avatarUrl: getStringField(value87, 18).trim() || getStringField(value87, 3).trim(),
        fullAvatarUrl: getStringField(value87, 3).trim() || getStringField(value87, 18).trim(),
        personalityUrl: getStringField(value87, 9).trim(),
        medals: value78,
        level: getVarintField(value75, 1),
        currentExperience: getVarintField(value75, 2),
        levelExperience: getVarintField(value75, 3),
        experienceRate: getFloatField(value75, 4, 1)
      };
    }
    try {
      const value79 = await this.sendOidb(PACKETS.ownPetCache, new Uint8Array());
      const items11 = getBytesField(parseProtobufFields(value79.body), 1);
      const value80 = items11.length ? parseProtobufFields(items11) : new Map();
      const value81 = getStringField(value80, 101).trim();
      if (value81) {
        return {
          petId: value81,
          name: getStringField(value80, 1).trim(),
          birthdayAt: 0,
          gender: "未知",
          species: "",
          personality: "",
          level: 0,
          avatarUrl: getStringField(value80, 3).trim(),
          fullAvatarUrl: getStringField(value80, 3).trim(),
          personalityUrl: "",
          medals: [],
          currentExperience: 0,
          levelExperience: 0,
          experienceRate: 1
        };
      }
    } catch {}
    throw new QQPetError("服务器未返回本人宠物 ID；请确认当前 QQ 已创建新版 QQ 宠物");
  }
  async queryOwnPetId() {
    return (await this.queryOwnPetProfile()).petId;
  }
  async queryMedalGallery() {
    const value92 = parseProtobufFields((await this.sendOidb(PACKETS.medalGallery, encodeStringField(1, this.petId))).body);
    const items14 = [];
    for (const field6 of getProtobufFields(value92, 1)) {
      if (field6.wireType !== 2) {
        continue;
      }
      const value91 = parseProtobufFields(field6.value);
      for (const field5 of getProtobufFields(value91, 3)) {
        if (field5.wireType !== 2) {
          continue;
        }
        const value90 = parseProtobufFields(field5.value);
        for (const field4 of getProtobufFields(value90, 2)) {
          if (field4.wireType !== 2) {
            continue;
          }
          const value89 = parseProtobufFields(field4.value);
          const items13 = getBytesField(value89, 1);
          if (items13.length) {
            items14.push(ot(items13, !!getVarintField(value89, 2), !!getVarintField(value89, 4)));
          }
        }
      }
    }
    return items14;
  }
  async queryInteractionMessages(arg146 = 20) {
    const value96 = concatBytes(encodeVarintField(1, 0), encodeVarintField(2, Math.max(1, Math.min(50, Math.trunc(arg146)))));
    const value97 = parseProtobufFields((await this.sendOidb(PACKETS.interactionHistory, value96)).body);
    return getProtobufFields(value97, 1).flatMap(field7 => {
      if (field7.wireType !== 2) {
        return [];
      }
      const value93 = parseProtobufFields(field7.value);
      const value94 = getStringField(value93, 4).trim();
      const value95 = Qt(getStringField(value93, 2));
      if (!value94 || !value95) {
        return [];
      } else {
        return [{
          id: value94,
          uin: getStringField(value93, 1).trim(),
          petName: getStringField(value93, 5).trim(),
          text: value95,
          timestamp: getVarintField(value93, 3),
          eventType: getVarintField(value93, 6)
        }];
      }
    });
  }
  async queryValues() {
    const value98 = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(1)));
    const value99 = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(6)));
    const [value100, value101, value102] = await Promise.all([this.sendOidb(PACKETS.display, value98), this.sendOidb(PACKETS.display, value99), this.queryAttributes()]);
    const value103 = parseProtobufFields(getBytesField(parseProtobufFields(value100.body), 1));
    const value104 = arg147 => getFloatField(parseProtobufFields(getBytesField(value103, arg147)), 3);
    const value105 = parseProtobufFields(getBytesField(parseProtobufFields(value101.body), 1));
    return {
      feel: value104(1),
      hunger: value104(2),
      clean: value104(3),
      total: value104(4),
      gold: getFloatField(parseProtobufFields(getBytesField(value105, 5)), 3),
      ...value102
    };
  }
  async queryAttributes() {
    const value109 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const value110 = parseProtobufFields((await this.sendOidb(PACKETS.overview, value109)).body);
    const items15 = getBytesField(value110, 2);
    const value111 = items15.length ? parseProtobufFields(items15) : new Map();
    const value112 = {
      strength: 0,
      intelligence: 0,
      charm: 0
    };
    const value113 = [1, 2, 3].flatMap(arg148 => getProtobufFields(value111, arg148));
    for (const field8 of value113) {
      if (field8.wireType !== 2) {
        continue;
      }
      const value106 = parseProtobufFields(field8.value);
      const value107 = getStringField(value106, 1);
      const value108 = value107 === "力量" ? "strength" : value107 === "智力" ? "intelligence" : value107 === "魅力" ? "charm" : null;
      if (value108) {
        value112[value108] = getVarintField(value106, 3);
      }
    }
    return value112;
  }
  async queryOtherPet(arg150, arg219) {
    const value118 = arg149 => {
      const value114 = getStringField(arg149, 8).trim() || getStringField(arg149, 101).trim();
      if (!value114) {
        return null;
      }
      const items16 = getBytesField(arg149, 13);
      const value115 = items16.length ? getVarintField(parseProtobufFields(items16), 1) : 0;
      return {
        uin: arg150,
        petId: value114,
        name: getStringField(arg149, 1).trim(),
        level: value115,
        kind: arg219
      };
    };
    if (this.otherPetMobileAvailable === false) {
      throw new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口");
    }
    try {
      const value116 = parseProtobufFields((await this.sendOidb(PACKETS.otherPet, encodeStringField(1, arg150))).body);
      this.otherPetMobileAvailable = true;
      const items17 = getBytesField(value116, 1);
      return value118(items17.length ? parseProtobufFields(items17) : value116);
    } catch (error2) {
      const value117 = error2 instanceof Error ? error2.message : String(error2);
      if (/用户没有宠物|尚未创建.*宠物|未创建.*宠物/.test(value117)) {
        this.otherPetMobileAvailable = true;
        return null;
      }
      throw /不支持.*好友宠物|action.*(?:不存在|not found|unsupported)|返回空响应或未知响应结构|unknown command/i.test(value117) ? (this.otherPetMobileAvailable = false, new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口：" + value117, "other_pet_unsupported")) : new QQPetError("查询好友宠物失败：" + value117, "other_pet_query_failed");
    }
  }
  async queryOtherValues(arg152) {
    const value119 = concatBytes(encodeStringField(1, arg152), encodeBytesField(2, Uint8Array.of(1)));
    const value120 = parseProtobufFields(getBytesField(parseProtobufFields((await this.sendOidb(PACKETS.display, value119)).body), 1));
    const value121 = arg151 => getFloatField(parseProtobufFields(getBytesField(value120, arg151)), 3);
    return {
      feel: value121(1),
      hunger: value121(2),
      clean: value121(3),
      total: value121(4)
    };
  }
  async visitOther(arg153) {
    const value122 = concatBytes(encodeVarintField(1, 4000), encodeVarintField(2, 0), encodeVarintField(3, 0));
    const value123 = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, arg153), encodeBytesField(3, value122), encodeBytesField(4, new Uint8Array()));
    await this.sendOidb(PACKETS.reportEvent, value123);
  }
  async feedOther(arg154, arg220) {
    const value124 = concatBytes(encodeStringField(1, arg154), encodeStringField(2, ""), encodeStringField(3, ""), encodeStringField(4, arg220));
    await this.sendOidb(PACKETS.feed, value124);
  }
  async washOther(arg155, arg221) {
    const value125 = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, arg221), encodeVarintField(3, 1), encodeStringField(4, arg155));
    await this.sendOidb(PACKETS.useBathItem, value125);
  }
  async feed() {
    await this.sendOidb(PACKETS.feed, encodeStringField(4, this.petId));
  }
  async queryFoodInventory() {
    const value126 = await this.sendOidb(PACKETS.feedInventory, new Uint8Array());
    const value127 = parseProtobufFields(value126.body);
    return {
      biscuits: getVarintField(value127, 1),
      shrimp: getVarintField(value127, 2)
    };
  }
  async buyFood(arg156) {
    if (arg156 <= 0) {
      throw new QQPetError("购买饼干数量必须大于 0");
    }
    const value128 = parseProtobufFields((await this.sendOidb(PACKETS.buyFood, encodeVarintField(1, arg156))).body);
    return {
      bought: getVarintField(value128, 3),
      costGold: getVarintField(value128, 4)
    };
  }
  async queryBathItems() {
    const value131 = parseProtobufFields((await this.sendOidb(PACKETS.bathItems, encodeVarintField(1, 1))).body);
    return getProtobufFields(value131, 1).filter(item8 => item8.wireType === 2).map(item9 => {
      const value129 = parseProtobufFields(item9.value);
      const items18 = getBytesField(value129, 14);
      const value130 = items18.length ? parseProtobufFields(items18) : new Map();
      return {
        name: getStringField(value129, 1),
        itemId: getStringField(value129, 2),
        goldPrice: getVarintField(value129, 5),
        cleanGain: getVarintField(value129, 6),
        description: getStringField(value129, 7),
        defaultCount: getVarintField(value129, 8),
        step: getVarintField(value129, 9),
        minimum: getVarintField(value129, 10),
        maximum: getVarintField(value129, 11),
        moodGain: getVarintField(value129, 12),
        previewUrl: _(getStringField(value129, 3)),
        silhouetteUrl: _(getStringField(value129, 13)),
        selectedPreviewUrl: _(getStringField(value129, 15)),
        soapingUrl: _(getStringField(value130, 4))
      };
    });
  }
  async queryBathInventory() {
    const value133 = parseProtobufFields((await this.sendOidb(PACKETS.bathInventory, encodeVarintField(1, 1))).body);
    const items19 = getBytesField(value133, 1);
    const value134 = items19.length ? parseProtobufFields(items19) : new Map();
    const value135 = {};
    for (const field9 of getProtobufFields(value134, 1)) {
      if (field9.wireType !== 2) {
        continue;
      }
      const value132 = parseProtobufFields(field9.value);
      value135[getStringField(value132, 1)] = getVarintField(value132, 2);
    }
    const value136 = {
      soap: value135[1] ?? 0,
      bathBall: value135[2] ?? 0,
      counts: value135
    };
    return value136;
  }
  async buyBathItem(arg157, arg222) {
    if (arg222 <= 0) {
      throw new QQPetError("购买洗护道具数量必须大于 0");
    }
    const value137 = concatBytes(encodeVarintField(1, 1), encodeVarintField(2, 1001), encodeStringField(3, this.petId));
    const value138 = concatBytes(encodeVarintField(1, 355), encodeVarintField(2, Number(arg157)), encodeVarintField(3, arg222));
    const value139 = concatBytes(encodeBytesField(1, value137), encodeVarintField(2, 1001), encodeBytesField(3, value138), encodeVarintField(4, 21));
    const value140 = parseProtobufFields((await this.sendOidb(PACKETS.buyBathItem, value139)).body);
    const value141 = getVarintField(value140, 1);
    const value142 = getStringField(value140, 2);
    return {
      result: value141,
      orderId: value142,
      succeeded: value141 === 0 && !!value142
    };
  }
  async useBathItem(arg158) {
    const value143 = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, arg158), encodeVarintField(3, 1), encodeStringField(4, ""));
    await this.sendOidb(PACKETS.useBathItem, value143);
  }
  async querySchoolStage() {
    const value144 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const value145 = getVarintField(parseProtobufFields((await this.sendOidb(PACKETS.overview, value144)).body), 4);
    if (![0, 1, 2, 3, 4].includes(value145)) {
      throw new QQPetError("服务器返回未知学习阶段：" + value145);
    }
    return value145;
  }
  async querySchoolCourses(arg159) {
    const value146 = arg159 ?? (await this.querySchoolStage());
    const value147 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeVarintField(11, value146), encodeVarintField(100, 2));
    const value148 = parseProtobufFields((await this.sendOidb(PACKETS.catalog, value147)).body);
    return getProtobufFields(value148, 1).filter(item10 => item10.wireType === 2).map(item11 => H(item11.value));
  }
  async selectSchoolCourse(arg160, arg223 = 0) {
    const value149 = {
      physical: "力量",
      culture: "智力",
      art: "魅力"
    }[arg160];
    if (!value149) {
      throw new QQPetError("未知学习属性：" + arg160);
    }
    const items20 = (await this.querySchoolCourses()).filter(item12 => item12.canDo && item12.subEventType > 0);
    const value150 = arg223 ? items20.find(item13 => item13.subEventType === arg223) : items20.filter(item14 => item14.reward.includes(value149)).sort(at)[0];
    if (!value150) {
      throw new QQPetError(arg223 ? "指定课程 " + arg223 + " 当前不可用" : "当前暂无可用的" + value149 + "课程");
    }
    return value150;
  }
  async startSchool(arg161, arg224 = 0) {
    const value151 = await this.selectSchoolCourse(arg161, arg224);
    const value152 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, value151.name), encodeVarintField(7, value151.subEventType), encodeVarintField(100, 2));
    const value153 = await this.sendOidb(PACKETS.startStory, value152);
    return {
      item: value151,
      storyId: getStringField(parseProtobufFields(value153.body), 1)
    };
  }
  async queryWorkOverview() {
    const value157 = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const value158 = parseProtobufFields((await this.sendOidb(PACKETS.overview, value157)).body);
    return {
      careers: getProtobufFields(value158, 1).filter(item15 => item15.wireType === 2).map(item16 => {
        const value154 = parseProtobufFields(item16.value);
        const value155 = getVarintField(value154, 4);
        const value156 = getStringField(value154, 1);
        return {
          careerType: getVarintField(value154, 20),
          name: value156,
          available: value155 !== 3 && value156 !== "???",
          statusCode: value155,
          message: getStringField(value154, 5)
        };
      }).filter(item17 => item17.careerType > 0),
      currentCareerType: getVarintField(value158, 3),
      lastSubEventType: getVarintField(value158, 5)
    };
  }
  async queryWorkJobs(arg162, arg225 = "") {
    const value159 = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, arg225), encodeVarintField(10, arg162), encodeVarintField(100, 2));
    const value160 = parseProtobufFields((await this.sendOidb(PACKETS.catalog, value159)).body);
    const value161 = getStringField(value160, 2);
    const value162 = {
      careerType: arg162,
      careerName: value161
    };
    return getProtobufFields(value160, 1).filter(item18 => item18.wireType === 2).map(item19 => H(item19.value, value162));
  }
  async selectWorkJob(arg163 = 0, arg226 = 0, arg37 = "") {
    const value163 = await this.queryWorkOverview();
    const items21 = value163.careers.filter(item20 => item20.available && (!arg163 || item20.careerType === arg163));
    if (!items21.length) {
      throw new QQPetError(arg163 ? "职业 " + arg163 + " 尚未开放" : "服务器当前没有开放的职业");
    }
    const value164 = (await Promise.all(items21.map(async item21 => {
      try {
        return await this.queryWorkJobs(item21.careerType, arg37);
      } catch (error3) {
        if (isCareerRequirementError(error3)) {
          return [];
        }
        throw error3;
      }
    }))).flat().filter(item22 => item22.canDo && item22.subEventType > 0);
    const value165 = arg226 ? value164.find(item23 => item23.subEventType === arg226) : value164.sort((left, right) => at(left, right) || +(right.careerType === value163.currentCareerType) - +(left.careerType === value163.currentCareerType) || (left.careerType ?? 0) - (right.careerType ?? 0))[0];
    if (!value165) {
      throw new QQPetError(arg226 ? "指定岗位 " + arg226 + " 当前不可用" : "服务器当前没有可执行的打工岗位");
    }
    return value165;
  }
  async startWork(arg164 = 0, arg227 = 0, target2) {
    const value166 = target2?.uin.trim() ?? "";
    const value167 = target2?.petId.trim() ?? "";
    if (!!value166 != !!value167) {
      throw new QQPetError("雇佣好友时必须同时提供好友账号和宠物 ID");
    }
    const value168 = await this.selectWorkJob(arg164, arg227, value167);
    const value169 = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, ""), value166 ? encodeBytesField(4, concatBytes(encodeStringField(1, value166), encodeStringField(2, value167))) : new Uint8Array(), encodeStringField(6, value168.name), encodeVarintField(7, value168.subEventType), encodeVarintField(100, 2));
    const value170 = await this.sendOidb(PACKETS.startStory, value169);
    return {
      item: value168,
      storyId: getStringField(parseProtobufFields(value170.body), 1),
      hiredFriend: !!value166
    };
  }
  async queryAdventureOptions(arg165 = "") {
    const value171 = concatBytes(encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, arg165), encodeVarintField(100, 2));
    const value172 = parseProtobufFields((await this.sendOidb(PACKETS.catalog, value171)).body);
    return getProtobufFields(value172, 1).filter(item24 => item24.wireType === 2).map(item25 => H(item25.value));
  }
  async queryFatigueStatus() {
    try {
      const value173 = (await this.queryWorkOverview()).careers.find(item26 => item26.available);
      let items23;
      try {
        items23 = value173 ? await this.queryWorkJobs(value173.careerType) : await this.querySchoolCourses();
      } catch (error3) {
        if (!value173 || !isCareerRequirementError(error3)) {
          throw error3;
        }
        items23 = await this.querySchoolCourses();
      }
      const value174 = items23.filter(item27 => item27.name).sort((left2, right2) => (Q(left2.duration) || Number.MAX_SAFE_INTEGER) - (Q(right2.duration) || Number.MAX_SAFE_INTEGER))[0];
      if (value174) {
        return Ut(value174.warning ?? "");
      } else {
        return {
          fatigued: null,
          tier: null,
          benefitRate: null,
          reason: "服务器没有返回可用于疲劳判定的任务"
        };
      }
    } catch (error3) {
      return {
        fatigued: null,
        tier: null,
        benefitRate: null,
        reason: "疲劳状态读取失败：" + (error3 instanceof Error ? error3.message : String(error3))
      };
    }
  }
  async startAdventure(arg166 = "") {
    const value175 = (await this.queryAdventureOptions()).filter(item28 => item28.canDo && item28.name);
    const value176 = arg166 ? value175.find(item29 => item29.name === arg166) : value175[0];
    if (!value176) {
      throw new QQPetError(arg166 ? "指定冒险“" + arg166 + "”当前不可用" : "服务器当前没有可执行的冒险");
    }
    const items22 = [encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, value176.name)];
    if (value176.subEventType > 0) {
      items22.push(encodeVarintField(7, value176.subEventType));
    }
    items22.push(encodeVarintField(100, 2));
    const value177 = await this.sendOidb(PACKETS.startStory, concatBytes(...items22));
    return {
      item: value176,
      storyId: getStringField(parseProtobufFields(value177.body), 1)
    };
  }
  async queryStory() {
    const value178 = concatBytes(encodeStringField(1, this.petId), encodeVarintField(100, 2));
    const value179 = parseProtobufFields((await this.sendOidb(PACKETS.storyStatus, value178)).body);
    const items23 = getBytesField(value179, 1);
    const value180 = items23.length ? parseProtobufFields(items23) : new Map();
    const value181 = getStringField(value179, 2);
    const value182 = getVarintField(value180, 2);
    const value183 = getVarintField(value180, 3);
    return {
      storyId: value181,
      stateCode: getVarintField(value180, 1),
      remainingSeconds: value182,
      durationSeconds: value183,
      startedAt: getVarintField(value180, 4),
      recallable: !!getVarintField(value180, 5),
      finished: !!value181 && !!(value183 > 0) && !!(value182 <= 0)
    };
  }
  async settleStory(arg167) {
    const value184 = concatBytes(encodeStringField(1, arg167), encodeVarintField(2, 1000), encodeStringField(3, this.petId), encodeVarintField(100, 2));
    return this.sendOidb(PACKETS.storySettle, value184);
  }
}
const delaySeconds = arg168 => new Promise(resolve2 => setTimeout(resolve2, Math.max(0, arg168) * 1000));
const ATTRIBUTE_ROTATION = ["physical", "culture", "art"];
function ut(arg169, arg228, arg38 = Math.random) {
  const value185 = Math.max(0, Math.trunc(arg169 * 60));
  const value186 = Math.max(value185, Math.trunc(arg228 * 60));
  return value185 + Math.floor(Math.min(0.999999999, Math.max(0, arg38())) * (value186 - value185 + 1));
}
function jt(arg170, arg229) {
  if (!arg170.schoolRotationEnabled) {
    return arg170.schoolAttribute;
  }
  const value187 = ATTRIBUTE_ROTATION.indexOf(arg170.schoolAttribute);
  return ATTRIBUTE_ROTATION[(value187 + Math.max(0, Math.trunc(arg229))) % ATTRIBUTE_ROTATION.length];
}
function Ht(arg171, values2, arg39) {
  const value188 = {
    school: arg171.schoolEnabled && values2.gold >= arg171.coinThreshold,
    work: arg171.workEnabled && (!arg171.workTimesPerDay || (arg39.work ?? 0) < arg171.workTimesPerDay)
  };
  const value189 = value188;
  return (arg171.taskPriority === "work" ? ["work", "school"] : ["school", "work"]).find(item30 => value189[item30]) ?? null;
}
function zt(arg172, arg230) {
  if (!arg230.fatigued || !arg230.tier) {
    return null;
  } else if (arg230.tier >= 12) {
    return arg172.fatigue12HourAction;
  } else {
    return arg172.fatigue8HourAction;
  }
}
function lt(story2, arg231) {
  const value190 = {
    storyId: "",
    stateCode: 0,
    remainingSeconds: 0,
    durationSeconds: 0,
    startedAt: 0,
    recallable: false,
    finished: false
  };
  if (!story2.storyId || !story2.finished || !arg231) {
    return story2;
  } else {
    return value190;
  }
}
function Wt(error4) {
  return /宠物结算条件不满足|(?:任务|故事).*(?:已结算|不存在|已失效)|无需结算/.test(error4 instanceof Error ? error4.message : String(error4));
}
function Jt(arg173, arg232) {
  return arg232.bonus - arg173.bonus || arg232.totalReward - arg173.totalReward || arg232.target.level - arg173.target.level || arg173.target.uin.localeCompare(arg232.target.uin);
}
class AutomationController {
  constructor(arg174, arg233) {
    this.host = arg174;
    this.progress = arg233;
  }
  timer = null;
  busy = false;
  active = false;
  generation = 0;
  petName = "";
  identityLoaded = false;
  medals = null;
  medalsLoadedAt = 0;
  interactions = [];
  interactionsLoadedAt = 0;
  get running() {
    return this.active;
  }
  start() {
    if (this.running) {
      return false;
    }
    this.active = true;
    const value191 = ++this.generation;
    this.host.log("自动托管已启动");
    this.host.updateStatus({
      automationRunning: true,
      activity: "自动托管已启动，正在检查"
    });
    this.loop(value191);
    return true;
  }
  stop() {
    if (this.running) {
      this.active = false;
      this.generation += 1;
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = null;
      this.host.updateStatus({
        automationRunning: false,
        activity: "自动托管已停止"
      });
      this.host.log("自动托管已停止");
      return true;
    } else {
      return false;
    }
  }
  async loop(arg175) {
    if (!this.active || arg175 !== this.generation) {
      return;
    }
    try {
      await this.runOnce();
    } catch (error5) {
      const value192 = error5 instanceof Error ? error5.message : String(error5);
      this.host.log("本轮失败：" + value192);
      this.host.updateStatus({
        connected: false,
        error: value192,
        activity: "本轮执行失败，等待重试"
      });
    }
    if (!this.active || arg175 !== this.generation) {
      return;
    }
    const value193 = Math.max(3, this.host.getConfig().intervalSeconds);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.loop(arg175);
    }, value193 * 1000);
  }
  async client() {
    const target4 = this.host.getConfig();
    const target5 = new QQPetApi(this.host.ctx, target4.petId);
    const value195 = isAutoPetId(target4.petId);
    if (value195 || !this.identityLoaded) {
      if (value195) {
        this.host.updateStatus({
          activity: "正在自动获取宠物档案"
        });
      }
      try {
        const target3 = await target5.queryOwnPetProfile();
        this.petName = target3.name;
        this.identityLoaded = true;
        if (value195) {
          this.host.updateConfig({
            petId: target3.petId
          });
          target5.petId = target3.petId;
          this.host.log("已自动获取宠物 ID 和昵称并保存");
        }
      } catch (value194) {
        if (value195) {
          throw value194;
        }
        this.identityLoaded = true;
      }
    }
    return target5;
  }
  async queryProfile(arg176) {
    const value196 = await arg176.queryOwnPetProfile();
    if (!this.medals || Date.now() - this.medalsLoadedAt >= 300000) {
      try {
        const items24 = await arg176.queryMedalGallery();
        if (items24.length) {
          this.medals = items24;
        }
        this.medalsLoadedAt = Date.now();
      } catch {
        this.medals ||= value196.medals;
        this.medalsLoadedAt = Date.now();
      }
    }
    if (!this.interactionsLoadedAt || Date.now() - this.interactionsLoadedAt >= 300000) {
      try {
        this.interactions = await arg176.queryInteractionMessages();
      } catch {}
      this.interactionsLoadedAt = Date.now();
    }
    const value197 = {
      ...value196
    };
    value197.medals = this.medals ?? value196.medals;
    return value197;
  }
  async blocked(arg177, arg234) {
    if (arg177.safeMode) {
      this.host.log("安全模式：计划执行" + arg234 + "，本轮不发送写请求");
      return true;
    } else {
      return false;
    }
  }
  decide(arg178, arg235) {
    const value198 = this.progress.snapshot().counts;
    const value199 = new Date();
    const value200 = String(value199.getHours()).padStart(2, "0") + ":" + String(value199.getMinutes()).padStart(2, "0");
    if (arg178.adventureEnabled && value200 >= arg178.adventureStartTime && (!arg178.adventureTimesPerDay || value198.adventure < arg178.adventureTimesPerDay)) {
      return "adventure";
    } else {
      return Ht(arg178, arg235, value198);
    }
  }
  actionArray(arg181) {
    if (Array.isArray(arg181)) {
      return arg181.flatMap(arg179 => this.actionArray(arg179));
    }
    if (arg181 && typeof arg181 == "object") {
      const value201 = arg181;
      if ("user_id" in value201 || "uin" in value201 || "group_id" in value201) {
        return [value201];
      } else {
        return Object.values(value201).flatMap(arg180 => this.actionArray(arg180));
      }
    }
    return [];
  }
  async callAction(arg182, arg236) {
    const value202 = await this.host.ctx.actions.call(arg182, arg236, this.host.ctx.adapterName, this.host.ctx.pluginManager.config);
    return this.actionArray(value202);
  }
  targetLabel(target6) {
    return (target6.name?.trim() ? "“" + target6.name.trim() + "”" : "未命名对象") + "（QQ " + target6.uin + "）";
  }
  async friendCandidates() {
    const items25 = (await this.callAction("get_friends_with_category", {})).flatMap(loginInfo2 => {
      const value203 = String(loginInfo2.user_id ?? loginInfo2.uin ?? "").trim();
      const value204 = String(loginInfo2.remark ?? loginInfo2.nickname ?? loginInfo2.nick ?? "").trim();
      if (value203 && value203 !== this.host.uin) {
        return [{
          uin: value203,
          name: value204,
          kind: "friend"
        }];
      } else {
        return [];
      }
    });
    return [...new Map(items25.map(item31 => [item31.uin, item31])).values()];
  }
  async visitCandidates(arg183) {
    const items27 = await this.friendCandidates();
    const value211 = new Set(items27.map(item32 => item32.uin));
    const items28 = arg183.visitFriends ? items27 : [];
    const items29 = [];
    if (arg183.visitStrangers) {
      let items26 = arg183.visitStrangerGroupIds.split(/[,，\s]+/).map(item33 => item33.trim()).filter(Boolean);
      if (!items26.length) {
        items26 = (await this.callAction("get_group_list", {})).slice(0, 1).map(item34 => String(item34.group_id ?? "")).filter(Boolean);
      }
      for (const value209 of items26.slice(0, 3)) {
        const value207 = {
          group_id: value209,
          no_cache: false
        };
        const value208 = await this.callAction("get_group_member_list", value207);
        for (const loginInfo3 of value208) {
          const value205 = String(loginInfo3.user_id ?? loginInfo3.uin ?? "");
          const value206 = String(loginInfo3.card ?? loginInfo3.nickname ?? loginInfo3.nick ?? "").trim();
          if (value205 && value205 !== this.host.uin && !value211.has(value205)) {
            items29.push({
              uin: value205,
              name: value206,
              kind: "stranger"
            });
          }
        }
      }
    }
    const items30 = [...new Map(items28.map(item35 => [item35.uin, item35])).values()];
    const items31 = [...new Map(items29.map(item36 => [item36.uin, item36])).values()];
    const items32 = [];
    const value212 = Math.max(items30.length, items31.length);
    for (let value210 = 0; value210 < value212; value210 += 1) {
      if (items30[value210]) {
        items32.push(items30[value210]);
      }
      if (items31[value210]) {
        items32.push(items31[value210]);
      }
    }
    return items32;
  }
  async findEmployableFriend(arg184, arg237) {
    let items33;
    try {
      items33 = (await this.friendCandidates()).slice(0, arg237.workFriendScanLimit);
    } catch (error6) {
      this.host.log("读取好友列表失败，本次按普通打工继续：" + (error6 instanceof Error ? error6.message : String(error6)));
      return null;
    }
    let value216 = items33.length ? "" : "好友列表没有可扫描对象";
    let value217;
    try {
      value217 = await arg184.selectWorkJob(arg237.workCareerType, arg237.workJobSubEvent);
    } catch (error7) {
      this.host.log("读取普通岗位收益失败，无法比较好友雇佣加成：" + (error7 instanceof Error ? error7.message : String(error7)));
      return null;
    }
    const value218 = V(value217.reward);
    const value219 = value217.careerType;
    if (!value219) {
      this.host.log("服务器未返回基准岗位所属职业，无法比较好友雇佣加成，本次按普通打工继续");
      return null;
    }
    const items34 = [];
    for (const target8 of items33) {
      try {
        const target7 = await arg184.queryOtherPet(target8.uin, "friend");
        if (!target7) {
          value216 = this.targetLabel(target8) + "尚未创建宠物";
          continue;
        }
        const value213 = (await arg184.queryWorkJobs(value219, target7.petId)).find(item37 => item37.canDo && item37.subEventType === value217.subEventType);
        if (!value213) {
          value216 = this.targetLabel(target7) + "不能参加当前岗位";
          continue;
        }
        const value214 = V(value213.reward);
        items34.push({
          target: target7,
          jobSubEvent: value213.subEventType,
          bonus: value214 - value218,
          totalReward: value214
        });
      } catch (error8) {
        value216 = this.targetLabel(target8) + "不可雇佣：" + (error8 instanceof Error ? error8.message : String(error8));
        if (value216.includes("不支持安卓端的好友宠物详情接口")) {
          break;
        }
      }
    }
    items34.sort(Jt);
    if (items34[0]) {
      const value215 = items34[0];
      this.host.log("已比较 " + items34.length + " 只可雇佣好友宠物，选择" + this.targetLabel(value215.target) + "，预计雇佣加成 " + (value215.bonus >= 0 ? "+" : "") + value215.bonus);
      return value215;
    }
    this.host.log("未找到可雇佣的好友宠物，本次按普通打工继续" + (value216 ? "（" + value216 + "）" : ""));
    return null;
  }
  async maybeVisit(arg185, config2, foodInventory, bathInventory2) {
    if (!config2.visitEnabled || this.progress.activeBlock("visit")) {
      return false;
    }
    const value226 = this.progress.snapshot().counts;
    const value227 = (value226.visitFriend ?? 0) + (value226.visitStranger ?? 0);
    if (config2.visitMaxPerDay && value227 >= config2.visitMaxPerDay || (await this.blocked(config2, "走访宠物"))) {
      return false;
    }
    let value228 = "";
    try {
      const value223 = (await this.visitCandidates(config2)).filter(item38 => !this.progress.targetWasVisited(item38.uin)).slice(0, config2.visitCandidateScanLimit);
      for (const target10 of value223) {
        try {
          await arg185.visitOther(target10.uin);
          this.progress.markTargetVisited(target10.uin);
          this.progress.increment(target10.kind === "friend" ? "visitFriend" : "visitStranger");
          this.host.log("自动走访" + (target10.kind === "friend" ? "好友" : "陌生人") + this.targetLabel(target10) + "成功");
          const value221 = config2.otherCareDailyExperienceLimit > 0 && this.progress.snapshot().dailyExperienceGain >= config2.otherCareDailyExperienceLimit;
          if (config2.visitAutoCare && value221) {
            this.host.log("今日经验已达到 " + config2.otherCareDailyExperienceLimit + "，停止照顾别人");
          } else if (config2.visitAutoCare) {
            try {
              const target9 = await arg185.queryOtherPet(target10.uin, target10.kind);
              if (target9) {
                const values3 = await arg185.queryOtherValues(target9.petId);
                if (values3.hunger < config2.hungerThreshold && foodInventory.biscuits > 0) {
                  await arg185.feedOther(target9.uin, target9.petId);
                  this.progress.increment("careOther");
                  this.host.log("已自动喂养走访对象");
                }
                const value220 = bathInventory2.bathBall > 0 ? "2" : bathInventory2.soap > 0 ? "1" : null;
                if (values3.clean < config2.cleanThreshold && value220) {
                  await arg185.washOther(target9.uin, value220);
                  this.progress.increment("careOther");
                  this.host.log("已自动清洁走访对象");
                }
              }
            } catch (error9) {
              this.host.log("走访已完成，暂无法读取对方宠物状态：" + (error9 instanceof Error ? error9.message : String(error9)));
            }
          }
          const value222 = ut(config2.visitDelayMinMinutes, config2.visitDelayMaxMinutes);
          this.progress.setBlock("visit", "等待下次走访", value222);
          this.host.updateStatus({
            activity: "自动走访已完成"
          });
          return true;
        } catch (error10) {
          value228 = error10 instanceof Error ? error10.message : String(error10);
        }
      }
      const value224 = ut(config2.visitDelayMinMinutes, config2.visitDelayMaxMinutes);
      this.progress.setBlock("visit", value228 || "暂无可走访的宠物", value224);
      if (value228) {
        this.host.log("走访候选检查未成功：" + value228);
      }
    } catch (error11) {
      const value225 = error11 instanceof Error ? error11.message : String(error11);
      this.progress.setBlock("visit", value225, config2.failureCooldownSeconds);
      this.host.log("获取走访候选失败：" + value225);
    }
    return false;
  }
  storyKind(arg186) {
    return {
      "6100": "school",
      "6400": "work",
      "6700": "adventure"
    }[arg186.split("_", 1)[0]] ?? null;
  }
  handleMissingPending(arg187, story3) {
    if (!story3) {
      return false;
    }
    const value229 = this.progress.markPendingMissing();
    const value230 = value229 ? (Date.now() - Date.parse(value229)) / 1000 : 0;
    if (value230 < arg187.startConfirmSeconds) {
      this.host.updateStatus({
        activity: "任务状态暂未返回，等待同步（" + Math.ceil(arg187.startConfirmSeconds - value230) + "s）"
      });
      return true;
    } else {
      this.progress.clearPending();
      this.host.log("服务器持续未返回任务 " + (story3.storyId || story3.kind) + "，已清除待确认记录且不计入完成次数");
      return true;
    }
  }
  async handleStory(arg188, arg238, story4) {
    let story5 = this.progress.snapshot().pending;
    if (story4.storyId) {
      if (story4.finished && (this.progress.storyWasSettled(story4.storyId) || this.progress.storyWasDismissed(story4.storyId))) {
        return this.handleMissingPending(arg238, story5);
      }
      const value233 = this.storyKind(story4.storyId);
      const value234 = !!story5 && (story5.storyId !== story4.storyId || !!value233 && story5.kind !== value233);
      if (!story5 || !story5.confirmed || value234) {
        if (value234) {
          this.host.log("本地待处理任务 " + (story5?.storyId || story5?.kind) + " 与服务器 " + story4.storyId + " 不一致，已按服务器状态恢复");
        }
        if (value233) {
          this.progress.setPending(value233, story4.storyId);
        } else {
          this.progress.clearPending();
        }
        story5 = this.progress.snapshot().pending;
        if (value233 && !value234) {
          this.host.log("已恢复进行中的" + value233 + "任务");
        }
      } else {
        this.progress.markPendingSeen();
        story5 = this.progress.snapshot().pending;
      }
      if (story4.finished) {
        if (await this.blocked(arg238, "结算任务")) {
          return true;
        }
        const value232 = "settle:" + story4.storyId;
        if (this.progress.activeBlock(value232)) {
          return true;
        }
        try {
          await arg188.settleStory(story4.storyId);
          this.progress.markStorySettled(story4.storyId);
          if (story5?.kind === "school" && arg238.schoolRotationEnabled) {
            this.progress.advanceSchoolRotation(arg238.schoolRotationEvery);
          } else if (story5) {
            this.progress.increment(story5.kind);
          }
          this.progress.clearPending();
          this.progress.clearBlock(value232);
          this.host.log("任务已结算并记录：" + story4.storyId);
        } catch (value231) {
          if (Wt(value231)) {
            this.progress.dismissStory(story4.storyId);
            if (story5?.storyId === story4.storyId) {
              this.progress.clearPending();
            }
            this.progress.clearBlock(value232);
            this.host.updateStatus({
              connected: true,
              error: null,
              story: lt(story4, true),
              progress: this.progress.snapshot(),
              activity: "服务器残留任务已忽略，当前空闲"
            });
            this.host.log("服务器已拒绝结算残留任务，按空闲处理：" + story4.storyId);
            return true;
          }
          this.progress.setBlock(value232, String(value231), arg238.settleRetrySeconds);
          throw value231;
        }
        return true;
      }
      const value235 = {
        activity: "任务进行中，剩余 " + story4.remainingSeconds + "s"
      };
      this.host.updateStatus(value235);
      return true;
    }
    return this.handleMissingPending(arg238, story5);
  }
  publish(arg189, arg239, arg310, story6, arg5, arg6) {
    this.petName = arg189.name;
    const value236 = this.progress.snapshot();
    const value237 = this.progress.storyWasSettled(story6.storyId) || this.progress.storyWasDismissed(story6.storyId);
    const value238 = lt(story6, value237);
    const value239 = {
      ...arg5,
      ...arg6
    };
    this.host.updateStatus({
      connected: true,
      error: null,
      updatedAt: new Date().toISOString(),
      profile: arg189,
      interactions: this.interactions,
      fatigue: arg239,
      values: arg310,
      story: value238,
      inventory: value239,
      progress: value236,
      account: {
        uin: this.host.uin,
        petId: this.host.getConfig().petId,
        petIdReady: true,
        petName: this.petName
      }
    });
  }
  async refreshReadonly() {
    if (!this.busy) {
      this.busy = true;
      try {
        const value240 = await this.client();
        const [value241, value242, value243, value244, value245] = await Promise.all([this.queryProfile(value240), value240.queryValues(), value240.queryStory(), value240.queryFoodInventory(), value240.queryBathInventory()]);
        const value246 = await value240.queryFatigueStatus();
        this.progress.recordAttributes(value242);
        this.publish(value241, value246, value242, value243, value244, value245);
        this.host.updateStatus({
          activity: "状态已刷新"
        });
      } finally {
        this.busy = false;
      }
    }
  }
  async catalogs() {
    const value247 = await this.client();
    const [value248, value249, value250, value251] = await Promise.all([value247.querySchoolStage(), value247.queryWorkOverview(), value247.queryAdventureOptions(), value247.queryBathItems()]);
    const [value252, value253] = await Promise.all([value247.querySchoolCourses(value248), Promise.all(value249.careers.map(async item39 => {
      try {
        return {
          ...item39,
          jobs: item39.available ? await value247.queryWorkJobs(item39.careerType) : []
        };
      } catch (error13) {
        if (!isCareerRequirementError(error13)) {
          throw error13;
        }
        return {
          ...item39,
          available: false,
          message: error13 instanceof Error ? error13.message : String(error13),
          jobs: []
        };
      }
    }))]);
    const value254 = {
      currentCareerType: value249.currentCareerType,
      lastSubEventType: value249.lastSubEventType
    };
    const value255 = {
      stage: value248,
      courses: value252,
      careers: value253,
      workOverview: value254,
      adventures: value250,
      bathItems: value251
    };
    return value255;
  }
  async runOnce() {
    if (this.busy) {
      return null;
    }
    this.busy = true;
    try {
      const config3 = this.host.getConfig();
      if (!config3.enabled) {
        return null;
      }
      if (this.progress.rollover()) {
        this.host.log("检测到新的一天，今日计数已清零");
      }
      this.host.updateStatus({
        activity: "正在检查宠物状态"
      });
      const value264 = await this.client();
      let [value265, values6, story10, foodInventory2, bathInventory3] = await Promise.all([this.queryProfile(value264), value264.queryValues(), value264.queryStory(), value264.queryFoodInventory(), value264.queryBathInventory()]);
      const value266 = await value264.queryFatigueStatus();
      this.progress.recordAttributes(values6);
      this.publish(value265, value266, values6, story10, foodInventory2, bathInventory3);
      this.host.log("状态：金币 " + values6.gold.toFixed(0) + "，心情 " + values6.feel.toFixed(0) + "，体力 " + values6.hunger.toFixed(0) + "，清洁 " + values6.clean.toFixed(0));
      if (story10.finished && (await this.handleStory(value264, config3, story10))) {
        return "story";
      }
      if (config3.careEnabled && values6.hunger < config3.hungerThreshold && !this.progress.activeBlock("feed") && !(await this.blocked(config3, "喂食"))) {
        try {
          if (foodInventory2.biscuits <= 0) {
            if (!config3.autoBuySupplies) {
              this.progress.setBlock("feed", "饼干不足且自动购买已关闭", config3.failureCooldownSeconds);
              return "feed_unavailable";
            }
            await value264.buyFood(config3.foodPurchaseCount);
            foodInventory2 = await value264.queryFoodInventory();
            if (foodInventory2.biscuits <= 0) {
              throw new QQPetError("购买饼干后库存仍为空");
            }
          }
          await value264.feed();
          await delaySeconds(config3.verifyDelaySeconds);
          const values4 = await value264.queryValues();
          if (values4.hunger <= values6.hunger) {
            throw new QQPetError("喂食后体力未增加");
          }
          this.progress.increment("feed");
          this.progress.clearBlock("feed");
          this.host.log("自动喂食成功：" + values6.hunger.toFixed(0) + "→" + values4.hunger.toFixed(0));
        } catch (error12) {
          this.progress.setBlock("feed", error12 instanceof Error ? error12.message : String(error12), config3.failureCooldownSeconds);
          throw error12;
        }
        return "feed";
      }
      if (config3.careEnabled && values6.clean < config3.cleanThreshold && !this.progress.activeBlock("wash") && !(await this.blocked(config3, "洗澡"))) {
        try {
          let value256 = bathInventory3.bathBall > 0 ? "2" : "1";
          if ((value256 === "2" ? bathInventory3.bathBall : bathInventory3.soap) <= 0) {
            if (!config3.autoBuySupplies) {
              this.progress.setBlock("wash", "洗护用品不足且自动购买已关闭", config3.failureCooldownSeconds);
              return "wash_unavailable";
            }
            value256 = "2";
            await value264.buyBathItem(value256, config3.bathPurchaseCount);
          }
          await value264.useBathItem(value256);
          await delaySeconds(config3.verifyDelaySeconds);
          const values5 = await value264.queryValues();
          if (values5.clean <= values6.clean) {
            throw new QQPetError("洗澡后清洁值未增加");
          }
          this.progress.increment("wash");
          this.progress.clearBlock("wash");
          this.host.log("自动洗澡成功：" + values6.clean.toFixed(0) + "→" + values5.clean.toFixed(0));
        } catch (error13) {
          this.progress.setBlock("wash", error13 instanceof Error ? error13.message : String(error13), config3.failureCooldownSeconds);
          throw error13;
        }
        return "wash";
      }
      if (await this.maybeVisit(value264, config3, foodInventory2, bathInventory3)) {
        return "visit";
      }
      if (await this.handleStory(value264, config3, story10)) {
        return "story";
      }
      const value267 = zt(config3, value266);
      if (value267 === "rest") {
        const value257 = value266.tier === 12 ? "12 小时" : "8 小时";
        const value258 = {
          activity: "疲劳休息：已进入 " + value257 + "档"
        };
        this.host.updateStatus(value258);
        return "fatigue_rest";
      }
      const value268 = value267 ?? this.decide(config3, values6);
      if (!value268) {
        this.host.updateStatus({
          activity: "空闲：今日任务已完成"
        });
        return null;
      }
      if (await this.blocked(config3, value268 === "school" ? "学习" : value268 === "work" ? "打工" : "冒险")) {
        return value268;
      }
      if (value268 === "school") {
        const value259 = jt(config3, this.progress.snapshot().schoolRotationIndex);
        const value260 = config3.schoolRotationEnabled ? 0 : config3.courseSubEvent;
        const story7 = await value264.startSchool(value259, value260);
        this.progress.setPending("school", story7.storyId);
        const value261 = {
          physical: "力量",
          culture: "智力",
          art: "魅力"
        }[value259];
        this.host.log("已开始" + value261 + "学习“" + story7.item.name + "”" + (story7.storyId ? "，storyId=" + story7.storyId : ""));
      } else if (value268 === "work") {
        const value262 = config3.employFriend ? await this.findEmployableFriend(value264, config3) : null;
        const story8 = await value264.startWork(config3.workCareerType, value262?.jobSubEvent ?? config3.workJobSubEvent, value262 ? {
          uin: value262.target.uin,
          petId: value262.target.petId
        } : undefined);
        this.progress.setPending("work", story8.storyId);
        const value263 = story8.hiredFriend && value262 ? "，已雇佣好友" + this.targetLabel(value262.target) + "（加成 " + (value262.bonus >= 0 ? "+" : "") + value262.bonus + "）" : "";
        this.host.log("已开始打工“" + story8.item.name + "”" + value263 + (story8.storyId ? "，storyId=" + story8.storyId : ""));
      } else {
        const story9 = await value264.startAdventure(config3.adventureOption);
        this.progress.setPending("adventure", story9.storyId);
        this.host.log("已开始冒险“" + story9.item.name + "”" + (story9.storyId ? "，storyId=" + story9.storyId : ""));
      }
      return value268;
    } finally {
      this.host.updateStatus({
        progress: this.progress.snapshot()
      });
      this.busy = false;
    }
  }
}
const INITIAL_CONFIG = {
  ...DEFAULT_CONFIG
};
const EMPTY_ACCOUNT_STATUS = {
  uin: "",
  petId: "",
  petIdReady: false,
  petName: ""
};
const INITIAL_STATUS_CONFIG = {
  ...DEFAULT_CONFIG
};
const INITIAL_STATUS = {
  connected: false,
  automationRunning: false,
  activity: "等待运行时登录",
  updatedAt: null,
  error: null,
  values: null,
  profile: null,
  interactions: [],
  fatigue: null,
  story: null,
  inventory: null,
  progress: null,
  account: EMPTY_ACCOUNT_STATUS,
  logs: [],
  config: INITIAL_STATUS_CONFIG
};
class QQPetPlugin {
  constructor(arg190 = "OneBot") {
    this.runtimeName = arg190;
    this.status.activity = "等待 " + arg190 + " 登录";
  }
  context = null;
  configValue = INITIAL_CONFIG;
  status = INITIAL_STATUS;
  logLines = [];
  logCounts = new Map();
  logTimes = new Map();
  scheduler = null;
  uin = "";
  get ctx() {
    if (!this.context) {
      throw new Error("QQ 宠物插件尚未初始化");
    }
    return this.context;
  }
  getConfig() {
    const value269 = {
      ...this.configValue
    };
    return value269;
  }
  accountStatus() {
    const value270 = !["", "AUTO", "YOUR_PET_ID"].includes(this.configValue.petId.trim().toUpperCase());
    const value271 = {
      uin: this.uin,
      petId: value270 ? this.configValue.petId : "",
      petIdReady: value270,
      petName: this.status.account.petName
    };
    return value271;
  }
  async init(arg191) {
    const value273 = {
      recursive: true
    };
    this.context = arg191;
    fs.mkdirSync(arg191.dataPath, value273);
    this.loadConfig();
    try {
      const loginInfo4 = await arg191.actions.call("get_login_info", {}, arg191.adapterName, arg191.pluginManager.config);
      this.uin = String(loginInfo4?.user_id ?? "");
    } catch (value272) {
      this.log("暂未取得当前 QQ：" + String(value272));
    }
    const value274 = new ProgressStore(path.join(arg191.dataPath, "daily-progress.json"));
    this.scheduler = new AutomationController(this, value274);
    this.updateStatus({
      account: this.accountStatus(),
      config: this.getConfig(),
      progress: value274.snapshot()
    });
    if (this.configValue.enabled && this.configValue.autoStart) {
      this.scheduler.start();
    }
  }
  cleanup() {
    this.scheduler?.stop();
    this.scheduler = null;
    this.saveConfig();
    this.context = null;
  }
  loadConfig() {
    try {
      this.configValue = normalizeConfig(JSON.parse(fs.readFileSync(this.ctx.configPath, "utf8")));
    } catch {
      const value275 = {
        ...DEFAULT_CONFIG
      };
      this.configValue = value275;
      this.saveConfig();
    }
  }
  saveConfig() {
    const value276 = {
      recursive: true
    };
    if (this.context) {
      fs.mkdirSync(path.dirname(this.context.configPath), value276);
      fs.writeFileSync(this.context.configPath, JSON.stringify(this.configValue, null, 2) + "\n", "utf8");
    }
  }
  updateConfig(arg192) {
    const config4 = this.configValue;
    this.configValue = normalizeConfig({
      ...this.configValue,
      ...arg192
    });
    const value277 = ["visitEnabled", "visitFriends", "visitStrangers", "visitAutoCare", "visitMaxPerDay", "visitDelayMinMinutes", "visitDelayMaxMinutes", "otherCareDailyExperienceLimit", "visitCandidateScanLimit", "visitStrangerGroupIds"];
    if (this.scheduler && value277.some(item40 => config4[item40] !== this.configValue[item40])) {
      this.scheduler.progress.clearBlock("visit");
    }
    this.saveConfig();
    this.updateStatus({
      config: this.getConfig(),
      account: this.accountStatus()
    });
    if (this.scheduler && config4.intervalSeconds !== this.configValue.intervalSeconds && this.scheduler.running) {
      this.scheduler.stop();
      this.scheduler.start();
    }
    if (this.scheduler && config4.enabled !== this.configValue.enabled) {
      if (this.configValue.enabled && this.configValue.autoStart) {
        this.scheduler.start();
      } else if (!this.configValue.enabled) {
        this.scheduler.stop();
      }
    }
  }
  replaceConfig(arg193) {
    this.updateConfig(normalizeConfig(arg193));
  }
  log(arg194) {
    const value281 = {
      hour12: false
    };
    const value282 = Date.now();
    const value283 = new Date(value282).toLocaleTimeString("zh-CN", value281);
    const value284 = this.logTimes.get(arg194) ?? 0;
    if (value282 - value284 < 600000) {
      const value278 = (this.logCounts.get(arg194) ?? 1) + 1;
      this.logCounts.set(arg194, value278);
      this.logTimes.set(arg194, value282);
      const value279 = "] " + arg194;
      const value280 = this.logLines.findLastIndex(item41 => item41.includes(value279));
      if (value280 >= 0) {
        this.logLines.splice(value280, 1);
      }
      this.logLines.push("[" + value283 + "] " + arg194 + "（共 " + value278 + " 次）");
      return;
    }
    this.logCounts.set(arg194, 1);
    this.logTimes.set(arg194, value282);
    const value285 = "[" + value283 + "] " + arg194;
    this.logLines.push(value285);
    this.logLines = this.logLines.slice(-120);
    this.context?.logger.info(arg194);
  }
  updateStatus(arg195) {
    this.status = {
      ...this.status,
      ...arg195
    };
  }
  snapshot() {
    return structuredClone({
      ...this.status,
      automationRunning: this.scheduler?.running ?? false,
      logs: [...this.logLines].reverse(),
      config: this.getConfig(),
      account: this.accountStatus()
    });
  }
}
class RuntimeAdapter {
  constructor(arg196, arg240) {
    this.client = arg196;
    this.version = arg240;
  }
  call(arg197, arg241 = {}) {
    return this.client.call(arg197, arg241);
  }
}
class NapCatRuntimeAdapter extends RuntimeAdapter {
  kind = "napcat";
  runtimeName = "NapCat";
}
class SnowLumaRuntimeAdapter extends RuntimeAdapter {
  kind = "snowluma";
  runtimeName = "SnowLuma";
}
function detectRuntimeKind(arg198) {
  const value286 = String(arg198.app_name ?? "").toLowerCase();
  if (value286.includes("snowluma")) {
    return "snowluma";
  } else if (value286.includes("napcat")) {
    return "napcat";
  } else {
    return null;
  }
}
async function createRuntimeAdapter(client, requestedKind = "auto") {
  const version = await client.call("get_version_info");
  const detectedKind = detectRuntimeKind(version);
  const runtimeKind = requestedKind === "auto" ? detectedKind : requestedKind;
  if (!runtimeKind) {
    throw new Error("无法识别 OneBot 运行时：" + (version.app_name || "未返回 app_name"));
  }
  if (requestedKind !== "auto" && detectedKind && detectedKind !== requestedKind) {
    throw new Error("配置要求 " + requestedKind + "，但 OneBot 返回 " + version.app_name);
  }
  if (runtimeKind === "napcat") {
    return new NapCatRuntimeAdapter(client, version);
  } else {
    return new SnowLumaRuntimeAdapter(client, version);
  }
}
const DEFAULT_LOG_MAX_BYTES = 5242880;
const DEFAULT_LOG_BACKUPS = 5;
const MAX_LOG_ERROR_LENGTH = 32000;
function formatLogError(error) {
  const message = (error instanceof Error ? error.message : String(error)).replaceAll("\r", "\\r").replaceAll("\n", "\\n");
  if (message.length > MAX_LOG_ERROR_LENGTH) {
    return message.slice(0, MAX_LOG_ERROR_LENGTH) + "…";
  } else {
    return message;
  }
}
function createLogger(dataDir, options = {}) {
  const logDir = path.join(dataDir, "logs");
  const logPath = path.join(logDir, "qqpet.log");
  const maxBytes = Math.max(1024, Math.trunc(options.maxBytes ?? DEFAULT_LOG_MAX_BYTES));
  const backups = Math.max(1, Math.min(20, Math.trunc(options.backups ?? DEFAULT_LOG_BACKUPS)));
  const now = options.now ?? (() => new Date());
  let writeFailureReported = false;
  const value296 = arg199 => {
    if (!writeFailureReported) {
      writeFailureReported = true;
      process.stderr.write("[QQPet] 本地日志写入失败：" + formatLogError(arg199) + "\n");
    }
  };
  const value297 = arg1100 => {
    let value290 = 0;
    try {
      value290 = fs.statSync(logPath).size;
    } catch (value287) {
      if (value287.code !== "ENOENT") {
        throw value287;
      }
    }
    if (value290 + arg1100 <= maxBytes) {
      return;
    }
    const value291 = logPath + "." + backups;
    if (fs.existsSync(value291)) {
      fs.unlinkSync(value291);
    }
    for (let value289 = backups - 1; value289 >= 1; value289 -= 1) {
      const value288 = logPath + "." + value289;
      if (fs.existsSync(value288)) {
        fs.renameSync(value288, logPath + "." + (value289 + 1));
      }
    }
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, logPath + ".1");
    }
  };
  const value298 = (arg1101, arg242, items35) => {
    const value294 = items35.length ? " " + items35.map(formatLogError).join(" ") : "";
    const value295 = "[" + now().toISOString() + "] [" + arg1101 + "] " + formatLogError(arg242) + value294 + "\n";
    process.stdout.write(value295);
    try {
      const value292 = {
        recursive: true,
        mode: 448
      };
      fs.mkdirSync(logDir, value292);
      value297(Buffer.byteLength(value295));
      fs.appendFileSync(logPath, value295, {
        encoding: "utf8",
        mode: 384
      });
      try {
        fs.chmodSync(logPath, 384);
      } catch {}
    } catch (value293) {
      value296(value293);
    }
  };
  return {
    filePath: logPath,
    debug: (arg1102, ...arg243) => value298("DEBUG", arg1102, arg243),
    info: (arg1103, ...arg244) => value298("INFO", arg1103, arg244),
    warn: (arg1104, ...arg245) => value298("WARN", arg1104, arg245),
    error: (arg1105, ...arg246) => value298("ERROR", arg1105, arg246)
  };
}
class OneBotError extends Error {
  constructor(arg1106, arg247, arg311 = 0, arg4 = -1) {
    super(arg1106);
    this.action = arg247;
    this.httpStatus = arg311;
    this.retcode = arg4;
    this.name = "OneBotActionError";
  }
}
function normalizeOneBotUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("QQPET_ONEBOT_URL 无效：" + value);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("OneBot 地址只支持 HTTP/HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("OneBot 地址不能包含用户名或密码，请使用 QQPET_ONEBOT_TOKEN");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}
class OneBotHttpClient {
  constructor(options, fetchImpl = fetch) {
    this.fetchImpl = fetchImpl;
    this.baseUrl = normalizeOneBotUrl(options.baseUrl);
    this.accessToken = options.accessToken?.trim() ?? "";
    this.timeoutMs = Math.max(1000, options.timeoutMs ?? 15000);
  }
  baseUrl;
  accessToken;
  timeoutMs;
  async call(action, params = {}) {
    if (!/^[.a-zA-Z0-9_]+$/.test(action)) {
      throw new OneBotError("OneBot action 名称无效", action);
    }
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (this.accessToken) {
      headers.Authorization = "Bearer " + this.accessToken;
    }
    let response;
    try {
      response = await this.fetchImpl(this.baseUrl + "/" + action, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new OneBotError("OneBot 请求失败：" + message, action);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new OneBotError("OneBot 返回了非 JSON 响应（HTTP " + response.status + "）", action, response.status);
    }
    const retcode = Number(payload.retcode ?? (payload.status === "ok" ? 0 : -1));
    if (!response.ok || payload.status !== "ok" || retcode !== 0) {
      const wording = payload.message || payload.wording || "HTTP " + response.status;
      throw new OneBotError("OneBot action " + action + " 失败：" + wording, action, response.status, retcode);
    }
    return payload.data;
  }
}
const MAX_REQUEST_BODY_BYTES = 262144;
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};
function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}
async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new Error("请求体过大");
    }
    chunks.push(buffer);
  }
  if (!chunks.length) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求体不是有效 JSON");
  }
}
function serveStaticFile(response, filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    const value299 = {
      code: -1,
      message: "文件不存在"
    };
    sendJson(response, 404, value299);
    return;
  }
  if (!stat.isFile()) {
    const value300 = {
      code: -1,
      message: "文件不存在"
    };
    sendJson(response, 404, value300);
    return;
  }
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": filePath.endsWith(".html") ? "no-store" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(response);
}
function renderIndexHtml(webuiPath, runtimeName) {
  const appMtime = Math.trunc(fs.statSync(path.join(webuiPath, "app.js")).mtimeMs);
  return fs.readFileSync(path.join(webuiPath, "index.html"), "utf8").replace("ONEBOT · QQ PET", runtimeName.toUpperCase() + " · QQ PET").replace("正在连接 OneBot…", "正在连接 " + runtimeName + "…").replace(/<script type="module" src="\/static\/app\.js[^"]*/, "<script>window.__QQPET_API_BASE__=\"/api\";</script>\n  <script type=\"module\" src=\"/static/app.js?v=" + appMtime);
}
function createWebServer(plugin, options) {
  const indexHtml = renderIndexHtml(options.webuiPath, options.runtimeName);
  return http.createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (method === "GET" && url.pathname === "/healthz") {
        const value301 = {
          status: "ok",
          runtime: options.runtimeKind,
          uin: options.uin
        };
        sendJson(response, 200, value301);
        return;
      }
      if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(indexHtml),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY"
        });
        response.end(indexHtml);
        return;
      }
      if (method === "GET" && url.pathname.startsWith("/static/")) {
        const assetPath = decodeURIComponent(url.pathname.slice(8));
        if (!assetPath || assetPath.includes("\0") || assetPath.split("/").includes("..")) {
          const value302 = {
            code: -1,
            message: "静态文件路径无效"
          };
          sendJson(response, 400, value302);
          return;
        }
        serveStaticFile(response, path.join(options.webuiPath, assetPath));
        return;
      }
      if (method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, {
          code: 0,
          data: plugin.snapshot()
        });
        return;
      }
      if (method === "GET" && url.pathname === "/api/config") {
        sendJson(response, 200, {
          code: 0,
          data: plugin.getConfig()
        });
        return;
      }
      if (method === "PUT" && url.pathname === "/api/config") {
        plugin.updateConfig(await readJsonBody(request));
        sendJson(response, 200, {
          code: 0,
          data: plugin.getConfig()
        });
        return;
      }
      if (method === "POST" && url.pathname === "/api/refresh") {
        await plugin.scheduler?.refreshReadonly();
        sendJson(response, 200, {
          code: 0,
          data: plugin.snapshot()
        });
        return;
      }
      if (method === "POST" && url.pathname === "/api/run-once") {
        const value303 = await plugin.scheduler?.runOnce();
        sendJson(response, 200, {
          code: 0,
          data: {
            action: value303,
            status: plugin.snapshot()
          }
        });
        return;
      }
      if (method === "POST" && url.pathname === "/api/automation/start") {
        sendJson(response, 200, {
          code: 0,
          data: {
            changed: plugin.scheduler?.start() ?? false
          }
        });
        return;
      }
      if (method === "POST" && url.pathname === "/api/automation/stop") {
        sendJson(response, 200, {
          code: 0,
          data: {
            changed: plugin.scheduler?.stop() ?? false
          }
        });
        return;
      }
      if (method === "POST" && url.pathname === "/api/catalogs") {
        sendJson(response, 200, {
          code: 0,
          data: await plugin.scheduler?.catalogs()
        });
        return;
      }
      const value304 = {
        code: -1,
        message: "接口不存在"
      };
      sendJson(response, 404, value304);
    } catch (error14) {
      const value305 = error14 instanceof Error ? error14.message : String(error14);
      sendJson(response, value305 === "请求体过大" ? 413 : 500, {
        code: -1,
        message: value305
      });
    }
  });
}
const pluginDir = path.dirname(fileURLToPath(import.meta.url));
function parsePort(envName, defaultPort, allowZero = false) {
  const port = Number(process.env[envName] ?? defaultPort);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(port) || port < minimum || port > 65535) {
    throw new Error(envName + " 必须是 " + minimum + "～65535 的端口");
  }
  return port;
}
function isDesktopMode() {
  return ["1", "true", "yes"].includes((process.env.QQPET_DESKTOP_MODE ?? "").trim().toLowerCase());
}
function sendDesktopEvent(event) {
  if (isDesktopMode()) {
    process.stdout.write("QQPET_DESKTOP_EVENT " + JSON.stringify(event) + "\n");
  }
}
function normalizeWebHost(host) {
  const normalizedHost = host.trim().toLowerCase();
  if (!["127.0.0.1", "localhost", "::1"].includes(normalizedHost)) {
    throw new Error("QQPET_WEB_HOST 当前仅允许 127.0.0.1、localhost 或 ::1");
  }
  return normalizedHost;
}
async function main() {
  const oneBotUrl = process.env.QQPET_ONEBOT_URL?.trim() || "http://127.0.0.1:3000";
  const requestedRuntime = process.env.QQPET_RUNTIME?.trim().toLowerCase() || "auto";
  if (!["auto", "napcat", "snowluma"].includes(requestedRuntime)) {
    throw new Error("QQPET_RUNTIME 只能是 auto、napcat 或 snowluma");
  }
  const oneBotClient = new OneBotHttpClient({
    baseUrl: oneBotUrl,
    accessToken: process.env.QQPET_ONEBOT_TOKEN,
    timeoutMs: Number(process.env.QQPET_ONEBOT_TIMEOUT_MS ?? 15000)
  });
  const runtime = await createRuntimeAdapter(oneBotClient, requestedRuntime);
  const loginInfo = await runtime.call("get_login_info");
  const uin = String(loginInfo.user_id ?? "").trim();
  if (!/^\d{5,20}$/.test(uin)) {
    throw new Error(runtime.runtimeName + " 未返回有效的当前 QQ 号");
  }
  const dataRoot = process.env.QQPET_DATA_DIR?.trim() ? path.resolve(process.env.QQPET_DATA_DIR) : path.join(os.homedir(), ".qqpet-onebot");
  const accountDataDir = path.join(dataRoot, runtime.kind, uin);
  const value307 = {
    recursive: true
  };
  fs.mkdirSync(accountDataDir, value307);
  const logger = createLogger(accountDataDir);
  const pluginContext = {
    actions: {
      call: (action, params) => runtime.call(action, params ?? {})
    },
    adapterName: runtime.kind + "-onebot-http",
    pluginManager: {
      config: {
        baseUrl: oneBotUrl,
        runtime: runtime.kind
      }
    },
    pluginName: "qqpet-" + runtime.kind + "-onebot",
    pluginPath: pluginDir,
    configPath: path.join(accountDataDir, "config.json"),
    dataPath: accountDataDir,
    logger: logger
  };
  const plugin = new QQPetPlugin(runtime.runtimeName);
  await plugin.init(pluginContext);
  const webHost = normalizeWebHost(process.env.QQPET_WEB_HOST || "127.0.0.1");
  const webPort = parsePort("QQPET_WEB_PORT", 8090, isDesktopMode());
  const webuiPath = path.join(pluginDir, "webui");
  const server = createWebServer(plugin, {
    host: webHost,
    port: webPort,
    webuiPath: webuiPath,
    runtimeName: runtime.runtimeName,
    runtimeKind: runtime.kind,
    uin: uin
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(webPort, webHost, resolve);
  });
  const actualPort = server.address()?.port;
  if (!actualPort) {
    throw new Error("无法读取 QQPet Web UI 实际监听端口");
  }
  const webUrl = "http://" + webHost + ":" + actualPort;
  logger.info(runtime.runtimeName + " OneBot QQ 宠物已连接 QQ " + uin + (loginInfo.nickname ? "（" + loginInfo.nickname + "）" : ""));
  logger.info(("运行时版本：" + (runtime.version.app_name ?? runtime.runtimeName) + " " + (runtime.version.app_version ?? "")).trim());
  logger.info("Web UI：" + webUrl);
  logger.info("本地日志：" + logger.filePath);
  sendDesktopEvent({
    type: "ready",
    protocolVersion: 1,
    botId: process.env.QQPET_DESKTOP_BOT_ID?.trim() || undefined,
    pid: process.pid,
    runtime: runtime.kind,
    uin: uin,
    webUrl: webUrl,
    webPort: actualPort
  });
  let stopping = false;
  const shutdown = async () => {
    const value306 = {
      type: "stopping",
      pid: process.pid
    };
    if (!stopping) {
      stopping = true;
      sendDesktopEvent(value306);
      plugin.cleanup();
      await new Promise(resolve3 => server.close(() => resolve3()));
      sendDesktopEvent({
        type: "stopped",
        pid: process.pid
      });
    }
  };
  const value308 = {
    input: process.stdin,
    terminal: false
  };
  if (isDesktopMode()) {
    readline.createInterface(value308).on("line", arg1107 => {
      try {
        if (JSON.parse(arg1107).command === "shutdown") {
          shutdown().then(() => process.exit(0));
        }
      } catch {}
    });
  }
  process.once("SIGINT", () => {
    shutdown().then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    shutdown().then(() => process.exit(0));
  });
}
main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write("OneBot QQ 宠物启动失败：" + message + "\n");
  process.exitCode = 1;
});
