/* Miku QQ Pet readable runtime, reconstructed from the upstream release build. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import http from "node:http";
const DEFAULT_CONFIG_VALUES = {
  enabled: true,
  autoStart: false,
  safeMode: false,
  petId: "AUTO",
  intervalSeconds: 15,
  statusRefreshSeconds: 15,
  coinThreshold: 0,
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
  schoolSelectionMode: "lowest",
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
  adventureEnabled: false,
  adventureOption: "",
  adventureStartTime: "20:00",
  adventureEndTime: "23:59",
  adventureTimesPerDay: 3,
  settleRetrySeconds: 60,
  startConfirmSeconds: 45
};
const DEFAULT_CONFIG = DEFAULT_CONFIG_VALUES;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const NUMERIC_CONFIG_KEYS = ["intervalSeconds", "statusRefreshSeconds", "coinThreshold", "hungerThreshold", "cleanThreshold", "foodPurchaseCount", "bathPurchaseCount", "verifyDelaySeconds", "failureCooldownSeconds", "schoolRotationEvery", "courseSubEvent", "visitMaxPerDay", "visitDelayMinMinutes", "visitDelayMaxMinutes", "otherCareDailyExperienceLimit", "visitCandidateScanLimit", "workCareerType", "workJobSubEvent", "workTimesPerDay", "workFriendScanLimit", "adventureTimesPerDay", "settleRetrySeconds", "startConfirmSeconds"];
function normalizeTimeOfDay(value, fallback) {
  const text = String(value ?? "").trim();
  return TIME_OF_DAY_PATTERN.test(text) ? text : fallback;
}
function isWithinTimeWindow(nowHhmm, startHhmm, endHhmm) {
  if (startHhmm <= endHhmm) {
    return nowHhmm >= startHhmm && nowHhmm <= endHhmm;
  }
  // Cross-midnight window, e.g. 22:00 → 02:00.
  return nowHhmm >= startHhmm || nowHhmm <= endHhmm;
}
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
  if (!["lowest", "rotation", "fixed"].includes(config.schoolSelectionMode)) {
    config.schoolSelectionMode = "lowest";
  }
  if (!["school", "work", "smart"].includes(config.taskPriority)) {
    config.taskPriority = "school";
  }
  if (!["rest", "work", "school", "adventure"].includes(config.fatigue8HourAction)) {
    config.fatigue8HourAction = "rest";
  }
  if (!["rest", "work", "school", "adventure"].includes(config.fatigue12HourAction)) {
    config.fatigue12HourAction = "rest";
  }
  config.adventureStartTime = normalizeTimeOfDay(config.adventureStartTime, "20:00");
  config.adventureEndTime = normalizeTimeOfDay(config.adventureEndTime, "23:59");
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
  config.verifyDelaySeconds = Math.max(0, Math.min(30, Math.trunc(config.verifyDelaySeconds)));
  config.failureCooldownSeconds = Math.max(0, Math.trunc(config.failureCooldownSeconds));
  config.settleRetrySeconds = Math.max(1, Math.trunc(config.settleRetrySeconds));
  config.startConfirmSeconds = Math.max(5, Math.trunc(config.startConfirmSeconds));
  return config;
}
function isAutoPetId(petId) {
  return ["", "AUTO", "YOUR_PET_ID"].includes(String(petId ?? "").trim().toUpperCase());
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
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function createDailyProgress() {
  const counts = {
    ...EMPTY_DAILY_COUNTS
  };
  return {
    date: currentDateKey(),
    counts: counts,
    history: [],
    pending: null,
    careBlocks: {},
    settledStoryIds: [],
    dismissedStoryIds: [],
    schoolRotationIndex: 0,
    schoolRotationProgress: 0,
    visitedTargetIds: [],
    attributeBaseline: null,
    dailyExperienceGain: 0,
    goldFloor: null,
    dailyGoldGain: 0,
    telemetry: [],
    recentFailures: []
  };
}
function writeJsonAtomically(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const body = JSON.stringify(value, null, 2) + "\n";
  try {
    fs.writeFileSync(tempPath, body, "utf8");
    try {
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      if (!error || !["EEXIST", "EPERM"].includes(error.code)) {
        throw error;
      }
      fs.rmSync(filePath, {
        force: true
      });
      fs.renameSync(tempPath, filePath);
    }
  } finally {
    fs.rmSync(tempPath, {
      force: true
    });
  }
}
function backupCorruptFile(filePath, error) {
  if (error?.code === "ENOENT") {
    return;
  }
  try {
    fs.copyFileSync(filePath, `${filePath}.corrupt-${Date.now()}`);
  } catch {
    // Preserve the original error path even when the backup cannot be made.
  }
}
class ProgressStore {
  constructor(filePath) {
    const mkdirOptions = {
      recursive: true
    };
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), mkdirOptions);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const {
        pendingReturnVisits: pendingReturnVisits,
        ...rest
      } = parsed;
      const carriedCounts = {
        ...(rest.counts ?? {})
      };
      delete carriedCounts.returnVisit;
      this.state = {
        ...createDailyProgress(),
        ...rest,
        counts: {
          ...EMPTY_DAILY_COUNTS,
          ...carriedCounts
        },
        careBlocks: rest.careBlocks ?? {},
        settledStoryIds: rest.settledStoryIds ?? [],
        dismissedStoryIds: rest.dismissedStoryIds ?? [],
        schoolRotationIndex: Math.max(0, Math.trunc(Number(rest.schoolRotationIndex) || 0)),
        schoolRotationProgress: Math.max(0, Math.trunc(Number(rest.schoolRotationProgress) || 0)),
        visitedTargetIds: Array.isArray(rest.visitedTargetIds) ? rest.visitedTargetIds.map(String).slice(-500) : [],
        attributeBaseline: rest.attributeBaseline && typeof rest.attributeBaseline == "object" ? {
          strength: Math.max(0, Number(rest.attributeBaseline.strength) || 0),
          intelligence: Math.max(0, Number(rest.attributeBaseline.intelligence) || 0),
          charm: Math.max(0, Number(rest.attributeBaseline.charm) || 0)
        } : null,
        dailyExperienceGain: Math.max(0, Math.trunc(Number(rest.dailyExperienceGain) || 0)),
        goldFloor: rest.goldFloor === null || rest.goldFloor === void 0 ? null : Math.max(0, Number(rest.goldFloor) || 0),
        dailyGoldGain: Math.max(0, Math.trunc(Number(rest.dailyGoldGain) || 0)),
        telemetry: Array.isArray(rest.telemetry) ? rest.telemetry.slice(-100) : [],
        recentFailures: Array.isArray(rest.recentFailures) ? rest.recentFailures.slice(-50) : []
      };
    } catch (error) {
      backupCorruptFile(filePath, error);
      this.state = createDailyProgress();
    }
    this.rollover();
    this.save();
  }
  state;
  save() {
    writeJsonAtomically(this.filePath, this.state);
  }
  rollover(dateKey = currentDateKey()) {
    if (this.state.date === dateKey) {
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
        date: dateKey,
        counts: {
          ...EMPTY_DAILY_COUNTS
        },
        pending: null,
        careBlocks: {},
        visitedTargetIds: [],
        attributeBaseline: null,
        dailyExperienceGain: 0,
        goldFloor: null,
        dailyGoldGain: 0,
        recentFailures: []
      };
      this.save();
      return true;
    }
  }
  snapshot() {
    this.rollover();
    return structuredClone(this.state);
  }
  count(kind) {
    return this.snapshot().counts[kind] ?? 0;
  }
  increment(kind) {
    this.rollover();
    this.state.counts[kind] = (this.state.counts[kind] ?? 0) + 1;
    this.save();
    return this.state.counts[kind];
  }
  advanceSchoolRotation(every) {
    this.increment("school");
    this.state.schoolRotationProgress += 1;
    if (this.state.schoolRotationProgress >= Math.max(1, Math.trunc(every))) {
      this.state.schoolRotationIndex = (this.state.schoolRotationIndex + 1) % 3;
      this.state.schoolRotationProgress = 0;
    }
    this.save();
    return this.state.schoolRotationIndex;
  }
  setPending(kind, storyId = "", metadata = {}) {
    this.state.pending = {
      kind: kind,
      createdAt: new Date().toISOString(),
      confirmed: !!storyId,
      storyId: storyId,
      ...metadata
    };
    this.save();
  }
  confirmPending(storyId) {
    if (this.state.pending) {
      this.state.pending.confirmed = true;
      this.state.pending.storyId = storyId;
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
    const pending = this.state.pending;
    this.state.pending = null;
    this.save();
    return pending;
  }
  storyWasSettled(storyId) {
    return this.state.settledStoryIds.includes(storyId);
  }
  markStorySettled(storyId) {
    if (!this.state.settledStoryIds.includes(storyId)) {
      this.state.settledStoryIds.push(storyId);
      this.state.settledStoryIds = this.state.settledStoryIds.slice(-100);
      this.save();
    }
  }
  storyWasDismissed(storyId) {
    return this.state.dismissedStoryIds.includes(storyId);
  }
  dismissStory(storyId) {
    if (!this.state.dismissedStoryIds.includes(storyId)) {
      this.state.dismissedStoryIds.push(storyId);
      this.state.dismissedStoryIds = this.state.dismissedStoryIds.slice(-100);
      this.save();
    }
  }
  setBlock(key, reason, seconds) {
    this.state.careBlocks[key] = {
      reason: reason,
      until: Date.now() / 1000 + Math.max(0, seconds)
    };
    this.save();
  }
  activeBlock(key) {
    const block = this.state.careBlocks[key];
    if (block) {
      if (block.until <= Date.now() / 1000) {
        delete this.state.careBlocks[key];
        this.save();
        return null;
      } else {
        return {
          ...block
        };
      }
    } else {
      return null;
    }
  }
  clearBlock(key) {
    if (this.state.careBlocks[key]) {
      delete this.state.careBlocks[key];
      this.save();
    }
  }
  targetWasVisited(targetId) {
    return this.snapshot().visitedTargetIds.includes(targetId);
  }
  markTargetVisited(targetId) {
    if (!this.state.visitedTargetIds.includes(targetId)) {
      this.state.visitedTargetIds.push(targetId);
      this.state.visitedTargetIds = this.state.visitedTargetIds.slice(-500);
      this.save();
    }
  }
  recordAttributes(values) {
    this.rollover();
    const attributes = {
      strength: Math.max(0, Number(values.strength) || 0),
      intelligence: Math.max(0, Number(values.intelligence) || 0),
      charm: Math.max(0, Number(values.charm) || 0)
    };
    if (!this.state.attributeBaseline) {
      this.state.attributeBaseline = attributes;
      this.state.dailyExperienceGain = 0;
    } else {
      const attributeBaseline = this.state.attributeBaseline;
      const attributeNames = ["strength", "intelligence", "charm"];
      if (attributeNames.every(name => attributes[name] < attributeBaseline[name])) {
        this.state.attributeBaseline = attributes;
        this.state.dailyExperienceGain = 0;
      } else {
        this.state.dailyExperienceGain = attributeNames.reduce((total, name) => total + Math.max(0, attributes[name] - attributeBaseline[name]), 0);
      }
    }
    if (Number.isFinite(Number(values.gold))) {
      const gold = Math.max(0, Number(values.gold));
      if (this.state.goldFloor === null) {
        this.state.goldFloor = gold;
      } else if (gold < this.state.goldFloor) {
        // Ignore suspicious collapse-to-zero readings that would later inflate dailyGoldGain.
        const previous = this.state.goldFloor;
        const isGlitchZero = gold === 0 && previous >= 10 && (previous - gold) / previous >= 0.5;
        if (!isGlitchZero) {
          this.state.goldFloor = gold;
        }
      } else if (gold > this.state.goldFloor) {
        this.state.dailyGoldGain += gold - this.state.goldFloor;
        this.state.goldFloor = gold;
      }
    }
    this.save();
    return this.state.dailyExperienceGain;
  }
  recordTelemetry(entry) {
    this.rollover();
    this.state.telemetry.push({
      ...entry,
      recordedAt: entry.recordedAt ?? new Date().toISOString()
    });
    this.state.telemetry = this.state.telemetry.slice(-100);
    this.save();
  }
  recordFailure(kind) {
    this.rollover();
    this.state.recentFailures.push({ kind: kind, at: new Date().toISOString() });
    this.state.recentFailures = this.state.recentFailures.slice(-50);
    this.save();
  }
  isTaskDiscouraged(kind, windowMs = 600000, threshold = 2) {
    return isFailureDiscouraged(kind, this.snapshot().recentFailures, windowMs, threshold);
  }
}
function concatBytes(...chunks) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
function encodeVarint(value) {
  if (!Number.isSafeInteger(value)) {
    throw new Error("varint 不是安全整数: " + value);
  }
  let remaining = value < 0 ? BigInt.asUintN(64, BigInt(value)) : BigInt(value);
  const encodedBytes = [];
  do {
    const sevenBits = Number(remaining & 0x7fn);
    remaining >>= 0x7n;
    encodedBytes.push(sevenBits | (remaining ? 128 : 0));
  } while (remaining);
  return Uint8Array.from(encodedBytes);
}
function encodeVarintField(fieldNumber, value) {
  return concatBytes(encodeVarint(fieldNumber << 3), encodeVarint(value));
}
function encodeBytesField(fieldNumber, bytes) {
  return concatBytes(encodeVarint(fieldNumber << 3 | 2), encodeVarint(bytes.length), bytes);
}
function encodeStringField(fieldNumber, text) {
  return encodeBytesField(fieldNumber, new TextEncoder().encode(text));
}
function decodeVarint(bytes, offset) {
  let position = offset;
  let result = 0x0n;
  let shift = 0x0n;
  while (position < bytes.length) {
    const byte = bytes[position++];
    result |= BigInt(byte & 127) << shift;
    if ((byte & 128) === 0) {
      const value = Number(result);
      if (!Number.isSafeInteger(value)) {
        throw new Error("protobuf varint 超出安全整数范围");
      }
      return [value, position];
    }
    shift += 0x7n;
    if (shift > 0x46n) {
      throw new Error("protobuf varint 太长");
    }
  }
  throw new Error("protobuf varint 被截断");
}
function parseProtobufFields(bytes) {
  const fieldsByNumber = new Map();
  let position = 0;
  while (position < bytes.length) {
    let tag;
    [tag, position] = decodeVarint(bytes, position);
    const fieldNumber = tag >>> 3;
    const wireType = tag & 7;
    if (!fieldNumber) {
      throw new Error("protobuf 字段号为 0");
    }
    let fieldValue;
    if (wireType === 0) {
      [fieldValue, position] = decodeVarint(bytes, position);
    } else if (wireType === 1) {
      if (position + 8 > bytes.length) {
        throw new Error("fixed64 被截断");
      }
      fieldValue = bytes.slice(position, position + 8);
      position += 8;
    } else if (wireType === 2) {
      let fieldLength;
      [fieldLength, position] = decodeVarint(bytes, position);
      if (position + fieldLength > bytes.length) {
        throw new Error("length-delimited 字段被截断");
      }
      fieldValue = bytes.slice(position, position + fieldLength);
      position += fieldLength;
    } else if (wireType === 5) {
      if (position + 4 > bytes.length) {
        throw new Error("fixed32 被截断");
      }
      fieldValue = bytes.slice(position, position + 4);
      position += 4;
    } else {
      throw new Error("暂不支持 protobuf wire type " + wireType);
    }
    const entries = fieldsByNumber.get(fieldNumber) ?? [];
    const fieldEntry = {
      wireType: wireType,
      value: fieldValue
    };
    entries.push(fieldEntry);
    fieldsByNumber.set(fieldNumber, entries);
  }
  return fieldsByNumber;
}
function getProtobufFields(fields, fieldNumber) {
  return fields.get(fieldNumber) ?? [];
}
function getVarintField(fields, fieldNumber, fallback = 0) {
  const field = fields.get(fieldNumber)?.[0];
  if (field?.wireType === 0) {
    return Number(field.value);
  } else {
    return fallback;
  }
}
function getBytesField(fields, fieldNumber) {
  const field = fields.get(fieldNumber)?.[0];
  if (field?.wireType === 2) {
    return field.value;
  } else {
    return new Uint8Array();
  }
}
function getStringField(fields, fieldNumber, fallback = "") {
  const fieldBytes = getBytesField(fields, fieldNumber);
  if (fieldBytes.length) {
    return new TextDecoder().decode(fieldBytes);
  } else {
    return fallback;
  }
}
function getFloatField(fields, fieldNumber, fallback = 0) {
  const field = fields.get(fieldNumber)?.[0];
  if (field?.wireType !== 5) {
    return fallback;
  }
  const fieldBytes = field.value;
  return new DataView(fieldBytes.buffer, fieldBytes.byteOffset, 4).getFloat32(0, true);
}
function buildPacketEnvelope(command, subCommand, body) {
  return concatBytes(encodeVarintField(1, command), encodeVarintField(2, subCommand), encodeBytesField(4, body), encodeVarintField(12, 1));
}
function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}
function hexToBytes(hex) {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) {
    throw new Error("响应不是有效十六进制");
  }
  return new Uint8Array(Buffer.from(hex, "hex"));
}
class QQPetError extends Error {
  constructor(message, code = "") {
    super(message);
    this.code = code;
  }
}
class TaskFallbackError extends Error {
  constructor(message) {
    super(message);
    this.name = "TaskFallbackError";
  }
}
function isFallbackWorthy(error) {
  if (error instanceof TaskFallbackError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /不可用|暂无可用|暂无|没有开放|没有可执行|无可|不存在|尚未|不满足|未达到|条件不|not found|not available|no (?:available|open)|requirement/i.test(message);
}
function isFailureDiscouraged(kind, recentFailures = [], windowMs = 600000, threshold = 2) {
  const cutoff = Date.now() - windowMs;
  return recentFailures.filter(entry => entry.kind === kind && Number.isFinite(Date.parse(entry.at)) && Date.parse(entry.at) >= cutoff).length >= threshold;
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
  interactionHistory: ["OidbSvcTrpcTcp.0x994d_1", 39245, 1],
};
function extractPacketHex(payload) {
  if (typeof payload == "string") {
    return payload;
  }
  if (!payload || typeof payload != "object") {
    return "";
  }
  const payloadObject = payload;
  for (const candidateKey of ["data", "packet", "hex"]) {
    const candidateValue = payloadObject[candidateKey];
    if (typeof candidateValue == "string" && /^(?:[0-9a-fA-F]{2})+$/.test(candidateValue)) {
      return candidateValue;
    }
    const packetHex = extractPacketHex(candidateValue);
    if (packetHex) {
      return packetHex;
    }
  }
  return "";
}
function parseRewardAmount(rewardText) {
  const rewardString = String(rewardText ?? "");
  const numberPattern = "(\\d+(?:\\.\\d+)?)";
  const total = rewardString.match(new RegExp("(?:总收益|合计|总计|共获得|合计获得)\\D*" + numberPattern))?.[1];
  const gold = rewardString.match(new RegExp("(?:金币|金豆|经验)\\D*" + numberPattern))?.[1];
  const first = rewardString.match(new RegExp(numberPattern))?.[1];
  return Number(total ?? gold ?? first ?? 0);
}
function extractImageUrl(...texts) {
  for (const text of texts) {
    const imageUrl = text.match(/https:\/\/[^\s\])]+\.(?:png|webp|jpe?g|gif)/i)?.[0];
    if (imageUrl) {
      return imageUrl;
    }
  }
  return "";
}
function stripMarkdown(text) {
  return text.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function parseMedal(bytes, acquired = true, equipped) {
  const fields = parseProtobufFields(bytes);
  return {
    id: getVarintField(fields, 1),
    name: getStringField(fields, 2),
    progress: getStringField(fields, 3),
    acquired: acquired,
    category: getStringField(fields, 5),
    imageUrl: extractImageUrl(getStringField(fields, 7)),
    requirement: getStringField(fields, 8),
    description: getStringField(fields, 9),
    ...(equipped === undefined ? {} : {
      equipped: equipped
    })
  };
}
function parseInteractionText(raw) {
  try {
    const segments = JSON.parse(raw);
    if (Array.isArray(segments)) {
      const trimmed = segments.map(segment => {
        if (!segment || typeof segment != "object") {
          return "";
        }
        const text = segment.text;
        if (typeof text == "string") {
          return text;
        } else {
          return "";
        }
      }).join("").trim();
      if (trimmed) {
        return trimmed.replace(/^\d{1,2}:\d{2}\s*/, "");
      }
    }
  } catch {}
  return raw.trim();
}
function parseCatalogItem(bytes, extra = {}) {
  const fields = parseProtobufFields(bytes);
  const plainText = stripMarkdown(getStringField(fields, 8));
  return {
    name: getStringField(fields, 1),
    subEventType: getVarintField(fields, 52),
    cost: getStringField(fields, 6),
    duration: getStringField(fields, 7),
    reward: extra.careerType && /^\d+(?:\.\d+)?$/.test(plainText) ? "金币 " + plainText : plainText,
    description: getStringField(fields, 10) || getStringField(fields, 14),
    canDo: !!getVarintField(fields, 50),
    unavailableReason: getStringField(fields, 51),
    warning: getStringField(fields, 17),
    iconUrl: extractImageUrl(getStringField(fields, 2)),
    rewardIconUrl: extractImageUrl(getStringField(fields, 8), getStringField(fields, 12), getStringField(fields, 6)),
    ...extra
  };
}
function parseDurationSeconds(durationText) {
  const durationString = String(durationText ?? "");
  const hours = Number(durationString.match(/(\d+)\s*(?:小时|时|h\b)/i)?.[1] ?? 0);
  const minutes = Number(durationString.match(/(\d+)\s*(?:分钟|分|m\b)/i)?.[1] ?? 0);
  const seconds = Number(durationString.match(/(\d+)\s*(?:秒|s\b)/i)?.[1] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}
function compareRewardPerSecond(left, right) {
  const leftDuration = parseDurationSeconds(left.duration);
  const rightDuration = parseDurationSeconds(right.duration);
  const leftReward = parseRewardAmount(left.reward);
  const rightReward = parseRewardAmount(right.reward);
  if (leftDuration > 0 && rightDuration > 0) {
    const cross = rightReward * leftDuration - leftReward * rightDuration;
    if (cross) {
      return cross;
    }
  } else if (leftDuration !== rightDuration) {
    if (leftDuration > 0) {
      return -1;
    } else {
      return 1;
    }
  }
  return rightReward - leftReward;
}
function parseFatigueStatus(warningText) {
  const raw = String(warningText ?? "");
  let decoded = raw.trim();
  const encoded = raw.match(/[?&]text=([^)&\s]+)/)?.[1];
  if (encoded) {
    try {
      decoded = decodeURIComponent(encoded);
    } catch {}
  }
  const haystack = raw + "\n" + decoded;
  const tier12 = {
    fatigued: true,
    tier: 12,
    benefitRate: 0.1,
    reason: decoded || "服务器提示已超过 12 小时"
  };
  const tier8 = {
    fatigued: true,
    tier: 8,
    benefitRate: 0.25,
    reason: decoded || "服务器提示已超过 8 小时"
  };
  const rested = {
    fatigued: false,
    tier: 0,
    benefitRate: 1,
    reason: "服务器当前未返回疲劳提示"
  };
  if (/非常累|极度疲劳|超出\s*12\s*小时|超过\s*12\s*小时|降低至\s*10\s*%|收益.*10\s*%/.test(haystack)) {
    return tier12;
  }
  if (/疲惫|有点累|超出\s*8\s*小时|超过\s*8\s*小时|收益减少|降低至\s*25\s*%|收益.*25\s*%/.test(haystack)) {
    return tier8;
  }
  return rested;
}
class QQPetApi {
  constructor(ctx, petId) {
    this.ctx = ctx;
    this.petId = petId;
  }
  otherPetMobileAvailable = null;
  async sendPacket(packet, body) {
    const [commandName] = packet;
    let callResult;
    try {
      callResult = await this.ctx.actions.call("send_packet", {
        cmd: commandName,
        data: bytesToHex(body)
      }, this.ctx.adapterName, this.ctx.pluginManager.config);
    } catch (error) {
      throw new QQPetError("OneBot send_packet 失败：" + String(error));
    }
    const packetHex = extractPacketHex(callResult);
    if (!packetHex) {
      throw new QQPetError(commandName + " 返回空响应或未知响应结构");
    }
    try {
      return hexToBytes(packetHex);
    } catch (hexError) {
      throw new QQPetError(commandName + " 响应无法解析：" + String(hexError));
    }
  }
  async sendOidb(packet, body) {
    const [commandName, command, subCommand] = packet;
    const responseBytes = await this.sendPacket(packet, buildPacketEnvelope(command, subCommand, body));
    const fields = parseProtobufFields(responseBytes);
    const commandMatched = getVarintField(fields, 1) === command && getVarintField(fields, 2) === subCommand;
    const errorCode = commandMatched ? getVarintField(fields, 3) : 0;
    if (errorCode) {
      throw new QQPetError(commandName + " OIDB errorCode=" + errorCode);
    }
    return {
      command: command,
      subCommand: subCommand,
      errorCode: errorCode,
      body: commandMatched ? getBytesField(fields, 4) : responseBytes,
      raw: responseBytes
    };
  }
  async queryOwnPetProfile() {
    const [commandName, command, subCommand] = PACKETS.ownProfile;
    const responseBytes = await this.sendPacket(PACKETS.ownProfile, buildPacketEnvelope(command, subCommand, new Uint8Array()));
    let fields = parseProtobufFields(responseBytes);
    if (getVarintField(fields, 1) === command && getVarintField(fields, 2) === subCommand) {
      const errorCode = getVarintField(fields, 3);
      if (errorCode) {
        throw new QQPetError(commandName + " OIDB errorCode=" + errorCode);
      }
      fields = parseProtobufFields(getBytesField(fields, 4));
    }
    const profileFieldBytes = getBytesField(fields, 1);
    const profileFields = profileFieldBytes.length ? parseProtobufFields(profileFieldBytes) : fields;
    const petId = getStringField(profileFields, 8).trim();
    if (petId) {
      const levelFieldBytes = getBytesField(profileFields, 13);
      const levelFields = levelFieldBytes.length ? parseProtobufFields(levelFieldBytes) : new Map();
      const medalFieldBytes = getBytesField(profileFields, 14);
      const medalListFields = medalFieldBytes.length ? parseProtobufFields(medalFieldBytes) : new Map();
      const genderCode = getVarintField(profileFields, 6);
      const medals = getProtobufFields(medalListFields, 1).filter(medalField => medalField.wireType === 2).map(medalField => parseMedal(medalField.value, true, true));
      return {
        petId: petId,
        name: getStringField(profileFields, 1).trim(),
        birthdayAt: getVarintField(profileFields, 4),
        gender: genderCode === 1 ? "男" : genderCode === 2 ? "女" : "未知",
        species: getStringField(profileFields, 11).trim(),
        personality: getStringField(profileFields, 7).trim(),
        avatarUrl: getStringField(profileFields, 18).trim() || getStringField(profileFields, 3).trim(),
        fullAvatarUrl: getStringField(profileFields, 3).trim() || getStringField(profileFields, 18).trim(),
        personalityUrl: getStringField(profileFields, 9).trim(),
        medals: medals,
        level: getVarintField(levelFields, 1),
        currentExperience: getVarintField(levelFields, 2),
        levelExperience: getVarintField(levelFields, 3),
        experienceRate: getFloatField(levelFields, 4, 1)
      };
    }
    try {
      const cacheResponse = await this.sendOidb(PACKETS.ownPetCache, new Uint8Array());
      const cacheProfileBytes = getBytesField(parseProtobufFields(cacheResponse.body), 1);
      const cacheFields = cacheProfileBytes.length ? parseProtobufFields(cacheProfileBytes) : new Map();
      const petId = getStringField(cacheFields, 101).trim();
      if (petId) {
        return {
          petId: petId,
          name: getStringField(cacheFields, 1).trim(),
          birthdayAt: 0,
          gender: "未知",
          species: "",
          personality: "",
          level: 0,
          avatarUrl: getStringField(cacheFields, 3).trim(),
          fullAvatarUrl: getStringField(cacheFields, 3).trim(),
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
    const galleryFields = parseProtobufFields((await this.sendOidb(PACKETS.medalGallery, encodeStringField(1, this.petId))).body);
    const medals = [];
    for (const categoryField of getProtobufFields(galleryFields, 1)) {
      if (categoryField.wireType !== 2) {
        continue;
      }
      const categoryFields = parseProtobufFields(categoryField.value);
      for (const groupField of getProtobufFields(categoryFields, 3)) {
        if (groupField.wireType !== 2) {
          continue;
        }
        const groupFields = parseProtobufFields(groupField.value);
        for (const field of getProtobufFields(groupFields, 2)) {
          if (field.wireType !== 2) {
            continue;
          }
          const fields = parseProtobufFields(field.value);
          const fieldBytes = getBytesField(fields, 1);
          if (fieldBytes.length) {
            medals.push(parseMedal(fieldBytes, !!getVarintField(fields, 2), !!getVarintField(fields, 4)));
          }
        }
      }
    }
    return medals;
  }
  async queryInteractionMessages(limit = 20) {
    const requestBody = concatBytes(encodeVarintField(1, 0), encodeVarintField(2, Math.max(1, Math.min(50, Math.trunc(limit)))));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.interactionHistory, requestBody)).body);
    return getProtobufFields(fields, 1).flatMap(entryField => {
      if (entryField.wireType !== 2) {
        return [];
      }
      const fields = parseProtobufFields(entryField.value);
      const messageId = getStringField(fields, 4).trim();
      const interactionText = parseInteractionText(getStringField(fields, 2));
      if (!messageId || !interactionText) {
        return [];
      } else {
        return [{
          id: messageId,
          uin: getStringField(fields, 1).trim(),
          petName: getStringField(fields, 5).trim(),
          text: interactionText,
          timestamp: getVarintField(fields, 3),
          eventType: getVarintField(fields, 6)
        }];
      }
    });
  }
  async queryValues() {
    const statusRequest = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(1)));
    const valuesRequest = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(6)));
    const [profile, petValues, story] = await Promise.all([this.sendOidb(PACKETS.display, statusRequest), this.sendOidb(PACKETS.display, valuesRequest), this.queryAttributes()]);
    const fields = parseProtobufFields(getBytesField(parseProtobufFields(profile.body), 1));
    const statusOf = fieldNumber => getFloatField(parseProtobufFields(getBytesField(fields, fieldNumber)), 3);
    const valueFields = parseProtobufFields(getBytesField(parseProtobufFields(petValues.body), 1));
    return {
      feel: statusOf(1),
      hunger: statusOf(2),
      clean: statusOf(3),
      total: statusOf(4),
      gold: getFloatField(parseProtobufFields(getBytesField(valueFields, 5)), 3),
      ...story
    };
  }
  async queryAttributes() {
    const requestBody = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const overviewFields = parseProtobufFields((await this.sendOidb(PACKETS.overview, requestBody)).body);
    const fieldBytes = getBytesField(overviewFields, 2);
    const attributeFields = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
    const attributes = {
      strength: 0,
      intelligence: 0,
      charm: 0
    };
    const attributeFieldList = [1, 2, 3].flatMap(fieldNumber => getProtobufFields(attributeFields, fieldNumber));
    for (const field of attributeFieldList) {
      if (field.wireType !== 2) {
        continue;
      }
      const fields = parseProtobufFields(field.value);
      const fieldText = getStringField(fields, 1);
      const attributeKey = fieldText === "力量" ? "strength" : fieldText === "智力" ? "intelligence" : fieldText === "魅力" ? "charm" : null;
      if (attributeKey) {
        attributes[attributeKey] = getVarintField(fields, 3);
      }
    }
    return attributes;
  }
  async queryOtherPet(uin, kind) {
    const toPetSummary = fields => {
      const petId = getStringField(fields, 8).trim() || getStringField(fields, 101).trim();
      if (!petId) {
        return null;
      }
      const levelFieldBytes = getBytesField(fields, 13);
      const level = levelFieldBytes.length ? getVarintField(parseProtobufFields(levelFieldBytes), 1) : 0;
      return {
        uin: uin,
        petId: petId,
        name: getStringField(fields, 1).trim(),
        level: level,
        kind: kind
      };
    };
    if (this.otherPetMobileAvailable === false) {
      throw new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口");
    }
    try {
      const fields = parseProtobufFields((await this.sendOidb(PACKETS.otherPet, encodeStringField(1, uin))).body);
      this.otherPetMobileAvailable = true;
      const profileFieldBytes = getBytesField(fields, 1);
      return toPetSummary(profileFieldBytes.length ? parseProtobufFields(profileFieldBytes) : fields);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (/用户没有宠物|尚未创建.*宠物|未创建.*宠物/.test(errorMessage)) {
        this.otherPetMobileAvailable = true;
        return null;
      }
      throw /不支持.*好友宠物|action.*(?:不存在|not found|unsupported)|返回空响应或未知响应结构|unknown command/i.test(errorMessage) ? (this.otherPetMobileAvailable = false, new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口：" + errorMessage, "other_pet_unsupported")) : new QQPetError("查询好友宠物失败：" + errorMessage, "other_pet_query_failed");
    }
  }
  async queryOtherValues(petId) {
    const requestBody = concatBytes(encodeStringField(1, petId), encodeBytesField(2, Uint8Array.of(1)));
    const fields = parseProtobufFields(getBytesField(parseProtobufFields((await this.sendOidb(PACKETS.display, requestBody)).body), 1));
    const statusOf = fieldNumber => getFloatField(parseProtobufFields(getBytesField(fields, fieldNumber)), 3);
    return {
      feel: statusOf(1),
      hunger: statusOf(2),
      clean: statusOf(3),
      total: statusOf(4)
    };
  }
  async visitOther(uin) {
    const visitCommandBody = concatBytes(encodeVarintField(1, 4000), encodeVarintField(2, 0), encodeVarintField(3, 0));
    const requestBody = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, uin), encodeBytesField(3, visitCommandBody), encodeBytesField(4, new Uint8Array()));
    await this.sendOidb(PACKETS.reportEvent, requestBody);
  }
  async feedOther(uin, petId) {
    const requestBody = concatBytes(encodeStringField(1, uin), encodeStringField(2, ""), encodeStringField(3, ""), encodeStringField(4, petId));
    await this.sendOidb(PACKETS.feed, requestBody);
  }
  async washOther(uin, itemId) {
    const requestBody = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, itemId), encodeVarintField(3, 1), encodeStringField(4, uin));
    await this.sendOidb(PACKETS.useBathItem, requestBody);
  }
  async feed() {
    await this.sendOidb(PACKETS.feed, encodeStringField(4, this.petId));
  }
  async queryFoodInventory() {
    const response = await this.sendOidb(PACKETS.feedInventory, new Uint8Array());
    const fields = parseProtobufFields(response.body);
    return {
      biscuits: getVarintField(fields, 1),
      shrimp: getVarintField(fields, 2)
    };
  }
  async buyFood(count) {
    if (count <= 0) {
      throw new QQPetError("购买饼干数量必须大于 0");
    }
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.buyFood, encodeVarintField(1, count))).body);
    return {
      bought: getVarintField(fields, 3),
      costGold: getVarintField(fields, 4)
    };
  }
  async queryBathItems() {
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.bathItems, encodeVarintField(1, 1))).body);
    return getProtobufFields(fields, 1).filter(itemField => itemField.wireType === 2).map(itemField => {
      const fields = parseProtobufFields(itemField.value);
      const fieldBytes = getBytesField(fields, 14);
      const mediaFields = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
      return {
        name: getStringField(fields, 1),
        itemId: getStringField(fields, 2),
        goldPrice: getVarintField(fields, 5),
        cleanGain: getVarintField(fields, 6),
        description: getStringField(fields, 7),
        defaultCount: getVarintField(fields, 8),
        step: getVarintField(fields, 9),
        minimum: getVarintField(fields, 10),
        maximum: getVarintField(fields, 11),
        moodGain: getVarintField(fields, 12),
        previewUrl: extractImageUrl(getStringField(fields, 3)),
        silhouetteUrl: extractImageUrl(getStringField(fields, 13)),
        selectedPreviewUrl: extractImageUrl(getStringField(fields, 15)),
        soapingUrl: extractImageUrl(getStringField(mediaFields, 4))
      };
    });
  }
  async queryBathInventory() {
    const inventoryFields = parseProtobufFields((await this.sendOidb(PACKETS.bathInventory, encodeVarintField(1, 1))).body);
    const fieldBytes = getBytesField(inventoryFields, 1);
    const wrapperFields = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
    const itemCounts = {};
    for (const field of getProtobufFields(wrapperFields, 1)) {
      if (field.wireType !== 2) {
        continue;
      }
      const fields = parseProtobufFields(field.value);
      itemCounts[getStringField(fields, 1)] = getVarintField(fields, 2);
    }
    const bathInventory = {
      soap: itemCounts[1] ?? 0,
      bathBall: itemCounts[2] ?? 0,
      counts: itemCounts
    };
    return bathInventory;
  }
  async buyBathItem(itemId, count) {
    if (count <= 0) {
      throw new QQPetError("购买洗护道具数量必须大于 0");
    }
    const buyerBody = concatBytes(encodeVarintField(1, 1), encodeVarintField(2, 1001), encodeStringField(3, this.petId));
    const itemOrderBody = concatBytes(encodeVarintField(1, 355), encodeVarintField(2, Number(itemId)), encodeVarintField(3, count));
    const requestBody = concatBytes(encodeBytesField(1, buyerBody), encodeVarintField(2, 1001), encodeBytesField(3, itemOrderBody), encodeVarintField(4, 21));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.buyBathItem, requestBody)).body);
    const resultCode = getVarintField(fields, 1);
    const orderId = getStringField(fields, 2);
    return {
      result: resultCode,
      orderId: orderId,
      succeeded: resultCode === 0 && !!orderId
    };
  }
  async useBathItem(itemId) {
    const requestBody = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, itemId), encodeVarintField(3, 1), encodeStringField(4, ""));
    await this.sendOidb(PACKETS.useBathItem, requestBody);
  }
  async querySchoolStage() {
    const requestBody = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const stage = getVarintField(parseProtobufFields((await this.sendOidb(PACKETS.overview, requestBody)).body), 4);
    if (![0, 1, 2, 3, 4].includes(stage)) {
      throw new QQPetError("服务器返回未知学习阶段：" + stage);
    }
    return stage;
  }
  async querySchoolCourses(stage) {
    const resolvedStage = stage ?? (await this.querySchoolStage());
    const requestBody = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeVarintField(11, resolvedStage), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.catalog, requestBody)).body);
    return getProtobufFields(fields, 1).filter(courseField => courseField.wireType === 2).map(courseField => parseCatalogItem(courseField.value));
  }
  async selectSchoolCourse(attribute, subEventType = 0) {
    const attributeLabel = {
      physical: "力量",
      culture: "智力",
      art: "魅力"
    }[attribute];
    if (!attributeLabel) {
      throw new QQPetError("未知学习属性：" + attribute);
    }
    const availableCourses = (await this.querySchoolCourses()).filter(course => course.canDo && course.subEventType > 0);
    const selected = subEventType ? availableCourses.find(course => course.subEventType === subEventType) : availableCourses.filter(course => course.reward.includes(attributeLabel)).sort(compareRewardPerSecond)[0];
    if (!selected) {
      throw new QQPetError(subEventType ? "指定课程 " + subEventType + " 当前不可用" : "当前暂无可用的" + attributeLabel + "课程");
    }
    return selected;
  }
  async startSchool(attribute, subEventType = 0) {
    const catalogItem = await this.selectSchoolCourse(attribute, subEventType);
    const requestBody = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, catalogItem.name), encodeVarintField(7, catalogItem.subEventType), encodeVarintField(100, 2));
    const response = await this.sendOidb(PACKETS.startStory, requestBody);
    return {
      item: catalogItem,
      storyId: getStringField(parseProtobufFields(response.body), 1)
    };
  }
  async queryWorkOverview() {
    const requestBody = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.overview, requestBody)).body);
    return {
      careers: getProtobufFields(fields, 1).filter(careerField => careerField.wireType === 2).map(careerField => {
        const fields = parseProtobufFields(careerField.value);
        const statusCode = getVarintField(fields, 4);
        const fieldText = getStringField(fields, 1);
        return {
          careerType: getVarintField(fields, 20),
          name: fieldText,
          available: statusCode !== 3 && fieldText !== "???",
          statusCode: statusCode,
          message: getStringField(fields, 5)
        };
      }).filter(career => career.careerType > 0),
      currentCareerType: getVarintField(fields, 3),
      lastSubEventType: getVarintField(fields, 5)
    };
  }
  async queryWorkJobs(careerType, friendPetId = "") {
    const requestBody = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, friendPetId), encodeVarintField(10, careerType), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.catalog, requestBody)).body);
    const fieldText = getStringField(fields, 2);
    const careerMeta = {
      careerType: careerType,
      careerName: fieldText
    };
    return getProtobufFields(fields, 1).filter(jobField => jobField.wireType === 2).map(jobField => parseCatalogItem(jobField.value, careerMeta));
  }
  async selectWorkJob(careerType = 0, jobSubEvent = 0, friendPetId = "") {
    const workOverview = await this.queryWorkOverview();
    const availableCareers = workOverview.careers.filter(career => career.available && (!careerType || career.careerType === careerType));
    if (!availableCareers.length) {
      throw new QQPetError(careerType ? "职业 " + careerType + " 尚未开放" : "服务器当前没有开放的职业");
    }
    const availableJobs = (await Promise.all(availableCareers.map(async career => {
      try {
        return await this.queryWorkJobs(career.careerType, friendPetId);
      } catch (error) {
        if (isCareerRequirementError(error)) {
          return [];
        }
        throw error;
      }
    }))).flat().filter(job => job.canDo && job.subEventType > 0);
    const selected = jobSubEvent ? availableJobs.find(job => job.subEventType === jobSubEvent) : availableJobs.sort((left, right) => compareRewardPerSecond(left, right) || +(right.careerType === workOverview.currentCareerType) - +(left.careerType === workOverview.currentCareerType) || (left.careerType ?? 0) - (right.careerType ?? 0))[0];
    if (!selected) {
      throw new QQPetError(jobSubEvent ? "指定岗位 " + jobSubEvent + " 当前不可用" : "服务器当前没有可执行的打工岗位");
    }
    return selected;
  }
  async startWork(careerType = 0, jobSubEvent = 0, hire) {
    const friendUin = hire?.uin.trim() ?? "";
    const friendPetId = hire?.petId.trim() ?? "";
    if (!!friendUin != !!friendPetId) {
      throw new QQPetError("雇佣好友时必须同时提供好友账号和宠物 ID");
    }
    const catalogItem = await this.selectWorkJob(careerType, jobSubEvent, friendPetId);
    const requestBody = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, ""), friendUin ? encodeBytesField(4, concatBytes(encodeStringField(1, friendUin), encodeStringField(2, friendPetId))) : new Uint8Array(), encodeStringField(6, catalogItem.name), encodeVarintField(7, catalogItem.subEventType), encodeVarintField(100, 2));
    const response = await this.sendOidb(PACKETS.startStory, requestBody);
    return {
      item: catalogItem,
      storyId: getStringField(parseProtobufFields(response.body), 1),
      hiredFriend: !!friendUin
    };
  }
  async queryAdventureOptions(filterText = "") {
    const requestBody = concatBytes(encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, filterText), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.catalog, requestBody)).body);
    return getProtobufFields(fields, 1).filter(optionField => optionField.wireType === 2).map(optionField => parseCatalogItem(optionField.value));
  }
  async queryFatigueStatus() {
    try {
      const availableCareer = (await this.queryWorkOverview()).careers.find(item => item.available);
      let taskOptions;
      try {
        taskOptions = availableCareer ? await this.queryWorkJobs(availableCareer.careerType) : await this.querySchoolCourses();
      } catch (error) {
        if (!availableCareer || !isCareerRequirementError(error)) {
          throw error;
        }
        taskOptions = await this.querySchoolCourses();
      }
      const shortestTask = taskOptions.filter(item => item.name).sort((left, right) => (parseDurationSeconds(left.duration) || Number.MAX_SAFE_INTEGER) - (parseDurationSeconds(right.duration) || Number.MAX_SAFE_INTEGER))[0];
      if (shortestTask) {
        return parseFatigueStatus(shortestTask.warning ?? "");
      } else {
        return {
          fatigued: null,
          tier: null,
          benefitRate: null,
          reason: "服务器没有返回可用于疲劳判定的任务"
        };
      }
    } catch (error) {
      return {
        fatigued: null,
        tier: null,
        benefitRate: null,
        reason: "疲劳状态读取失败：" + (error instanceof Error ? error.message : String(error))
      };
    }
  }
  async startAdventure(optionName = "") {
    const availableOptions = (await this.queryAdventureOptions()).filter(option => option.canDo && option.name);
    const catalogItem = optionName ? availableOptions.find(option => option.name === optionName) : availableOptions[0];
    if (!catalogItem) {
      throw new QQPetError(optionName ? "指定冒险“" + optionName + "”当前不可用" : "服务器当前没有可执行的冒险");
    }
    const requestParts = [encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, catalogItem.name)];
    if (catalogItem.subEventType > 0) {
      requestParts.push(encodeVarintField(7, catalogItem.subEventType));
    }
    requestParts.push(encodeVarintField(100, 2));
    const response = await this.sendOidb(PACKETS.startStory, concatBytes(...requestParts));
    return {
      item: catalogItem,
      storyId: getStringField(parseProtobufFields(response.body), 1)
    };
  }
  async queryStory() {
    const requestBody = concatBytes(encodeStringField(1, this.petId), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(PACKETS.storyStatus, requestBody)).body);
    const fieldBytes = getBytesField(fields, 1);
    const storyFields = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
    const fieldText = getStringField(fields, 2);
    const remainingSeconds = getVarintField(storyFields, 2);
    const durationSeconds = getVarintField(storyFields, 3);
    return {
      storyId: fieldText,
      stateCode: getVarintField(storyFields, 1),
      remainingSeconds: remainingSeconds,
      durationSeconds: durationSeconds,
      startedAt: getVarintField(storyFields, 4),
      recallable: !!getVarintField(storyFields, 5),
      finished: !!fieldText && !!(durationSeconds > 0) && !!(remainingSeconds <= 0)
    };
  }
  async settleStory(storyId) {
    const requestBody = concatBytes(encodeStringField(1, storyId), encodeVarintField(2, 1000), encodeStringField(3, this.petId), encodeVarintField(100, 2));
    return this.sendOidb(PACKETS.storySettle, requestBody);
  }
}
const delaySeconds = seconds => new Promise(resolve => setTimeout(resolve, Math.max(0, seconds) * 1000));
const ATTRIBUTE_ROTATION = ["physical", "culture", "art"];
const ATTRIBUTE_KEYS = {
  physical: "strength",
  culture: "intelligence",
  art: "charm"
};
function attributeSnapshot(values) {
  if (!values || typeof values !== "object") return null;
  return {
    strength: Math.max(0, Number(values.strength) || 0),
    intelligence: Math.max(0, Number(values.intelligence) || 0),
    charm: Math.max(0, Number(values.charm) || 0)
  };
}
function compactTask(task) {
  if (!task || typeof task !== "object") return null;
  return {
    name: String(task.name ?? ""),
    subEventType: Number(task.subEventType) || 0,
    careerName: String(task.careerName ?? ""),
    duration: String(task.duration ?? ""),
    reward: String(task.reward ?? ""),
    cost: String(task.cost ?? "")
  };
}
function lowestSchoolAttribute(config, values) {
  const base = Math.max(0, ATTRIBUTE_ROTATION.indexOf(config.schoolAttribute));
  const order = ATTRIBUTE_ROTATION.map((attribute, index) => ({
    attribute,
    value: Number(values?.[ATTRIBUTE_KEYS[attribute]] ?? Number.MAX_SAFE_INTEGER),
    tie: (index - base + ATTRIBUTE_ROTATION.length) % ATTRIBUTE_ROTATION.length
  }));
  order.sort((left, right) => left.value - right.value || left.tie - right.tie);
  return order[0]?.attribute ?? config.schoolAttribute;
}
function selectSchoolAttribute(config, values, rotationIndex = 0) {
  if (config.schoolSelectionMode === "lowest") {
    return lowestSchoolAttribute(config, values);
  }
  if (config.schoolSelectionMode === "rotation") {
    return rotateSchoolAttribute({
      ...config,
      schoolRotationEnabled: true
    }, rotationIndex);
  }
  return config.schoolAttribute;
}
function telemetryDelta(before, after) {
  if (!before || !after) return null;
  return {
    strength: Number((after.strength - before.strength).toFixed(3)),
    intelligence: Number((after.intelligence - before.intelligence).toFixed(3)),
    charm: Number((after.charm - before.charm).toFixed(3))
  };
}
function telemetryEventType(kind) {
  return {
    school: 6100,
    work: 6400,
    adventure: 6700
  }[kind] ?? 0;
}
function telemetryToOutdoorRecords(telemetry, limit = 30) {
  const records = [];
  const seen = new Set();
  for (const entry of Array.isArray(telemetry) ? telemetry : []) {
    if (!entry || entry.status !== "settled") continue;
    const settledAt = Date.parse(entry.settledAt ?? entry.recordedAt ?? "");
    if (!Number.isFinite(settledAt)) continue;
    const storyId = String(entry.storyId ?? "").trim();
    const key = storyId || [entry.kind, entry.item?.name, entry.startedAt, entry.settledAt].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const results = Object.entries({
      strength: "力量",
      intelligence: "智力",
      charm: "魅力"
    }).flatMap(([attribute, name]) => {
      const difference = Number(entry.delta?.[attribute]);
      return Number.isFinite(difference) && difference !== 0 ? [{
        type: 0,
        name,
        value: Number(entry.after?.[attribute]) || 0,
        difference,
        rightTopDescription: "",
        iconUrl: "",
        isPetInfo: true,
        petId: ""
      }] : [];
    });
    const expectedReward = String(entry.item?.reward ?? "").trim();
    records.push({
      storyId: storyId || `local-${settledAt}-${records.length}`,
      timestamp: Math.floor(settledAt / 1000),
      eventType: telemetryEventType(entry.kind),
      grade: 0,
      title: String(entry.item?.name || ({ school: "学习", work: "打工", adventure: "冒险" }[entry.kind] ?? "出门任务")),
      detail: [
        entry.elapsedSeconds == null ? "本机结算记录" : `实际耗时 ${Math.max(0, Math.trunc(Number(entry.elapsedSeconds) || 0))} 秒`,
        results.length ? "" : expectedReward
      ].filter(Boolean).join(" · "),
      results,
      unread: false,
      outdoorVersion: 0,
      source: "local"
    });
  }
  return records.sort((left, right) => right.timestamp - left.timestamp).slice(0, Math.max(0, Math.trunc(limit)));
}
function randomDelaySeconds(minMinutes, maxMinutes, random = Math.random) {
  const minSeconds = Math.max(0, Math.trunc(minMinutes * 60));
  const maxSeconds = Math.max(minSeconds, Math.trunc(maxMinutes * 60));
  return minSeconds + Math.floor(Math.min(0.999999999, Math.max(0, random())) * (maxSeconds - minSeconds + 1));
}
function rotateSchoolAttribute(config, rotationIndex) {
  if (!config.schoolRotationEnabled) {
    return config.schoolAttribute;
  }
  const base = ATTRIBUTE_ROTATION.indexOf(config.schoolAttribute);
  return ATTRIBUTE_ROTATION[(base + Math.max(0, Math.trunc(rotationIndex))) % ATTRIBUTE_ROTATION.length];
}
function selectSchoolOrWork(config, values, counts) {
  const available = {
    school: config.schoolEnabled && values.gold >= config.coinThreshold,
    work: config.workEnabled && (!config.workTimesPerDay || (counts.work ?? 0) < config.workTimesPerDay)
  };
  // smart 无目录时与 buildCandidateList 默认顺序一致：先学后工；真正的 RPS 择优在 runOnce 中异步完成。
  const order = config.taskPriority === "work" ? ["work", "school"] : ["school", "work"];
  return order.find(kind => available[kind]) ?? null;
}
function fatigueAction(config, fatigue) {
  if (!fatigue.fatigued || !fatigue.tier) {
    return null;
  }
  if (fatigue.tier >= 12) {
    return config.fatigue12HourAction;
  }
  return config.fatigue8HourAction;
}
function clearFinishedStoryDisplay(story, settled) {
  const emptyStory = {
    storyId: "",
    stateCode: 0,
    remainingSeconds: 0,
    durationSeconds: 0,
    startedAt: 0,
    recallable: false,
    finished: false
  };
  if (!story.storyId || !story.finished || !settled) {
    return story;
  }
  return emptyStory;
}
function isIrrecoverableSettleError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /宠物结算条件不满足|(?:任务|故事).*(?:已结算|不存在|已失效|已完成)|无需结算|settle.*(?:already|not found|invalid|expired)/i.test(message);
}
function compareEmployableFriends(left, right) {
  return right.bonus - left.bonus || right.totalReward - left.totalReward || right.target.level - left.target.level || left.target.uin.localeCompare(right.target.uin);
}
function buildCandidateList(config, values, counts, recentFailures, now = new Date()) {
  const candidates = [];
  if (isAdventureWindowOpen(config, now) && (!config.adventureTimesPerDay || (counts.adventure ?? 0) < config.adventureTimesPerDay)) {
    candidates.push("adventure");
  }
  const schoolWork = config.taskPriority === "smart"
    ? ["school", "work"]
    : (config.taskPriority === "work" ? ["work", "school"] : ["school", "work"]);
  for (const kind of schoolWork) {
    if (kind === "school" && config.schoolEnabled) {
      candidates.push("school");
    } else if (kind === "work" && config.workEnabled && (!config.workTimesPerDay || (counts.work ?? 0) < config.workTimesPerDay)) {
      candidates.push("work");
    }
  }
  return candidates.sort((left, right) => {
    const leftDiscouraged = isFailureDiscouraged(left, recentFailures);
    const rightDiscouraged = isFailureDiscouraged(right, recentFailures);
    if (leftDiscouraged !== rightDiscouraged) return leftDiscouraged ? 1 : -1;
    return 0;
  });
}
function orderCandidatesForSmart(candidates, preferred) {
  if (!preferred || !candidates.includes(preferred)) {
    return candidates.slice();
  }
  const adventure = candidates.filter(kind => kind === "adventure");
  const rest = candidates.filter(kind => kind !== "adventure" && kind !== preferred);
  return [...adventure, preferred, ...rest];
}
async function estimateBestTaskRps(api, config, allowedKinds = null) {
  const allowSchool = config.schoolEnabled !== false && (!allowedKinds || allowedKinds.includes("school"));
  const allowWork = config.workEnabled !== false && (!allowedKinds || allowedKinds.includes("work"));
  let bestSchoolRps = 0;
  let bestWorkRps = 0;
  if (allowSchool) {
    try {
      const courses = (await api.querySchoolCourses()).filter(course => course.canDo && course.subEventType > 0);
      const bestCourse = courses.sort(compareRewardPerSecond)[0];
      if (bestCourse) bestSchoolRps = parseRewardAmount(bestCourse.reward) / Math.max(1, parseDurationSeconds(bestCourse.duration));
    } catch {}
  }
  if (allowWork) {
    try {
      const overview = await api.queryWorkOverview();
      const availableCareer = overview.careers.find(career => career.available);
      if (availableCareer) {
        const jobs = (await api.queryWorkJobs(availableCareer.careerType)).filter(job => job.canDo && job.subEventType > 0);
        const bestJob = jobs.sort(compareRewardPerSecond)[0];
        if (bestJob) bestWorkRps = parseRewardAmount(bestJob.reward) / Math.max(1, parseDurationSeconds(bestJob.duration));
      }
    } catch {}
  }
  if (allowSchool && bestSchoolRps > 0 && bestSchoolRps >= bestWorkRps) return "school";
  if (allowWork && bestWorkRps > 0) return "work";
  if (allowedKinds?.length) {
    const fallback = allowedKinds.find(kind => kind === "school" && allowSchool || kind === "work" && allowWork);
    if (fallback) return fallback;
    return allowedKinds[0];
  }
  if (allowWork && !allowSchool) return "work";
  if (allowSchool && !allowWork) return "school";
  return config.taskPriority === "work" ? "work" : "school";
}
function isAdventureWindowOpen(config, now = new Date()) {
  if (!config.adventureEnabled) {
    return false;
  }
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  return isWithinTimeWindow(hhmm, config.adventureStartTime, config.adventureEndTime);
}
function hasFreeAvailableCourses(courses) {
  return Array.isArray(courses) && courses.some(course => {
    const costText = String(course.cost ?? "").trim();
    return !costText || costText === "0" || /免费|free/i.test(costText);
  });
}
function decideNextTask(config, values, counts, now = new Date(), recentFailures = []) {
  const candidates = buildCandidateList(config, values, counts, recentFailures, now).filter(kind => {
    if (kind === "school" && values.gold < config.coinThreshold) return false;
    return true;
  });
  return candidates[0] ?? null;
}
class AutomationController {
  constructor(host, progress) {
    this.host = host;
    this.progress = progress;
  }
  timer = null;
  busy = false;
  active = false;
  generation = 0;
  failureStreak = 0;
  lastNextCheckHint = null;
  idleCycles = 0;
  petName = "";
  identityLoaded = false;
  medals = null;
  medalsLoadedAt = 0;
  interactions = [];
  interactionsLoadedAt = 0;
  outdoorRecords = [];
  outdoorRecordsLoadedAt = 0;
  get running() {
    return this.active;
  }
  start() {
    if (this.running) {
      return false;
    }
    this.active = true;
    const generation = ++this.generation;
    this.host.log("自动托管已启动");
    this.host.updateStatus({
      automationRunning: true,
      activity: "自动托管已启动，正在检查"
    });
    this.loop(generation);
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
  async stopAndWait(timeoutMs = 30000) {
    this.stop();
    const deadline = Date.now() + Math.max(1000, timeoutMs);
    while (this.busy && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (this.busy) {
      this.host.log("等待当前请求结束超时，正在继续关闭");
      return false;
    }
    return true;
  }
  async loop(generation) {
    if (!this.active || generation !== this.generation) {
      return;
    }
    let nextDelay;
    try {
      await this.runOnce();
      this.failureStreak = 0;
      nextDelay = Math.max(3, this.host.getConfig().intervalSeconds) * 1000;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.failureStreak += 1;
      const intervalMs = Math.max(3, this.host.getConfig().intervalSeconds) * 1000;
      nextDelay = Math.min(300000, intervalMs * 2 ** Math.min(6, this.failureStreak - 1));
      this.host.log("本轮失败：" + message);
      this.host.updateStatus({
        connected: false,
        error: message,
        activity: "本轮执行失败，等待重试"
      });
    }
    if (!this.active || generation !== this.generation) {
      return;
    }
    const baseInterval = Math.max(3, this.host.getConfig().intervalSeconds) * 1000;
    if (this.lastNextCheckHint === "story_neardone" && this.host.status.story?.remainingSeconds > 0) {
      nextDelay = Math.min(nextDelay ?? baseInterval, (this.host.status.story.remainingSeconds + 2) * 1000);
    } else if (this.lastNextCheckHint === "idle") {
      this.idleCycles = (this.idleCycles ?? 0) + 1;
      if (this.idleCycles >= 3) {
        nextDelay = Math.min(300000, baseInterval * 2);
      }
    } else {
      this.idleCycles = 0;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.loop(generation);
    }, nextDelay);
  }
  async client() {
    const config = this.host.getConfig();
    const api = new QQPetApi(this.host.ctx, config.petId);
    const isAuto = isAutoPetId(config.petId);
    if (isAuto || !this.identityLoaded) {
      if (isAuto) {
        this.host.updateStatus({
          activity: "正在自动获取宠物档案"
        });
      }
      try {
        const profile = await api.queryOwnPetProfile();
        this.petName = profile.name;
        this.identityLoaded = true;
        if (isAuto) {
          this.host.updateConfig({
            petId: profile.petId
          });
          api.petId = profile.petId;
          this.host.log("已自动获取宠物 ID 和昵称并保存");
        }
      } catch (error) {
        if (isAuto) {
          throw error;
        }
        this.identityLoaded = true;
      }
    }
    return api;
  }
  async queryProfile(client) {
    const profile = await client.queryOwnPetProfile();
    if (!this.medals || Date.now() - this.medalsLoadedAt >= 300000) {
      try {
        const medalGallery = await client.queryMedalGallery();
        if (medalGallery.length) {
          this.medals = medalGallery;
        }
        this.medalsLoadedAt = Date.now();
      } catch {
        this.medals ||= profile.medals;
        this.medalsLoadedAt = Date.now();
      }
    }
    if (!this.interactionsLoadedAt || Date.now() - this.interactionsLoadedAt >= 300000) {
      try {
        this.interactions = await client.queryInteractionMessages();
      } catch {}
      this.interactionsLoadedAt = Date.now();
    }
    if (!this.outdoorRecordsLoadedAt || Date.now() - this.outdoorRecordsLoadedAt >= 120000) {
      await this.refreshOutdoorRecords();
    }
    const fullProfile = {
      ...profile
    };
    fullProfile.medals = this.medals ?? profile.medals;
    return fullProfile;
  }
  async refreshOutdoorRecords() {
    this.outdoorRecords = telemetryToOutdoorRecords(this.progress.snapshot().telemetry, 30);
    this.outdoorRecordsLoadedAt = Date.now();
    return this.outdoorRecords;
  }
  async blocked(config, actionLabel) {
    if (config.safeMode) {
      this.host.log("安全模式：计划执行" + actionLabel + "，本轮不发送写请求");
      return true;
    } else {
      return false;
    }
  }
  recordTaskTelemetry(pending, status, afterValues) {
    if (!pending?.kind || !pending.beforeValues) return;
    const before = attributeSnapshot(pending.beforeValues);
    const after = attributeSnapshot(afterValues);
    const settledAt = new Date().toISOString();
    const startedAt = pending.startedAt ?? pending.createdAt ?? settledAt;
    const startedMs = Date.parse(startedAt);
    this.progress.recordTelemetry({
      kind: pending.kind,
      status,
      storyId: pending.storyId ?? "",
      startedAt,
      settledAt,
      elapsedSeconds: Number.isFinite(startedMs) ? Math.max(0, Math.round((Date.parse(settledAt) - startedMs) / 1000)) : null,
      attribute: pending.attribute ?? null,
      item: pending.item ?? null,
      before,
      after,
      delta: telemetryDelta(before, after)
    });
  }
  decide(config, values) {
    const snapshot = this.progress.snapshot();
    return buildCandidateList(config, values, snapshot.counts, snapshot.recentFailures);
  }
  actionArray(payload) {
    if (Array.isArray(payload)) {
      return payload.flatMap(entry => this.actionArray(entry));
    }
    if (payload && typeof payload == "object") {
      const payloadObject = payload;
      if ("user_id" in payloadObject || "uin" in payloadObject || "group_id" in payloadObject) {
        return [payloadObject];
      } else {
        return Object.values(payloadObject).flatMap(value => this.actionArray(value));
      }
    }
    return [];
  }
  async callAction(action, params) {
    const result = await this.host.ctx.actions.call(action, params, this.host.ctx.adapterName, this.host.ctx.pluginManager.config);
    return this.actionArray(result);
  }
  targetLabel(target) {
    return (target.name?.trim() ? "“" + target.name.trim() + "”" : "未命名对象") + "（QQ " + target.uin + "）";
  }
  async friendCandidates() {
    const rawFriends = (await this.callAction("get_friends_with_category", {})).flatMap(rawFriend => {
      const uin = String(rawFriend.user_id ?? rawFriend.uin ?? "").trim();
      const name = String(rawFriend.remark ?? rawFriend.nickname ?? rawFriend.nick ?? "").trim();
      if (uin && uin !== this.host.uin) {
        return [{
          uin: uin,
          name: name,
          kind: "friend"
        }];
      } else {
        return [];
      }
    });
    return [...new Map(rawFriends.map(friend => [friend.uin, friend])).values()];
  }
  async visitCandidates(config) {
    const friends = await this.friendCandidates();
    const friendUins = new Set(friends.map(friend => friend.uin));
    const friendCandidates = config.visitFriends ? friends : [];
    const strangerCandidates = [];
    if (config.visitStrangers) {
      let groupIds = config.visitStrangerGroupIds.split(/[,，\s]+/).map(rawGroupId => rawGroupId.trim()).filter(Boolean);
      if (!groupIds.length) {
        groupIds = (await this.callAction("get_group_list", {})).slice(0, 1).map(group => String(group.group_id ?? "")).filter(Boolean);
      }
      for (const groupId of groupIds.slice(0, 3)) {
        const memberListParams = {
          group_id: groupId,
          no_cache: false
        };
        const actionResult = await this.callAction("get_group_member_list", memberListParams);
        for (const memberInfo of actionResult) {
          const uin = String(memberInfo.user_id ?? memberInfo.uin ?? "");
          const name = String(memberInfo.card ?? memberInfo.nickname ?? memberInfo.nick ?? "").trim();
          if (uin && uin !== this.host.uin && !friendUins.has(uin)) {
            strangerCandidates.push({
              uin: uin,
              name: name,
              kind: "stranger"
            });
          }
        }
      }
    }
    const uniqueFriends = [...new Map(friendCandidates.map(candidate => [candidate.uin, candidate])).values()];
    const uniqueStrangers = [...new Map(strangerCandidates.map(candidate => [candidate.uin, candidate])).values()];
    const interleaved = [];
    const maxLength = Math.max(uniqueFriends.length, uniqueStrangers.length);
    for (let index = 0; index < maxLength; index += 1) {
      if (uniqueFriends[index]) {
        interleaved.push(uniqueFriends[index]);
      }
      if (uniqueStrangers[index]) {
        interleaved.push(uniqueStrangers[index]);
      }
    }
    return interleaved;
  }
  async findEmployableFriend(client, config) {
    let candidates;
    try {
      candidates = (await this.friendCandidates()).slice(0, config.workFriendScanLimit);
    } catch (error) {
      this.host.log("读取好友列表失败，本次按普通打工继续：" + (error instanceof Error ? error.message : String(error)));
      return null;
    }
    let lastReason = candidates.length ? "" : "好友列表没有可扫描对象";
    let baselineJob;
    try {
      baselineJob = await client.selectWorkJob(config.workCareerType, config.workJobSubEvent);
    } catch (error) {
      this.host.log("读取普通岗位收益失败，无法比较好友雇佣加成：" + (error instanceof Error ? error.message : String(error)));
      return null;
    }
    const baselineReward = parseRewardAmount(baselineJob.reward);
    const careerType = baselineJob.careerType;
    if (!careerType) {
      this.host.log("服务器未返回基准岗位所属职业，无法比较好友雇佣加成，本次按普通打工继续");
      return null;
    }
    const hireCandidates = [];
    for (const candidate of candidates) {
      try {
        const otherPet = await client.queryOtherPet(candidate.uin, "friend");
        if (!otherPet) {
          lastReason = this.targetLabel(candidate) + "尚未创建宠物";
          continue;
        }
        const catalogItem = (await client.queryWorkJobs(careerType, otherPet.petId)).find(job => job.canDo && job.subEventType === baselineJob.subEventType);
        if (!catalogItem) {
          lastReason = this.targetLabel(otherPet) + "不能参加当前岗位";
          continue;
        }
        const rewardAmount = parseRewardAmount(catalogItem.reward);
        hireCandidates.push({
          target: otherPet,
          jobSubEvent: catalogItem.subEventType,
          bonus: rewardAmount - baselineReward,
          totalReward: rewardAmount
        });
      } catch (error) {
        lastReason = this.targetLabel(candidate) + "不可雇佣：" + (error instanceof Error ? error.message : String(error));
        if (lastReason.includes("不支持安卓端的好友宠物详情接口")) {
          break;
        }
      }
    }
    hireCandidates.sort(compareEmployableFriends);
    if (hireCandidates[0]) {
      const hireCandidate = hireCandidates[0];
      this.host.log("已比较 " + hireCandidates.length + " 只可雇佣好友宠物，选择" + this.targetLabel(hireCandidate.target) + "，预计雇佣加成 " + (hireCandidate.bonus >= 0 ? "+" : "") + hireCandidate.bonus);
      return hireCandidate;
    }
    this.host.log("未找到可雇佣的好友宠物，本次按普通打工继续" + (lastReason ? "（" + lastReason + "）" : ""));
    return null;
  }
  async maybeVisit(client, config, foodInventory, bathInventory) {
    if (!config.visitEnabled || this.progress.activeBlock("visit")) {
      return false;
    }
    const counts = this.progress.snapshot().counts;
    const visitCount = (counts.visitFriend ?? 0) + (counts.visitStranger ?? 0);
    if (config.visitMaxPerDay && visitCount >= config.visitMaxPerDay || (await this.blocked(config, "走访宠物"))) {
      return false;
    }
    let lastError = "";
    try {
      const candidates = (await this.visitCandidates(config)).filter(candidate => !this.progress.targetWasVisited(candidate.uin)).slice(0, config.visitCandidateScanLimit);
      for (const candidate of candidates) {
        try {
          await client.visitOther(candidate.uin);
          this.progress.markTargetVisited(candidate.uin);
          this.progress.increment(candidate.kind === "friend" ? "visitFriend" : "visitStranger");
          this.host.log("自动走访" + (candidate.kind === "friend" ? "好友" : "陌生人") + this.targetLabel(candidate) + "成功");
          const experienceLimitReached = config.otherCareDailyExperienceLimit > 0 && this.progress.snapshot().dailyExperienceGain >= config.otherCareDailyExperienceLimit;
          if (config.visitAutoCare && experienceLimitReached) {
            this.host.log("今日经验已达到 " + config.otherCareDailyExperienceLimit + "，停止照顾别人");
          } else if (config.visitAutoCare) {
            try {
              const target = await client.queryOtherPet(candidate.uin, candidate.kind);
              if (target) {
                const petValues = await client.queryOtherValues(target.petId);
                if (petValues.hunger < config.hungerThreshold && foodInventory.biscuits > 0) {
                  await client.feedOther(target.uin, target.petId);
                  this.progress.increment("careOther");
                  this.host.log("已自动喂养走访对象");
                }
                const bathItemId = bathInventory.bathBall > 0 ? "2" : bathInventory.soap > 0 ? "1" : null;
                if (petValues.clean < config.cleanThreshold && bathItemId) {
                  await client.washOther(target.uin, bathItemId);
                  this.progress.increment("careOther");
                  this.host.log("已自动清洁走访对象");
                }
              }
            } catch (error) {
              this.host.log("走访已完成，暂无法读取对方宠物状态：" + (error instanceof Error ? error.message : String(error)));
            }
          }
          const nextVisitDelay = randomDelaySeconds(config.visitDelayMinMinutes, config.visitDelayMaxMinutes);
          this.progress.setBlock("visit", "等待下次走访", nextVisitDelay);
          this.host.updateStatus({
            activity: "自动走访已完成"
          });
          return true;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      const fallbackDelay = randomDelaySeconds(config.visitDelayMinMinutes, config.visitDelayMaxMinutes);
      this.progress.setBlock("visit", lastError || "暂无可走访的宠物", fallbackDelay);
      if (lastError) {
        this.host.log("走访候选检查未成功：" + lastError);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.progress.setBlock("visit", message, config.failureCooldownSeconds);
      this.host.log("获取走访候选失败：" + message);
    }
    return false;
  }
  storyKind(storyId) {
    return {
      "6100": "school",
      "6400": "work",
      "6700": "adventure"
    }[storyId.split("_", 1)[0]] ?? null;
  }
  handleMissingPending(config, pending) {
    if (!pending) {
      return false;
    }
    const missingSince = this.progress.markPendingMissing();
    const missingSeconds = missingSince ? (Date.now() - Date.parse(missingSince)) / 1000 : 0;
    if (missingSeconds < config.startConfirmSeconds) {
      this.host.updateStatus({
        activity: "任务状态暂未返回，等待同步（" + Math.ceil(config.startConfirmSeconds - missingSeconds) + "s）"
      });
      return true;
    } else {
      this.progress.clearPending();
      this.host.log("服务器持续未返回任务 " + (pending.storyId || pending.kind) + "，已清除待确认记录且不计入完成次数");
      return true;
    }
  }
  async handleStory(client, config, story) {
    let pending = this.progress.snapshot().pending;
    if (story.storyId) {
      if (story.finished && (this.progress.storyWasSettled(story.storyId) || this.progress.storyWasDismissed(story.storyId))) {
        return this.handleMissingPending(config, pending);
      }
      const kind = this.storyKind(story.storyId);
      const pendingMismatch = !!pending && (pending.storyId !== story.storyId || !!kind && pending.kind !== kind);
      if (!pending || !pending.confirmed || pendingMismatch) {
        if (pendingMismatch) {
          this.host.log("本地待处理任务 " + (pending?.storyId || pending?.kind) + " 与服务器 " + story.storyId + " 不一致，已按服务器状态恢复");
        }
        if (kind) {
          this.progress.setPending(kind, story.storyId);
        } else {
          this.progress.clearPending();
        }
        pending = this.progress.snapshot().pending;
        if (kind && !pendingMismatch) {
          this.host.log("已恢复进行中的" + kind + "任务");
        }
      } else {
        this.progress.markPendingSeen();
        pending = this.progress.snapshot().pending;
      }
      if (story.finished) {
        if (await this.blocked(config, "结算任务")) {
          return true;
        }
        const settleBlockKey = "settle:" + story.storyId;
        if (this.progress.activeBlock(settleBlockKey)) {
          return true;
        }
        try {
          await client.settleStory(story.storyId);
          let afterValues = null;
          try {
            await delaySeconds(Math.max(1, config.verifyDelaySeconds));
            afterValues = await client.queryValues();
            this.progress.recordAttributes(afterValues);
          } catch (error) {
            this.host.log("任务已结算，但无法读取最新属性：" + (error instanceof Error ? error.message : String(error)));
          }
          this.recordTaskTelemetry(pending, "settled", afterValues);
          this.progress.markStorySettled(story.storyId);
          if (pending?.kind === "school" && config.schoolSelectionMode === "rotation" && config.schoolRotationEnabled) {
            this.progress.advanceSchoolRotation(config.schoolRotationEvery);
          } else if (pending) {
            this.progress.increment(pending.kind);
          }
          this.progress.clearPending();
          this.progress.clearBlock(settleBlockKey);
          await this.refreshOutdoorRecords();
          if (afterValues) {
            this.host.updateStatus({
              values: afterValues,
              progress: this.progress.snapshot(),
              outdoorRecords: this.outdoorRecords
            });
          } else {
            this.host.updateStatus({ outdoorRecords: this.outdoorRecords });
          }
          this.host.log("任务已结算并记录：" + story.storyId);
        } catch (error) {
          if (isIrrecoverableSettleError(error)) {
            this.progress.dismissStory(story.storyId);
            if (pending?.storyId === story.storyId) {
              this.progress.clearPending();
            }
            this.progress.clearBlock(settleBlockKey);
            this.host.updateStatus({
              connected: true,
              error: null,
              story: clearFinishedStoryDisplay(story, true),
              progress: this.progress.snapshot(),
              activity: "服务器残留任务已忽略，当前空闲"
            });
            this.host.log("服务器已拒绝结算残留任务，按空闲处理：" + story.storyId);
            return true;
          }
          this.progress.setBlock(settleBlockKey, String(error), config.settleRetrySeconds);
          throw error;
        }
        return true;
      }
      const statusPatch = {
        activity: "任务进行中，剩余 " + story.remainingSeconds + "s"
      };
      this.host.updateStatus(statusPatch);
      return true;
    }
    return this.handleMissingPending(config, pending);
  }
  publish(profile, fatigue, values, story, foodInventory, bathInventory) {
    this.petName = profile.name;
    const snapshot = this.progress.snapshot();
    const alreadyHandled = this.progress.storyWasSettled(story.storyId) || this.progress.storyWasDismissed(story.storyId);
    const displayStory = clearFinishedStoryDisplay(story, alreadyHandled);
    const inventory = {
      ...foodInventory,
      ...bathInventory
    };
    this.host.updateStatus({
      connected: true,
      error: null,
      updatedAt: new Date().toISOString(),
      profile: profile,
      interactions: this.interactions,
      outdoorRecords: this.outdoorRecords,
      fatigue: fatigue,
      values: values,
      story: displayStory,
      inventory: inventory,
      progress: snapshot,
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
        const api = await this.client();
        const [profile, petValues, story, foodInventory, bathInventory] = await Promise.all([this.queryProfile(api), api.queryValues(), api.queryStory(), api.queryFoodInventory(), api.queryBathInventory()]);
        const fatigue = await api.queryFatigueStatus();
        this.progress.recordAttributes(petValues);
        this.publish(profile, fatigue, petValues, story, foodInventory, bathInventory);
        this.host.updateStatus({
          activity: "状态已刷新"
        });
      } finally {
        this.busy = false;
      }
    }
  }
  async catalogs() {
    if (this.busy) {
      throw new QQPetError("当前已有请求执行中，请稍后再试");
    }
    this.busy = true;
    try {
      const api = await this.client();
      const [schoolStage, workOverview, adventures, bathItems] = await Promise.all([api.querySchoolStage(), api.queryWorkOverview(), api.queryAdventureOptions(), api.queryBathItems()]);
      const [courses, careers] = await Promise.all([api.querySchoolCourses(schoolStage), Promise.all(workOverview.careers.map(async career => {
        try {
          return {
            ...career,
            jobs: career.available ? await api.queryWorkJobs(career.careerType) : []
          };
        } catch (error) {
          if (!isCareerRequirementError(error)) {
            throw error;
          }
          return {
            ...career,
            available: false,
            message: error instanceof Error ? error.message : String(error),
            jobs: []
          };
        }
      }))]);
      const workSummary = {
        currentCareerType: workOverview.currentCareerType,
        lastSubEventType: workOverview.lastSubEventType
      };
      const result = {
        stage: schoolStage,
        courses: courses,
        careers: careers,
        workOverview: workSummary,
        adventures: adventures,
        bathItems: bathItems
      };
      return result;
    } finally {
      this.busy = false;
    }
  }
  async startTaskByKind(api, config, values, kind) {
    if (kind === "school") {
      const progress = this.progress.snapshot();
      const attribute = selectSchoolAttribute(config, values, progress.schoolRotationIndex);
      const courseSubEvent = config.schoolSelectionMode === "fixed" ? config.courseSubEvent : 0;
      const schoolStory = await api.startSchool(attribute, courseSubEvent);
      this.progress.setPending("school", schoolStory.storyId, {
        startedAt: new Date().toISOString(),
        attribute: attribute,
        item: compactTask(schoolStory.item),
        beforeValues: attributeSnapshot(values)
      });
      const attributeLabel = { physical: "力量", culture: "智力", art: "魅力" }[attribute];
      this.host.log("已开始" + attributeLabel + "学习“" + schoolStory.item.name + "”" + (schoolStory.storyId ? "，storyId=" + schoolStory.storyId : ""));
    } else if (kind === "work") {
      const hireCandidate = config.employFriend ? await this.findEmployableFriend(api, config) : null;
      const workStory = await api.startWork(config.workCareerType, hireCandidate?.jobSubEvent ?? config.workJobSubEvent, hireCandidate ? {
        uin: hireCandidate.target.uin,
        petId: hireCandidate.target.petId
      } : undefined);
      this.progress.setPending("work", workStory.storyId, {
        startedAt: new Date().toISOString(),
        item: compactTask(workStory.item),
        beforeValues: attributeSnapshot(values)
      });
      const hireNote = workStory.hiredFriend && hireCandidate ? "，已雇佣好友" + this.targetLabel(hireCandidate.target) + "（加成 " + (hireCandidate.bonus >= 0 ? "+" : "") + hireCandidate.bonus + "）" : "";
      this.host.log("已开始打工“" + workStory.item.name + "”" + hireNote + (workStory.storyId ? "，storyId=" + workStory.storyId : ""));
    } else {
      const adventureStory = await api.startAdventure(config.adventureOption);
      this.progress.setPending("adventure", adventureStory.storyId, {
        startedAt: new Date().toISOString(),
        item: compactTask(adventureStory.item),
        beforeValues: attributeSnapshot(values)
      });
      this.host.log("已开始冒险“" + adventureStory.item.name + "”" + (adventureStory.storyId ? "，storyId=" + adventureStory.storyId : ""));
    }
  }
  async runOnce() {
    if (this.busy) {
      return null;
    }
    this.busy = true;
    try {
      const config = this.host.getConfig();
      if (!config.enabled) {
        return null;
      }
      if (this.progress.rollover()) {
        this.host.log("检测到新的一天，今日计数已清零");
      }
      this.host.updateStatus({
        activity: "正在检查宠物状态"
      });
      const api = await this.client();
      let [profile, values, story, foodInventory, bathInventory] = await Promise.all([this.queryProfile(api), api.queryValues(), api.queryStory(), api.queryFoodInventory(), api.queryBathInventory()]);
      const fatigue = await api.queryFatigueStatus();
      this.progress.recordAttributes(values);
      this.publish(profile, fatigue, values, story, foodInventory, bathInventory);
      this.host.log("状态：金币 " + values.gold.toFixed(0) + "，心情 " + values.feel.toFixed(0) + "，体力 " + values.hunger.toFixed(0) + "，清洁 " + values.clean.toFixed(0));
      if (story.storyId && !story.finished && story.remainingSeconds > 0 && story.remainingSeconds <= 30) {
        this.lastNextCheckHint = "story_neardone";
      }
      if (story.finished && (await this.handleStory(api, config, story))) {
        return "story";
      }
      if (config.careEnabled && values.hunger < config.hungerThreshold && !this.progress.activeBlock("feed") && !(await this.blocked(config, "喂食"))) {
        try {
          if (foodInventory.biscuits <= 0) {
            if (!config.autoBuySupplies) {
              this.progress.setBlock("feed", "饼干不足且自动购买已关闭", config.failureCooldownSeconds);
              return "feed_unavailable";
            }
            await api.buyFood(config.foodPurchaseCount);
            foodInventory = await api.queryFoodInventory();
            if (foodInventory.biscuits <= 0) {
              throw new QQPetError("购买饼干后库存仍为空");
            }
          }
          await api.feed();
          await delaySeconds(config.verifyDelaySeconds);
          const afterValues = await api.queryValues();
          if (afterValues.hunger <= values.hunger) {
            throw new QQPetError("喂食后体力未增加");
          }
          this.progress.increment("feed");
          this.progress.clearBlock("feed");
          this.host.log("自动喂食成功：" + values.hunger.toFixed(0) + "→" + afterValues.hunger.toFixed(0));
        } catch (error) {
          this.progress.setBlock("feed", error instanceof Error ? error.message : String(error), config.failureCooldownSeconds);
          throw error;
        }
        return "feed";
      }
      if (config.careEnabled && values.clean < config.cleanThreshold && !this.progress.activeBlock("wash") && !(await this.blocked(config, "洗澡"))) {
        try {
          let bathItemId = bathInventory.bathBall > 0 ? "2" : "1";
          if ((bathItemId === "2" ? bathInventory.bathBall : bathInventory.soap) <= 0) {
            if (!config.autoBuySupplies) {
              this.progress.setBlock("wash", "洗护用品不足且自动购买已关闭", config.failureCooldownSeconds);
              return "wash_unavailable";
            }
            bathItemId = "2";
            const bathPurchase = await api.buyBathItem(bathItemId, config.bathPurchaseCount);
            if (!bathPurchase.succeeded) {
              throw new QQPetError("购买洗护道具失败：" + (bathPurchase.result ? "result=" + bathPurchase.result : "未返回订单"));
            }
            bathInventory = await api.queryBathInventory();
            if ((bathItemId === "2" ? bathInventory.bathBall : bathInventory.soap) <= 0) {
              throw new QQPetError("购买洗护道具后库存仍为空");
            }
          }
          await api.useBathItem(bathItemId);
          await delaySeconds(config.verifyDelaySeconds);
          const afterValues = await api.queryValues();
          if (afterValues.clean <= values.clean) {
            throw new QQPetError("洗澡后清洁值未增加");
          }
          this.progress.increment("wash");
          this.progress.clearBlock("wash");
          this.host.log("自动洗澡成功：" + values.clean.toFixed(0) + "→" + afterValues.clean.toFixed(0));
        } catch (error) {
          this.progress.setBlock("wash", error instanceof Error ? error.message : String(error), config.failureCooldownSeconds);
          throw error;
        }
        return "wash";
      }
      if (await this.maybeVisit(api, config, foodInventory, bathInventory)) {
        return "visit";
      }
      if (await this.handleStory(api, config, story)) {
        return "story";
      }
      const forcedAction = fatigueAction(config, fatigue);
      if (forcedAction === "rest") {
        const fatigueTierLabel = fatigue.tier === 12 ? "12 小时" : "8 小时";
        const statusPatch = {
          activity: "疲劳休息：已进入 " + fatigueTierLabel + "档"
        };
        this.host.updateStatus(statusPatch);
        this.lastNextCheckHint = "idle";
        return "fatigue_rest";
      }
      if (forcedAction) {
        const candidates = [forcedAction];
        if (await this.blocked(config, forcedAction === "school" ? "学习" : forcedAction === "work" ? "打工" : "冒险")) {
          return forcedAction;
        }
        await this.startTaskByKind(api, config, values, forcedAction);
        return forcedAction;
      }
      const snapshot = this.progress.snapshot();
      const candidates = buildCandidateList(config, values, snapshot.counts, snapshot.recentFailures);
      if (!candidates.length) {
        this.host.updateStatus({ activity: "空闲：今日任务已完成" });
        this.lastNextCheckHint = "idle";
        return null;
      }
      let freeCoursesAvailable = false;
      if (values.gold < config.coinThreshold && candidates.includes("school")) {
        try {
          const freeCourses = (await api.querySchoolCourses()).filter(course => course.canDo && course.subEventType > 0);
          freeCoursesAvailable = hasFreeAvailableCourses(freeCourses);
        } catch {}
      }
      const effectiveCandidates = candidates.filter(kind => {
        if (kind === "school" && values.gold < config.coinThreshold && !freeCoursesAvailable) return false;
        return true;
      });
      if (!effectiveCandidates.length) {
        this.host.updateStatus({ activity: "空闲：金币不足且无免费课程" });
        this.lastNextCheckHint = "idle";
        return null;
      }
      let orderedCandidates = effectiveCandidates.slice();
      const schoolWorkCandidates = effectiveCandidates.filter(kind => kind === "school" || kind === "work");
      if (config.taskPriority === "smart" && schoolWorkCandidates.length > 0) {
        try {
          const preferred = await estimateBestTaskRps(api, config, schoolWorkCandidates);
          orderedCandidates = orderCandidatesForSmart(effectiveCandidates, preferred);
        } catch {}
      }
      const maxAttempts = Math.min(2, orderedCandidates.length);
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = orderedCandidates[attempt];
        const actionLabel = candidate === "school" ? "学习" : candidate === "work" ? "打工" : "冒险";
        if (await this.blocked(config, actionLabel)) {
          continue;
        }
        try {
          await this.startTaskByKind(api, config, values, candidate);
          return candidate;
        } catch (error) {
          if (!isFallbackWorthy(error)) {
            throw error;
          }
          this.progress.recordFailure(candidate);
          const message = error instanceof Error ? error.message : String(error);
          this.host.log("任务" + actionLabel + "启动失败，尝试降级：" + message);
          if (attempt >= maxAttempts - 1) {
            throw error;
          }
        }
      }
      return null;
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
  constructor(runtimeName = "OneBot") {
    this.runtimeName = runtimeName;
    this.status.activity = "等待 " + runtimeName + " 登录";
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
    const config = {
      ...this.configValue
    };
    return config;
  }
  accountStatus() {
    const petIdReady = !["", "AUTO", "YOUR_PET_ID"].includes(this.configValue.petId.trim().toUpperCase());
    const petTarget = {
      uin: this.uin,
      petId: petIdReady ? this.configValue.petId : "",
      petIdReady: petIdReady,
      petName: this.status.account.petName
    };
    return petTarget;
  }
  async init(context) {
    const mkdirOptions = {
      recursive: true
    };
    this.context = context;
    fs.mkdirSync(context.dataPath, mkdirOptions);
    this.loadConfig();
    try {
      const loginInfo = await context.actions.call("get_login_info", {}, context.adapterName, context.pluginManager.config);
      this.uin = String(loginInfo?.user_id ?? "");
    } catch (error) {
      this.log("暂未取得当前 QQ：" + String(error));
    }
    const progressStore = new ProgressStore(path.join(context.dataPath, "daily-progress.json"));
    this.scheduler = new AutomationController(this, progressStore);
    this.updateStatus({
      account: this.accountStatus(),
      config: this.getConfig(),
      progress: progressStore.snapshot()
    });
    if (this.configValue.enabled && this.configValue.autoStart) {
      this.scheduler.start();
    }
  }
  async cleanup() {
    await this.scheduler?.stopAndWait();
    this.scheduler = null;
    this.saveConfig();
    this.context = null;
  }
  loadConfig() {
    try {
      this.configValue = normalizeConfig(JSON.parse(fs.readFileSync(this.ctx.configPath, "utf8")));
    } catch (error) {
      backupCorruptFile(this.ctx.configPath, error);
      const config = {
        ...DEFAULT_CONFIG
      };
      this.configValue = config;
      this.saveConfig();
    }
  }
  saveConfig() {
    const mkdirOptions = {
      recursive: true
    };
    if (this.context) {
      fs.mkdirSync(path.dirname(this.context.configPath), mkdirOptions);
      writeJsonAtomically(this.context.configPath, this.configValue);
    }
  }
  updateConfig(partial) {
    const config = this.configValue;
    this.configValue = normalizeConfig({
      ...this.configValue,
      ...partial
    });
    const visitKeys = ["visitEnabled", "visitFriends", "visitStrangers", "visitAutoCare", "visitMaxPerDay", "visitDelayMinMinutes", "visitDelayMaxMinutes", "otherCareDailyExperienceLimit", "visitCandidateScanLimit", "visitStrangerGroupIds"];
    if (this.scheduler && visitKeys.some(key => config[key] !== this.configValue[key])) {
      this.scheduler.progress.clearBlock("visit");
    }
    this.saveConfig();
    this.updateStatus({
      config: this.getConfig(),
      account: this.accountStatus()
    });
    if (this.scheduler && config.intervalSeconds !== this.configValue.intervalSeconds && this.scheduler.running) {
      this.scheduler.stop();
      this.scheduler.start();
    }
    if (this.scheduler && config.enabled !== this.configValue.enabled) {
      if (this.configValue.enabled && this.configValue.autoStart) {
        this.scheduler.start();
      } else if (!this.configValue.enabled) {
        this.scheduler.stop();
      }
    }
  }
  replaceConfig(input) {
    this.updateConfig(normalizeConfig(input));
  }
  log(message) {
    const localeOptions = {
      hour12: false
    };
    const timestamp = Date.now();
    const timeLabel = new Date(timestamp).toLocaleTimeString("zh-CN", localeOptions);
    const lastLoggedAt = this.logTimes.get(message) ?? 0;
    if (timestamp - lastLoggedAt < 600000) {
      const count = (this.logCounts.get(message) ?? 1) + 1;
      this.logCounts.set(message, count);
      this.logTimes.set(message, timestamp);
      const messageSuffix = "] " + message;
      const existingIndex = this.logLines.findLastIndex(line => line.includes(messageSuffix));
      if (existingIndex >= 0) {
        this.logLines.splice(existingIndex, 1);
      }
      this.logLines.push("[" + timeLabel + "] " + message + "（共 " + count + " 次）");
      return;
    }
    this.logCounts.set(message, 1);
    this.logTimes.set(message, timestamp);
    const logLine = "[" + timeLabel + "] " + message;
    this.logLines.push(logLine);
    this.logLines = this.logLines.slice(-120);
    this.context?.logger.info(message);
  }
  updateStatus(patch) {
    this.status = {
      ...this.status,
      ...patch
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
  constructor(client, version) {
    this.client = client;
    this.version = version;
  }
  call(action, params = {}) {
    return this.client.call(action, params);
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
function detectRuntimeKind(versionInfo) {
  const appName = String(versionInfo.app_name ?? "").toLowerCase();
  if (appName.includes("snowluma")) {
    return "snowluma";
  } else if (appName.includes("napcat")) {
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
  const reportWriteFailure = error => {
    if (!writeFailureReported) {
      writeFailureReported = true;
      process.stderr.write("[QQPet] 本地日志写入失败：" + formatLogError(error) + "\n");
    }
  };
  const rotateIfNeeded = addedBytes => {
    let currentSize = 0;
    try {
      currentSize = fs.statSync(logPath).size;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    if (currentSize + addedBytes <= maxBytes) {
      return;
    }
    const oldestBackupPath = logPath + "." + backups;
    if (fs.existsSync(oldestBackupPath)) {
      fs.unlinkSync(oldestBackupPath);
    }
    for (let index = backups - 1; index >= 1; index -= 1) {
      const backupPath = logPath + "." + index;
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, logPath + "." + (index + 1));
      }
    }
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, logPath + ".1");
    }
  };
  const writeEntry = (level, message, extraArgs) => {
    const extraText = extraArgs.length ? " " + extraArgs.map(formatLogError).join(" ") : "";
    const logLine = "[" + now().toISOString() + "] [" + level + "] " + formatLogError(message) + extraText + "\n";
    process.stdout.write(logLine);
    try {
      const mkdirOptions = {
        recursive: true,
        mode: 448
      };
      fs.mkdirSync(logDir, mkdirOptions);
      rotateIfNeeded(Buffer.byteLength(logLine));
      fs.appendFileSync(logPath, logLine, {
        encoding: "utf8",
        mode: 384
      });
      try {
        fs.chmodSync(logPath, 384);
      } catch {}
    } catch (error) {
      reportWriteFailure(error);
    }
  };
  return {
    filePath: logPath,
    debug: (message, ...extraArgs) => writeEntry("DEBUG", message, extraArgs),
    info: (message, ...extraArgs) => writeEntry("INFO", message, extraArgs),
    warn: (message, ...extraArgs) => writeEntry("WARN", message, extraArgs),
    error: (message, ...extraArgs) => writeEntry("ERROR", message, extraArgs)
  };
}
class OneBotError extends Error {
  constructor(message, action, httpStatus = 0, retcode = -1) {
    super(message);
    this.action = action;
    this.httpStatus = httpStatus;
    this.retcode = retcode;
    this.name = "OneBotActionError";
  }
}
function normalizeOneBotUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("QQPET_ONEBOT_URL 无效：" + rawUrl);
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
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.retryDelayMs = Math.max(100, options.retryDelayMs ?? 500);
  }
  baseUrl;
  accessToken;
  timeoutMs;
  maxRetries;
  retryDelayMs;
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
    let networkError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
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
        networkError = new OneBotError("OneBot 请求失败：" + message, action);
        continue;
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
    throw networkError;
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
    const notFoundBody = {
      code: -1,
      message: "文件不存在"
    };
    sendJson(response, 404, notFoundBody);
    return;
  }
  if (!stat.isFile()) {
    const notFoundBody = {
      code: -1,
      message: "文件不存在"
    };
    sendJson(response, 404, notFoundBody);
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
function isWithinPath(childPath, parentPath) {
  return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
}
function resolveStaticAssetPath(webuiPath, assetPath) {
  const rootPath = fs.realpathSync(webuiPath);
  const candidatePath = path.resolve(rootPath, assetPath);
  if (!isWithinPath(candidatePath, rootPath)) {
    return null;
  }
  try {
    const realPath = fs.realpathSync(candidatePath);
    return isWithinPath(realPath, rootPath) ? realPath : null;
  } catch {
    return candidatePath;
  }
}
function createApiToken() {
  return randomBytes(32).toString("base64url");
}
function isAuthorizedRequest(request, expectedToken) {
  const authorization = request.headers.authorization ?? "";
  const prefix = "Bearer ";
  if (!expectedToken || !authorization.startsWith(prefix)) {
    return false;
  }
  const actual = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(expectedToken);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function renderIndexHtml(webuiPath, runtimeName, apiToken) {
  const appMtime = Math.trunc(fs.statSync(path.join(webuiPath, "app.js")).mtimeMs);
  const tokenScript = `<script>window.__QQPET_API_BASE__="/api";window.__QQPET_API_TOKEN__=${JSON.stringify(apiToken)};</script>`;
  return fs.readFileSync(path.join(webuiPath, "index.html"), "utf8").replace("ONEBOT · QQ PET", runtimeName.toUpperCase() + " · QQ PET").replace("正在连接 OneBot…", "正在连接 " + runtimeName + "…").replace(/<script type="module" src="\/static\/app\.js[^"]*/, tokenScript + "\n  <script type=\"module\" src=\"/static/app.js?v=" + appMtime);
}
function createWebServer(plugin, options) {
  const indexHtml = renderIndexHtml(options.webuiPath, options.runtimeName, options.apiToken);
  return http.createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (method === "GET" && url.pathname === "/healthz") {
        const healthBody = {
          status: "ok",
          runtime: options.runtimeKind,
          uin: options.uin
        };
        sendJson(response, 200, healthBody);
        return;
      }
      if (url.pathname.startsWith("/api/") && !isAuthorizedRequest(request, options.apiToken)) {
        sendJson(response, 401, {
          code: -1,
          message: "未授权的 API 请求"
        });
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
        let assetPath;
        try {
          assetPath = decodeURIComponent(url.pathname.slice(8));
        } catch {
          assetPath = "";
        }
        const resolvedAssetPath = assetPath && !assetPath.includes("\0") && !assetPath.includes("\\") ? resolveStaticAssetPath(options.webuiPath, assetPath) : null;
        if (!resolvedAssetPath) {
          const invalidPathBody = {
            code: -1,
            message: "静态文件路径无效"
          };
          sendJson(response, 400, invalidPathBody);
          return;
        }
        serveStaticFile(response, resolvedAssetPath);
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
        const actionResult = await plugin.scheduler?.runOnce();
        if (actionResult === null) {
          sendJson(response, 409, {
            code: -1,
            message: "当前已有请求执行中，请稍后再试"
          });
          return;
        }
        sendJson(response, 200, {
          code: 0,
          data: {
            action: actionResult,
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
        const changed = (await plugin.scheduler?.stopAndWait()) ?? false;
        sendJson(response, 200, {
          code: 0,
          data: {
            changed: changed
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
      const notFoundBody = {
        code: -1,
        message: "接口不存在"
      };
      sendJson(response, 404, notFoundBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, message === "请求体过大" ? 413 : 500, {
        code: -1,
        message: message
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
  const dataRoot = process.env.QQPET_DATA_DIR?.trim() ? path.resolve(process.env.QQPET_DATA_DIR) : path.join(os.homedir(), ".qqpet-miku");
  const accountDataDir = path.join(dataRoot, runtime.kind, uin);
  const mkdirOptions = {
    recursive: true
  };
  fs.mkdirSync(accountDataDir, mkdirOptions);
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
  const webPort = parsePort("QQPET_WEB_PORT", 8091, isDesktopMode());
  const webuiPath = path.join(pluginDir, "webui");
  const apiToken = createApiToken();
  const server = createWebServer(plugin, {
    host: webHost,
    port: webPort,
    webuiPath: webuiPath,
    runtimeName: runtime.runtimeName,
    runtimeKind: runtime.kind,
    uin: uin,
    apiToken: apiToken
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
    const stoppingEvent = {
      type: "stopping",
      pid: process.pid
    };
    if (!stopping) {
      stopping = true;
      sendDesktopEvent(stoppingEvent);
      await plugin.cleanup();
      await new Promise(resolve => server.close(() => resolve()));
      sendDesktopEvent({
        type: "stopped",
        pid: process.pid
      });
    }
  };
  const readlineOptions = {
    input: process.stdin,
    terminal: false
  };
  if (isDesktopMode()) {
    readline.createInterface(readlineOptions).on("line", line => {
      try {
        if (JSON.parse(line).command === "shutdown") {
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
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write("OneBot QQ 宠物启动失败：" + message + "\n");
    process.exitCode = 1;
  });
}
export { AutomationController, DEFAULT_CONFIG, OneBotHttpClient, ProgressStore, QQPetApi, QQPetPlugin, TaskFallbackError, buildCandidateList, compareEmployableFriends, compareRewardPerSecond, createApiToken, createWebServer, decideNextTask, estimateBestTaskRps, fatigueAction, hasFreeAvailableCourses, isAdventureWindowOpen, isFailureDiscouraged, isFallbackWorthy, isIrrecoverableSettleError, isWithinTimeWindow, normalizeConfig, orderCandidatesForSmart, parseDurationSeconds, parseFatigueStatus, parseRewardAmount, resolveStaticAssetPath, rotateSchoolAttribute, selectSchoolAttribute, selectSchoolOrWork, telemetryToOutdoorRecords, writeJsonAtomically };
