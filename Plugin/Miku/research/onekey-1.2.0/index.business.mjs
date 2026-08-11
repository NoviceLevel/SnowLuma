"OneKey QQPet 1.2.0 pure business extraction.";

import fs from "node:fs";
import path from "node:path";
const DEFAULT_CONFIG_VALUES = {
  enabled: true,
  autoStart: true,
  safeMode: false,
  petId: "AUTO",
  intervalSeconds: 60,
  statusRefreshSeconds: 60,
  restPeriodEnabled: true,
  restStartTime: "00:00",
  restEndTime: "07:00",
  coinThreshold: 500,
  taskPriority: "school",
  fatigue8HourAction: "work",
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
  schoolEncouragementEnabled: true,
  schoolAttribute: "physical",
  schoolRotationEnabled: false,
  schoolRotationEvery: 1,
  courseSubEvent: 0,
  visitEnabled: true,
  visitFriends: true,
  visitStrangers: true,
  visitAutoCare: true,
  visitStompEnabled: false,
  visitMaxPerDay: 10,
  visitDelayMinSeconds: 30,
  visitDelayMaxSeconds: 30,
  otherCareDailyExperienceLimit: 50,
  visitCandidateScanLimit: 30,
  visitStrangerGroupIds: "",
  pkEnabled: false,
  pkOnlyWinnable: true,
  pkMaxPerDay: 10,
  pkFriends: true,
  pkStrangers: false,
  pkCandidateScanLimit: 30,
  workEnabled: true,
  workCareerType: 0,
  workJobSubEvent: 0,
  workTimesPerDay: 0,
  employFriend: false,
  workFriendUins: "",
  workFriendScanLimit: 10,
  adventureEnabled: true,
  quickAdventureEnabled: false,
  adventurePreviewRefreshLimit: 20,
  adventureMoneyBagStopEnabled: false,
  adventureNoMoneyBagLimit: 10,
  adventureOption: "",
  adventureTimesPerDay: 3,
  settleRetrySeconds: 60,
  startConfirmSeconds: 45
};
// Configuration and daily progress persistence.
const DEFAULT_CONFIG = DEFAULT_CONFIG_VALUES;
const NUMERIC_CONFIG_KEYS = ["intervalSeconds", "statusRefreshSeconds", "coinThreshold", "hungerThreshold", "cleanThreshold", "foodPurchaseCount", "bathPurchaseCount", "verifyDelaySeconds", "failureCooldownSeconds", "schoolRotationEvery", "courseSubEvent", "visitMaxPerDay", "pkMaxPerDay", "visitDelayMinSeconds", "visitDelayMaxSeconds", "otherCareDailyExperienceLimit", "visitCandidateScanLimit", "workCareerType", "workJobSubEvent", "workTimesPerDay", "workFriendScanLimit", "adventureTimesPerDay", "pkCandidateScanLimit", "adventurePreviewRefreshLimit", "adventureNoMoneyBagLimit", "settleRetrySeconds", "startConfirmSeconds"];
function normalizeConfig(input) {
  const record_2 = {
    ...DEFAULT_CONFIG
  };
  const temp_3 = record_2;
  if (!input || typeof input != "object" || Array.isArray(input)) {
    return temp_3;
  }
  const record = {
    ...input
  };
  const record_3 = record;
  if (record_3.visitDelayMinSeconds === undefined && record_3.visitDelayMinMinutes !== undefined) {
    record_3.visitDelayMinSeconds = record_3.visitDelayMinMinutes;
  }
  if (record_3.visitDelayMaxSeconds === undefined && record_3.visitDelayMaxMinutes !== undefined) {
    record_3.visitDelayMaxSeconds = record_3.visitDelayMaxMinutes;
  }
  for (const temp of Object.keys(DEFAULT_CONFIG)) {
    const member = record_3[temp];
    if (typeof DEFAULT_CONFIG[temp] == typeof member) {
      temp_3[temp] = member;
    }
  }
  for (const temp_2 of NUMERIC_CONFIG_KEYS) {
    const number = Number(record_3[temp_2] ?? temp_3[temp_2]);
    if (Number.isFinite(number)) {
      temp_3[temp_2] = Math.max(0, number);
    }
  }
  if (!["culture", "physical", "art"].includes(temp_3.schoolAttribute)) {
    temp_3.schoolAttribute = "physical";
  }
  if (!["school", "work"].includes(temp_3.taskPriority)) {
    temp_3.taskPriority = "school";
  }
  if (!["rest", "work", "school"].includes(temp_3.fatigue8HourAction)) {
    temp_3.fatigue8HourAction = "rest";
  }
  if (!["rest", "work", "school"].includes(temp_3.fatigue12HourAction)) {
    temp_3.fatigue12HourAction = "rest";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(temp_3.restStartTime)) {
    temp_3.restStartTime = DEFAULT_CONFIG.restStartTime;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(temp_3.restEndTime)) {
    temp_3.restEndTime = DEFAULT_CONFIG.restEndTime;
  }
  temp_3.intervalSeconds = Math.max(3, Math.min(300, Math.trunc(temp_3.intervalSeconds)));
  temp_3.statusRefreshSeconds = temp_3.intervalSeconds;
  temp_3.foodPurchaseCount = Math.max(1, Math.trunc(temp_3.foodPurchaseCount));
  temp_3.bathPurchaseCount = Math.max(1, Math.trunc(temp_3.bathPurchaseCount));
  temp_3.schoolRotationEvery = Math.max(1, Math.trunc(temp_3.schoolRotationEvery));
  temp_3.visitDelayMinSeconds = Math.trunc(temp_3.visitDelayMinSeconds);
  temp_3.visitDelayMaxSeconds = Math.max(temp_3.visitDelayMinSeconds, Math.trunc(temp_3.visitDelayMaxSeconds));
  temp_3.otherCareDailyExperienceLimit = Math.trunc(temp_3.otherCareDailyExperienceLimit);
  temp_3.visitCandidateScanLimit = Math.max(1, Math.min(200, Math.trunc(temp_3.visitCandidateScanLimit)));
  temp_3.workFriendScanLimit = Math.max(1, Math.min(200, Math.trunc(temp_3.workFriendScanLimit)));
  temp_3.pkCandidateScanLimit = Math.max(1, Math.min(100, Math.trunc(temp_3.pkCandidateScanLimit)));
  temp_3.adventurePreviewRefreshLimit = Math.max(1, Math.min(50, Math.trunc(temp_3.adventurePreviewRefreshLimit)));
  temp_3.adventureNoMoneyBagLimit = Math.max(1, Math.min(1000, Math.trunc(temp_3.adventureNoMoneyBagLimit)));
  return temp_3;
}
function isAutoPetId(petId) {
  return ["", "AUTO", "YOUR_PET_ID"].includes(String(petId ?? "").trim().toUpperCase());
}
function parseUinList(input) {
  if (typeof input != "string") {
    return [];
  } else {
    return [...new Set(input.split(/[,，;；\s]+/).map(temp => temp.trim()).filter(temp_2 => /^[1-9]\d{4,11}$/.test(temp_2)))];
  }
}
const EMPTY_DAILY_COUNTS = {
  school: 0,
  work: 0,
  adventure: 0,
  employed: 0,
  feed: 0,
  wash: 0,
  encourage: 0,
  visitFriend: 0,
  visitStranger: 0,
  careOther: 0,
  stomp: 0,
  pkFriend: 0,
  pkStranger: 0
};
function currentDateKey() {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function createDailyProgress() {
  const record = {
    ...EMPTY_DAILY_COUNTS
  };
  return {
    date: currentDateKey(),
    counts: record,
    history: [],
    pending: null,
    pendingPk: null,
    careBlocks: {},
    settledStoryIds: [],
    dismissedStoryIds: [],
    schoolRotationIndex: 0,
    schoolRotationProgress: 0,
    visitedTargetIds: [],
    encouragedStoryIds: [],
    pkTargetIds: [],
    attributeBaseline: null,
    dailyExperienceGain: 0,
    consecutiveAdventureNoMoneyBag: 0
  };
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
      const record = {
        ...(rest.counts ?? {})
      };
      delete record.returnVisit;
      this.state = {
        ...createDailyProgress(),
        ...rest,
        counts: {
          ...EMPTY_DAILY_COUNTS,
          ...record
        },
        careBlocks: rest.careBlocks ?? {},
        settledStoryIds: rest.settledStoryIds ?? [],
        dismissedStoryIds: rest.dismissedStoryIds ?? [],
        schoolRotationIndex: Math.max(0, Math.trunc(Number(rest.schoolRotationIndex) || 0)),
        schoolRotationProgress: Math.max(0, Math.trunc(Number(rest.schoolRotationProgress) || 0)),
        visitedTargetIds: Array.isArray(rest.visitedTargetIds) ? rest.visitedTargetIds.map(String).slice(-500) : [],
        encouragedStoryIds: Array.isArray(rest.encouragedStoryIds) ? rest.encouragedStoryIds.map(String).slice(-100) : [],
        pkTargetIds: Array.isArray(rest.pkTargetIds) ? rest.pkTargetIds.map(String).slice(-500) : [],
        pendingPk: rest.pendingPk && typeof rest.pendingPk == "object" ? rest.pendingPk : null,
        attributeBaseline: rest.attributeBaseline && typeof rest.attributeBaseline == "object" ? {
          strength: Math.max(0, Number(rest.attributeBaseline.strength) || 0),
          intelligence: Math.max(0, Number(rest.attributeBaseline.intelligence) || 0),
          charm: Math.max(0, Number(rest.attributeBaseline.charm) || 0)
        } : null,
        dailyExperienceGain: Math.max(0, Math.trunc(Number(rest.dailyExperienceGain) || 0)),
        consecutiveAdventureNoMoneyBag: Math.max(0, Math.trunc(Number(rest.consecutiveAdventureNoMoneyBag) || 0))
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
        pkTargetIds: [],
        attributeBaseline: null,
        dailyExperienceGain: 0,
        consecutiveAdventureNoMoneyBag: 0
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
  setPending(kind, storyId = "") {
    this.state.pending = {
      kind: kind,
      createdAt: new Date().toISOString(),
      confirmed: !!storyId,
      storyId: storyId
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
  setPendingPk(kind, storyId, targetUin) {
    this.state.pendingPk = {
      kind: kind,
      storyId: storyId,
      targetUin: targetUin,
      createdAt: new Date().toISOString()
    };
    this.save();
  }
  clearPendingPk() {
    const pendingPk = this.state.pendingPk;
    this.state.pendingPk = null;
    this.save();
    return pendingPk;
  }
  pkTargetWasUsed(uin) {
    return this.snapshot().pkTargetIds.includes(uin);
  }
  markPkTarget(uin) {
    if (!this.state.pkTargetIds.includes(uin)) {
      this.state.pkTargetIds.push(uin);
      this.state.pkTargetIds = this.state.pkTargetIds.slice(-500);
      this.save();
    }
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
    const member = this.state.careBlocks[key];
    if (member) {
      if (member.until <= Date.now() / 1000 || /mutation_denied/i.test(member.reason)) {
        delete this.state.careBlocks[key];
        this.save();
        return null;
      } else {
        return {
          ...member
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
  storyWasEncouraged(storyId) {
    return this.snapshot().encouragedStoryIds.includes(storyId);
  }
  markStoryEncouraged(storyId) {
    if (!this.state.encouragedStoryIds.includes(storyId)) {
      this.state.encouragedStoryIds.push(storyId);
      this.state.encouragedStoryIds = this.state.encouragedStoryIds.slice(-100);
      this.save();
    }
  }
  setAdventureNoMoneyBagStreak(streak) {
    this.state.consecutiveAdventureNoMoneyBag = Math.max(0, Math.trunc(streak));
    this.save();
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
      const list = ["strength", "intelligence", "charm"];
      if (list.every(temp => attributes[temp] < attributeBaseline[temp])) {
        this.state.attributeBaseline = attributes;
        this.state.dailyExperienceGain = 0;
      } else {
        this.state.dailyExperienceGain = list.reduce((accumulator, temp_2) => accumulator + Math.max(0, attributes[temp_2] - attributeBaseline[temp_2]), 0);
      }
    }
    this.save();
    return this.state.dailyExperienceGain;
  }
}
// Commercial authorization boundary. Retained for a faithful full-file audit, excluded from
// the pure QQPet business functionality intended for Miku.

// Protobuf/OIDB codec and QQPet protocol client.
function concatBytes(...chunks) {
  const temp_3 = chunks.reduce((accumulator, temp) => accumulator + temp.length, 0);
  const bytes = new Uint8Array(temp_3);
  let number = 0;
  for (const temp_2 of chunks) {
    bytes.set(temp_2, number);
    number += temp_2.length;
  }
  return bytes;
}
function encodeVarint(value) {
  if (!Number.isSafeInteger(value)) {
    throw new Error("varint 不是安全整数: " + value);
  }
  let temp_2 = value < 0 ? BigInt.asUintN(64, BigInt(value)) : BigInt(value);
  const list = [];
  do {
    const number = Number(temp_2 & 0x7fn);
    temp_2 >>= 0x7n;
    list.push(number | (temp_2 ? 128 : 0));
  } while (temp_2);
  return Uint8Array.from(list);
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
  let offset_2 = offset;
  let temp_2 = 0x0n;
  let temp = 0x0n;
  while (offset_2 < bytes.length) {
    const member = bytes[offset_2++];
    temp_2 |= BigInt(member & 127) << temp;
    if ((member & 128) === 0) {
      const number = Number(temp_2);
      if (!Number.isSafeInteger(number)) {
        throw new Error("protobuf varint 超出安全整数范围");
      }
      return [number, offset_2];
    }
    temp += 0x7n;
    if (temp > 0x46n) {
      throw new Error("protobuf varint 太长");
    }
  }
  throw new Error("protobuf varint 被截断");
}
function parseProtobufFields(bytes) {
  const temp_4 = new Map();
  let number_3 = 0;
  while (number_3 < bytes.length) {
    let temp_2;
    [temp_2, number_3] = decodeVarint(bytes, number_3);
    const number_2 = temp_2 >>> 3;
    const number = temp_2 & 7;
    if (!number_2) {
      throw new Error("protobuf 字段号为 0");
    }
    let temp_3;
    if (number === 0) {
      [temp_3, number_3] = decodeVarint(bytes, number_3);
    } else if (number === 1) {
      if (number_3 + 8 > bytes.length) {
        throw new Error("fixed64 被截断");
      }
      temp_3 = bytes.slice(number_3, number_3 + 8);
      number_3 += 8;
    } else if (number === 2) {
      let temp;
      [temp, number_3] = decodeVarint(bytes, number_3);
      if (number_3 + temp > bytes.length) {
        throw new Error("length-delimited 字段被截断");
      }
      temp_3 = bytes.slice(number_3, number_3 + temp);
      number_3 += temp;
    } else if (number === 5) {
      if (number_3 + 4 > bytes.length) {
        throw new Error("fixed32 被截断");
      }
      temp_3 = bytes.slice(number_3, number_3 + 4);
      number_3 += 4;
    } else {
      throw new Error("暂不支持 protobuf wire type " + number);
    }
    const list = temp_4.get(number_2) ?? [];
    const record = {
      wireType: number,
      value: temp_3
    };
    list.push(record);
    temp_4.set(number_2, list);
  }
  return temp_4;
}
function getProtobufFields(fields, fieldNumber) {
  return fields.get(fieldNumber) ?? [];
}
function getVarintField(fields, fieldNumber, input3 = 0) {
  const temp = fields.get(fieldNumber)?.[0];
  if (temp?.wireType === 0) {
    return Number(temp.value);
  } else {
    return input3;
  }
}
function getBytesField(fields, fieldNumber) {
  const temp = fields.get(fieldNumber)?.[0];
  if (temp?.wireType === 2) {
    return temp.value;
  } else {
    return new Uint8Array();
  }
}
function getStringField(fields, fieldNumber, input3 = "") {
  const fieldBytes = getBytesField(fields, fieldNumber);
  if (fieldBytes.length) {
    return new TextDecoder().decode(fieldBytes);
  } else {
    return input3;
  }
}
function getFloatField(fields, fieldNumber, input3 = 0) {
  const temp = fields.get(fieldNumber)?.[0];
  if (temp?.wireType !== 5) {
    return input3;
  }
  const member = temp.value;
  return new DataView(member.buffer, member.byteOffset, 4).getFloat32(0, true);
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
  constructor(input, input2 = "") {
    super(input);
    this.code = input2;
  }
}
const READ_PACKETS = {
  ownProfile: ["trpc.qqone.gateway.Gateway.Sso_QQpet_GetProfile", 39410, 1],
  ownPetCache: ["OidbSvcTrpcTcp.0x95e1_0", 38369, 0],
  display: ["OidbSvcTrpcTcp.0x96f2_1", 38642, 1],
  feedInventory: ["OidbSvcTrpcTcp.0x9949_1", 39241, 1],
  bathItems: ["OidbSvcTrpcTcp.0x9bf1_1", 39921, 1],
  bathInventory: ["OidbSvcTrpcTcp.0x9bf2_1", 39922, 1],
  pageRules: ["OidbSvcTrpcTcp.0x96a4_1", 38564, 1],
  storyStatus: ["OidbSvcTrpcTcp.0x975a_1", 38746, 1],
  overview: ["OidbSvcTrpcTcp.0x9b60_1", 39776, 1],
  catalog: ["OidbSvcTrpcTcp.0x9ab2_1", 39602, 1],
  otherPet: ["OidbSvcTrpcTcp.0x976c_0", 38764, 0],
  medalGallery: ["OidbSvcTrpcTcp.0x9ac3_0", 39619, 0],
  interactionHistory: ["OidbSvcTrpcTcp.0x994d_1", 39245, 1],
  outdoorHistory: ["OidbSvcTrpcTcp.0x9876_1", 39030, 1],
  petFriends: ["OidbSvcTrpcTcp.0x985d_0", 39005, 0],
  stompStatus: ["OidbSvcTrpcTcp.0x985c_0", 39004, 0],
  pkPower: ["OidbSvcTrpcTcp.0x9ad4_1", 39636, 1]
};
const PET_DIRECTORY_TYPES = {
  friends: 3,
  alsoPlaying: 4
};
const packetKey = ([packet_3, packet_2, packet]) => packet_3 + ":" + packet_2 + ":" + packet;
const READ_ONLY_PACKET_KEYS = new Set([READ_PACKETS.ownProfile, READ_PACKETS.ownPetCache, READ_PACKETS.display, READ_PACKETS.feedInventory, READ_PACKETS.bathItems, READ_PACKETS.bathInventory, READ_PACKETS.pageRules, READ_PACKETS.storyStatus, READ_PACKETS.overview, READ_PACKETS.catalog, READ_PACKETS.otherPet, READ_PACKETS.medalGallery, READ_PACKETS.interactionHistory, READ_PACKETS.outdoorHistory, READ_PACKETS.petFriends, READ_PACKETS.stompStatus, READ_PACKETS.pkPower].map(packetKey));
const DEFAULT_MUTATION_PACKETS = {
  "pet.feed": ["OidbSvcTrpcTcp.0x992d_1", 39213, 1],
  "pet.buy-food": ["OidbSvcTrpcTcp.0x99df_1", 39391, 1],
  "pet.use-bath-item": ["OidbSvcTrpcTcp.0x9bf3_1", 39923, 1],
  "pet.buy-bath-item": ["OidbSvcTrpcTcp.0x9bd0_0", 39888, 0],
  "pet.story-settle": ["OidbSvcTrpcTcp.0x9760_1", 38752, 1],
  "pet.story-start": ["OidbSvcTrpcTcp.0x975e_1", 38750, 1],
  "pet.report-event": ["OidbSvcTrpcTcp.0x96a6_1", 38566, 1],
  "pet.stomp": ["OidbSvcTrpcTcp.0x985b_0", 39003, 0],
  "pet.encourage-story": ["OidbSvcTrpcTcp.0x9c44_1", 40004, 1]
};
const MUTATION_PACKETS = DEFAULT_MUTATION_PACKETS;
function extractPacketHex(payload) {
  if (typeof payload == "string") {
    return payload;
  }
  if (!payload || typeof payload != "object") {
    return "";
  }
  const payload_2 = payload;
  for (const temp of ["data", "packet", "hex"]) {
    const member = payload_2[temp];
    if (typeof member == "string" && /^(?:[0-9a-fA-F]{2})+$/.test(member)) {
      return member;
    }
    const packetHex = extractPacketHex(member);
    if (packetHex) {
      return packetHex;
    }
  }
  return "";
}
function parseRewardAmount(rewardText) {
  const text = "(\\d+(?:\\.\\d+)?)";
  const member_3 = rewardText.match(new RegExp("(?:总收益|合计|总计)\\D*" + text))?.[1];
  const member_2 = rewardText.match(new RegExp("金币\\D*" + text))?.[1];
  const member = rewardText.match(new RegExp(text))?.[1];
  return Number(member_3 ?? member_2 ?? member ?? 0);
}
function adventureHasMoneyBag(adventure) {
  const combined = adventure.name + "\n" + adventure.description;
  return /钱袋子?|捡到(?:了)?\s*金币/.test(combined) || /金币/.test(adventure.reward);
}
function extractImageUrl(...parts) {
  for (const temp of parts) {
    const member = temp.match(/https:\/\/[^\s\])]+\.(?:png|webp|jpe?g|gif)/i)?.[0];
    if (member) {
      return member;
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
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      const trimmed = list.map(temp => {
        if (!temp || typeof temp != "object") {
          return "";
        }
        const text = temp.text;
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
  const number_3 = Number(durationText.match(/(\d+)\s*小时/)?.[1] ?? 0);
  const number = Number(durationText.match(/(\d+)\s*分钟/)?.[1] ?? 0);
  const number_2 = Number(durationText.match(/(\d+)\s*秒/)?.[1] ?? 0);
  return number_3 * 3600 + number * 60 + number_2;
}
function compareRewardPerSecond(left, right) {
  const durationSeconds_2 = parseDurationSeconds(left.duration);
  const durationSeconds = parseDurationSeconds(right.duration);
  const rewardAmount = parseRewardAmount(left.reward);
  const rewardAmount_2 = parseRewardAmount(right.reward);
  if (durationSeconds_2 > 0 && durationSeconds > 0) {
    const number = rewardAmount_2 * durationSeconds_2 - rewardAmount * durationSeconds;
    if (number) {
      return number;
    }
  } else if (durationSeconds_2 !== durationSeconds) {
    if (durationSeconds_2 > 0) {
      return -1;
    } else {
      return 1;
    }
  }
  return rewardAmount_2 - rewardAmount;
}
function parseFatigueStatus(warningText) {
  let trimmed = warningText.trim();
  const member = warningText.match(/[?&]text=([^)&\s]+)/)?.[1];
  if (member) {
    try {
      trimmed = decodeURIComponent(member);
    } catch {}
  }
  const combined = warningText + "\n" + trimmed;
  const fatigue = {
    fatigued: true,
    tier: 12,
    benefitRate: 0.1,
    reason: trimmed || "服务器提示已超过 12 小时"
  };
  const fatigue_2 = {
    fatigued: false,
    tier: 0,
    benefitRate: 1,
    reason: "服务器当前未返回疲劳提示"
  };
  if (/非常累|超出\s*12\s*小时|降低至\s*10%/.test(combined)) {
    return fatigue;
  } else if (/疲惫|超出\s*8\s*小时|收益减少|降低至\s*25%/.test(combined)) {
    return {
      fatigued: true,
      tier: 8,
      benefitRate: 0.25,
      reason: trimmed || "服务器提示已超过 8 小时"
    };
  } else {
    return fatigue_2;
  }
}
function aggregateFatigueStatus(items) {
  const list = items.filter(temp => temp.name);
  if (!list.length) {
    return null;
  }
  const member_2 = list.map(temp_2 => parseFatigueStatus(temp_2.warning ?? "")).filter(temp_3 => temp_3.fatigued).sort((left, right) => (right.tier ?? 0) - (left.tier ?? 0))[0];
  if (member_2) {
    return member_2;
  }
  const member = list.sort((left_2, right_2) => (parseDurationSeconds(left_2.duration) || Number.MAX_SAFE_INTEGER) - (parseDurationSeconds(right_2.duration) || Number.MAX_SAFE_INTEGER))[0];
  return parseFatigueStatus(member.warning ?? "");
}
class QQPetApi {
  constructor(ctx, petId, executeMutation = async input => {
    throw new QQPetError("写请求执行器缺失，已阻止" + input, "mutation_executor_missing");
  }) {
    this.ctx = ctx;
    this.petId = petId;
    this.executeMutation = executeMutation;
  }
  otherPetMobileAvailable = null;
  async sendPacket(packet, body) {
    const [commandName] = packet;
    const temp_4 = packetKey(packet);
    const temp_3 = READ_ONLY_PACKET_KEYS.has(temp_4) ? undefined : "未知协议写请求";
    const hex = bytesToHex(body);
    let temp_5;
    if (temp_3) {
      temp_5 = await this.executeMutation(temp_3, "unregistered.operation", hex, {
        command: commandName,
        dataHex: hex
      });
    } else {
      try {
        const packetRequest = {
          cmd: commandName,
          data: hex
        };
        temp_5 = await this.ctx.actions.call("send_packet", packetRequest, this.ctx.adapterName, this.ctx.pluginManager.config);
      } catch (temp) {
        throw new QQPetError("OneBot send_packet 失败：" + String(temp));
      }
    }
    const packetHex = extractPacketHex(temp_5);
    if (!packetHex) {
      throw new QQPetError(commandName + " 返回空响应或未知响应结构");
    }
    try {
      return hexToBytes(packetHex);
    } catch (temp_2) {
      throw new QQPetError(commandName + " 响应无法解析：" + String(temp_2));
    }
  }
  async sendOidb(packet, body) {
    const [commandName, command, subCommand] = packet;
    const temp = await this.sendPacket(packet, buildPacketEnvelope(command, subCommand, body));
    const fields = parseProtobufFields(temp);
    const temp_3 = getVarintField(fields, 1) === command && getVarintField(fields, 2) === subCommand;
    const temp_2 = temp_3 ? getVarintField(fields, 3) : 0;
    if (temp_2) {
      throw new QQPetError(commandName + " OIDB errorCode=" + temp_2);
    }
    return {
      command: command,
      subCommand: subCommand,
      errorCode: temp_2,
      body: temp_3 ? getBytesField(fields, 4) : temp,
      raw: temp
    };
  }
  async sendProtectedOidb(operation, actionLabel, body) {
    const member = MUTATION_PACKETS[operation];
    const temp_4 = await this.executeMutation(actionLabel, operation, bytesToHex(body), member ? {
      command: member[0],
      dataHex: bytesToHex(buildPacketEnvelope(member[1], member[2], body))
    } : undefined);
    const packetHex = extractPacketHex(temp_4);
    if (!packetHex) {
      throw new QQPetError(actionLabel + "返回空响应或未知响应结构");
    }
    let temp_3;
    try {
      temp_3 = hexToBytes(packetHex);
    } catch (temp) {
      throw new QQPetError(actionLabel + "响应无法解析：" + String(temp));
    }
    const fields = parseProtobufFields(temp_3);
    const varint_2 = getVarintField(fields, 1);
    const varint = getVarintField(fields, 2);
    const temp_2 = varint_2 > 0 && fields.has(4);
    const temp_5 = temp_2 ? getVarintField(fields, 3) : 0;
    if (temp_5) {
      throw new QQPetError(actionLabel + " OIDB errorCode=" + temp_5);
    }
    return {
      command: varint_2,
      subCommand: varint,
      errorCode: temp_5,
      body: temp_2 ? getBytesField(fields, 4) : temp_3,
      raw: temp_3
    };
  }
  async queryOwnPetProfile() {
    const [part1, part2, part3] = READ_PACKETS.ownProfile;
    const temp_8 = await this.sendPacket(READ_PACKETS.ownProfile, buildPacketEnvelope(part2, part3, new Uint8Array()));
    let fields = parseProtobufFields(temp_8);
    if (getVarintField(fields, 1) === part2 && getVarintField(fields, 2) === part3) {
      const varint = getVarintField(fields, 3);
      if (varint) {
        throw new QQPetError(part1 + " OIDB errorCode=" + varint);
      }
      fields = parseProtobufFields(getBytesField(fields, 4));
    }
    const fieldBytes_4 = getBytesField(fields, 1);
    const temp_7 = fieldBytes_4.length ? parseProtobufFields(fieldBytes_4) : fields;
    const trimmed_2 = getStringField(temp_7, 8).trim();
    if (trimmed_2) {
      const fieldBytes_2 = getBytesField(temp_7, 13);
      const temp_4 = fieldBytes_2.length ? parseProtobufFields(fieldBytes_2) : new Map();
      const fieldBytes = getBytesField(temp_7, 14);
      const temp_3 = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
      const varint_2 = getVarintField(temp_7, 6);
      const mappedItems = getProtobufFields(temp_3, 1).filter(temp => temp.wireType === 2).map(temp_2 => parseMedal(temp_2.value, true, true));
      return {
        petId: trimmed_2,
        name: getStringField(temp_7, 1).trim(),
        birthdayAt: getVarintField(temp_7, 4),
        gender: varint_2 === 1 ? "男" : varint_2 === 2 ? "女" : "未知",
        species: getStringField(temp_7, 11).trim(),
        personality: getStringField(temp_7, 7).trim(),
        avatarUrl: getStringField(temp_7, 18).trim() || getStringField(temp_7, 3).trim(),
        fullAvatarUrl: getStringField(temp_7, 3).trim() || getStringField(temp_7, 18).trim(),
        personalityUrl: getStringField(temp_7, 9).trim(),
        medals: mappedItems,
        level: getVarintField(temp_4, 1),
        currentExperience: getVarintField(temp_4, 2),
        levelExperience: getVarintField(temp_4, 3),
        experienceRate: getFloatField(temp_4, 4, 1)
      };
    }
    try {
      const temp_5 = await this.sendOidb(READ_PACKETS.ownPetCache, new Uint8Array());
      const fieldBytes_3 = getBytesField(parseProtobufFields(temp_5.body), 1);
      const temp_6 = fieldBytes_3.length ? parseProtobufFields(fieldBytes_3) : new Map();
      const trimmed = getStringField(temp_6, 101).trim();
      if (trimmed) {
        return {
          petId: trimmed,
          name: getStringField(temp_6, 1).trim(),
          birthdayAt: 0,
          gender: "未知",
          species: "",
          personality: "",
          level: 0,
          avatarUrl: getStringField(temp_6, 3).trim(),
          fullAvatarUrl: getStringField(temp_6, 3).trim(),
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
    const fields_4 = parseProtobufFields((await this.sendOidb(READ_PACKETS.medalGallery, encodeStringField(1, this.petId))).body);
    const list = [];
    for (const temp_3 of getProtobufFields(fields_4, 1)) {
      if (temp_3.wireType !== 2) {
        continue;
      }
      const fields_3 = parseProtobufFields(temp_3.value);
      for (const temp_2 of getProtobufFields(fields_3, 3)) {
        if (temp_2.wireType !== 2) {
          continue;
        }
        const fields_2 = parseProtobufFields(temp_2.value);
        for (const temp of getProtobufFields(fields_2, 2)) {
          if (temp.wireType !== 2) {
            continue;
          }
          const fields = parseProtobufFields(temp.value);
          const fieldBytes = getBytesField(fields, 1);
          if (fieldBytes.length) {
            list.push(parseMedal(fieldBytes, !!getVarintField(fields, 2), !!getVarintField(fields, 4)));
          }
        }
      }
    }
    return list;
  }
  async queryInteractionMessages(limit = 20) {
    const bytes = concatBytes(encodeVarintField(1, 0), encodeVarintField(2, Math.max(1, Math.min(50, Math.trunc(limit)))));
    const fields_2 = parseProtobufFields((await this.sendOidb(READ_PACKETS.interactionHistory, bytes)).body);
    return getProtobufFields(fields_2, 1).flatMap(temp => {
      if (temp.wireType !== 2) {
        return [];
      }
      const fields = parseProtobufFields(temp.value);
      const trimmed = getStringField(fields, 4).trim();
      const interactionText = parseInteractionText(getStringField(fields, 2));
      if (!trimmed || !interactionText) {
        return [];
      } else {
        return [{
          id: trimmed,
          uin: getStringField(fields, 1).trim(),
          petName: getStringField(fields, 5).trim(),
          text: interactionText,
          timestamp: getVarintField(fields, 3),
          eventType: getVarintField(fields, 6)
        }];
      }
    });
  }
  async queryOutdoorRecords(limit = 20, offset = 0) {
    const requestBody = concatBytes(encodeVarintField(1, Math.max(0, Math.trunc(offset))), encodeVarintField(2, Math.max(1, Math.min(50, Math.trunc(limit)))), encodeStringField(3, this.petId), encodeVarintField(100, 2));
    const response = parseProtobufFields((await this.sendOidb(READ_PACKETS.outdoorHistory, requestBody)).body);
    const readWatermark = getVarintField(response, 4);
    return getProtobufFields(response, 1).filter(entryField => entryField.wireType === 2).flatMap(entryField => {
      const entry = parseProtobufFields(entryField.value);
      const storyId = getStringField(entry, 1).trim();
      if (!storyId) {
        return [];
      }
      const timestamp = getVarintField(entry, 2);
      const resultList = parseProtobufFields(getBytesField(entry, 6));
      const results = getProtobufFields(resultList, 1).filter(resultField => resultField.wireType === 2).map(resultField => {
        const result = parseProtobufFields(resultField.value);
        const rawType = getVarintField(result, 1);
        return {
          name: getStringField(result, 2).trim(),
          value: getVarintField(result, 3),
          rightTopDescription: getStringField(result, 4).trim(),
          iconUrl: getStringField(result, 6).trim(),
          difference: getVarintField(result, 7),
          type: rawType === 1 ? 2 : rawType === 2 ? 3 : rawType,
          isPetInfo: !!getVarintField(result, 9),
          petId: getStringField(result, 10).trim()
        };
      });
      return [{
        storyId,
        timestamp,
        eventType: getVarintField(entry, 7),
        grade: getVarintField(entry, 4),
        title: getStringField(entry, 3).trim(),
        detail: getStringField(entry, 5).trim(),
        results,
        unread: timestamp > readWatermark,
        outdoorVersion: getVarintField(entry, 8)
      }];
    });
  }
  async queryValues() {
    const [profile, petValues, temp] = await Promise.all([this.queryCondition(), this.queryGold(), this.queryAttributes()]);
    const record = {
      ...profile,
      gold: petValues,
      ...temp
    };
    return record;
  }
  async queryCondition() {
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(1)));
    const temp = await this.sendOidb(READ_PACKETS.display, bytes);
    const fields = parseProtobufFields(getBytesField(parseProtobufFields(temp.body), 1));
    const handler = input => getFloatField(parseProtobufFields(getBytesField(fields, input)), 3);
    return {
      feel: handler(1),
      hunger: handler(2),
      clean: handler(3),
      total: handler(4)
    };
  }
  async queryGold() {
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(6)));
    const temp = await this.sendOidb(READ_PACKETS.display, bytes);
    const fields = parseProtobufFields(getBytesField(parseProtobufFields(temp.body), 1));
    return getFloatField(parseProtobufFields(getBytesField(fields, 5)), 3);
  }
  async queryAttributes() {
    const bytes = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const fields_2 = parseProtobufFields((await this.sendOidb(READ_PACKETS.overview, bytes)).body);
    const fieldBytes = getBytesField(fields_2, 2);
    const temp_4 = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
    const attributes = {
      strength: 0,
      intelligence: 0,
      charm: 0
    };
    const flatItems = [1, 2, 3].flatMap(temp => getProtobufFields(temp_4, temp));
    for (const temp_3 of flatItems) {
      if (temp_3.wireType !== 2) {
        continue;
      }
      const fields = parseProtobufFields(temp_3.value);
      const fieldText = getStringField(fields, 1);
      const temp_2 = fieldText === "力量" ? "strength" : fieldText === "智力" ? "intelligence" : fieldText === "魅力" ? "charm" : null;
      if (temp_2) {
        attributes[temp_2] = getVarintField(fields, 3);
      }
    }
    return attributes;
  }
  async queryOtherPet(uin, kind) {
    const handler = input => {
      const temp_2 = getStringField(input, 8).trim() || getStringField(input, 101).trim();
      if (!temp_2) {
        return null;
      }
      const fieldBytes = getBytesField(input, 13);
      const temp = fieldBytes.length ? getVarintField(parseProtobufFields(fieldBytes), 1) : 0;
      return {
        uin: uin,
        petId: temp_2,
        name: getStringField(input, 1).trim(),
        level: temp,
        kind: kind
      };
    };
    if (this.otherPetMobileAvailable === false) {
      throw new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口");
    }
    try {
      const fields = parseProtobufFields((await this.sendOidb(READ_PACKETS.otherPet, encodeStringField(1, uin))).body);
      this.otherPetMobileAvailable = true;
      const fieldBytes_2 = getBytesField(fields, 1);
      return handler(fieldBytes_2.length ? parseProtobufFields(fieldBytes_2) : fields);
    } catch (temp_3) {
      const temp_4 = temp_3 instanceof Error ? temp_3.message : String(temp_3);
      if (/用户没有宠物|尚未创建.*宠物|未创建.*宠物/.test(temp_4)) {
        this.otherPetMobileAvailable = true;
        return null;
      }
      throw /不支持.*好友宠物|请升级客户端版本|action.*(?:不存在|not found|unsupported)|返回空响应或未知响应结构|unknown command/i.test(temp_4) ? (this.otherPetMobileAvailable = false, new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口：" + temp_4, "other_pet_unsupported")) : new QQPetError("查询好友宠物失败：" + temp_4, "other_pet_query_failed");
    }
  }
  async queryOtherValues(petId) {
    const bytes = concatBytes(encodeStringField(1, petId), encodeBytesField(2, Uint8Array.of(1)));
    const fields = parseProtobufFields(getBytesField(parseProtobufFields((await this.sendOidb(READ_PACKETS.display, bytes)).body), 1));
    const handler = input => getFloatField(parseProtobufFields(getBytesField(fields, input)), 3);
    return {
      feel: handler(1),
      hunger: handler(2),
      clean: handler(3),
      total: handler(4)
    };
  }
  async queryPetFriendRecords(page, directoryType = PET_DIRECTORY_TYPES.friends) {
    const list = [];
    const temp_4 = new Set();
    let text_2 = "";
    for (let number = 0; number < 100; number += 1) {
      const bytes = concatBytes(encodeStringField(1, text_2), encodeVarintField(2, directoryType));
      const fields_5 = parseProtobufFields((await this.sendOidb(READ_PACKETS.petFriends, bytes)).body);
      for (const temp_3 of getProtobufFields(fields_5, 1).filter(temp => temp.wireType === 2)) {
        const fields_2 = parseProtobufFields(temp_3.value);
        const matches = getVarintField(fields_2, 8) === 0;
        if (!page && !matches) {
          continue;
        }
        const fields = parseProtobufFields(getBytesField(fields_2, 1));
        const fields_3 = parseProtobufFields(getBytesField(fields_2, 2));
        const trimmed = (getStringField(fields, 8) || getStringField(fields, 101)).trim();
        const text = String(getVarintField(fields_3, 1));
        if (!trimmed || !/^[1-9]\d{4,11}$/.test(text)) {
          continue;
        }
        const fields_4 = parseProtobufFields(getBytesField(fields, 13));
        list.push({
          target: {
            uin: text,
            petId: trimmed,
            name: (getStringField(fields, 1) || getStringField(fields_3, 2)).trim(),
            level: getVarintField(fields_4, 1),
            kind: matches ? "friend" : "stranger"
          },
          isFriend: matches,
          raw: fields_2
        });
      }
      if (!getVarintField(fields_5, 3)) {
        break;
      }
      const trimmed_2 = getStringField(fields_5, 2).trim();
      if (!trimmed_2 || trimmed_2 === text_2 || temp_4.has(trimmed_2)) {
        break;
      }
      temp_4.add(trimmed_2);
      text_2 = trimmed_2;
    }
    return [...new Map(list.map(temp_2 => [temp_2.target.uin, temp_2])).values()];
  }
  async queryPetFriendDirectory() {
    const list = await this.queryPetFriendRecords(true);
    const mappedItems = list.map(temp => {
      const fields = parseProtobufFields(getBytesField(temp.raw, 14));
      return {
        target: temp.target,
        isFriend: temp.isFriend,
        displayedPkPower: getVarintField(fields, 4)
      };
    });
    const mappedItems_2 = list.filter(temp_2 => temp_2.isFriend).map(temp_3 => {
      const fields_2 = parseProtobufFields(getBytesField(temp_3.raw, 13));
      const varint = getVarintField(temp_3.raw, 3);
      return {
        target: temp_3.target,
        coinBonusPercent: getVarintField(fields_2, 1),
        careerName: getStringField(fields_2, 2).trim(),
        statusCode: varint,
        statusDescription: getStringField(temp_3.raw, 7).trim(),
        available: varint === 10
      };
    });
    const record = {
      petDirectory: mappedItems,
      workHireFriends: mappedItems_2
    };
    return record;
  }
  async queryPetDirectory() {
    return (await this.queryPetFriendDirectory()).petDirectory;
  }
  async queryPetAlsoPlayingDirectory() {
    return (await this.queryPetFriendRecords(true, PET_DIRECTORY_TYPES.alsoPlaying)).filter(temp => !temp.isFriend).map(temp_2 => {
      const fields = parseProtobufFields(getBytesField(temp_2.raw, 14));
      return {
        target: temp_2.target,
        isFriend: false,
        displayedPkPower: getVarintField(fields, 4)
      };
    });
  }
  async queryWorkHireFriends() {
    return (await this.queryPetFriendDirectory()).workHireFriends;
  }
  async visitOther(uin) {
    const bytes_2 = concatBytes(encodeVarintField(1, 4000), encodeVarintField(2, 0), encodeVarintField(3, 0));
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, uin), encodeBytesField(3, bytes_2), encodeBytesField(4, new Uint8Array()));
    await this.sendProtectedOidb("pet.report-event", "走访宠物", bytes);
  }
  async queryStompStatus(uin) {
    if (!/^[1-9]\d{4,11}$/.test(uin)) {
      throw new QQPetError("QQ 号格式无效", "invalid_uin");
    }
    const fields = parseProtobufFields((await this.sendOidb(READ_PACKETS.stompStatus, encodeVarintField(1, Number(uin)))).body);
    return {
      count: Number(getVarintField(fields, 1)),
      alreadyStomped: getVarintField(fields, 2) !== 0
    };
  }
  async stompOther(uin) {
    if (!/^[1-9]\d{4,11}$/.test(uin)) {
      throw new QQPetError("QQ 号格式无效", "invalid_uin");
    }
    const fields = parseProtobufFields((await this.sendProtectedOidb("pet.stomp", "踩踩", encodeVarintField(1, Number(uin)))).body);
    return {
      count: Number(getVarintField(fields, 1)),
      alreadyStomped: true
    };
  }
  async encourageSchool(storyId) {
    if (!storyId || storyId.split("_", 1)[0] !== "6100") {
      throw new QQPetError("只有进行中的学习任务可以鼓励", "invalid_school_story");
    }
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, storyId));
    const fields = parseProtobufFields((await this.sendProtectedOidb("pet.encourage-story", "鼓励宠物", bytes)).body);
    const flatItems = getProtobufFields(fields, 2).flatMap(temp => temp.wireType === 2 ? [new TextDecoder().decode(temp.value)].filter(Boolean) : []);
    return {
      credit: getVarintField(fields, 1),
      toastWords: flatItems,
      selectedToast: getStringField(fields, 3)
    };
  }
  async queryPkPower(uin) {
    if (!uin.trim()) {
      throw new QQPetError("宠物 ID 不能为空", "invalid_pet_id");
    }
    const bytes = concatBytes(encodeStringField(1, uin), encodeVarintField(100, 2));
    const fields_2 = parseProtobufFields((await this.sendOidb(READ_PACKETS.pkPower, bytes)).body);
    const fields = parseProtobufFields(getBytesField(fields_2, 1));
    const varint = getVarintField(fields, 4);
    if (varint <= 0) {
      throw new QQPetError("服务器未返回有效 PK 战力", "pk_power_missing");
    }
    return {
      petId: uin,
      power: varint,
      dominantType: getVarintField(fields, 3)
    };
  }
  async startPk(candidate) {
    const bytes = concatBytes(encodeStringField(1, candidate.target.uin), encodeStringField(2, candidate.target.petId));
    const bytes_2 = concatBytes(encodeVarintField(1, 6900), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeBytesField(4, bytes), encodeStringField(6, "PK"), encodeVarintField(7, 6901), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendProtectedOidb("pet.story-start", "发起 PK", bytes_2)).body);
    const fieldText = getStringField(fields, 1);
    if (!fieldText) {
      throw new QQPetError("PK 成功发起但服务器未返回 Story ID", "pk_story_id_missing");
    }
    const record = {
      candidate: candidate,
      storyId: fieldText
    };
    return record;
  }
  async settlePk(storyId) {
    if (!storyId.trim()) {
      throw new QQPetError("PK Story ID 不能为空", "invalid_story_id");
    }
    const bytes = concatBytes(encodeStringField(1, storyId), encodeVarintField(2, 6000), encodeStringField(3, this.petId), encodeVarintField(100, 2));
    await this.sendProtectedOidb("pet.story-settle", "结算 PK", bytes);
  }
  async feedOther(uin, petId) {
    const bytes = concatBytes(encodeStringField(1, uin), encodeStringField(2, ""), encodeStringField(3, ""), encodeStringField(4, petId));
    await this.sendProtectedOidb("pet.feed", "喂食", bytes);
  }
  async washOther(uin, itemId) {
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, itemId), encodeVarintField(3, 1), encodeStringField(4, uin));
    await this.sendProtectedOidb("pet.use-bath-item", "使用洗护用品", bytes);
  }
  async feed() {
    await this.sendProtectedOidb("pet.feed", "喂食", encodeStringField(4, this.petId));
  }
  async queryFoodInventory() {
    const temp_3 = await this.sendOidb(READ_PACKETS.feedInventory, encodeStringField(4, ""));
    const fields_2 = parseProtobufFields(temp_3.body);
    const list = getProtobufFields(fields_2, 4).flatMap(temp => {
      if (temp.wireType !== 2) {
        return [];
      }
      const fields = parseProtobufFields(temp.value);
      return [{
        balance: getVarintField(fields, 1),
        balanceMax: getVarintField(fields, 2),
        name: getStringField(fields, 3),
        foodId: getStringField(fields, 4),
        tqPic: getStringField(fields, 5),
        resourceId: getStringField(fields, 6),
        selectedPic: getStringField(fields, 7)
      }];
    });
    const handler = input => list.find(temp_2 => temp_2.name.includes(input))?.balance ?? null;
    return {
      biscuits: handler("饼干"),
      shrimp: handler("虾仁"),
      allowanceRemaining: getVarintField(fields_2, 1),
      allowanceMax: getVarintField(fields_2, 2),
      items: list
    };
  }
  async buyFood(count) {
    if (count <= 0) {
      throw new QQPetError("购买饼干数量必须大于 0");
    }
    const fields = parseProtobufFields((await this.sendProtectedOidb("pet.buy-food", "购买食物", encodeVarintField(1, count))).body);
    return {
      bought: getVarintField(fields, 3),
      costGold: getVarintField(fields, 4)
    };
  }
  async queryBathItems() {
    const fields_2 = parseProtobufFields((await this.sendOidb(READ_PACKETS.bathItems, encodeVarintField(1, 1))).body);
    return getProtobufFields(fields_2, 1).filter(temp => temp.wireType === 2).map(temp_2 => {
      const fields = parseProtobufFields(temp_2.value);
      const fieldBytes = getBytesField(fields, 14);
      const temp_3 = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
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
        soapingUrl: extractImageUrl(getStringField(temp_3, 4))
      };
    });
  }
  async queryBathInventory() {
    const fields_2 = parseProtobufFields((await this.sendOidb(READ_PACKETS.bathInventory, encodeVarintField(1, 1))).body);
    const fieldBytes = getBytesField(fields_2, 1);
    const temp_2 = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
    const record = {};
    for (const temp of getProtobufFields(temp_2, 1)) {
      if (temp.wireType !== 2) {
        continue;
      }
      const fields = parseProtobufFields(temp.value);
      record[getStringField(fields, 1)] = getVarintField(fields, 2);
    }
    const temp_3 = {
      soap: record[1] ?? 0,
      bathBall: record[2] ?? 0,
      counts: record
    };
    return temp_3;
  }
  async buyBathItem(itemId, count) {
    if (count <= 0) {
      throw new QQPetError("购买洗护道具数量必须大于 0");
    }
    const bytes = concatBytes(encodeVarintField(1, 1), encodeVarintField(2, 1001), encodeStringField(3, this.petId));
    const bytes_3 = concatBytes(encodeVarintField(1, 355), encodeVarintField(2, Number(itemId)), encodeVarintField(3, count));
    const bytes_2 = concatBytes(encodeBytesField(1, bytes), encodeVarintField(2, 1001), encodeBytesField(3, bytes_3), encodeVarintField(4, 21));
    const fields = parseProtobufFields((await this.sendProtectedOidb("pet.buy-bath-item", "购买洗护用品", bytes_2)).body);
    const varint = getVarintField(fields, 1);
    const fieldText = getStringField(fields, 2);
    return {
      result: varint,
      orderId: fieldText,
      succeeded: varint === 0 && !!fieldText
    };
  }
  async useBathItem(itemId) {
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, itemId), encodeVarintField(3, 1), encodeStringField(4, ""));
    await this.sendProtectedOidb("pet.use-bath-item", "使用洗护用品", bytes);
  }
  async querySchoolStage() {
    const bytes = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const varint = getVarintField(parseProtobufFields((await this.sendOidb(READ_PACKETS.overview, bytes)).body), 4);
    if (![0, 1, 2, 3, 4].includes(varint)) {
      throw new QQPetError("服务器返回未知学习阶段：" + varint);
    }
    return varint;
  }
  async querySchoolCourses(stage) {
    const temp_3 = stage ?? (await this.querySchoolStage());
    const bytes = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeVarintField(11, temp_3), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(READ_PACKETS.catalog, bytes)).body);
    return getProtobufFields(fields, 1).filter(temp => temp.wireType === 2).map(temp_2 => parseCatalogItem(temp_2.value));
  }
  async selectSchoolCourse(attribute, subEventType = 0) {
    const member = {
      physical: "力量",
      culture: "智力",
      art: "魅力"
    }[attribute];
    if (!member) {
      throw new QQPetError("未知学习属性：" + attribute);
    }
    const list = (await this.querySchoolCourses()).filter(temp => temp.canDo && temp.subEventType > 0);
    const temp_4 = subEventType ? list.find(temp_2 => temp_2.subEventType === subEventType) : list.filter(temp_3 => temp_3.reward.includes(member)).sort(compareRewardPerSecond)[0];
    if (!temp_4) {
      throw new QQPetError(subEventType ? "指定课程 " + subEventType + " 当前不可用" : "当前暂无可用的" + member + "课程");
    }
    return temp_4;
  }
  async startSchool(attribute, subEventType = 0) {
    const catalogItem = await this.selectSchoolCourse(attribute, subEventType);
    const bytes = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, catalogItem.name), encodeVarintField(7, catalogItem.subEventType), encodeVarintField(100, 2));
    const temp = await this.sendProtectedOidb("pet.story-start", "开始任务", bytes);
    return {
      item: catalogItem,
      storyId: getStringField(parseProtobufFields(temp.body), 1)
    };
  }
  async queryWorkOverview() {
    const bytes = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const fields_2 = parseProtobufFields((await this.sendOidb(READ_PACKETS.overview, bytes)).body);
    return {
      careers: getProtobufFields(fields_2, 1).filter(temp => temp.wireType === 2).map(temp_2 => {
        const fields = parseProtobufFields(temp_2.value);
        const varint = getVarintField(fields, 4);
        const fieldText = getStringField(fields, 1);
        return {
          careerType: getVarintField(fields, 20),
          name: fieldText,
          available: varint !== 3 && fieldText !== "???",
          statusCode: varint,
          message: getStringField(fields, 5)
        };
      }).filter(temp_3 => temp_3.careerType > 0),
      currentCareerType: getVarintField(fields_2, 3),
      lastSubEventType: getVarintField(fields_2, 5)
    };
  }
  async queryWorkJobs(careerType, input2 = "") {
    const bytes = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, input2), encodeVarintField(10, careerType), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(READ_PACKETS.catalog, bytes)).body);
    const fieldText = getStringField(fields, 2);
    const record = {
      careerType: careerType,
      careerName: fieldText
    };
    return getProtobufFields(fields, 1).filter(temp => temp.wireType === 2).map(temp_2 => parseCatalogItem(temp_2.value, record));
  }
  async selectWorkJob(careerType = 0, jobSubEvent = 0, input3 = "") {
    const workOverview = await this.queryWorkOverview();
    const list_2 = workOverview.careers.filter(temp => temp.available && (!careerType || temp.careerType === careerType));
    if (!list_2.length) {
      throw new QQPetError(careerType ? "职业 " + careerType + " 尚未开放" : "服务器当前没有开放的职业");
    }
    const list = (await Promise.all(list_2.map(temp_2 => this.queryWorkJobs(temp_2.careerType, input3)))).flat().filter(temp_3 => temp_3.canDo && temp_3.subEventType > 0);
    const temp_5 = jobSubEvent ? list.find(temp_4 => temp_4.subEventType === jobSubEvent) : list.sort((left, right) => compareRewardPerSecond(left, right) || +(right.careerType === workOverview.currentCareerType) - +(left.careerType === workOverview.currentCareerType) || (left.careerType ?? 0) - (right.careerType ?? 0))[0];
    if (!temp_5) {
      throw new QQPetError(jobSubEvent ? "指定岗位 " + jobSubEvent + " 当前不可用" : "服务器当前没有可执行的打工岗位");
    }
    return temp_5;
  }
  async startWork(careerType = 0, jobSubEvent = 0, hire) {
    const temp_2 = hire?.uin.trim() ?? "";
    const temp_3 = hire?.petId.trim() ?? "";
    if (!!temp_2 != !!temp_3) {
      throw new QQPetError("雇佣好友时必须同时提供好友账号和宠物 ID");
    }
    const catalogItem = await this.selectWorkJob(careerType, jobSubEvent, temp_3);
    const bytes = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, ""), temp_2 ? encodeBytesField(4, concatBytes(encodeStringField(1, temp_2), encodeStringField(2, temp_3))) : new Uint8Array(), encodeStringField(6, catalogItem.name), encodeVarintField(7, catalogItem.subEventType), encodeVarintField(100, 2));
    const temp = await this.sendProtectedOidb("pet.story-start", "开始任务", bytes);
    return {
      item: catalogItem,
      storyId: getStringField(parseProtobufFields(temp.body), 1),
      hiredFriend: !!temp_2
    };
  }
  async queryAdventureOptions(filterText = "") {
    const bytes = concatBytes(encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, filterText), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(READ_PACKETS.catalog, bytes)).body);
    return getProtobufFields(fields, 1).filter(temp => temp.wireType === 2).map(temp_2 => parseCatalogItem(temp_2.value));
  }
  async queryFatigueStatus() {
    const list = [];
    let temp_9 = null;
    try {
      temp_9 = await this.queryWorkOverview();
    } catch (temp_2) {
      list.push("职业目录：" + (temp_2 instanceof Error ? temp_2.message : String(temp_2)));
    }
    if (temp_9) {
      const temp_6 = temp_9.careers.filter(temp => temp.available).sort((left, right) => +(right.careerType === temp_9?.currentCareerType) - +(left.careerType === temp_9?.currentCareerType));
      for (const temp_5 of temp_6) {
        try {
          const temp_3 = aggregateFatigueStatus(await this.queryWorkJobs(temp_5.careerType));
          if (temp_3) {
            return temp_3;
          }
        } catch (temp_4) {
          list.push((temp_5.name || temp_5.careerType) + "：" + (temp_4 instanceof Error ? temp_4.message : String(temp_4)));
        }
      }
    }
    try {
      const temp_7 = aggregateFatigueStatus(await this.querySchoolCourses());
      if (temp_7) {
        return temp_7;
      }
    } catch (temp_8) {
      list.push("课程目录：" + (temp_8 instanceof Error ? temp_8.message : String(temp_8)));
    }
    return {
      fatigued: null,
      tier: null,
      benefitRate: null,
      reason: "服务器没有返回可用于疲劳判定的任务" + (list.length ? "（" + list.join("；") + "）" : "")
    };
  }
  async startAdventure(optionName = "", quickMode = false, previewRefreshLimit = 30) {
    let catalogItem;
    let number = 0;
    for (; number < 1; number += 1) {
      const list = (await this.queryAdventureOptions()).filter(temp => temp.canDo && temp.name);
      const list_2 = optionName ? list.filter(temp_2 => temp_2.name === optionName) : list;
      catalogItem = quickMode ? list_2.find(adventureHasMoneyBag) : list_2[0];
      if (catalogItem) {
        break;
      }
    }
    if (!catalogItem) {
      throw quickMode ? new QQPetError("快速冒险本轮未出现钱袋子，稍后继续检查", "coin_bag_not_found") : new QQPetError(optionName ? "指定冒险“" + optionName + "”当前不可用" : "服务器当前没有可执行的冒险");
    }
    const list_3 = [encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, catalogItem.name)];
    if (catalogItem.subEventType > 0) {
      list_3.push(encodeVarintField(7, catalogItem.subEventType));
    }
    list_3.push(encodeVarintField(100, 2));
    const temp_3 = await this.sendProtectedOidb("pet.story-start", "开始任务", concatBytes(...list_3));
    return {
      item: catalogItem,
      storyId: getStringField(parseProtobufFields(temp_3.body), 1),
      refreshCount: number + 1
    };
  }
  async queryStory() {
    const bytes = concatBytes(encodeStringField(1, this.petId), encodeVarintField(100, 2));
    const fields = parseProtobufFields((await this.sendOidb(READ_PACKETS.storyStatus, bytes)).body);
    const fieldBytes = getBytesField(fields, 1);
    const temp = fieldBytes.length ? parseProtobufFields(fieldBytes) : new Map();
    const fieldText = getStringField(fields, 2);
    const varint = getVarintField(temp, 2);
    const varint_2 = getVarintField(temp, 3);
    return {
      storyId: fieldText,
      stateCode: getVarintField(temp, 1),
      remainingSeconds: varint,
      durationSeconds: varint_2,
      startedAt: getVarintField(temp, 4),
      recallable: !!getVarintField(temp, 5),
      finished: !!fieldText && !!(varint_2 > 0) && !!(varint <= 0)
    };
  }
  async settleStory(storyId) {
    const bytes = concatBytes(encodeStringField(1, storyId), encodeVarintField(2, 1000), encodeStringField(3, this.petId), encodeVarintField(100, 2));
    return this.sendProtectedOidb("pet.story-settle", "结算任务", bytes);
  }
}
// Automation policy and task orchestration.
const delaySeconds = seconds => new Promise(input => setTimeout(input, Math.max(0, seconds) * 1000));
const ATTRIBUTE_ROTATION = ["physical", "culture", "art"];
function randomDelaySeconds(minMinutes, maxMinutes, random = Math.random) {
  const temp = Math.max(0, Math.trunc(minMinutes));
  const temp_2 = Math.max(temp, Math.trunc(maxMinutes));
  return temp + Math.floor(Math.min(0.999999999, Math.max(0, random())) * (temp_2 - temp + 1));
}
function rotateSchoolAttribute(config, rotationIndex) {
  if (!config.schoolRotationEnabled) {
    return config.schoolAttribute;
  }
  const temp_2 = ATTRIBUTE_ROTATION.indexOf(config.schoolAttribute);
  return ATTRIBUTE_ROTATION[(temp_2 + Math.max(0, Math.trunc(rotationIndex))) % ATTRIBUTE_ROTATION.length];
}
function selectSchoolOrWork(config, values, counts) {
  const record = {
    school: config.schoolEnabled && values.gold >= config.coinThreshold,
    work: config.workEnabled && (!config.workTimesPerDay || (counts.work ?? 0) < config.workTimesPerDay)
  };
  return (config.taskPriority === "work" ? ["work", "school"] : ["school", "work"]).find(temp => record[temp]) ?? null;
}
function fatigueAction(config, fatigue) {
  if (!fatigue.fatigued || !fatigue.tier) {
    return null;
  } else if (fatigue.tier >= 12) {
    return config.fatigue12HourAction;
  } else {
    return config.fatigue8HourAction;
  }
}
function resolveTaskForFatigue(config, fatigue, taskKind) {
  if (taskKind === "adventure") {
    return "adventure";
  } else {
    return fatigueAction(config, fatigue) ?? taskKind;
  }
}
function isRestPeriodActive(config, now = new Date()) {
  if (!config.restPeriodEnabled) {
    return false;
  }
  const handler = input => {
    const [part1, part2] = input.split(":").map(Number);
    return part1 * 60 + part2;
  };
  const combined = now.getHours() * 60 + now.getMinutes();
  const temp = handler(config.restStartTime);
  const temp_2 = handler(config.restEndTime);
  if (temp === temp_2) {
    return true;
  } else if (temp < temp_2) {
    return combined >= temp && combined < temp_2;
  } else {
    return combined >= temp || combined < temp_2;
  }
}
function updateAdventureMoneyBagStreak(previousStreak, beforeGold, afterGold, limit) {
  const matches = afterGold > beforeGold + 0.01;
  const temp = matches ? 0 : Math.max(0, Math.trunc(previousStreak)) + 1;
  const temp_2 = Math.max(1, Math.trunc(limit));
  return {
    dropped: matches,
    goldGain: matches ? Math.max(1, Math.round(afterGold - beforeGold)) : 0,
    streak: temp,
    paused: !matches && temp >= temp_2
  };
}
function shouldPauseAdventureForNoMoneyBag(config, streak) {
  return config.adventureMoneyBagStopEnabled && streak >= Math.max(1, config.adventureNoMoneyBagLimit);
}
function clearFinishedStoryDisplay(story, settled) {
  const storyInfo = {
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
  } else {
    return storyInfo;
  }
}
function isIrrecoverableSettleError(error) {
  return /宠物结算条件不满足|(?:任务|故事).*(?:已结算|不存在|已失效)|无需结算/.test(error instanceof Error ? error.message : String(error));
}
function isMutationDeniedError(error) {
  return error instanceof QQPetError && error.code === "mutation_denied";
}
function comparePkCandidates(left, right) {
  return right.bonus - left.bonus || right.totalReward - left.totalReward || right.target.level - left.target.level || left.target.uin.localeCompare(right.target.uin);
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
  petName = "";
  identityLoaded = false;
  interactions = [];
  interactionsLoadedAt = 0;
  outdoorRecords = [];
  outdoorRecordsLoadedAt = 0;
  catalogCache = null;
  friendDirectoryCache = null;
  alsoPlayingCache = null;
  profileCache = null;
  conditionCache = null;
  goldCache = null;
  attributeCache = null;
  foodCache = null;
  bathCache = null;
  fatigueCache = null;
  nextRunDelaySeconds = 60;
  get running() {
    return this.active;
  }
  start() {
    if (this.running) {
      return false;
    }
    this.active = true;
    const temp = ++this.generation;
    this.host.log("自动托管已启动");
    this.host.updateStatus({
      automationRunning: true,
      activity: "自动托管已启动，正在检查"
    });
    this.loop(temp);
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
  async loop(generation) {
    if (!this.active || generation !== this.generation) {
      return;
    }
    try {
      await this.runOnce();
    } catch (temp) {
      const temp_2 = temp instanceof Error ? temp.message : String(temp);
      this.host.log("本轮失败：" + temp_2);
      this.host.updateStatus({
        connected: false,
        error: temp_2,
        activity: "本轮执行失败，等待重试"
      });
    }
    if (!this.active || generation !== this.generation) {
      return;
    }
    const temp_3 = Math.max(3, this.nextRunDelaySeconds);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.loop(generation);
    }, temp_3 * 1000);
  }
  async client() {
    const temp_2 = this.host.getConfig();
    const api = new QQPetApi(this.host.ctx, temp_2.petId, (input, input2, input3, input4) => this.host.executeWrite(input, input2, input3, input4));
    const isAuto = isAutoPetId(temp_2.petId);
    if (isAuto || !this.identityLoaded) {
      if (isAuto) {
        this.host.updateStatus({
          activity: "正在自动获取宠物档案"
        });
      }
      try {
        const profile = await api.queryOwnPetProfile();
        this.profileCache = {
          loadedAt: Date.now(),
          value: profile
        };
        this.petName = profile.name;
        this.identityLoaded = true;
        if (isAuto) {
          this.host.updateConfig({
            petId: profile.petId
          });
          api.petId = profile.petId;
          this.host.log("已自动获取宠物 ID 和昵称并保存");
        }
      } catch (temp) {
        if (isAuto) {
          throw temp;
        }
        this.identityLoaded = true;
      }
    }
    return api;
  }
  async queryProfile(client, input2 = false) {
    const timestamp = Date.now();
    let member = this.profileCache?.value;
    if (input2 || !member || timestamp - this.profileCache.loadedAt >= 1800000) {
      member = await client.queryOwnPetProfile();
      this.profileCache = {
        loadedAt: timestamp,
        value: member
      };
    }
    if (input2 || !this.interactionsLoadedAt || timestamp - this.interactionsLoadedAt >= 900000) {
      try {
        this.interactions = await client.queryInteractionMessages();
      } catch {}
      this.interactionsLoadedAt = timestamp;
    }
    if (input2 || !this.outdoorRecordsLoadedAt || timestamp - this.outdoorRecordsLoadedAt >= 900000) {
      try {
        this.outdoorRecords = await client.queryOutdoorRecords();
      } catch {}
      this.outdoorRecordsLoadedAt = timestamp;
    }
    return member;
  }
  async queryCurrentValues(client, force = false) {
    const timestamp = Date.now();
    const client_2 = client;
    if (typeof client_2.queryCondition != "function" || typeof client_2.queryGold != "function" || typeof client_2.queryAttributes != "function") {
      const petValues = await client.queryValues();
      const record = {
        loadedAt: timestamp,
        value: petValues
      };
      const record_2 = {
        loadedAt: timestamp,
        value: petValues.gold
      };
      const record_3 = {
        loadedAt: timestamp,
        value: petValues
      };
      this.conditionCache = record;
      this.goldCache = record_2;
      this.attributeCache = record_3;
      return petValues;
    }
    const temp = !force && !!this.goldCache && !!(timestamp - this.goldCache.loadedAt < 120000);
    const temp_2 = !force && !!this.attributeCache && !!(timestamp - this.attributeCache.loadedAt < 600000);
    const [profile, petValues_2, temp_3] = await Promise.all([client_2.queryCondition(), temp ? this.goldCache.value : client_2.queryGold(), temp_2 ? this.attributeCache.value : client_2.queryAttributes()]);
    const record_5 = {
      loadedAt: timestamp,
      value: profile
    };
    const record_6 = {
      loadedAt: timestamp,
      value: petValues_2
    };
    const record_4 = {
      loadedAt: timestamp,
      value: temp_3
    };
    this.conditionCache = record_5;
    if (!temp) {
      this.goldCache = record_6;
    }
    if (!temp_2) {
      this.attributeCache = record_4;
    }
    return {
      ...profile,
      gold: petValues_2,
      ...temp_3
    };
  }
  async queryFood(client, force = false) {
    if (!force && this.foodCache && Date.now() - this.foodCache.loadedAt < 300000) {
      return this.foodCache.value;
    }
    const temp = await client.queryFoodInventory();
    this.foodCache = {
      loadedAt: Date.now(),
      value: temp
    };
    return temp;
  }
  async queryGoldNow(client) {
    const client_2 = client;
    const temp = typeof client_2.queryGold == "function" ? await client_2.queryGold() : (await client.queryValues()).gold;
    this.goldCache = {
      loadedAt: Date.now(),
      value: temp
    };
    return temp;
  }
  async queryBath(client, force = false) {
    if (!force && this.bathCache && Date.now() - this.bathCache.loadedAt < 3600000) {
      return this.bathCache.value;
    }
    const temp = await client.queryBathInventory();
    this.bathCache = {
      loadedAt: Date.now(),
      value: temp
    };
    return temp;
  }
  async queryFatigue(client, force = false) {
    if (!force && this.fatigueCache && Date.now() - this.fatigueCache.loadedAt < 900000) {
      return this.fatigueCache.value;
    }
    const fatigue = await client.queryFatigueStatus();
    this.fatigueCache = {
      loadedAt: Date.now(),
      value: fatigue
    };
    return fatigue;
  }
  setNextRunDelay(seconds, reason) {
    if (this.progress.snapshot().pendingPk) {
      this.nextRunDelaySeconds = 8;
    } else if (reason.storyId && reason.remainingSeconds > 0) {
      this.nextRunDelaySeconds = Math.min(300, Math.max(seconds.intervalSeconds, reason.remainingSeconds - 3));
    } else {
      this.nextRunDelaySeconds = Math.max(60, seconds.intervalSeconds);
    }
  }
  async blocked(config, actionLabel) {
    if (config.safeMode) {
      this.host.log("安全模式：计划执行" + actionLabel + "，本轮不发送写请求");
      return true;
    } else {
      return false;
    }
  }
  decide(config, values) {
    const counts = this.progress.snapshot().counts;
    if (config.adventureEnabled && !shouldPauseAdventureForNoMoneyBag(config, this.progress.snapshot().consecutiveAdventureNoMoneyBag) && (!config.adventureTimesPerDay || counts.adventure < config.adventureTimesPerDay)) {
      return "adventure";
    } else {
      return selectSchoolOrWork(config, values, counts);
    }
  }
  actionArray(payload) {
    if (Array.isArray(payload)) {
      return payload.flatMap(temp => this.actionArray(temp));
    }
    if (payload && typeof payload == "object") {
      const payload_2 = payload;
      if ("user_id" in payload_2 || "uin" in payload_2 || "group_id" in payload_2) {
        return [payload_2];
      } else {
        return Object.values(payload_2).flatMap(temp_2 => this.actionArray(temp_2));
      }
    }
    return [];
  }
  async callAction(action, params) {
    const temp = await this.host.ctx.actions.call(action, params, this.host.ctx.adapterName, this.host.ctx.pluginManager.config);
    return this.actionArray(temp);
  }
  targetLabel(target) {
    return (target.name?.trim() ? "“" + target.name.trim() + "”" : "未命名对象") + "（QQ " + target.uin + "）";
  }
  async friendCandidates() {
    const list = (await this.callAction("get_friends_with_category", {})).flatMap(temp => {
      const trimmed_2 = String(temp.user_id ?? temp.uin ?? "").trim();
      const trimmed = String(temp.remark ?? temp.nickname ?? temp.nick ?? "").trim();
      if (trimmed_2 && trimmed_2 !== this.host.uin) {
        return [{
          uin: trimmed_2,
          name: trimmed,
          kind: "friend"
        }];
      } else {
        return [];
      }
    });
    const temp_4 = new Map(this.interactions.map((temp_2, index) => [temp_2.uin, index]));
    return [...new Map(list.map(temp_3 => [temp_3.uin, temp_3])).values()].sort((left, right) => (temp_4.get(left.uin) ?? Number.MAX_SAFE_INTEGER) - (temp_4.get(right.uin) ?? Number.MAX_SAFE_INTEGER));
  }
  async visitCandidates(config, excludedUins = []) {
    const list_7 = excludedUins.filter(temp => temp.isFriend ? config.visitFriends : config.visitStrangers).map(temp_2 => ({
      uin: temp_2.target.uin,
      name: temp_2.target.name,
      kind: temp_2.isFriend ? "friend" : "stranger",
      target: temp_2.target
    }));
    const temp_22 = config.visitFriends && !list_7.some(temp_3 => temp_3.kind === "friend");
    const temp_20 = config.visitStrangers && !list_7.some(temp_4 => temp_4.kind === "stranger");
    if (!temp_22 && !temp_20) {
      return [...new Map(list_7.map(temp_5 => [temp_5.uin, temp_5])).values()];
    }
    let list_4;
    try {
      list_4 = await this.friendCandidates();
    } catch (temp_16) {
      if (!list_7.length) {
        throw temp_16;
      }
      this.host.log("读取 OneBot 好友列表失败，仅使用 QQ 宠物官方候选：" + (temp_16 instanceof Error ? temp_16.message : String(temp_16)));
      return [...new Map(list_7.map(temp_6 => [temp_6.uin, temp_6])).values()];
    }
    const temp_19 = new Set(list_4.map(temp_7 => temp_7.uin));
    const list_5 = temp_22 ? [...list_7.filter(temp_8 => temp_8.kind === "friend"), ...list_4] : list_7.filter(temp_9 => temp_9.kind === "friend");
    const list = config.visitStrangers ? list_7.filter(temp_10 => temp_10.kind === "stranger") : [];
    if (temp_20) {
      let filteredItems = config.visitStrangerGroupIds.split(/[,，\s]+/).map(temp_11 => temp_11.trim()).filter(Boolean);
      if (!filteredItems.length) {
        filteredItems = (await this.callAction("get_group_list", {})).slice(0, 1).map(temp_12 => String(temp_12.group_id ?? "")).filter(Boolean);
      }
      for (const temp_18 of filteredItems.slice(0, 3)) {
        const record = {
          group_id: temp_18,
          no_cache: false
        };
        const actionResult = await this.callAction("get_group_member_list", record);
        for (const temp_17 of actionResult) {
          const text = String(temp_17.user_id ?? temp_17.uin ?? "");
          const trimmed = String(temp_17.card ?? temp_17.nickname ?? temp_17.nick ?? "").trim();
          if (text && text !== this.host.uin && !temp_19.has(text)) {
            list.push({
              uin: text,
              name: trimmed,
              kind: "stranger"
            });
          }
        }
      }
    }
    const list_6 = [...new Map(list_5.map(temp_13 => [temp_13.uin, temp_13])).values()];
    const list_3 = [...new Map(list.map(temp_14 => [temp_14.uin, temp_14])).values()];
    const list_2 = [];
    const temp_21 = Math.max(list_6.length, list_3.length);
    for (let number = 0; number < temp_21; number += 1) {
      if (list_6[number]) {
        list_2.push(list_6[number]);
      }
      if (list_3[number]) {
        list_2.push(list_3[number]);
      }
    }
    return list_2;
  }
  async findEmployableFriend(client, config) {
    const flag = !!config.workFriendUins.trim();
    let temp_16;
    let list_2 = [];
    try {
      list_2 = (await this.friendDirectory(client)).workHireFriends;
    } catch (temp_9) {
      this.host.log("官方雇佣目录不可用，回退好友扫描：" + (temp_9 instanceof Error ? temp_9.message : String(temp_9)));
    }
    const temp_18 = new Map(list_2.map(temp => [temp.target.uin, temp]));
    if (flag) {
      temp_16 = parseUinList(config.workFriendUins).filter(temp_2 => temp_2 !== this.host.uin).flatMap(temp_3 => {
        const temp_10 = temp_18.get(temp_3);
        if (temp_10 && !temp_10.available) {
          return [];
        } else {
          return [{
            uin: temp_3,
            name: temp_10?.target.name ?? "",
            kind: "friend",
            target: temp_10?.target
          }];
        }
      });
    } else if (list_2.some(temp_4 => temp_4.available)) {
      temp_16 = list_2.filter(temp_5 => temp_5.available).sort((left, right) => right.coinBonusPercent - left.coinBonusPercent || right.target.level - left.target.level).slice(0, config.workFriendScanLimit).map(temp_6 => ({
        uin: temp_6.target.uin,
        name: temp_6.target.name,
        kind: "friend",
        target: temp_6.target
      }));
    } else {
      try {
        temp_16 = (await this.friendCandidates()).slice(0, config.workFriendScanLimit);
      } catch (temp_11) {
        this.host.log("读取好友列表失败，本次按普通打工继续：" + (temp_11 instanceof Error ? temp_11.message : String(temp_11)));
        return null;
      }
    }
    let temp_17 = temp_16.length ? "" : flag ? "指定好友 QQ 中没有有效候选" : "好友列表没有可扫描对象";
    let catalogItem_2;
    try {
      catalogItem_2 = await client.selectWorkJob(config.workCareerType, config.workJobSubEvent);
    } catch (temp_12) {
      this.host.log("读取普通岗位收益失败，无法比较好友雇佣加成：" + (temp_12 instanceof Error ? temp_12.message : String(temp_12)));
      return null;
    }
    const rewardAmount_2 = parseRewardAmount(catalogItem_2.reward);
    const careerType = catalogItem_2.careerType;
    if (!careerType) {
      this.host.log("服务器未返回基准岗位所属职业，无法比较好友雇佣加成，本次按普通打工继续");
      return null;
    }
    const list = [];
    for (const temp_15 of temp_16) {
      try {
        const temp_13 = temp_15.target ?? (await client.queryOtherPet(temp_15.uin, "friend"));
        if (!temp_13) {
          temp_17 = this.targetLabel(temp_15) + "尚未创建宠物";
          continue;
        }
        const catalogItem = (await client.queryWorkJobs(careerType, temp_13.petId)).find(temp_7 => temp_7.canDo && temp_7.subEventType === catalogItem_2.subEventType);
        if (!catalogItem) {
          temp_17 = this.targetLabel(temp_13) + "不能参加当前岗位";
          continue;
        }
        const rewardAmount = parseRewardAmount(catalogItem.reward);
        const hireCandidate = {
          target: temp_13,
          jobSubEvent: catalogItem.subEventType,
          bonus: rewardAmount - rewardAmount_2,
          totalReward: rewardAmount
        };
        if (flag) {
          this.host.log("按指定顺序选择" + this.targetLabel(temp_13) + "，预计雇佣加成 " + (hireCandidate.bonus >= 0 ? "+" : "") + hireCandidate.bonus);
          return hireCandidate;
        }
        list.push(hireCandidate);
      } catch (temp_14) {
        temp_17 = this.targetLabel(temp_15) + "不可雇佣：" + (temp_14 instanceof Error ? temp_14.message : String(temp_14));
        if (temp_17.includes("不支持安卓端的好友宠物详情接口")) {
          break;
        }
      }
    }
    list.sort(comparePkCandidates);
    if (list[0]) {
      const hireCandidate_2 = list[0];
      this.host.log("已比较 " + list.length + " 只可雇佣好友宠物，选择" + this.targetLabel(hireCandidate_2.target) + "，预计雇佣加成 " + (hireCandidate_2.bonus >= 0 ? "+" : "") + hireCandidate_2.bonus);
      return hireCandidate_2;
    }
    this.host.log("未找到可雇佣的好友宠物，本次按普通打工继续" + (temp_17 ? "（" + temp_17 + "）" : ""));
    return null;
  }
  async maybeVisit(client, config, foodInventory, bathInventory) {
    if (!config.visitEnabled || this.progress.activeBlock("visit")) {
      return false;
    }
    const counts = this.progress.snapshot().counts;
    const combined = (counts.visitFriend ?? 0) + (counts.visitStranger ?? 0);
    if (config.visitMaxPerDay && combined >= config.visitMaxPerDay || (await this.blocked(config, "走访宠物"))) {
      return false;
    }
    let text = "";
    try {
      let list = [];
      if (config.visitStrangers) {
        try {
          list = await this.alsoPlayingDirectory(client);
        } catch (temp_5) {
          this.host.log("读取 QQ 宠物“他们也在玩”失败，继续使用现有走访候选：" + (temp_5 instanceof Error ? temp_5.message : String(temp_5)));
        }
      }
      const slicedItems = (await this.visitCandidates(config, list)).filter(temp => !this.progress.targetWasVisited(temp.uin)).slice(0, config.visitCandidateScanLimit);
      for (const temp_14 of slicedItems) {
        try {
          await client.visitOther(temp_14.uin);
          this.progress.markTargetVisited(temp_14.uin);
          this.progress.increment(temp_14.kind === "friend" ? "visitFriend" : "visitStranger");
          this.host.log("自动走访" + (temp_14.kind === "friend" ? "好友" : "陌生人") + this.targetLabel(temp_14) + "成功");
          if (config.visitStompEnabled) {
            try {
              let flag = false;
              try {
                flag = (await client.queryStompStatus(temp_14.uin)).alreadyStomped;
              } catch (temp_6) {
                if (isMutationDeniedError(temp_6)) {
                  throw temp_6;
                }
                this.host.log("踩踩状态接口不可用，尝试由服务器直接判重：" + (temp_6 instanceof Error ? temp_6.message : String(temp_6)));
              }
              if (flag) {
                this.host.log(this.targetLabel(temp_14) + "今日已踩踩");
              } else {
                const temp_7 = await client.stompOther(temp_14.uin);
                this.progress.increment("stomp");
                this.host.log("已给" + this.targetLabel(temp_14) + "踩踩，踩踩数 " + temp_7.count);
              }
            } catch (temp_8) {
              if (isMutationDeniedError(temp_8)) {
                throw temp_8;
              }
              this.host.log("走访成功，但踩踩失败：" + (temp_8 instanceof Error ? temp_8.message : String(temp_8)));
            }
          }
          const temp_12 = config.otherCareDailyExperienceLimit > 0 && this.progress.snapshot().dailyExperienceGain >= config.otherCareDailyExperienceLimit;
          if (config.visitAutoCare && temp_12) {
            this.host.log("今日经验已达到 " + config.otherCareDailyExperienceLimit + "，停止照顾别人");
          } else if (config.visitAutoCare) {
            try {
              const temp_10 = temp_14.target ?? (await client.queryOtherPet(temp_14.uin, temp_14.kind));
              if (temp_10) {
                const petValues = await client.queryOtherValues(temp_10.petId);
                if (petValues.hunger < config.hungerThreshold && (foodInventory.biscuits ?? 0) > 0) {
                  await client.feedOther(temp_10.uin, temp_10.petId);
                  this.progress.increment("careOther");
                  this.host.log("已自动喂养走访对象");
                }
                const temp_9 = bathInventory.bathBall > 0 ? "2" : bathInventory.soap > 0 ? "1" : null;
                if (petValues.clean < config.cleanThreshold && temp_9) {
                  await client.washOther(temp_10.uin, temp_9);
                  this.progress.increment("careOther");
                  this.host.log("已自动清洁走访对象");
                }
              }
            } catch (temp_11) {
              if (isMutationDeniedError(temp_11)) {
                throw temp_11;
              }
              this.host.log("走访已完成，暂无法读取对方宠物状态：" + (temp_11 instanceof Error ? temp_11.message : String(temp_11)));
            }
          }
          const delaySeconds_2 = randomDelaySeconds(config.visitDelayMinSeconds, config.visitDelayMaxSeconds);
          this.progress.setBlock("visit", "等待下次走访", delaySeconds_2);
          this.host.updateStatus({
            activity: "自动走访已完成"
          });
          return true;
        } catch (temp_13) {
          if (isMutationDeniedError(temp_13)) {
            throw temp_13;
          }
          text = temp_13 instanceof Error ? temp_13.message : String(temp_13);
        }
      }
      const delaySeconds_3 = randomDelaySeconds(config.visitDelayMinSeconds, config.visitDelayMaxSeconds);
      this.progress.setBlock("visit", text || "暂无可走访的宠物", delaySeconds_3);
      if (text) {
        this.host.log("走访候选检查未成功：" + text);
      }
    } catch (temp_16) {
      if (isMutationDeniedError(temp_16)) {
        throw temp_16;
      }
      const temp_15 = temp_16 instanceof Error ? temp_16.message : String(temp_16);
      this.progress.setBlock("visit", temp_15, config.failureCooldownSeconds);
      this.host.log("获取走访候选失败：" + temp_15);
    }
    return false;
  }
  async pkDirectory(client, directoryType) {
    const list_2 = [];
    if (directoryType.pkFriends) {
      try {
        list_2.push(...(await this.friendDirectory(client)).petDirectory.filter(temp => temp.isFriend));
      } catch (temp_6) {
        this.host.log("读取 QQ 宠物好友 PK 目录失败：" + (temp_6 instanceof Error ? temp_6.message : String(temp_6)));
      }
    }
    if (directoryType.pkStrangers) {
      try {
        list_2.push(...(await this.alsoPlayingDirectory(client)));
      } catch (temp_7) {
        this.host.log("读取 QQ 宠物“他们也在玩”PK 目录失败：" + (temp_7 instanceof Error ? temp_7.message : String(temp_7)));
      }
    }
    const temp_11 = list_2.some(temp_2 => temp_2.isFriend);
    const temp_10 = list_2.some(temp_3 => !temp_3.isFriend);
    if ((!directoryType.pkFriends || temp_11) && (!directoryType.pkStrangers || temp_10)) {
      return [...new Map(list_2.map(temp_4 => [temp_4.target.uin, temp_4])).values()];
    }
    const record = {
      ...directoryType
    };
    record.visitFriends = directoryType.pkFriends && !temp_11;
    record.visitStrangers = directoryType.pkStrangers && !temp_10;
    const candidates = await this.visitCandidates(record);
    const list = [];
    let text = "";
    for (const temp_9 of candidates.slice(0, directoryType.pkCandidateScanLimit)) {
      try {
        const otherPet = await client.queryOtherPet(temp_9.uin, temp_9.kind);
        if (otherPet) {
          list.push({
            target: otherPet,
            isFriend: temp_9.kind === "friend",
            displayedPkPower: 0
          });
        }
      } catch (temp_8) {
        if (isMutationDeniedError(temp_8)) {
          throw temp_8;
        }
        text = temp_8 instanceof Error ? temp_8.message : String(temp_8);
        if (/不支持安卓端的好友宠物详情接口|请升级客户端版本/.test(text)) {
          break;
        }
      }
    }
    if (!list.length && text) {
      this.host.log("OneBot 联系人 PK 扫描不可用：" + text);
    }
    return [...new Map([...list_2, ...list].map(temp_5 => [temp_5.target.uin, temp_5])).values()];
  }
  async friendDirectory(client) {
    if (this.friendDirectoryCache && Date.now() - this.friendDirectoryCache.loadedAt < 600000) {
      return this.friendDirectoryCache.value;
    }
    const temp = typeof client.queryPetFriendDirectory == "function" ? await client.queryPetFriendDirectory() : {
      petDirectory: await client.queryPetDirectory(),
      workHireFriends: await client.queryWorkHireFriends()
    };
    this.friendDirectoryCache = {
      loadedAt: Date.now(),
      value: temp
    };
    return temp;
  }
  async alsoPlayingDirectory(client) {
    if (this.alsoPlayingCache && Date.now() - this.alsoPlayingCache.loadedAt < 600000) {
      return this.alsoPlayingCache.value;
    }
    const client_2 = client;
    const temp_2 = typeof client_2.queryPetAlsoPlayingDirectory == "function" ? await client_2.queryPetAlsoPlayingDirectory() : (await this.friendDirectory(client)).petDirectory.filter(temp => !temp.isFriend);
    this.alsoPlayingCache = {
      loadedAt: Date.now(),
      value: temp_2
    };
    return temp_2;
  }
  async handlePendingPk(client, story) {
    const temp_4 = this.progress.snapshot().pendingPk;
    if (!temp_4) {
      return false;
    }
    const temp_3 = Math.max(0, 8000 - (Date.now() - Date.parse(temp_4.createdAt)));
    if (temp_3 > 0) {
      this.host.updateStatus({
        activity: "PK 结果播放中，" + Math.ceil(temp_3 / 1000) + " 秒后结算；主任务不受影响"
      });
      return false;
    }
    const combined = "settle-pk:" + temp_4.storyId;
    if (this.progress.activeBlock(combined) || (await this.blocked(story, "结算 PK"))) {
      return false;
    }
    try {
      await client.settlePk(temp_4.storyId);
      this.progress.markStorySettled(temp_4.storyId);
      this.progress.clearPendingPk();
      this.progress.increment(temp_4.kind);
      this.progress.clearBlock(combined);
      this.host.log("PK 已结算并记录：" + temp_4.storyId);
    } catch (temp_2) {
      if (isIrrecoverableSettleError(temp_2)) {
        this.progress.dismissStory(temp_4.storyId);
        this.progress.clearPendingPk();
        this.progress.increment(temp_4.kind);
        this.progress.clearBlock(combined);
        this.host.log("PK 已由服务器结算：" + temp_4.storyId);
      } else {
        if (!isMutationDeniedError(temp_2)) {
          this.progress.setBlock(combined, temp_2 instanceof Error ? temp_2.message : String(temp_2), story.settleRetrySeconds);
        }
        throw temp_2;
      }
    }
    return true;
  }
  async maybePk(client, config) {
    if (!config.pkEnabled || !config.pkFriends && !config.pkStrangers || this.progress.snapshot().pendingPk || this.progress.activeBlock("pk")) {
      return false;
    }
    const snapshot = this.progress.snapshot();
    const combined = (snapshot.counts.pkFriend ?? 0) + (snapshot.counts.pkStranger ?? 0);
    if (config.pkMaxPerDay > 0 && combined >= config.pkMaxPerDay || (await this.blocked(config, "PK"))) {
      return false;
    }
    try {
      const slicedItems = (await this.pkDirectory(client, config)).filter(temp => (temp.isFriend ? config.pkFriends : config.pkStrangers) && temp.target.uin !== this.host.uin && !this.progress.pkTargetWasUsed(temp.target.uin)).sort((left, right) => (left.displayedPkPower || Number.MAX_SAFE_INTEGER) - (right.displayedPkPower || Number.MAX_SAFE_INTEGER) || left.target.uin.localeCompare(right.target.uin)).slice(0, config.pkCandidateScanLimit);
      if (!slicedItems.length) {
        this.progress.setBlock("pk", "暂无未挑战的目标", 300);
        return false;
      }
      const power_2 = (await client.queryPkPower(client.petId)).power;
      let temp_7 = null;
      let number = 0;
      let text = "";
      for (const temp_4 of slicedItems) {
        try {
          const power = (await client.queryPkPower(temp_4.target.petId)).power;
          number += 1;
          if (!config.pkOnlyWinnable || power_2 > power) {
            temp_7 = {
              target: temp_4.target,
              selfPower: power_2,
              opponentPower: power
            };
            break;
          }
        } catch (temp_3) {
          text = temp_3 instanceof Error ? temp_3.message : String(temp_3);
        }
      }
      if (!temp_7) {
        const temp_5 = config.pkOnlyWinnable && number > 0 ? "已检查 " + number + " 个目标，暂无战力更低的宠物" : text || "暂无可 PK 的宠物";
        this.progress.setBlock("pk", temp_5, 300);
        this.host.log("本轮未发起 PK：" + temp_5);
        return false;
      }
      const temp_8 = await client.startPk(temp_7);
      const temp_6 = temp_7.target.kind === "friend" ? "pkFriend" : "pkStranger";
      this.progress.setPendingPk(temp_6, temp_8.storyId, temp_7.target.uin);
      this.progress.markPkTarget(temp_7.target.uin);
      this.progress.clearBlock("pk");
      this.host.log("已向" + (temp_7.target.kind === "friend" ? "好友" : "陌生人") + this.targetLabel(temp_7.target) + "发起 PK：我方 " + temp_7.selfPower + "，对方 " + temp_7.opponentPower + "，战力差 " + (temp_7.selfPower - temp_7.opponentPower >= 0 ? "+" : "") + (temp_7.selfPower - temp_7.opponentPower) + "；Story ID：" + temp_8.storyId);
      return true;
    } catch (temp_9) {
      if (isMutationDeniedError(temp_9)) {
        throw temp_9;
      }
      const temp_10 = temp_9 instanceof Error ? temp_9.message : String(temp_9);
      this.progress.setBlock("pk", temp_10, 300);
      this.host.log("PK 检查失败：" + temp_10);
      return false;
    }
  }
  storyKind(storyId) {
    return {
      "6100": "school",
      "6400": "work",
      "6700": "adventure"
    }[storyId.split("_", 1)[0]] ?? null;
  }
  async maybeEncourageSchool(client, config, story) {
    if (!config.schoolEncouragementEnabled || story.finished || !story.storyId.startsWith("6100_") || this.progress.storyWasEncouraged(story.storyId)) {
      return false;
    }
    const combined = "encourage:" + story.storyId;
    if (this.progress.activeBlock(combined) || (await this.blocked(config, "学习鼓励"))) {
      return false;
    }
    try {
      const temp_3 = await client.encourageSchool(story.storyId);
      this.progress.markStoryEncouraged(story.storyId);
      this.progress.increment("encourage");
      this.progress.clearBlock(combined);
      const temp_4 = temp_3.selectedToast || temp_3.toastWords.join("、");
      this.host.log("已鼓励学习中的宠物" + (temp_4 ? "：" + temp_4 : "") + "，Story ID：" + story.storyId);
      return true;
    } catch (temp_5) {
      const temp_6 = temp_5 instanceof Error ? temp_5.message : String(temp_5);
      if (/(?:已经|已).*鼓励|重复.*鼓励|鼓励.*(?:已领取|已完成)/.test(temp_6)) {
        this.progress.markStoryEncouraged(story.storyId);
        this.host.log("服务器已记录本次学习鼓励，Story ID：" + story.storyId);
        return true;
      }
      if (isMutationDeniedError(temp_5)) {
        throw temp_5;
      }
      this.progress.setBlock(combined, temp_6, config.failureCooldownSeconds);
      this.host.log("学习鼓励失败：" + temp_6);
      return false;
    }
  }
  handleMissingPending(config, pending) {
    if (!pending) {
      return false;
    }
    const missingSince = this.progress.markPendingMissing();
    const temp_2 = missingSince ? (Date.now() - Date.parse(missingSince)) / 1000 : 0;
    if (temp_2 < config.startConfirmSeconds) {
      this.host.updateStatus({
        activity: "任务状态暂未返回，等待同步（" + Math.ceil(config.startConfirmSeconds - temp_2) + "s）"
      });
      return true;
    } else {
      this.progress.clearPending();
      this.host.log("服务器持续未返回任务 " + (pending.storyId || pending.kind) + "，已清除待确认记录且不计入完成次数");
      return true;
    }
  }
  async handleStory(client, config, story) {
    let temp_11 = this.progress.snapshot().pending;
    if (story.storyId) {
      if (story.finished && (this.progress.storyWasSettled(story.storyId) || this.progress.storyWasDismissed(story.storyId))) {
        return this.handleMissingPending(config, temp_11);
      }
      const kind = this.storyKind(story.storyId);
      const temp_10 = !!temp_11 && (temp_11.storyId !== story.storyId || !!kind && temp_11.kind !== kind);
      if (!temp_11 || !temp_11.confirmed || temp_10) {
        if (temp_10) {
          this.host.log("本地待处理任务 " + (temp_11?.storyId || temp_11?.kind) + " 与服务器 " + story.storyId + " 不一致，已按服务器状态恢复");
        }
        if (kind) {
          this.progress.setPending(kind, story.storyId);
        } else {
          this.progress.clearPending();
        }
        temp_11 = this.progress.snapshot().pending;
        if (kind && !temp_10) {
          this.host.log("已恢复进行中的" + kind + "任务");
        }
      } else {
        this.progress.markPendingSeen();
        temp_11 = this.progress.snapshot().pending;
      }
      if (story.finished) {
        if (await this.blocked(config, "结算任务")) {
          return true;
        }
        const combined = "settle:" + story.storyId;
        if (this.progress.activeBlock(combined)) {
          return true;
        }
        try {
          const temp_6 = temp_11?.kind === "adventure" && config.adventureMoneyBagStopEnabled;
          let temp_8 = null;
          if (temp_6) {
            try {
              temp_8 = await this.queryGoldNow(client);
            } catch (temp_3) {
              this.host.log("冒险钱袋检测：结算前金币读取失败，本次不累计连续次数：" + (temp_3 instanceof Error ? temp_3.message : String(temp_3)));
            }
          }
          await client.settleStory(story.storyId);
          let temp_7 = null;
          if (temp_8 !== null) {
            await delaySeconds(config.verifyDelaySeconds);
            try {
              temp_7 = await this.queryGoldNow(client);
            } catch (temp_4) {
              this.host.log("冒险钱袋检测：结算后金币读取失败，本次不累计连续次数：" + (temp_4 instanceof Error ? temp_4.message : String(temp_4)));
            }
          }
          this.progress.markStorySettled(story.storyId);
          this.profileCache = null;
          this.attributeCache = null;
          this.outdoorRecordsLoadedAt = 0;
          if (temp_11?.kind === "school" && config.schoolRotationEnabled) {
            this.progress.advanceSchoolRotation(config.schoolRotationEvery);
          } else if (temp_11) {
            this.progress.increment(temp_11.kind);
          }
          this.progress.clearPending();
          this.progress.clearBlock(combined);
          this.host.log("任务已结算并记录：" + story.storyId);
          if (temp_8 !== null && temp_7 !== null) {
            const temp_5 = updateAdventureMoneyBagStreak(this.progress.snapshot().consecutiveAdventureNoMoneyBag, temp_8, temp_7, config.adventureNoMoneyBagLimit);
            this.progress.setAdventureNoMoneyBagStreak(temp_5.streak);
            if (temp_5.dropped) {
              this.host.log("冒险掉落钱袋：金币 +" + temp_5.goldGain + "，连续未掉落次数已清零");
            } else if (temp_5.paused) {
              this.host.log("冒险未掉落钱袋：已连续 " + temp_5.streak + " 次，今日暂停冒险，次日自动恢复");
            } else {
              this.host.log("冒险未掉落钱袋：连续 " + temp_5.streak + "/" + config.adventureNoMoneyBagLimit + " 次");
            }
          }
        } catch (temp_9) {
          if (isIrrecoverableSettleError(temp_9)) {
            this.progress.dismissStory(story.storyId);
            if (temp_11?.storyId === story.storyId) {
              this.progress.clearPending();
            }
            this.progress.clearBlock(combined);
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
          if (!isMutationDeniedError(temp_9)) {
            this.progress.setBlock(combined, String(temp_9), config.settleRetrySeconds);
          }
          throw temp_9;
        }
        return true;
      }
      const statusPatch = {
        activity: "任务进行中，剩余 " + story.remainingSeconds + "s"
      };
      this.host.updateStatus(statusPatch);
      return true;
    }
    return this.handleMissingPending(config, temp_11);
  }
  publish(profile, fatigue, values, story, foodInventory, bathInventory) {
    this.petName = profile.name;
    const snapshot = this.progress.snapshot();
    const temp_5 = this.progress.storyWasSettled(story.storyId) || this.progress.storyWasDismissed(story.storyId);
    const displayStory = clearFinishedStoryDisplay(story, temp_5);
    const record = {
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
      inventory: record,
      progress: snapshot,
      account: {
        uin: this.host.uin,
        petId: this.host.getConfig().petId,
        petIdReady: true,
        petName: this.petName
      }
    });
  }
  async refreshReadonly(force = false) {
    if (!this.busy) {
      this.busy = true;
      try {
        const temp_2 = await this.client();
        const [profile, petValues, temp, temp_3, temp_4] = await Promise.all([this.queryProfile(temp_2, force), this.queryCurrentValues(temp_2, force), temp_2.queryStory(), this.queryFood(temp_2, force), this.queryBath(temp_2, force)]);
        const fatigue = await this.queryFatigue(temp_2, force);
        this.progress.recordAttributes(petValues);
        this.publish(profile, fatigue, petValues, temp, temp_3, temp_4);
        this.host.updateStatus({
          activity: "状态已刷新"
        });
      } finally {
        this.busy = false;
      }
    }
  }
  async catalogs() {
    if (this.catalogCache && Date.now() - this.catalogCache.loadedAt < 600000) {
      return structuredClone(this.catalogCache.value);
    }
    const temp_2 = await this.client();
    const [profile, petValues_2] = await Promise.all([temp_2.querySchoolStage(), temp_2.queryWorkOverview()]);
    const [profile_2, petValues] = await Promise.all([temp_2.querySchoolCourses(profile), Promise.all(petValues_2.careers.map(async temp => ({
      ...temp,
      jobs: temp.available ? await temp_2.queryWorkJobs(temp.careerType) : []
    })))]);
    const catalogs = {
      stage: profile,
      courses: profile_2,
      careers: petValues,
      workOverview: {
        currentCareerType: petValues_2.currentCareerType,
        lastSubEventType: petValues_2.lastSubEventType
      },
      adventures: [],
      bathItems: [],
      petDirectory: [],
      workHireFriends: []
    };
    this.catalogCache = {
      loadedAt: Date.now(),
      value: catalogs
    };
    return structuredClone(catalogs);
  }
  async runOnce() {
    if (this.busy) {
      return null;
    }
    this.busy = true;
    try {
      const temp_20 = this.host.getConfig();
      if (!temp_20.enabled) {
        return null;
      }
      if (this.progress.rollover()) {
        this.host.log("检测到新的一天，今日计数已清零");
      }
      this.host.updateStatus({
        activity: "正在检查宠物状态"
      });
      const temp_21 = await this.client();
      let [profile, petValues_3, temp_19, temp_18, temp_22] = await Promise.all([this.queryProfile(temp_21), this.queryCurrentValues(temp_21), temp_21.queryStory(), this.queryFood(temp_21), this.queryBath(temp_21)]);
      const fatigue = await this.queryFatigue(temp_21);
      this.setNextRunDelay(temp_20, temp_19);
      this.progress.recordAttributes(petValues_3);
      this.publish(profile, fatigue, petValues_3, temp_19, temp_18, temp_22);
      this.host.log("状态：金币 " + petValues_3.gold.toFixed(0) + "，心情 " + petValues_3.feel.toFixed(0) + "，体力 " + petValues_3.hunger.toFixed(0) + "，清洁 " + petValues_3.clean.toFixed(0));
      if (temp_19.finished && (await this.handleStory(temp_21, temp_20, temp_19))) {
        return "story";
      }
      const list = [];
      if (await this.handlePendingPk(temp_21, temp_20)) {
        list.push("pk_settle");
      }
      if (isRestPeriodActive(temp_20)) {
        await this.handleStory(temp_21, temp_20, temp_19);
        const temp = temp_19.storyId ? "休息时段：等待当前任务结束，剩余 " + temp_19.remainingSeconds + "s" : "休息时段 " + temp_20.restStartTime + "–" + temp_20.restEndTime + "：保持空闲";
        const statusPatch = {
          activity: temp
        };
        this.host.updateStatus(statusPatch);
        return "rest_period";
      }
      if (await this.maybeEncourageSchool(temp_21, temp_20, temp_19)) {
        list.push("encourage");
      }
      const petValues_2 = petValues_3;
      let flag_2 = false;
      let flag = false;
      if (temp_20.careEnabled && petValues_2.hunger < temp_20.hungerThreshold && !this.progress.activeBlock("feed") && !(await this.blocked(temp_20, "喂食"))) {
        try {
          if (temp_18.biscuits === 0) {
            if (!temp_20.autoBuySupplies) {
              this.progress.setBlock("feed", "饼干不足且自动购买已关闭", temp_20.failureCooldownSeconds);
            } else {
              await temp_21.buyFood(temp_20.foodPurchaseCount);
              temp_18 = await this.queryFood(temp_21, true);
              if (temp_18.biscuits === 0) {
                throw new QQPetError("购买饼干后库存仍为空");
              }
            }
          }
          if (temp_18.biscuits !== 0) {
            await temp_21.feed();
            flag_2 = true;
            if (typeof temp_18.biscuits == "number" && temp_18.biscuits > 0) {
              temp_18 = {
                ...temp_18,
                biscuits: temp_18.biscuits - 1
              };
              this.foodCache = {
                loadedAt: Date.now(),
                value: temp_18
              };
            }
          }
        } catch (temp_2) {
          if (isMutationDeniedError(temp_2)) {
            throw temp_2;
          }
          const temp_3 = temp_2 instanceof Error ? temp_2.message : String(temp_2);
          this.progress.setBlock("feed", temp_3, temp_20.failureCooldownSeconds);
          this.host.log("自动喂食失败，本轮继续检查其他动作：" + temp_3);
        }
      }
      if (temp_20.careEnabled && petValues_2.clean < temp_20.cleanThreshold && !this.progress.activeBlock("wash") && !(await this.blocked(temp_20, "洗澡"))) {
        try {
          let temp_4 = temp_22.bathBall > 0 ? "2" : "1";
          if ((temp_4 === "2" ? temp_22.bathBall : temp_22.soap) <= 0) {
            if (!temp_20.autoBuySupplies) {
              this.progress.setBlock("wash", "洗护用品不足且自动购买已关闭", temp_20.failureCooldownSeconds);
              temp_4 = temp_22.soap > 0 ? "1" : "2";
            } else {
              temp_4 = "2";
              if (!(await temp_21.buyBathItem(temp_4, temp_20.bathPurchaseCount)).succeeded) {
                throw new QQPetError("购买洗护用品未成功");
              }
              temp_22 = {
                ...temp_22,
                bathBall: temp_22.bathBall + temp_20.bathPurchaseCount,
                counts: {
                  ...temp_22.counts,
                  2: (temp_22.counts[2] ?? 0) + temp_20.bathPurchaseCount
                }
              };
              this.bathCache = {
                loadedAt: Date.now(),
                value: temp_22
              };
            }
          }
          if ((temp_4 === "2" ? temp_22.bathBall : temp_22.soap) > 0 || temp_20.autoBuySupplies) {
            await temp_21.useBathItem(temp_4);
            flag = true;
            if (temp_4 === "2" && temp_22.bathBall > 0) {
              temp_22 = {
                ...temp_22,
                bathBall: temp_22.bathBall - 1
              };
            }
            if (temp_4 === "1" && temp_22.soap > 0) {
              temp_22 = {
                ...temp_22,
                soap: temp_22.soap - 1
              };
            }
            this.bathCache = {
              loadedAt: Date.now(),
              value: temp_22
            };
          }
        } catch (temp_5) {
          if (isMutationDeniedError(temp_5)) {
            throw temp_5;
          }
          const temp_6 = temp_5 instanceof Error ? temp_5.message : String(temp_5);
          this.progress.setBlock("wash", temp_6, temp_20.failureCooldownSeconds);
          this.host.log("自动洗澡失败，本轮继续检查其他动作：" + temp_6);
        }
      }
      if (flag_2 || flag) {
        await delaySeconds(temp_20.verifyDelaySeconds);
        try {
          const petValues = await this.queryCurrentValues(temp_21);
          petValues_3 = petValues;
          if (flag_2) {
            if (petValues.hunger <= petValues_2.hunger) {
              this.progress.setBlock("feed", "喂食后体力未增加", temp_20.failureCooldownSeconds);
              this.host.log("自动喂食结果未生效，本轮继续检查其他动作");
            } else {
              this.progress.increment("feed");
              this.progress.clearBlock("feed");
              list.push("feed");
              this.host.log("自动喂食成功：" + petValues_2.hunger.toFixed(0) + "→" + petValues.hunger.toFixed(0));
            }
          }
          if (flag) {
            if (petValues.clean <= petValues_2.clean) {
              this.progress.setBlock("wash", "洗澡后清洁值未增加", temp_20.failureCooldownSeconds);
              this.host.log("自动洗澡结果未生效，本轮继续检查其他动作");
            } else {
              this.progress.increment("wash");
              this.progress.clearBlock("wash");
              list.push("wash");
              this.host.log("自动洗澡成功：" + petValues_2.clean.toFixed(0) + "→" + petValues.clean.toFixed(0));
            }
          }
        } catch (temp_7) {
          if (isMutationDeniedError(temp_7)) {
            throw temp_7;
          }
          const temp_8 = temp_7 instanceof Error ? temp_7.message : String(temp_7);
          if (flag_2) {
            this.progress.setBlock("feed", temp_8, temp_20.failureCooldownSeconds);
          }
          if (flag) {
            this.progress.setBlock("wash", temp_8, temp_20.failureCooldownSeconds);
          }
          this.host.log("护理结果校验失败，本轮继续检查其他动作：" + temp_8);
        }
      }
      if (await this.maybePk(temp_21, temp_20)) {
        list.push("pk");
      }
      if (await this.maybeVisit(temp_21, temp_20, temp_18, temp_22)) {
        list.push("visit");
      }
      if (await this.handleStory(temp_21, temp_20, temp_19)) {
        if (list.length) {
          return list.join("+") + "+story";
        } else {
          return "story";
        }
      }
      const temp_17 = resolveTaskForFatigue(temp_20, fatigue, this.decide(temp_20, petValues_3));
      if (temp_17 === "rest") {
        const temp_9 = fatigue.tier === 12 ? "12 小时" : "8 小时";
        const statusPatch_2 = {
          activity: "疲劳休息：已进入 " + temp_9 + "档"
        };
        this.host.updateStatus(statusPatch_2);
        return "fatigue_rest";
      }
      if (!temp_17) {
        if (list.length) {
          this.host.updateStatus({
            activity: "辅助动作已完成：" + list.join("、")
          });
          return list.join("+");
        } else {
          this.host.updateStatus({
            activity: "空闲：今日任务已完成"
          });
          return null;
        }
      }
      if (await this.blocked(temp_20, temp_17 === "school" ? "学习" : temp_17 === "work" ? "打工" : "冒险")) {
        if (list.length) {
          return list.join("+");
        } else {
          return temp_17;
        }
      }
      if (temp_17 === "school") {
        const attribute = rotateSchoolAttribute(temp_20, this.progress.snapshot().schoolRotationIndex);
        const temp_10 = temp_20.schoolRotationEnabled ? 0 : temp_20.courseSubEvent;
        const temp_11 = await temp_21.startSchool(attribute, temp_10);
        this.progress.setPending("school", temp_11.storyId);
        const member = {
          physical: "力量",
          culture: "智力",
          art: "魅力"
        }[attribute];
        this.host.log("已开始" + member + "学习“" + temp_11.item.name + "”" + (temp_11.storyId ? "，storyId=" + temp_11.storyId : ""));
      } else if (temp_17 === "work") {
        const hireCandidate = temp_20.employFriend ? await this.findEmployableFriend(temp_21, temp_20) : null;
        const temp_13 = await temp_21.startWork(temp_20.workCareerType, hireCandidate?.jobSubEvent ?? temp_20.workJobSubEvent, hireCandidate ? {
          uin: hireCandidate.target.uin,
          petId: hireCandidate.target.petId
        } : undefined);
        this.progress.setPending("work", temp_13.storyId);
        const temp_12 = temp_13.hiredFriend && hireCandidate ? "，已雇佣好友" + this.targetLabel(hireCandidate.target) + "（加成 " + (hireCandidate.bonus >= 0 ? "+" : "") + hireCandidate.bonus + "）" : "";
        this.host.log("已开始打工“" + temp_13.item.name + "”" + temp_12 + (temp_13.storyId ? "，storyId=" + temp_13.storyId : ""));
      } else {
        let temp_15;
        try {
          temp_15 = await temp_21.startAdventure("", temp_20.quickAdventureEnabled, temp_20.adventurePreviewRefreshLimit);
        } catch (temp_14) {
          if (temp_14 instanceof QQPetError && temp_14.code === "coin_bag_not_found") {
            this.nextRunDelaySeconds = Math.max(5, temp_20.intervalSeconds);
            this.host.log(temp_14.message);
            this.host.updateStatus({
              activity: "快速冒险：" + this.nextRunDelaySeconds + " 秒后再次检查钱袋子"
            });
            return "adventure_refresh";
          }
          throw temp_14;
        }
        this.progress.setPending("adventure", temp_15.storyId);
        const temp_16 = temp_20.quickAdventureEnabled ? "（刷新 " + temp_15.refreshCount + " 次命中钱袋子）" : "";
        this.host.log("已开始冒险“" + temp_15.item.name + "”" + temp_16 + (temp_15.storyId ? "，storyId=" + temp_15.storyId : ""));
      }
      return temp_17;
    } finally {
      this.host.updateStatus({
        progress: this.progress.snapshot()
      });
      this.busy = false;
    }
  }
}
