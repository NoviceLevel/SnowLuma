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
function isAutoPetId(_0x4eb7ee) {
  return ["", "AUTO", "YOUR_PET_ID"].includes(String(_0x4eb7ee ?? "").trim().toUpperCase());
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
  const _0x27310b = new Date();
  return _0x27310b.getFullYear() + "-" + String(_0x27310b.getMonth() + 1).padStart(2, "0") + "-" + String(_0x27310b.getDate()).padStart(2, "0");
}
function createDailyProgress() {
  const _0x343166 = {
    ...EMPTY_DAILY_COUNTS
  };
  return {
    date: currentDateKey(),
    counts: _0x343166,
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
  constructor(_0x5de54f) {
    const _0x48c515 = {
      recursive: true
    };
    this.filePath = _0x5de54f;
    fs.mkdirSync(path.dirname(_0x5de54f), _0x48c515);
    try {
      const _0x2c13f1 = JSON.parse(fs.readFileSync(_0x5de54f, "utf8"));
      const {
        pendingReturnVisits: _0x121b61,
        ..._0x366933
      } = _0x2c13f1;
      const _0x576123 = {
        ...(_0x366933.counts ?? {})
      };
      delete _0x576123.returnVisit;
      this.state = {
        ...createDailyProgress(),
        ..._0x366933,
        counts: {
          ...EMPTY_DAILY_COUNTS,
          ..._0x576123
        },
        careBlocks: _0x366933.careBlocks ?? {},
        settledStoryIds: _0x366933.settledStoryIds ?? [],
        dismissedStoryIds: _0x366933.dismissedStoryIds ?? [],
        schoolRotationIndex: Math.max(0, Math.trunc(Number(_0x366933.schoolRotationIndex) || 0)),
        schoolRotationProgress: Math.max(0, Math.trunc(Number(_0x366933.schoolRotationProgress) || 0)),
        visitedTargetIds: Array.isArray(_0x366933.visitedTargetIds) ? _0x366933.visitedTargetIds.map(String).slice(-500) : [],
        attributeBaseline: _0x366933.attributeBaseline && typeof _0x366933.attributeBaseline == "object" ? {
          strength: Math.max(0, Number(_0x366933.attributeBaseline.strength) || 0),
          intelligence: Math.max(0, Number(_0x366933.attributeBaseline.intelligence) || 0),
          charm: Math.max(0, Number(_0x366933.attributeBaseline.charm) || 0)
        } : null,
        dailyExperienceGain: Math.max(0, Math.trunc(Number(_0x366933.dailyExperienceGain) || 0))
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
  rollover(_0x2f9579 = currentDateKey()) {
    if (this.state.date === _0x2f9579) {
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
        date: _0x2f9579,
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
  count(_0x428aa5) {
    return this.snapshot().counts[_0x428aa5] ?? 0;
  }
  increment(_0x15b116) {
    this.rollover();
    this.state.counts[_0x15b116] = (this.state.counts[_0x15b116] ?? 0) + 1;
    this.save();
    return this.state.counts[_0x15b116];
  }
  advanceSchoolRotation(_0x6dc67e) {
    this.increment("school");
    this.state.schoolRotationProgress += 1;
    if (this.state.schoolRotationProgress >= Math.max(1, Math.trunc(_0x6dc67e))) {
      this.state.schoolRotationIndex = (this.state.schoolRotationIndex + 1) % 3;
      this.state.schoolRotationProgress = 0;
    }
    this.save();
    return this.state.schoolRotationIndex;
  }
  setPending(_0x123980, _0x15f324 = "") {
    this.state.pending = {
      kind: _0x123980,
      createdAt: new Date().toISOString(),
      confirmed: !!_0x15f324,
      storyId: _0x15f324
    };
    this.save();
  }
  confirmPending(_0x450648) {
    if (this.state.pending) {
      this.state.pending.confirmed = true;
      this.state.pending.storyId = _0x450648;
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
    const _0x350009 = this.state.pending;
    this.state.pending = null;
    this.save();
    return _0x350009;
  }
  storyWasSettled(_0x1ce434) {
    return this.state.settledStoryIds.includes(_0x1ce434);
  }
  markStorySettled(_0x46a480) {
    if (!this.state.settledStoryIds.includes(_0x46a480)) {
      this.state.settledStoryIds.push(_0x46a480);
      this.state.settledStoryIds = this.state.settledStoryIds.slice(-100);
      this.save();
    }
  }
  storyWasDismissed(_0x28430f) {
    return this.state.dismissedStoryIds.includes(_0x28430f);
  }
  dismissStory(_0x171a7d) {
    if (!this.state.dismissedStoryIds.includes(_0x171a7d)) {
      this.state.dismissedStoryIds.push(_0x171a7d);
      this.state.dismissedStoryIds = this.state.dismissedStoryIds.slice(-100);
      this.save();
    }
  }
  setBlock(_0x5c240f, _0x101f90, _0x4226fb) {
    this.state.careBlocks[_0x5c240f] = {
      reason: _0x101f90,
      until: Date.now() / 1000 + Math.max(0, _0x4226fb)
    };
    this.save();
  }
  activeBlock(_0x348ba1) {
    const _0x26d1f0 = this.state.careBlocks[_0x348ba1];
    if (_0x26d1f0) {
      if (_0x26d1f0.until <= Date.now() / 1000) {
        delete this.state.careBlocks[_0x348ba1];
        this.save();
        return null;
      } else {
        return {
          ..._0x26d1f0
        };
      }
    } else {
      return null;
    }
  }
  clearBlock(_0x56fb05) {
    if (this.state.careBlocks[_0x56fb05]) {
      delete this.state.careBlocks[_0x56fb05];
      this.save();
    }
  }
  targetWasVisited(_0x16f1e9) {
    return this.snapshot().visitedTargetIds.includes(_0x16f1e9);
  }
  markTargetVisited(_0x1da47c) {
    if (!this.state.visitedTargetIds.includes(_0x1da47c)) {
      this.state.visitedTargetIds.push(_0x1da47c);
      this.state.visitedTargetIds = this.state.visitedTargetIds.slice(-500);
      this.save();
    }
  }
  recordAttributes(_0x1ca7db) {
    this.rollover();
    const _0x42fb19 = {
      strength: Math.max(0, Number(_0x1ca7db.strength) || 0),
      intelligence: Math.max(0, Number(_0x1ca7db.intelligence) || 0),
      charm: Math.max(0, Number(_0x1ca7db.charm) || 0)
    };
    if (!this.state.attributeBaseline) {
      this.state.attributeBaseline = _0x42fb19;
      this.state.dailyExperienceGain = 0;
    } else {
      const _0x31d3b5 = this.state.attributeBaseline;
      const _0x5571c3 = ["strength", "intelligence", "charm"];
      if (_0x5571c3.every(_0x3662a6 => _0x42fb19[_0x3662a6] < _0x31d3b5[_0x3662a6])) {
        this.state.attributeBaseline = _0x42fb19;
        this.state.dailyExperienceGain = 0;
      } else {
        this.state.dailyExperienceGain = _0x5571c3.reduce((_0x479877, _0x21343d) => _0x479877 + Math.max(0, _0x42fb19[_0x21343d] - _0x31d3b5[_0x21343d]), 0);
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
function concatBytes(..._0x3ae831) {
  const _0x4523c7 = _0x3ae831.reduce((_0x38f316, _0x209431) => _0x38f316 + _0x209431.length, 0);
  const _0x58014a = new Uint8Array(_0x4523c7);
  let _0x548bc4 = 0;
  for (const _0x5bb006 of _0x3ae831) {
    _0x58014a.set(_0x5bb006, _0x548bc4);
    _0x548bc4 += _0x5bb006.length;
  }
  return _0x58014a;
}
function encodeVarint(_0x4c2961) {
  if (!Number.isSafeInteger(_0x4c2961)) {
    throw new Error("varint 不是安全整数: " + _0x4c2961);
  }
  let _0xf2c25e = _0x4c2961 < 0 ? BigInt.asUintN(64, BigInt(_0x4c2961)) : BigInt(_0x4c2961);
  const _0x44fb3d = [];
  do {
    const _0x47fd6a = Number(_0xf2c25e & 0x7fn);
    _0xf2c25e >>= 0x7n;
    _0x44fb3d.push(_0x47fd6a | (_0xf2c25e ? 128 : 0));
  } while (_0xf2c25e);
  return Uint8Array.from(_0x44fb3d);
}
function encodeVarintField(_0x37ec12, _0x427285) {
  return concatBytes(encodeVarint(_0x37ec12 << 3), encodeVarint(_0x427285));
}
function encodeBytesField(_0x2a9571, _0x3f9779) {
  return concatBytes(encodeVarint(_0x2a9571 << 3 | 2), encodeVarint(_0x3f9779.length), _0x3f9779);
}
function encodeStringField(_0x2602b1, _0x5994af) {
  return encodeBytesField(_0x2602b1, new TextEncoder().encode(_0x5994af));
}
function decodeVarint(_0x51602f, _0x3ec496) {
  let _0x55a0bb = _0x3ec496;
  let _0x5418c7 = 0x0n;
  let _0x1387ee = 0x0n;
  while (_0x55a0bb < _0x51602f.length) {
    const _0x2965d6 = _0x51602f[_0x55a0bb++];
    _0x5418c7 |= BigInt(_0x2965d6 & 127) << _0x1387ee;
    if ((_0x2965d6 & 128) === 0) {
      const _0x44f485 = Number(_0x5418c7);
      if (!Number.isSafeInteger(_0x44f485)) {
        throw new Error("protobuf varint 超出安全整数范围");
      }
      return [_0x44f485, _0x55a0bb];
    }
    _0x1387ee += 0x7n;
    if (_0x1387ee > 0x46n) {
      throw new Error("protobuf varint 太长");
    }
  }
  throw new Error("protobuf varint 被截断");
}
function parseProtobufFields(_0x5a641f) {
  const _0x5e7db8 = new Map();
  let _0x30ab78 = 0;
  while (_0x30ab78 < _0x5a641f.length) {
    let _0xe2e426;
    [_0xe2e426, _0x30ab78] = decodeVarint(_0x5a641f, _0x30ab78);
    const _0x223a0e = _0xe2e426 >>> 3;
    const _0x225553 = _0xe2e426 & 7;
    if (!_0x223a0e) {
      throw new Error("protobuf 字段号为 0");
    }
    let _0x4b951f;
    if (_0x225553 === 0) {
      [_0x4b951f, _0x30ab78] = decodeVarint(_0x5a641f, _0x30ab78);
    } else if (_0x225553 === 1) {
      if (_0x30ab78 + 8 > _0x5a641f.length) {
        throw new Error("fixed64 被截断");
      }
      _0x4b951f = _0x5a641f.slice(_0x30ab78, _0x30ab78 + 8);
      _0x30ab78 += 8;
    } else if (_0x225553 === 2) {
      let _0x3a62f9;
      [_0x3a62f9, _0x30ab78] = decodeVarint(_0x5a641f, _0x30ab78);
      if (_0x30ab78 + _0x3a62f9 > _0x5a641f.length) {
        throw new Error("length-delimited 字段被截断");
      }
      _0x4b951f = _0x5a641f.slice(_0x30ab78, _0x30ab78 + _0x3a62f9);
      _0x30ab78 += _0x3a62f9;
    } else if (_0x225553 === 5) {
      if (_0x30ab78 + 4 > _0x5a641f.length) {
        throw new Error("fixed32 被截断");
      }
      _0x4b951f = _0x5a641f.slice(_0x30ab78, _0x30ab78 + 4);
      _0x30ab78 += 4;
    } else {
      throw new Error("暂不支持 protobuf wire type " + _0x225553);
    }
    const _0x92848f = _0x5e7db8.get(_0x223a0e) ?? [];
    const _0x318334 = {
      wireType: _0x225553,
      value: _0x4b951f
    };
    _0x92848f.push(_0x318334);
    _0x5e7db8.set(_0x223a0e, _0x92848f);
  }
  return _0x5e7db8;
}
function getProtobufFields(_0x4d6c83, _0x1cd1a5) {
  return _0x4d6c83.get(_0x1cd1a5) ?? [];
}
function getVarintField(_0x10f131, _0x4e95fb, _0x35cfbf = 0) {
  const _0x4e95bf = _0x10f131.get(_0x4e95fb)?.[0];
  if (_0x4e95bf?.wireType === 0) {
    return Number(_0x4e95bf.value);
  } else {
    return _0x35cfbf;
  }
}
function getBytesField(_0x4f9a8e, _0x2f07ee) {
  const _0x5c1460 = _0x4f9a8e.get(_0x2f07ee)?.[0];
  if (_0x5c1460?.wireType === 2) {
    return _0x5c1460.value;
  } else {
    return new Uint8Array();
  }
}
function getStringField(_0x4a1bed, _0x59ea65, _0x1d7b31 = "") {
  const _0x348ed0 = getBytesField(_0x4a1bed, _0x59ea65);
  if (_0x348ed0.length) {
    return new TextDecoder().decode(_0x348ed0);
  } else {
    return _0x1d7b31;
  }
}
function getFloatField(_0x2acd84, _0x69a43, _0x49d7c8 = 0) {
  const _0x2ec0aa = _0x2acd84.get(_0x69a43)?.[0];
  if (_0x2ec0aa?.wireType !== 5) {
    return _0x49d7c8;
  }
  const _0x58e3a0 = _0x2ec0aa.value;
  return new DataView(_0x58e3a0.buffer, _0x58e3a0.byteOffset, 4).getFloat32(0, true);
}
function buildPacketEnvelope(_0x585e57, _0x1c2bc8, _0x179d45) {
  return concatBytes(encodeVarintField(1, _0x585e57), encodeVarintField(2, _0x1c2bc8), encodeBytesField(4, _0x179d45), encodeVarintField(12, 1));
}
function bytesToHex(_0x452390) {
  return Buffer.from(_0x452390).toString("hex");
}
function hexToBytes(_0x2007c0) {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(_0x2007c0)) {
    throw new Error("响应不是有效十六进制");
  }
  return new Uint8Array(Buffer.from(_0x2007c0, "hex"));
}
class QQPetError extends Error {
  constructor(_0x2fe574, _0x5d6ef3 = "") {
    super(_0x2fe574);
    this.code = _0x5d6ef3;
  }
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
function yt(_0x6a7ff6) {
  if (typeof _0x6a7ff6 == "string") {
    return _0x6a7ff6;
  }
  if (!_0x6a7ff6 || typeof _0x6a7ff6 != "object") {
    return "";
  }
  const _0x363700 = _0x6a7ff6;
  for (const _0x2bbd1a of ["data", "packet", "hex"]) {
    const _0x481d5b = _0x363700[_0x2bbd1a];
    if (typeof _0x481d5b == "string" && /^(?:[0-9a-fA-F]{2})+$/.test(_0x481d5b)) {
      return _0x481d5b;
    }
    const _0x427b09 = yt(_0x481d5b);
    if (_0x427b09) {
      return _0x427b09;
    }
  }
  return "";
}
function V(_0x4c6aeb) {
  const _0x17ca50 = "(\\d+(?:\\.\\d+)?)";
  const _0x3fcde9 = _0x4c6aeb.match(new RegExp("(?:总收益|合计|总计)\\D*" + _0x17ca50))?.[1];
  const _0x6b5c82 = _0x4c6aeb.match(new RegExp("金币\\D*" + _0x17ca50))?.[1];
  const _0x12e87c = _0x4c6aeb.match(new RegExp(_0x17ca50))?.[1];
  return Number(_0x3fcde9 ?? _0x6b5c82 ?? _0x12e87c ?? 0);
}
function _(..._0x2d53f4) {
  for (const _0x3d2ae9 of _0x2d53f4) {
    const _0x1fbc0d = _0x3d2ae9.match(/https:\/\/[^\s\])]+\.(?:png|webp|jpe?g|gif)/i)?.[0];
    if (_0x1fbc0d) {
      return _0x1fbc0d;
    }
  }
  return "";
}
function Vt(_0x1f966a) {
  return _0x1f966a.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function ot(_0x4e1407, _0x17c787 = true, _0x1d66b1) {
  const _0x183ac6 = parseProtobufFields(_0x4e1407);
  return {
    id: getVarintField(_0x183ac6, 1),
    name: getStringField(_0x183ac6, 2),
    progress: getStringField(_0x183ac6, 3),
    acquired: _0x17c787,
    category: getStringField(_0x183ac6, 5),
    imageUrl: _(getStringField(_0x183ac6, 7)),
    requirement: getStringField(_0x183ac6, 8),
    description: getStringField(_0x183ac6, 9),
    ...(_0x1d66b1 === undefined ? {} : {
      equipped: _0x1d66b1
    })
  };
}
function Qt(_0x4cfa61) {
  try {
    const _0x1fceff = JSON.parse(_0x4cfa61);
    if (Array.isArray(_0x1fceff)) {
      const _0x4159d6 = _0x1fceff.map(_0xfa9f80 => {
        if (!_0xfa9f80 || typeof _0xfa9f80 != "object") {
          return "";
        }
        const _0x700e27 = _0xfa9f80.text;
        if (typeof _0x700e27 == "string") {
          return _0x700e27;
        } else {
          return "";
        }
      }).join("").trim();
      if (_0x4159d6) {
        return _0x4159d6.replace(/^\d{1,2}:\d{2}\s*/, "");
      }
    }
  } catch {}
  return _0x4cfa61.trim();
}
function H(_0x1a453d, _0x4fc874 = {}) {
  const _0xd842b5 = parseProtobufFields(_0x1a453d);
  const _0x128015 = Vt(getStringField(_0xd842b5, 8));
  return {
    name: getStringField(_0xd842b5, 1),
    subEventType: getVarintField(_0xd842b5, 52),
    cost: getStringField(_0xd842b5, 6),
    duration: getStringField(_0xd842b5, 7),
    reward: _0x4fc874.careerType && /^\d+(?:\.\d+)?$/.test(_0x128015) ? "金币 " + _0x128015 : _0x128015,
    description: getStringField(_0xd842b5, 10) || getStringField(_0xd842b5, 14),
    canDo: !!getVarintField(_0xd842b5, 50),
    unavailableReason: getStringField(_0xd842b5, 51),
    warning: getStringField(_0xd842b5, 17),
    iconUrl: _(getStringField(_0xd842b5, 2)),
    rewardIconUrl: _(getStringField(_0xd842b5, 8), getStringField(_0xd842b5, 12), getStringField(_0xd842b5, 6)),
    ..._0x4fc874
  };
}
function Q(_0x583605) {
  const _0x32b1ea = Number(_0x583605.match(/(\d+)\s*小时/)?.[1] ?? 0);
  const _0x5a1937 = Number(_0x583605.match(/(\d+)\s*分钟/)?.[1] ?? 0);
  const _0x5ef3ce = Number(_0x583605.match(/(\d+)\s*秒/)?.[1] ?? 0);
  return _0x32b1ea * 3600 + _0x5a1937 * 60 + _0x5ef3ce;
}
function at(_0x487795, _0x3e9d6f) {
  const _0x179aa9 = Q(_0x487795.duration);
  const _0x630ab5 = Q(_0x3e9d6f.duration);
  const _0x6173ff = V(_0x487795.reward);
  const _0x2c7677 = V(_0x3e9d6f.reward);
  if (_0x179aa9 > 0 && _0x630ab5 > 0) {
    const _0x25613e = _0x2c7677 * _0x179aa9 - _0x6173ff * _0x630ab5;
    if (_0x25613e) {
      return _0x25613e;
    }
  } else if (_0x179aa9 !== _0x630ab5) {
    if (_0x179aa9 > 0) {
      return -1;
    } else {
      return 1;
    }
  }
  return _0x2c7677 - _0x6173ff;
}
function Ut(_0x3de2d1) {
  let _0x1b34e4 = _0x3de2d1.trim();
  const _0x51f08c = _0x3de2d1.match(/[?&]text=([^)&\s]+)/)?.[1];
  if (_0x51f08c) {
    try {
      _0x1b34e4 = decodeURIComponent(_0x51f08c);
    } catch {}
  }
  const _0x3ebe84 = _0x3de2d1 + "\n" + _0x1b34e4;
  const _0x3fbf9f = {
    fatigued: true,
    tier: 12,
    benefitRate: 0.1,
    reason: _0x1b34e4 || "服务器提示已超过 12 小时"
  };
  const _0x502027 = {
    fatigued: true,
    tier: 8,
    benefitRate: 0.25,
    reason: _0x1b34e4 || "服务器提示已超过 8 小时"
  };
  const _0x390b43 = {
    fatigued: false,
    tier: 0,
    benefitRate: 1,
    reason: "服务器当前未返回疲劳提示"
  };
  if (/非常累|超出\s*12\s*小时|降低至\s*10%/.test(_0x3ebe84)) {
    return _0x3fbf9f;
  } else if (/疲惫|超出\s*8\s*小时|收益减少|降低至\s*25%/.test(_0x3ebe84)) {
    return _0x502027;
  } else {
    return _0x390b43;
  }
}
class QQPetApi {
  constructor(_0x13b4c7, _0x86be54) {
    this.ctx = _0x13b4c7;
    this.petId = _0x86be54;
  }
  otherPetMobileAvailable = null;
  async sendPacket(_0x4f7b1f, _0x4ddcc4) {
    const [_0x4d092b] = _0x4f7b1f;
    let _0x2e154f;
    try {
      _0x2e154f = await this.ctx.actions.call("send_packet", {
        cmd: _0x4d092b,
        data: bytesToHex(_0x4ddcc4)
      }, this.ctx.adapterName, this.ctx.pluginManager.config);
    } catch (_0x424095) {
      throw new QQPetError("OneBot send_packet 失败：" + String(_0x424095));
    }
    const _0x208fe6 = yt(_0x2e154f);
    if (!_0x208fe6) {
      throw new QQPetError(_0x4d092b + " 返回空响应或未知响应结构");
    }
    try {
      return hexToBytes(_0x208fe6);
    } catch (_0x41fe5c) {
      throw new QQPetError(_0x4d092b + " 响应无法解析：" + String(_0x41fe5c));
    }
  }
  async sendOidb(_0x294b9f, _0x137a24) {
    const [_0x18d504, _0x11851e, _0x46c18e] = _0x294b9f;
    const _0xafc211 = await this.sendPacket(_0x294b9f, buildPacketEnvelope(_0x11851e, _0x46c18e, _0x137a24));
    const _0x5cf34a = parseProtobufFields(_0xafc211);
    const _0x558fd1 = getVarintField(_0x5cf34a, 1) === _0x11851e && getVarintField(_0x5cf34a, 2) === _0x46c18e;
    const _0x5862ab = _0x558fd1 ? getVarintField(_0x5cf34a, 3) : 0;
    if (_0x5862ab) {
      throw new QQPetError(_0x18d504 + " OIDB errorCode=" + _0x5862ab);
    }
    return {
      command: _0x11851e,
      subCommand: _0x46c18e,
      errorCode: _0x5862ab,
      body: _0x558fd1 ? getBytesField(_0x5cf34a, 4) : _0xafc211,
      raw: _0xafc211
    };
  }
  async queryOwnPetProfile() {
    const [_0x1eaa2a, _0x3146d0, _0x1db6cb] = PACKETS.ownProfile;
    const _0x23ed84 = await this.sendPacket(PACKETS.ownProfile, buildPacketEnvelope(_0x3146d0, _0x1db6cb, new Uint8Array()));
    let _0x38d262 = parseProtobufFields(_0x23ed84);
    if (getVarintField(_0x38d262, 1) === _0x3146d0 && getVarintField(_0x38d262, 2) === _0x1db6cb) {
      const _0x411d94 = getVarintField(_0x38d262, 3);
      if (_0x411d94) {
        throw new QQPetError(_0x1eaa2a + " OIDB errorCode=" + _0x411d94);
      }
      _0x38d262 = parseProtobufFields(getBytesField(_0x38d262, 4));
    }
    const _0x1bf1c6 = getBytesField(_0x38d262, 1);
    const _0x9dccf8 = _0x1bf1c6.length ? parseProtobufFields(_0x1bf1c6) : _0x38d262;
    const _0x551423 = getStringField(_0x9dccf8, 8).trim();
    if (_0x551423) {
      const _0x3c2f65 = getBytesField(_0x9dccf8, 13);
      const _0x750ab1 = _0x3c2f65.length ? parseProtobufFields(_0x3c2f65) : new Map();
      const _0x2ca75a = getBytesField(_0x9dccf8, 14);
      const _0x1406bb = _0x2ca75a.length ? parseProtobufFields(_0x2ca75a) : new Map();
      const _0x37088e = getVarintField(_0x9dccf8, 6);
      const _0x44583b = getProtobufFields(_0x1406bb, 1).filter(_0x56c1ef => _0x56c1ef.wireType === 2).map(_0x555207 => ot(_0x555207.value, true, true));
      return {
        petId: _0x551423,
        name: getStringField(_0x9dccf8, 1).trim(),
        birthdayAt: getVarintField(_0x9dccf8, 4),
        gender: _0x37088e === 1 ? "男" : _0x37088e === 2 ? "女" : "未知",
        species: getStringField(_0x9dccf8, 11).trim(),
        personality: getStringField(_0x9dccf8, 7).trim(),
        avatarUrl: getStringField(_0x9dccf8, 18).trim() || getStringField(_0x9dccf8, 3).trim(),
        fullAvatarUrl: getStringField(_0x9dccf8, 3).trim() || getStringField(_0x9dccf8, 18).trim(),
        personalityUrl: getStringField(_0x9dccf8, 9).trim(),
        medals: _0x44583b,
        level: getVarintField(_0x750ab1, 1),
        currentExperience: getVarintField(_0x750ab1, 2),
        levelExperience: getVarintField(_0x750ab1, 3),
        experienceRate: getFloatField(_0x750ab1, 4, 1)
      };
    }
    try {
      const _0x3caf2d = await this.sendOidb(PACKETS.ownPetCache, new Uint8Array());
      const _0x2b4c9a = getBytesField(parseProtobufFields(_0x3caf2d.body), 1);
      const _0x289d32 = _0x2b4c9a.length ? parseProtobufFields(_0x2b4c9a) : new Map();
      const _0x2b794c = getStringField(_0x289d32, 101).trim();
      if (_0x2b794c) {
        return {
          petId: _0x2b794c,
          name: getStringField(_0x289d32, 1).trim(),
          birthdayAt: 0,
          gender: "未知",
          species: "",
          personality: "",
          level: 0,
          avatarUrl: getStringField(_0x289d32, 3).trim(),
          fullAvatarUrl: getStringField(_0x289d32, 3).trim(),
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
    const _0x31799f = parseProtobufFields((await this.sendOidb(PACKETS.medalGallery, encodeStringField(1, this.petId))).body);
    const _0x1e198e = [];
    for (const _0x223720 of getProtobufFields(_0x31799f, 1)) {
      if (_0x223720.wireType !== 2) {
        continue;
      }
      const _0x2a13fb = parseProtobufFields(_0x223720.value);
      for (const _0xc5848b of getProtobufFields(_0x2a13fb, 3)) {
        if (_0xc5848b.wireType !== 2) {
          continue;
        }
        const _0x57d5a9 = parseProtobufFields(_0xc5848b.value);
        for (const _0x353259 of getProtobufFields(_0x57d5a9, 2)) {
          if (_0x353259.wireType !== 2) {
            continue;
          }
          const _0x5d29f3 = parseProtobufFields(_0x353259.value);
          const _0x4ee16e = getBytesField(_0x5d29f3, 1);
          if (_0x4ee16e.length) {
            _0x1e198e.push(ot(_0x4ee16e, !!getVarintField(_0x5d29f3, 2), !!getVarintField(_0x5d29f3, 4)));
          }
        }
      }
    }
    return _0x1e198e;
  }
  async queryInteractionMessages(_0xa26f9a = 20) {
    const _0x5e03c1 = concatBytes(encodeVarintField(1, 0), encodeVarintField(2, Math.max(1, Math.min(50, Math.trunc(_0xa26f9a)))));
    const _0x22e3bf = parseProtobufFields((await this.sendOidb(PACKETS.interactionHistory, _0x5e03c1)).body);
    return getProtobufFields(_0x22e3bf, 1).flatMap(_0x12c70 => {
      if (_0x12c70.wireType !== 2) {
        return [];
      }
      const _0x30eb78 = parseProtobufFields(_0x12c70.value);
      const _0x45bd60 = getStringField(_0x30eb78, 4).trim();
      const _0x40da08 = Qt(getStringField(_0x30eb78, 2));
      if (!_0x45bd60 || !_0x40da08) {
        return [];
      } else {
        return [{
          id: _0x45bd60,
          uin: getStringField(_0x30eb78, 1).trim(),
          petName: getStringField(_0x30eb78, 5).trim(),
          text: _0x40da08,
          timestamp: getVarintField(_0x30eb78, 3),
          eventType: getVarintField(_0x30eb78, 6)
        }];
      }
    });
  }
  async queryValues() {
    const _0x57ace5 = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(1)));
    const _0x1ee32a = concatBytes(encodeStringField(1, this.petId), encodeBytesField(2, Uint8Array.of(6)));
    const [_0x1c2d1a, _0x45c8f6, _0x3de5f8] = await Promise.all([this.sendOidb(PACKETS.display, _0x57ace5), this.sendOidb(PACKETS.display, _0x1ee32a), this.queryAttributes()]);
    const _0x15a9d4 = parseProtobufFields(getBytesField(parseProtobufFields(_0x1c2d1a.body), 1));
    const _0x9c072e = _0x10dbf6 => getFloatField(parseProtobufFields(getBytesField(_0x15a9d4, _0x10dbf6)), 3);
    const _0x207096 = parseProtobufFields(getBytesField(parseProtobufFields(_0x45c8f6.body), 1));
    return {
      feel: _0x9c072e(1),
      hunger: _0x9c072e(2),
      clean: _0x9c072e(3),
      total: _0x9c072e(4),
      gold: getFloatField(parseProtobufFields(getBytesField(_0x207096, 5)), 3),
      ..._0x3de5f8
    };
  }
  async queryAttributes() {
    const _0x2201b1 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const _0x223c67 = parseProtobufFields((await this.sendOidb(PACKETS.overview, _0x2201b1)).body);
    const _0x43b57d = getBytesField(_0x223c67, 2);
    const _0x18bc71 = _0x43b57d.length ? parseProtobufFields(_0x43b57d) : new Map();
    const _0xea3a5a = {
      strength: 0,
      intelligence: 0,
      charm: 0
    };
    const _0x5c8e53 = [1, 2, 3].flatMap(_0x2dbcf9 => getProtobufFields(_0x18bc71, _0x2dbcf9));
    for (const _0xa2b09 of _0x5c8e53) {
      if (_0xa2b09.wireType !== 2) {
        continue;
      }
      const _0x45a5ea = parseProtobufFields(_0xa2b09.value);
      const _0x169a84 = getStringField(_0x45a5ea, 1);
      const _0x2472ee = _0x169a84 === "力量" ? "strength" : _0x169a84 === "智力" ? "intelligence" : _0x169a84 === "魅力" ? "charm" : null;
      if (_0x2472ee) {
        _0xea3a5a[_0x2472ee] = getVarintField(_0x45a5ea, 3);
      }
    }
    return _0xea3a5a;
  }
  async queryOtherPet(_0x47da78, _0x4acf3d) {
    const _0x217ed9 = _0x21a127 => {
      const _0x23ef1a = getStringField(_0x21a127, 8).trim() || getStringField(_0x21a127, 101).trim();
      if (!_0x23ef1a) {
        return null;
      }
      const _0x26cda9 = getBytesField(_0x21a127, 13);
      const _0x4518ce = _0x26cda9.length ? getVarintField(parseProtobufFields(_0x26cda9), 1) : 0;
      return {
        uin: _0x47da78,
        petId: _0x23ef1a,
        name: getStringField(_0x21a127, 1).trim(),
        level: _0x4518ce,
        kind: _0x4acf3d
      };
    };
    if (this.otherPetMobileAvailable === false) {
      throw new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口");
    }
    try {
      const _0x35c229 = parseProtobufFields((await this.sendOidb(PACKETS.otherPet, encodeStringField(1, _0x47da78))).body);
      this.otherPetMobileAvailable = true;
      const _0x3f3ff5 = getBytesField(_0x35c229, 1);
      return _0x217ed9(_0x3f3ff5.length ? parseProtobufFields(_0x3f3ff5) : _0x35c229);
    } catch (_0x45fd15) {
      const _0x583a35 = _0x45fd15 instanceof Error ? _0x45fd15.message : String(_0x45fd15);
      if (/用户没有宠物|尚未创建.*宠物|未创建.*宠物/.test(_0x583a35)) {
        this.otherPetMobileAvailable = true;
        return null;
      }
      throw /不支持.*好友宠物|action.*(?:不存在|not found|unsupported)|返回空响应或未知响应结构|unknown command/i.test(_0x583a35) ? (this.otherPetMobileAvailable = false, new QQPetError("当前 QQ/OneBot 运行时不支持安卓端的好友宠物详情接口：" + _0x583a35, "other_pet_unsupported")) : new QQPetError("查询好友宠物失败：" + _0x583a35, "other_pet_query_failed");
    }
  }
  async queryOtherValues(_0x4aec06) {
    const _0x5eeda9 = concatBytes(encodeStringField(1, _0x4aec06), encodeBytesField(2, Uint8Array.of(1)));
    const _0x54767a = parseProtobufFields(getBytesField(parseProtobufFields((await this.sendOidb(PACKETS.display, _0x5eeda9)).body), 1));
    const _0x5b2582 = _0xcb5593 => getFloatField(parseProtobufFields(getBytesField(_0x54767a, _0xcb5593)), 3);
    return {
      feel: _0x5b2582(1),
      hunger: _0x5b2582(2),
      clean: _0x5b2582(3),
      total: _0x5b2582(4)
    };
  }
  async visitOther(_0x2622ee) {
    const _0x5afaaa = concatBytes(encodeVarintField(1, 4000), encodeVarintField(2, 0), encodeVarintField(3, 0));
    const _0x596a88 = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, _0x2622ee), encodeBytesField(3, _0x5afaaa), encodeBytesField(4, new Uint8Array()));
    await this.sendOidb(PACKETS.reportEvent, _0x596a88);
  }
  async feedOther(_0x412f13, _0x37de0b) {
    const _0x4c5f0d = concatBytes(encodeStringField(1, _0x412f13), encodeStringField(2, ""), encodeStringField(3, ""), encodeStringField(4, _0x37de0b));
    await this.sendOidb(PACKETS.feed, _0x4c5f0d);
  }
  async washOther(_0x51c827, _0x215d9b) {
    const _0x27b161 = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, _0x215d9b), encodeVarintField(3, 1), encodeStringField(4, _0x51c827));
    await this.sendOidb(PACKETS.useBathItem, _0x27b161);
  }
  async feed() {
    await this.sendOidb(PACKETS.feed, encodeStringField(4, this.petId));
  }
  async queryFoodInventory() {
    const _0x4f5832 = await this.sendOidb(PACKETS.feedInventory, new Uint8Array());
    const _0x250a2b = parseProtobufFields(_0x4f5832.body);
    return {
      biscuits: getVarintField(_0x250a2b, 1),
      shrimp: getVarintField(_0x250a2b, 2)
    };
  }
  async buyFood(_0x1fa3d4) {
    if (_0x1fa3d4 <= 0) {
      throw new QQPetError("购买饼干数量必须大于 0");
    }
    const _0x5a8555 = parseProtobufFields((await this.sendOidb(PACKETS.buyFood, encodeVarintField(1, _0x1fa3d4))).body);
    return {
      bought: getVarintField(_0x5a8555, 3),
      costGold: getVarintField(_0x5a8555, 4)
    };
  }
  async queryBathItems() {
    const _0x466ef1 = parseProtobufFields((await this.sendOidb(PACKETS.bathItems, encodeVarintField(1, 1))).body);
    return getProtobufFields(_0x466ef1, 1).filter(_0x2c0bc2 => _0x2c0bc2.wireType === 2).map(_0x4d739d => {
      const _0x4a84d2 = parseProtobufFields(_0x4d739d.value);
      const _0x30ea72 = getBytesField(_0x4a84d2, 14);
      const _0x382720 = _0x30ea72.length ? parseProtobufFields(_0x30ea72) : new Map();
      return {
        name: getStringField(_0x4a84d2, 1),
        itemId: getStringField(_0x4a84d2, 2),
        goldPrice: getVarintField(_0x4a84d2, 5),
        cleanGain: getVarintField(_0x4a84d2, 6),
        description: getStringField(_0x4a84d2, 7),
        defaultCount: getVarintField(_0x4a84d2, 8),
        step: getVarintField(_0x4a84d2, 9),
        minimum: getVarintField(_0x4a84d2, 10),
        maximum: getVarintField(_0x4a84d2, 11),
        moodGain: getVarintField(_0x4a84d2, 12),
        previewUrl: _(getStringField(_0x4a84d2, 3)),
        silhouetteUrl: _(getStringField(_0x4a84d2, 13)),
        selectedPreviewUrl: _(getStringField(_0x4a84d2, 15)),
        soapingUrl: _(getStringField(_0x382720, 4))
      };
    });
  }
  async queryBathInventory() {
    const _0x56a4c9 = parseProtobufFields((await this.sendOidb(PACKETS.bathInventory, encodeVarintField(1, 1))).body);
    const _0x59e2f1 = getBytesField(_0x56a4c9, 1);
    const _0x1b365e = _0x59e2f1.length ? parseProtobufFields(_0x59e2f1) : new Map();
    const _0x1824f5 = {};
    for (const _0x4662a5 of getProtobufFields(_0x1b365e, 1)) {
      if (_0x4662a5.wireType !== 2) {
        continue;
      }
      const _0x2cc90c = parseProtobufFields(_0x4662a5.value);
      _0x1824f5[getStringField(_0x2cc90c, 1)] = getVarintField(_0x2cc90c, 2);
    }
    const _0x10db4c = {
      soap: _0x1824f5[1] ?? 0,
      bathBall: _0x1824f5[2] ?? 0,
      counts: _0x1824f5
    };
    return _0x10db4c;
  }
  async buyBathItem(_0x48335a, _0x11eb62) {
    if (_0x11eb62 <= 0) {
      throw new QQPetError("购买洗护道具数量必须大于 0");
    }
    const _0x3d2023 = concatBytes(encodeVarintField(1, 1), encodeVarintField(2, 1001), encodeStringField(3, this.petId));
    const _0x343897 = concatBytes(encodeVarintField(1, 355), encodeVarintField(2, Number(_0x48335a)), encodeVarintField(3, _0x11eb62));
    const _0x1c8040 = concatBytes(encodeBytesField(1, _0x3d2023), encodeVarintField(2, 1001), encodeBytesField(3, _0x343897), encodeVarintField(4, 21));
    const _0x406183 = parseProtobufFields((await this.sendOidb(PACKETS.buyBathItem, _0x1c8040)).body);
    const _0x17b825 = getVarintField(_0x406183, 1);
    const _0x5b9bbb = getStringField(_0x406183, 2);
    return {
      result: _0x17b825,
      orderId: _0x5b9bbb,
      succeeded: _0x17b825 === 0 && !!_0x5b9bbb
    };
  }
  async useBathItem(_0x2c0405) {
    const _0x4a020c = concatBytes(encodeStringField(1, this.petId), encodeStringField(2, _0x2c0405), encodeVarintField(3, 1), encodeStringField(4, ""));
    await this.sendOidb(PACKETS.useBathItem, _0x4a020c);
  }
  async querySchoolStage() {
    const _0x1bc4f2 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const _0x202506 = getVarintField(parseProtobufFields((await this.sendOidb(PACKETS.overview, _0x1bc4f2)).body), 4);
    if (![0, 1, 2, 3, 4].includes(_0x202506)) {
      throw new QQPetError("服务器返回未知学习阶段：" + _0x202506);
    }
    return _0x202506;
  }
  async querySchoolCourses(_0x844f62) {
    const _0xec785f = _0x844f62 ?? (await this.querySchoolStage());
    const _0x32d5d7 = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeVarintField(11, _0xec785f), encodeVarintField(100, 2));
    const _0x18064c = parseProtobufFields((await this.sendOidb(PACKETS.catalog, _0x32d5d7)).body);
    return getProtobufFields(_0x18064c, 1).filter(_0x32998f => _0x32998f.wireType === 2).map(_0x4042df => H(_0x4042df.value));
  }
  async selectSchoolCourse(_0x1c2d4c, _0x34d12b = 0) {
    const _0x52f8d8 = {
      physical: "力量",
      culture: "智力",
      art: "魅力"
    }[_0x1c2d4c];
    if (!_0x52f8d8) {
      throw new QQPetError("未知学习属性：" + _0x1c2d4c);
    }
    const _0x882fd5 = (await this.querySchoolCourses()).filter(_0x38daf8 => _0x38daf8.canDo && _0x38daf8.subEventType > 0);
    const _0x5604ce = _0x34d12b ? _0x882fd5.find(_0x5af973 => _0x5af973.subEventType === _0x34d12b) : _0x882fd5.filter(_0x4a2125 => _0x4a2125.reward.includes(_0x52f8d8)).sort(at)[0];
    if (!_0x5604ce) {
      throw new QQPetError(_0x34d12b ? "指定课程 " + _0x34d12b + " 当前不可用" : "当前暂无可用的" + _0x52f8d8 + "课程");
    }
    return _0x5604ce;
  }
  async startSchool(_0x5e30e9, _0x387f5b = 0) {
    const _0x15b661 = await this.selectSchoolCourse(_0x5e30e9, _0x387f5b);
    const _0x2e5b5a = concatBytes(encodeVarintField(1, 6100), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, _0x15b661.name), encodeVarintField(7, _0x15b661.subEventType), encodeVarintField(100, 2));
    const _0x2cc2fa = await this.sendOidb(PACKETS.startStory, _0x2e5b5a);
    return {
      item: _0x15b661,
      storyId: getStringField(parseProtobufFields(_0x2cc2fa.body), 1)
    };
  }
  async queryWorkOverview() {
    const _0x2e0253 = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeVarintField(100, 2));
    const _0x31192a = parseProtobufFields((await this.sendOidb(PACKETS.overview, _0x2e0253)).body);
    return {
      careers: getProtobufFields(_0x31192a, 1).filter(_0x33f3c9 => _0x33f3c9.wireType === 2).map(_0x9660ee => {
        const _0x3f7895 = parseProtobufFields(_0x9660ee.value);
        const _0x34a71f = getVarintField(_0x3f7895, 4);
        const _0x598820 = getStringField(_0x3f7895, 1);
        return {
          careerType: getVarintField(_0x3f7895, 20),
          name: _0x598820,
          available: _0x34a71f !== 3 && _0x598820 !== "???",
          statusCode: _0x34a71f,
          message: getStringField(_0x3f7895, 5)
        };
      }).filter(_0x5ef565 => _0x5ef565.careerType > 0),
      currentCareerType: getVarintField(_0x31192a, 3),
      lastSubEventType: getVarintField(_0x31192a, 5)
    };
  }
  async queryWorkJobs(_0x1c3cb0, _0x4edb40 = "") {
    const _0x12602c = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, _0x4edb40), encodeVarintField(10, _0x1c3cb0), encodeVarintField(100, 2));
    const _0x2c4b23 = parseProtobufFields((await this.sendOidb(PACKETS.catalog, _0x12602c)).body);
    const _0x2ca7b3 = getStringField(_0x2c4b23, 2);
    const _0x2d5a6f = {
      careerType: _0x1c3cb0,
      careerName: _0x2ca7b3
    };
    return getProtobufFields(_0x2c4b23, 1).filter(_0x155839 => _0x155839.wireType === 2).map(_0x81b072 => H(_0x81b072.value, _0x2d5a6f));
  }
  async selectWorkJob(_0x4e139e = 0, _0x35ee7f = 0, _0x357521 = "") {
    const _0x11d0d2 = await this.queryWorkOverview();
    const _0x61dae = _0x11d0d2.careers.filter(_0x322904 => _0x322904.available && (!_0x4e139e || _0x322904.careerType === _0x4e139e));
    if (!_0x61dae.length) {
      throw new QQPetError(_0x4e139e ? "职业 " + _0x4e139e + " 尚未开放" : "服务器当前没有开放的职业");
    }
    const _0x4b53fa = (await Promise.all(_0x61dae.map(_0x461bfb => this.queryWorkJobs(_0x461bfb.careerType, _0x357521)))).flat().filter(_0x937942 => _0x937942.canDo && _0x937942.subEventType > 0);
    const _0x544a84 = _0x35ee7f ? _0x4b53fa.find(_0x36af28 => _0x36af28.subEventType === _0x35ee7f) : _0x4b53fa.sort((_0x3705bb, _0x4ca9dd) => at(_0x3705bb, _0x4ca9dd) || +(_0x4ca9dd.careerType === _0x11d0d2.currentCareerType) - +(_0x3705bb.careerType === _0x11d0d2.currentCareerType) || (_0x3705bb.careerType ?? 0) - (_0x4ca9dd.careerType ?? 0))[0];
    if (!_0x544a84) {
      throw new QQPetError(_0x35ee7f ? "指定岗位 " + _0x35ee7f + " 当前不可用" : "服务器当前没有可执行的打工岗位");
    }
    return _0x544a84;
  }
  async startWork(_0x44e351 = 0, _0x2f890c = 0, _0x2d7d4b) {
    const _0x396dac = _0x2d7d4b?.uin.trim() ?? "";
    const _0x1fa903 = _0x2d7d4b?.petId.trim() ?? "";
    if (!!_0x396dac != !!_0x1fa903) {
      throw new QQPetError("雇佣好友时必须同时提供好友账号和宠物 ID");
    }
    const _0x2f26aa = await this.selectWorkJob(_0x44e351, _0x2f890c, _0x1fa903);
    const _0x2064bd = concatBytes(encodeVarintField(1, 6400), encodeStringField(2, this.petId), encodeStringField(3, ""), _0x396dac ? encodeBytesField(4, concatBytes(encodeStringField(1, _0x396dac), encodeStringField(2, _0x1fa903))) : new Uint8Array(), encodeStringField(6, _0x2f26aa.name), encodeVarintField(7, _0x2f26aa.subEventType), encodeVarintField(100, 2));
    const _0x4e2151 = await this.sendOidb(PACKETS.startStory, _0x2064bd);
    return {
      item: _0x2f26aa,
      storyId: getStringField(parseProtobufFields(_0x4e2151.body), 1),
      hiredFriend: !!_0x396dac
    };
  }
  async queryAdventureOptions(_0x311118 = "") {
    const _0xddc507 = concatBytes(encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, _0x311118), encodeVarintField(100, 2));
    const _0x3b8702 = parseProtobufFields((await this.sendOidb(PACKETS.catalog, _0xddc507)).body);
    return getProtobufFields(_0x3b8702, 1).filter(_0x50d0a9 => _0x50d0a9.wireType === 2).map(_0x4f3e84 => H(_0x4f3e84.value));
  }
  async queryFatigueStatus() {
    try {
      const _0x5908fc = (await this.queryWorkOverview()).careers.find(_0x42f3f2 => _0x42f3f2.available);
      const _0x41f79c = (_0x5908fc ? await this.queryWorkJobs(_0x5908fc.careerType) : await this.querySchoolCourses()).filter(_0x5532de => _0x5532de.name).sort((_0x321602, _0x1bfa45) => (Q(_0x321602.duration) || Number.MAX_SAFE_INTEGER) - (Q(_0x1bfa45.duration) || Number.MAX_SAFE_INTEGER))[0];
      if (_0x41f79c) {
        return Ut(_0x41f79c.warning ?? "");
      } else {
        return {
          fatigued: null,
          tier: null,
          benefitRate: null,
          reason: "服务器没有返回可用于疲劳判定的任务"
        };
      }
    } catch (_0x524d38) {
      return {
        fatigued: null,
        tier: null,
        benefitRate: null,
        reason: "疲劳状态读取失败：" + (_0x524d38 instanceof Error ? _0x524d38.message : String(_0x524d38))
      };
    }
  }
  async startAdventure(_0x5d5a3e = "") {
    const _0x25fb26 = (await this.queryAdventureOptions()).filter(_0x3a0799 => _0x3a0799.canDo && _0x3a0799.name);
    const _0x244862 = _0x5d5a3e ? _0x25fb26.find(_0x5e5106 => _0x5e5106.name === _0x5d5a3e) : _0x25fb26[0];
    if (!_0x244862) {
      throw new QQPetError(_0x5d5a3e ? "指定冒险“" + _0x5d5a3e + "”当前不可用" : "服务器当前没有可执行的冒险");
    }
    const _0x44c9b7 = [encodeVarintField(1, 6700), encodeStringField(2, this.petId), encodeStringField(3, ""), encodeStringField(6, _0x244862.name)];
    if (_0x244862.subEventType > 0) {
      _0x44c9b7.push(encodeVarintField(7, _0x244862.subEventType));
    }
    _0x44c9b7.push(encodeVarintField(100, 2));
    const _0x4349de = await this.sendOidb(PACKETS.startStory, concatBytes(..._0x44c9b7));
    return {
      item: _0x244862,
      storyId: getStringField(parseProtobufFields(_0x4349de.body), 1)
    };
  }
  async queryStory() {
    const _0x1146e6 = concatBytes(encodeStringField(1, this.petId), encodeVarintField(100, 2));
    const _0x26796a = parseProtobufFields((await this.sendOidb(PACKETS.storyStatus, _0x1146e6)).body);
    const _0x5d2362 = getBytesField(_0x26796a, 1);
    const _0x1c9a74 = _0x5d2362.length ? parseProtobufFields(_0x5d2362) : new Map();
    const _0x562a2a = getStringField(_0x26796a, 2);
    const _0x38519f = getVarintField(_0x1c9a74, 2);
    const _0x1233f3 = getVarintField(_0x1c9a74, 3);
    return {
      storyId: _0x562a2a,
      stateCode: getVarintField(_0x1c9a74, 1),
      remainingSeconds: _0x38519f,
      durationSeconds: _0x1233f3,
      startedAt: getVarintField(_0x1c9a74, 4),
      recallable: !!getVarintField(_0x1c9a74, 5),
      finished: !!_0x562a2a && !!(_0x1233f3 > 0) && !!(_0x38519f <= 0)
    };
  }
  async settleStory(_0x143287) {
    const _0x580bb6 = concatBytes(encodeStringField(1, _0x143287), encodeVarintField(2, 1000), encodeStringField(3, this.petId), encodeVarintField(100, 2));
    return this.sendOidb(PACKETS.storySettle, _0x580bb6);
  }
}
const delaySeconds = _0x50f96b => new Promise(_0x5c8601 => setTimeout(_0x5c8601, Math.max(0, _0x50f96b) * 1000));
const ATTRIBUTE_ROTATION = ["physical", "culture", "art"];
function ut(_0x5a3e8d, _0x70706a, _0x1e6850 = Math.random) {
  const _0x284a48 = Math.max(0, Math.trunc(_0x5a3e8d * 60));
  const _0x401839 = Math.max(_0x284a48, Math.trunc(_0x70706a * 60));
  return _0x284a48 + Math.floor(Math.min(0.999999999, Math.max(0, _0x1e6850())) * (_0x401839 - _0x284a48 + 1));
}
function jt(_0x1f6cc5, _0x18584b) {
  if (!_0x1f6cc5.schoolRotationEnabled) {
    return _0x1f6cc5.schoolAttribute;
  }
  const _0x4e68aa = ATTRIBUTE_ROTATION.indexOf(_0x1f6cc5.schoolAttribute);
  return ATTRIBUTE_ROTATION[(_0x4e68aa + Math.max(0, Math.trunc(_0x18584b))) % ATTRIBUTE_ROTATION.length];
}
function Ht(_0x180908, _0x113a24, _0x4e21e7) {
  const _0x1ed86f = {
    school: _0x180908.schoolEnabled && _0x113a24.gold >= _0x180908.coinThreshold,
    work: _0x180908.workEnabled && (!_0x180908.workTimesPerDay || (_0x4e21e7.work ?? 0) < _0x180908.workTimesPerDay)
  };
  const _0x2523ac = _0x1ed86f;
  return (_0x180908.taskPriority === "work" ? ["work", "school"] : ["school", "work"]).find(_0x166336 => _0x2523ac[_0x166336]) ?? null;
}
function zt(_0x37b56d, _0x3428d6) {
  if (!_0x3428d6.fatigued || !_0x3428d6.tier) {
    return null;
  } else if (_0x3428d6.tier >= 12) {
    return _0x37b56d.fatigue12HourAction;
  } else {
    return _0x37b56d.fatigue8HourAction;
  }
}
function lt(_0x471514, _0x1811cf) {
  const _0x51c092 = {
    storyId: "",
    stateCode: 0,
    remainingSeconds: 0,
    durationSeconds: 0,
    startedAt: 0,
    recallable: false,
    finished: false
  };
  if (!_0x471514.storyId || !_0x471514.finished || !_0x1811cf) {
    return _0x471514;
  } else {
    return _0x51c092;
  }
}
function Wt(_0x479f93) {
  return /宠物结算条件不满足|(?:任务|故事).*(?:已结算|不存在|已失效)|无需结算/.test(_0x479f93 instanceof Error ? _0x479f93.message : String(_0x479f93));
}
function Jt(_0x8dca94, _0x179515) {
  return _0x179515.bonus - _0x8dca94.bonus || _0x179515.totalReward - _0x8dca94.totalReward || _0x179515.target.level - _0x8dca94.target.level || _0x8dca94.target.uin.localeCompare(_0x179515.target.uin);
}
class AutomationController {
  constructor(_0x439497, _0x422112) {
    this.host = _0x439497;
    this.progress = _0x422112;
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
    const _0x5d28a5 = ++this.generation;
    this.host.log("自动托管已启动");
    this.host.updateStatus({
      automationRunning: true,
      activity: "自动托管已启动，正在检查"
    });
    this.loop(_0x5d28a5);
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
  async loop(_0x22759a) {
    if (!this.active || _0x22759a !== this.generation) {
      return;
    }
    try {
      await this.runOnce();
    } catch (_0x157913) {
      const _0x3c9d58 = _0x157913 instanceof Error ? _0x157913.message : String(_0x157913);
      this.host.log("本轮失败：" + _0x3c9d58);
      this.host.updateStatus({
        connected: false,
        error: _0x3c9d58,
        activity: "本轮执行失败，等待重试"
      });
    }
    if (!this.active || _0x22759a !== this.generation) {
      return;
    }
    const _0x140d04 = Math.max(3, this.host.getConfig().intervalSeconds);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.loop(_0x22759a);
    }, _0x140d04 * 1000);
  }
  async client() {
    const _0x35e1a7 = this.host.getConfig();
    const _0x26a5b3 = new QQPetApi(this.host.ctx, _0x35e1a7.petId);
    const _0x25b76a = isAutoPetId(_0x35e1a7.petId);
    if (_0x25b76a || !this.identityLoaded) {
      if (_0x25b76a) {
        this.host.updateStatus({
          activity: "正在自动获取宠物档案"
        });
      }
      try {
        const _0x2f747f = await _0x26a5b3.queryOwnPetProfile();
        this.petName = _0x2f747f.name;
        this.identityLoaded = true;
        if (_0x25b76a) {
          this.host.updateConfig({
            petId: _0x2f747f.petId
          });
          _0x26a5b3.petId = _0x2f747f.petId;
          this.host.log("已自动获取宠物 ID 和昵称并保存");
        }
      } catch (_0x96d703) {
        if (_0x25b76a) {
          throw _0x96d703;
        }
        this.identityLoaded = true;
      }
    }
    return _0x26a5b3;
  }
  async queryProfile(_0x4e5efc) {
    const _0x95042c = await _0x4e5efc.queryOwnPetProfile();
    if (!this.medals || Date.now() - this.medalsLoadedAt >= 300000) {
      try {
        const _0x1eb344 = await _0x4e5efc.queryMedalGallery();
        if (_0x1eb344.length) {
          this.medals = _0x1eb344;
        }
        this.medalsLoadedAt = Date.now();
      } catch {
        this.medals ||= _0x95042c.medals;
        this.medalsLoadedAt = Date.now();
      }
    }
    if (!this.interactionsLoadedAt || Date.now() - this.interactionsLoadedAt >= 300000) {
      try {
        this.interactions = await _0x4e5efc.queryInteractionMessages();
      } catch {}
      this.interactionsLoadedAt = Date.now();
    }
    const _0x4067a7 = {
      ..._0x95042c
    };
    _0x4067a7.medals = this.medals ?? _0x95042c.medals;
    return _0x4067a7;
  }
  async blocked(_0x46e310, _0x26fea7) {
    if (_0x46e310.safeMode) {
      this.host.log("安全模式：计划执行" + _0x26fea7 + "，本轮不发送写请求");
      return true;
    } else {
      return false;
    }
  }
  decide(_0x15b742, _0x22185a) {
    const _0xeb2219 = this.progress.snapshot().counts;
    const _0x3559ea = new Date();
    const _0x43cc78 = String(_0x3559ea.getHours()).padStart(2, "0") + ":" + String(_0x3559ea.getMinutes()).padStart(2, "0");
    if (_0x15b742.adventureEnabled && _0x43cc78 >= _0x15b742.adventureStartTime && (!_0x15b742.adventureTimesPerDay || _0xeb2219.adventure < _0x15b742.adventureTimesPerDay)) {
      return "adventure";
    } else {
      return Ht(_0x15b742, _0x22185a, _0xeb2219);
    }
  }
  actionArray(_0x69ae1b) {
    if (Array.isArray(_0x69ae1b)) {
      return _0x69ae1b.flatMap(_0x1d8d96 => this.actionArray(_0x1d8d96));
    }
    if (_0x69ae1b && typeof _0x69ae1b == "object") {
      const _0x5a40f3 = _0x69ae1b;
      if ("user_id" in _0x5a40f3 || "uin" in _0x5a40f3 || "group_id" in _0x5a40f3) {
        return [_0x5a40f3];
      } else {
        return Object.values(_0x5a40f3).flatMap(_0x87478a => this.actionArray(_0x87478a));
      }
    }
    return [];
  }
  async callAction(_0x1fbad, _0x4bed3a) {
    const _0xf93365 = await this.host.ctx.actions.call(_0x1fbad, _0x4bed3a, this.host.ctx.adapterName, this.host.ctx.pluginManager.config);
    return this.actionArray(_0xf93365);
  }
  targetLabel(_0x364dc2) {
    return (_0x364dc2.name?.trim() ? "“" + _0x364dc2.name.trim() + "”" : "未命名对象") + "（QQ " + _0x364dc2.uin + "）";
  }
  async friendCandidates() {
    const _0x15a39 = (await this.callAction("get_friends_with_category", {})).flatMap(_0x56168b => {
      const _0x5bd480 = String(_0x56168b.user_id ?? _0x56168b.uin ?? "").trim();
      const _0x586efa = String(_0x56168b.remark ?? _0x56168b.nickname ?? _0x56168b.nick ?? "").trim();
      if (_0x5bd480 && _0x5bd480 !== this.host.uin) {
        return [{
          uin: _0x5bd480,
          name: _0x586efa,
          kind: "friend"
        }];
      } else {
        return [];
      }
    });
    return [...new Map(_0x15a39.map(_0x40facc => [_0x40facc.uin, _0x40facc])).values()];
  }
  async visitCandidates(_0x33cc64) {
    const _0x27d9e4 = await this.friendCandidates();
    const _0xc2be42 = new Set(_0x27d9e4.map(_0xe973d5 => _0xe973d5.uin));
    const _0x1e29dd = _0x33cc64.visitFriends ? _0x27d9e4 : [];
    const _0x14bb6a = [];
    if (_0x33cc64.visitStrangers) {
      let _0x4dd92b = _0x33cc64.visitStrangerGroupIds.split(/[,，\s]+/).map(_0x30dcde => _0x30dcde.trim()).filter(Boolean);
      if (!_0x4dd92b.length) {
        _0x4dd92b = (await this.callAction("get_group_list", {})).slice(0, 1).map(_0x282575 => String(_0x282575.group_id ?? "")).filter(Boolean);
      }
      for (const _0x49742a of _0x4dd92b.slice(0, 3)) {
        const _0xce0446 = {
          group_id: _0x49742a,
          no_cache: false
        };
        const _0x14a674 = await this.callAction("get_group_member_list", _0xce0446);
        for (const _0x512647 of _0x14a674) {
          const _0x3a1cab = String(_0x512647.user_id ?? _0x512647.uin ?? "");
          const _0x11ff1b = String(_0x512647.card ?? _0x512647.nickname ?? _0x512647.nick ?? "").trim();
          if (_0x3a1cab && _0x3a1cab !== this.host.uin && !_0xc2be42.has(_0x3a1cab)) {
            _0x14bb6a.push({
              uin: _0x3a1cab,
              name: _0x11ff1b,
              kind: "stranger"
            });
          }
        }
      }
    }
    const _0x5b65f9 = [...new Map(_0x1e29dd.map(_0x27a990 => [_0x27a990.uin, _0x27a990])).values()];
    const _0x5a5f06 = [...new Map(_0x14bb6a.map(_0x11e364 => [_0x11e364.uin, _0x11e364])).values()];
    const _0x250701 = [];
    const _0x2f223a = Math.max(_0x5b65f9.length, _0x5a5f06.length);
    for (let _0x58ff6a = 0; _0x58ff6a < _0x2f223a; _0x58ff6a += 1) {
      if (_0x5b65f9[_0x58ff6a]) {
        _0x250701.push(_0x5b65f9[_0x58ff6a]);
      }
      if (_0x5a5f06[_0x58ff6a]) {
        _0x250701.push(_0x5a5f06[_0x58ff6a]);
      }
    }
    return _0x250701;
  }
  async findEmployableFriend(_0x253eb2, _0x1fbbde) {
    let _0x1467e8;
    try {
      _0x1467e8 = (await this.friendCandidates()).slice(0, _0x1fbbde.workFriendScanLimit);
    } catch (_0x427d85) {
      this.host.log("读取好友列表失败，本次按普通打工继续：" + (_0x427d85 instanceof Error ? _0x427d85.message : String(_0x427d85)));
      return null;
    }
    let _0x520309 = _0x1467e8.length ? "" : "好友列表没有可扫描对象";
    let _0x125724;
    try {
      _0x125724 = await _0x253eb2.selectWorkJob(_0x1fbbde.workCareerType, _0x1fbbde.workJobSubEvent);
    } catch (_0x1e3a00) {
      this.host.log("读取普通岗位收益失败，无法比较好友雇佣加成：" + (_0x1e3a00 instanceof Error ? _0x1e3a00.message : String(_0x1e3a00)));
      return null;
    }
    const _0x38b4d0 = V(_0x125724.reward);
    const _0x489539 = _0x125724.careerType;
    if (!_0x489539) {
      this.host.log("服务器未返回基准岗位所属职业，无法比较好友雇佣加成，本次按普通打工继续");
      return null;
    }
    const _0x2a2a01 = [];
    for (const _0x4b59b1 of _0x1467e8) {
      try {
        const _0x3df9d7 = await _0x253eb2.queryOtherPet(_0x4b59b1.uin, "friend");
        if (!_0x3df9d7) {
          _0x520309 = this.targetLabel(_0x4b59b1) + "尚未创建宠物";
          continue;
        }
        const _0x5017c4 = (await _0x253eb2.queryWorkJobs(_0x489539, _0x3df9d7.petId)).find(_0x42683b => _0x42683b.canDo && _0x42683b.subEventType === _0x125724.subEventType);
        if (!_0x5017c4) {
          _0x520309 = this.targetLabel(_0x3df9d7) + "不能参加当前岗位";
          continue;
        }
        const _0x21a42a = V(_0x5017c4.reward);
        _0x2a2a01.push({
          target: _0x3df9d7,
          jobSubEvent: _0x5017c4.subEventType,
          bonus: _0x21a42a - _0x38b4d0,
          totalReward: _0x21a42a
        });
      } catch (_0x8e89d1) {
        _0x520309 = this.targetLabel(_0x4b59b1) + "不可雇佣：" + (_0x8e89d1 instanceof Error ? _0x8e89d1.message : String(_0x8e89d1));
        if (_0x520309.includes("不支持安卓端的好友宠物详情接口")) {
          break;
        }
      }
    }
    _0x2a2a01.sort(Jt);
    if (_0x2a2a01[0]) {
      const _0x59d1e9 = _0x2a2a01[0];
      this.host.log("已比较 " + _0x2a2a01.length + " 只可雇佣好友宠物，选择" + this.targetLabel(_0x59d1e9.target) + "，预计雇佣加成 " + (_0x59d1e9.bonus >= 0 ? "+" : "") + _0x59d1e9.bonus);
      return _0x59d1e9;
    }
    this.host.log("未找到可雇佣的好友宠物，本次按普通打工继续" + (_0x520309 ? "（" + _0x520309 + "）" : ""));
    return null;
  }
  async maybeVisit(_0x1488c1, _0x32624e, _0x1793b9, _0x201118) {
    if (!_0x32624e.visitEnabled || this.progress.activeBlock("visit")) {
      return false;
    }
    const _0x410913 = this.progress.snapshot().counts;
    const _0x49637c = (_0x410913.visitFriend ?? 0) + (_0x410913.visitStranger ?? 0);
    if (_0x32624e.visitMaxPerDay && _0x49637c >= _0x32624e.visitMaxPerDay || (await this.blocked(_0x32624e, "走访宠物"))) {
      return false;
    }
    let _0xfe6939 = "";
    try {
      const _0x4a862d = (await this.visitCandidates(_0x32624e)).filter(_0x41a0cf => !this.progress.targetWasVisited(_0x41a0cf.uin)).slice(0, _0x32624e.visitCandidateScanLimit);
      for (const _0x29fe3b of _0x4a862d) {
        try {
          await _0x1488c1.visitOther(_0x29fe3b.uin);
          this.progress.markTargetVisited(_0x29fe3b.uin);
          this.progress.increment(_0x29fe3b.kind === "friend" ? "visitFriend" : "visitStranger");
          this.host.log("自动走访" + (_0x29fe3b.kind === "friend" ? "好友" : "陌生人") + this.targetLabel(_0x29fe3b) + "成功");
          const _0x2c5416 = _0x32624e.otherCareDailyExperienceLimit > 0 && this.progress.snapshot().dailyExperienceGain >= _0x32624e.otherCareDailyExperienceLimit;
          if (_0x32624e.visitAutoCare && _0x2c5416) {
            this.host.log("今日经验已达到 " + _0x32624e.otherCareDailyExperienceLimit + "，停止照顾别人");
          } else if (_0x32624e.visitAutoCare) {
            try {
              const _0x3d8835 = await _0x1488c1.queryOtherPet(_0x29fe3b.uin, _0x29fe3b.kind);
              if (_0x3d8835) {
                const _0x32ad53 = await _0x1488c1.queryOtherValues(_0x3d8835.petId);
                if (_0x32ad53.hunger < _0x32624e.hungerThreshold && _0x1793b9.biscuits > 0) {
                  await _0x1488c1.feedOther(_0x3d8835.uin, _0x3d8835.petId);
                  this.progress.increment("careOther");
                  this.host.log("已自动喂养走访对象");
                }
                const _0x3c1289 = _0x201118.bathBall > 0 ? "2" : _0x201118.soap > 0 ? "1" : null;
                if (_0x32ad53.clean < _0x32624e.cleanThreshold && _0x3c1289) {
                  await _0x1488c1.washOther(_0x3d8835.uin, _0x3c1289);
                  this.progress.increment("careOther");
                  this.host.log("已自动清洁走访对象");
                }
              }
            } catch (_0x44d7d5) {
              this.host.log("走访已完成，暂无法读取对方宠物状态：" + (_0x44d7d5 instanceof Error ? _0x44d7d5.message : String(_0x44d7d5)));
            }
          }
          const _0x52060c = ut(_0x32624e.visitDelayMinMinutes, _0x32624e.visitDelayMaxMinutes);
          this.progress.setBlock("visit", "等待下次走访", _0x52060c);
          this.host.updateStatus({
            activity: "自动走访已完成"
          });
          return true;
        } catch (_0x880e96) {
          _0xfe6939 = _0x880e96 instanceof Error ? _0x880e96.message : String(_0x880e96);
        }
      }
      const _0x10dfea = ut(_0x32624e.visitDelayMinMinutes, _0x32624e.visitDelayMaxMinutes);
      this.progress.setBlock("visit", _0xfe6939 || "暂无可走访的宠物", _0x10dfea);
      if (_0xfe6939) {
        this.host.log("走访候选检查未成功：" + _0xfe6939);
      }
    } catch (_0x3d6b85) {
      const _0x487468 = _0x3d6b85 instanceof Error ? _0x3d6b85.message : String(_0x3d6b85);
      this.progress.setBlock("visit", _0x487468, _0x32624e.failureCooldownSeconds);
      this.host.log("获取走访候选失败：" + _0x487468);
    }
    return false;
  }
  storyKind(_0x359f18) {
    return {
      "6100": "school",
      "6400": "work",
      "6700": "adventure"
    }[_0x359f18.split("_", 1)[0]] ?? null;
  }
  handleMissingPending(_0x37128c, _0x4f915b) {
    if (!_0x4f915b) {
      return false;
    }
    const _0x17aba1 = this.progress.markPendingMissing();
    const _0x29d35d = _0x17aba1 ? (Date.now() - Date.parse(_0x17aba1)) / 1000 : 0;
    if (_0x29d35d < _0x37128c.startConfirmSeconds) {
      this.host.updateStatus({
        activity: "任务状态暂未返回，等待同步（" + Math.ceil(_0x37128c.startConfirmSeconds - _0x29d35d) + "s）"
      });
      return true;
    } else {
      this.progress.clearPending();
      this.host.log("服务器持续未返回任务 " + (_0x4f915b.storyId || _0x4f915b.kind) + "，已清除待确认记录且不计入完成次数");
      return true;
    }
  }
  async handleStory(_0x513e75, _0x280fde, _0x5da50d) {
    let _0x4068dc = this.progress.snapshot().pending;
    if (_0x5da50d.storyId) {
      if (_0x5da50d.finished && (this.progress.storyWasSettled(_0x5da50d.storyId) || this.progress.storyWasDismissed(_0x5da50d.storyId))) {
        return this.handleMissingPending(_0x280fde, _0x4068dc);
      }
      const _0x2c9b8e = this.storyKind(_0x5da50d.storyId);
      const _0x3d2c3d = !!_0x4068dc && (_0x4068dc.storyId !== _0x5da50d.storyId || !!_0x2c9b8e && _0x4068dc.kind !== _0x2c9b8e);
      if (!_0x4068dc || !_0x4068dc.confirmed || _0x3d2c3d) {
        if (_0x3d2c3d) {
          this.host.log("本地待处理任务 " + (_0x4068dc?.storyId || _0x4068dc?.kind) + " 与服务器 " + _0x5da50d.storyId + " 不一致，已按服务器状态恢复");
        }
        if (_0x2c9b8e) {
          this.progress.setPending(_0x2c9b8e, _0x5da50d.storyId);
        } else {
          this.progress.clearPending();
        }
        _0x4068dc = this.progress.snapshot().pending;
        if (_0x2c9b8e && !_0x3d2c3d) {
          this.host.log("已恢复进行中的" + _0x2c9b8e + "任务");
        }
      } else {
        this.progress.markPendingSeen();
        _0x4068dc = this.progress.snapshot().pending;
      }
      if (_0x5da50d.finished) {
        if (await this.blocked(_0x280fde, "结算任务")) {
          return true;
        }
        const _0x170137 = "settle:" + _0x5da50d.storyId;
        if (this.progress.activeBlock(_0x170137)) {
          return true;
        }
        try {
          await _0x513e75.settleStory(_0x5da50d.storyId);
          this.progress.markStorySettled(_0x5da50d.storyId);
          if (_0x4068dc?.kind === "school" && _0x280fde.schoolRotationEnabled) {
            this.progress.advanceSchoolRotation(_0x280fde.schoolRotationEvery);
          } else if (_0x4068dc) {
            this.progress.increment(_0x4068dc.kind);
          }
          this.progress.clearPending();
          this.progress.clearBlock(_0x170137);
          this.host.log("任务已结算并记录：" + _0x5da50d.storyId);
        } catch (_0x4c4035) {
          if (Wt(_0x4c4035)) {
            this.progress.dismissStory(_0x5da50d.storyId);
            if (_0x4068dc?.storyId === _0x5da50d.storyId) {
              this.progress.clearPending();
            }
            this.progress.clearBlock(_0x170137);
            this.host.updateStatus({
              connected: true,
              error: null,
              story: lt(_0x5da50d, true),
              progress: this.progress.snapshot(),
              activity: "服务器残留任务已忽略，当前空闲"
            });
            this.host.log("服务器已拒绝结算残留任务，按空闲处理：" + _0x5da50d.storyId);
            return true;
          }
          this.progress.setBlock(_0x170137, String(_0x4c4035), _0x280fde.settleRetrySeconds);
          throw _0x4c4035;
        }
        return true;
      }
      const _0x322664 = {
        activity: "任务进行中，剩余 " + _0x5da50d.remainingSeconds + "s"
      };
      this.host.updateStatus(_0x322664);
      return true;
    }
    return this.handleMissingPending(_0x280fde, _0x4068dc);
  }
  publish(_0x18a970, _0x433b67, _0xfdef97, _0x53aee6, _0x45534f, _0x613ed3) {
    this.petName = _0x18a970.name;
    const _0x1492da = this.progress.snapshot();
    const _0x11043b = this.progress.storyWasSettled(_0x53aee6.storyId) || this.progress.storyWasDismissed(_0x53aee6.storyId);
    const _0x128868 = lt(_0x53aee6, _0x11043b);
    const _0x108136 = {
      ..._0x45534f,
      ..._0x613ed3
    };
    this.host.updateStatus({
      connected: true,
      error: null,
      updatedAt: new Date().toISOString(),
      profile: _0x18a970,
      interactions: this.interactions,
      fatigue: _0x433b67,
      values: _0xfdef97,
      story: _0x128868,
      inventory: _0x108136,
      progress: _0x1492da,
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
        const _0x1e99b6 = await this.client();
        const [_0xcb3302, _0x43814a, _0x246ad1, _0x243b2c, _0x5970bf] = await Promise.all([this.queryProfile(_0x1e99b6), _0x1e99b6.queryValues(), _0x1e99b6.queryStory(), _0x1e99b6.queryFoodInventory(), _0x1e99b6.queryBathInventory()]);
        const _0xf91504 = await _0x1e99b6.queryFatigueStatus();
        this.progress.recordAttributes(_0x43814a);
        this.publish(_0xcb3302, _0xf91504, _0x43814a, _0x246ad1, _0x243b2c, _0x5970bf);
        this.host.updateStatus({
          activity: "状态已刷新"
        });
      } finally {
        this.busy = false;
      }
    }
  }
  async catalogs() {
    const _0x5d8931 = await this.client();
    const [_0x572af9, _0x49562e, _0xb0e90f, _0x1f2857] = await Promise.all([_0x5d8931.querySchoolStage(), _0x5d8931.queryWorkOverview(), _0x5d8931.queryAdventureOptions(), _0x5d8931.queryBathItems()]);
    const [_0x577638, _0x333eeb] = await Promise.all([_0x5d8931.querySchoolCourses(_0x572af9), Promise.all(_0x49562e.careers.map(async _0x41911e => ({
      ..._0x41911e,
      jobs: _0x41911e.available ? await _0x5d8931.queryWorkJobs(_0x41911e.careerType) : []
    })))]);
    const _0x380161 = {
      currentCareerType: _0x49562e.currentCareerType,
      lastSubEventType: _0x49562e.lastSubEventType
    };
    const _0x10aa3c = {
      stage: _0x572af9,
      courses: _0x577638,
      careers: _0x333eeb,
      workOverview: _0x380161,
      adventures: _0xb0e90f,
      bathItems: _0x1f2857
    };
    return _0x10aa3c;
  }
  async runOnce() {
    if (this.busy) {
      return null;
    }
    this.busy = true;
    try {
      const _0x39fe9c = this.host.getConfig();
      if (!_0x39fe9c.enabled) {
        return null;
      }
      if (this.progress.rollover()) {
        this.host.log("检测到新的一天，今日计数已清零");
      }
      this.host.updateStatus({
        activity: "正在检查宠物状态"
      });
      const _0x430911 = await this.client();
      let [_0x594798, _0x30f9e2, _0x9051f9, _0x57cc78, _0x28be8a] = await Promise.all([this.queryProfile(_0x430911), _0x430911.queryValues(), _0x430911.queryStory(), _0x430911.queryFoodInventory(), _0x430911.queryBathInventory()]);
      const _0x1baab7 = await _0x430911.queryFatigueStatus();
      this.progress.recordAttributes(_0x30f9e2);
      this.publish(_0x594798, _0x1baab7, _0x30f9e2, _0x9051f9, _0x57cc78, _0x28be8a);
      this.host.log("状态：金币 " + _0x30f9e2.gold.toFixed(0) + "，心情 " + _0x30f9e2.feel.toFixed(0) + "，体力 " + _0x30f9e2.hunger.toFixed(0) + "，清洁 " + _0x30f9e2.clean.toFixed(0));
      if (_0x9051f9.finished && (await this.handleStory(_0x430911, _0x39fe9c, _0x9051f9))) {
        return "story";
      }
      if (_0x39fe9c.careEnabled && _0x30f9e2.hunger < _0x39fe9c.hungerThreshold && !this.progress.activeBlock("feed") && !(await this.blocked(_0x39fe9c, "喂食"))) {
        try {
          if (_0x57cc78.biscuits <= 0) {
            if (!_0x39fe9c.autoBuySupplies) {
              this.progress.setBlock("feed", "饼干不足且自动购买已关闭", _0x39fe9c.failureCooldownSeconds);
              return "feed_unavailable";
            }
            await _0x430911.buyFood(_0x39fe9c.foodPurchaseCount);
            _0x57cc78 = await _0x430911.queryFoodInventory();
            if (_0x57cc78.biscuits <= 0) {
              throw new QQPetError("购买饼干后库存仍为空");
            }
          }
          await _0x430911.feed();
          await delaySeconds(_0x39fe9c.verifyDelaySeconds);
          const _0x38a671 = await _0x430911.queryValues();
          if (_0x38a671.hunger <= _0x30f9e2.hunger) {
            throw new QQPetError("喂食后体力未增加");
          }
          this.progress.increment("feed");
          this.progress.clearBlock("feed");
          this.host.log("自动喂食成功：" + _0x30f9e2.hunger.toFixed(0) + "→" + _0x38a671.hunger.toFixed(0));
        } catch (_0xf5cc84) {
          this.progress.setBlock("feed", _0xf5cc84 instanceof Error ? _0xf5cc84.message : String(_0xf5cc84), _0x39fe9c.failureCooldownSeconds);
          throw _0xf5cc84;
        }
        return "feed";
      }
      if (_0x39fe9c.careEnabled && _0x30f9e2.clean < _0x39fe9c.cleanThreshold && !this.progress.activeBlock("wash") && !(await this.blocked(_0x39fe9c, "洗澡"))) {
        try {
          let _0x5ea003 = _0x28be8a.bathBall > 0 ? "2" : "1";
          if ((_0x5ea003 === "2" ? _0x28be8a.bathBall : _0x28be8a.soap) <= 0) {
            if (!_0x39fe9c.autoBuySupplies) {
              this.progress.setBlock("wash", "洗护用品不足且自动购买已关闭", _0x39fe9c.failureCooldownSeconds);
              return "wash_unavailable";
            }
            _0x5ea003 = "2";
            await _0x430911.buyBathItem(_0x5ea003, _0x39fe9c.bathPurchaseCount);
          }
          await _0x430911.useBathItem(_0x5ea003);
          await delaySeconds(_0x39fe9c.verifyDelaySeconds);
          const _0x8785f6 = await _0x430911.queryValues();
          if (_0x8785f6.clean <= _0x30f9e2.clean) {
            throw new QQPetError("洗澡后清洁值未增加");
          }
          this.progress.increment("wash");
          this.progress.clearBlock("wash");
          this.host.log("自动洗澡成功：" + _0x30f9e2.clean.toFixed(0) + "→" + _0x8785f6.clean.toFixed(0));
        } catch (_0x12c848) {
          this.progress.setBlock("wash", _0x12c848 instanceof Error ? _0x12c848.message : String(_0x12c848), _0x39fe9c.failureCooldownSeconds);
          throw _0x12c848;
        }
        return "wash";
      }
      if (await this.maybeVisit(_0x430911, _0x39fe9c, _0x57cc78, _0x28be8a)) {
        return "visit";
      }
      if (await this.handleStory(_0x430911, _0x39fe9c, _0x9051f9)) {
        return "story";
      }
      const _0x346a12 = zt(_0x39fe9c, _0x1baab7);
      if (_0x346a12 === "rest") {
        const _0xefab87 = _0x1baab7.tier === 12 ? "12 小时" : "8 小时";
        const _0x40e1bc = {
          activity: "疲劳休息：已进入 " + _0xefab87 + "档"
        };
        this.host.updateStatus(_0x40e1bc);
        return "fatigue_rest";
      }
      const _0xf86e90 = _0x346a12 ?? this.decide(_0x39fe9c, _0x30f9e2);
      if (!_0xf86e90) {
        this.host.updateStatus({
          activity: "空闲：今日任务已完成"
        });
        return null;
      }
      if (await this.blocked(_0x39fe9c, _0xf86e90 === "school" ? "学习" : _0xf86e90 === "work" ? "打工" : "冒险")) {
        return _0xf86e90;
      }
      if (_0xf86e90 === "school") {
        const _0x112bce = jt(_0x39fe9c, this.progress.snapshot().schoolRotationIndex);
        const _0x1b70eb = _0x39fe9c.schoolRotationEnabled ? 0 : _0x39fe9c.courseSubEvent;
        const _0x37c31b = await _0x430911.startSchool(_0x112bce, _0x1b70eb);
        this.progress.setPending("school", _0x37c31b.storyId);
        const _0x22662f = {
          physical: "力量",
          culture: "智力",
          art: "魅力"
        }[_0x112bce];
        this.host.log("已开始" + _0x22662f + "学习“" + _0x37c31b.item.name + "”" + (_0x37c31b.storyId ? "，storyId=" + _0x37c31b.storyId : ""));
      } else if (_0xf86e90 === "work") {
        const _0x59f8f3 = _0x39fe9c.employFriend ? await this.findEmployableFriend(_0x430911, _0x39fe9c) : null;
        const _0x201e9f = await _0x430911.startWork(_0x39fe9c.workCareerType, _0x59f8f3?.jobSubEvent ?? _0x39fe9c.workJobSubEvent, _0x59f8f3 ? {
          uin: _0x59f8f3.target.uin,
          petId: _0x59f8f3.target.petId
        } : undefined);
        this.progress.setPending("work", _0x201e9f.storyId);
        const _0x29e7d1 = _0x201e9f.hiredFriend && _0x59f8f3 ? "，已雇佣好友" + this.targetLabel(_0x59f8f3.target) + "（加成 " + (_0x59f8f3.bonus >= 0 ? "+" : "") + _0x59f8f3.bonus + "）" : "";
        this.host.log("已开始打工“" + _0x201e9f.item.name + "”" + _0x29e7d1 + (_0x201e9f.storyId ? "，storyId=" + _0x201e9f.storyId : ""));
      } else {
        const _0x79f782 = await _0x430911.startAdventure(_0x39fe9c.adventureOption);
        this.progress.setPending("adventure", _0x79f782.storyId);
        this.host.log("已开始冒险“" + _0x79f782.item.name + "”" + (_0x79f782.storyId ? "，storyId=" + _0x79f782.storyId : ""));
      }
      return _0xf86e90;
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
  constructor(_0x2c969f = "OneBot") {
    this.runtimeName = _0x2c969f;
    this.status.activity = "等待 " + _0x2c969f + " 登录";
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
    const _0x518b45 = {
      ...this.configValue
    };
    return _0x518b45;
  }
  accountStatus() {
    const _0x542782 = !["", "AUTO", "YOUR_PET_ID"].includes(this.configValue.petId.trim().toUpperCase());
    const _0x3a6019 = {
      uin: this.uin,
      petId: _0x542782 ? this.configValue.petId : "",
      petIdReady: _0x542782,
      petName: this.status.account.petName
    };
    return _0x3a6019;
  }
  async init(_0x5d2a0f) {
    const _0x22e77a = {
      recursive: true
    };
    this.context = _0x5d2a0f;
    fs.mkdirSync(_0x5d2a0f.dataPath, _0x22e77a);
    this.loadConfig();
    try {
      const _0x5f36e1 = await _0x5d2a0f.actions.call("get_login_info", {}, _0x5d2a0f.adapterName, _0x5d2a0f.pluginManager.config);
      this.uin = String(_0x5f36e1?.user_id ?? "");
    } catch (_0x4efde7) {
      this.log("暂未取得当前 QQ：" + String(_0x4efde7));
    }
    const _0x4c46e8 = new ProgressStore(path.join(_0x5d2a0f.dataPath, "daily-progress.json"));
    this.scheduler = new AutomationController(this, _0x4c46e8);
    this.updateStatus({
      account: this.accountStatus(),
      config: this.getConfig(),
      progress: _0x4c46e8.snapshot()
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
      const _0x242170 = {
        ...DEFAULT_CONFIG
      };
      this.configValue = _0x242170;
      this.saveConfig();
    }
  }
  saveConfig() {
    const _0x211091 = {
      recursive: true
    };
    if (this.context) {
      fs.mkdirSync(path.dirname(this.context.configPath), _0x211091);
      fs.writeFileSync(this.context.configPath, JSON.stringify(this.configValue, null, 2) + "\n", "utf8");
    }
  }
  updateConfig(_0x39eae8) {
    const _0x409a31 = this.configValue;
    this.configValue = normalizeConfig({
      ...this.configValue,
      ..._0x39eae8
    });
    const _0x4cdf5a = ["visitEnabled", "visitFriends", "visitStrangers", "visitAutoCare", "visitMaxPerDay", "visitDelayMinMinutes", "visitDelayMaxMinutes", "otherCareDailyExperienceLimit", "visitCandidateScanLimit", "visitStrangerGroupIds"];
    if (this.scheduler && _0x4cdf5a.some(_0x1bab6c => _0x409a31[_0x1bab6c] !== this.configValue[_0x1bab6c])) {
      this.scheduler.progress.clearBlock("visit");
    }
    this.saveConfig();
    this.updateStatus({
      config: this.getConfig(),
      account: this.accountStatus()
    });
    if (this.scheduler && _0x409a31.intervalSeconds !== this.configValue.intervalSeconds && this.scheduler.running) {
      this.scheduler.stop();
      this.scheduler.start();
    }
    if (this.scheduler && _0x409a31.enabled !== this.configValue.enabled) {
      if (this.configValue.enabled && this.configValue.autoStart) {
        this.scheduler.start();
      } else if (!this.configValue.enabled) {
        this.scheduler.stop();
      }
    }
  }
  replaceConfig(_0x2eba0d) {
    this.updateConfig(normalizeConfig(_0x2eba0d));
  }
  log(_0x13ed9b) {
    const _0x14e65f = {
      hour12: false
    };
    const _0x58a3dd = Date.now();
    const _0x4d9db9 = new Date(_0x58a3dd).toLocaleTimeString("zh-CN", _0x14e65f);
    const _0x26e836 = this.logTimes.get(_0x13ed9b) ?? 0;
    if (_0x58a3dd - _0x26e836 < 600000) {
      const _0x5ec432 = (this.logCounts.get(_0x13ed9b) ?? 1) + 1;
      this.logCounts.set(_0x13ed9b, _0x5ec432);
      this.logTimes.set(_0x13ed9b, _0x58a3dd);
      const _0x3af87f = "] " + _0x13ed9b;
      const _0x1290fc = this.logLines.findLastIndex(_0x3ee9a2 => _0x3ee9a2.includes(_0x3af87f));
      if (_0x1290fc >= 0) {
        this.logLines.splice(_0x1290fc, 1);
      }
      this.logLines.push("[" + _0x4d9db9 + "] " + _0x13ed9b + "（共 " + _0x5ec432 + " 次）");
      return;
    }
    this.logCounts.set(_0x13ed9b, 1);
    this.logTimes.set(_0x13ed9b, _0x58a3dd);
    const _0x471308 = "[" + _0x4d9db9 + "] " + _0x13ed9b;
    this.logLines.push(_0x471308);
    this.logLines = this.logLines.slice(-120);
    this.context?.logger.info(_0x13ed9b);
  }
  updateStatus(_0x5a9382) {
    this.status = {
      ...this.status,
      ..._0x5a9382
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
  constructor(_0x565841, _0x38e3d1) {
    this.client = _0x565841;
    this.version = _0x38e3d1;
  }
  call(_0x28f8d4, _0x2db614 = {}) {
    return this.client.call(_0x28f8d4, _0x2db614);
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
function detectRuntimeKind(_0x508039) {
  const _0x2f7505 = String(_0x508039.app_name ?? "").toLowerCase();
  if (_0x2f7505.includes("snowluma")) {
    return "snowluma";
  } else if (_0x2f7505.includes("napcat")) {
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
  const _0x523e9b = _0x106347 => {
    if (!writeFailureReported) {
      writeFailureReported = true;
      process.stderr.write("[QQPet] 本地日志写入失败：" + formatLogError(_0x106347) + "\n");
    }
  };
  const _0x1a038a = _0x18b50b => {
    let _0xdc2e88 = 0;
    try {
      _0xdc2e88 = fs.statSync(logPath).size;
    } catch (_0x3d21d7) {
      if (_0x3d21d7.code !== "ENOENT") {
        throw _0x3d21d7;
      }
    }
    if (_0xdc2e88 + _0x18b50b <= maxBytes) {
      return;
    }
    const _0x142c5e = logPath + "." + backups;
    if (fs.existsSync(_0x142c5e)) {
      fs.unlinkSync(_0x142c5e);
    }
    for (let _0x5c64cd = backups - 1; _0x5c64cd >= 1; _0x5c64cd -= 1) {
      const _0x5cd777 = logPath + "." + _0x5c64cd;
      if (fs.existsSync(_0x5cd777)) {
        fs.renameSync(_0x5cd777, logPath + "." + (_0x5c64cd + 1));
      }
    }
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, logPath + ".1");
    }
  };
  const _0xce22d0 = (_0x527ccd, _0x5244ba, _0x14ef7b) => {
    const _0x3b0770 = _0x14ef7b.length ? " " + _0x14ef7b.map(formatLogError).join(" ") : "";
    const _0x300d1f = "[" + now().toISOString() + "] [" + _0x527ccd + "] " + formatLogError(_0x5244ba) + _0x3b0770 + "\n";
    process.stdout.write(_0x300d1f);
    try {
      const _0x3eb8a2 = {
        recursive: true,
        mode: 448
      };
      fs.mkdirSync(logDir, _0x3eb8a2);
      _0x1a038a(Buffer.byteLength(_0x300d1f));
      fs.appendFileSync(logPath, _0x300d1f, {
        encoding: "utf8",
        mode: 384
      });
      try {
        fs.chmodSync(logPath, 384);
      } catch {}
    } catch (_0x503cf9) {
      _0x523e9b(_0x503cf9);
    }
  };
  return {
    filePath: logPath,
    debug: (_0x5610f1, ..._0x1d1af6) => _0xce22d0("DEBUG", _0x5610f1, _0x1d1af6),
    info: (_0x36dd42, ..._0x42aa17) => _0xce22d0("INFO", _0x36dd42, _0x42aa17),
    warn: (_0x22ea48, ..._0x474873) => _0xce22d0("WARN", _0x22ea48, _0x474873),
    error: (_0xa05da1, ..._0x5b67fd) => _0xce22d0("ERROR", _0xa05da1, _0x5b67fd)
  };
}
class OneBotError extends Error {
  constructor(_0x10eb3c, _0x3e3f35, _0x13c9c9 = 0, _0x37c8d2 = -1) {
    super(_0x10eb3c);
    this.action = _0x3e3f35;
    this.httpStatus = _0x13c9c9;
    this.retcode = _0x37c8d2;
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
    const _0x526cd9 = {
      code: -1,
      message: "文件不存在"
    };
    sendJson(response, 404, _0x526cd9);
    return;
  }
  if (!stat.isFile()) {
    const _0x44fcd4 = {
      code: -1,
      message: "文件不存在"
    };
    sendJson(response, 404, _0x44fcd4);
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
        const _0x1702b8 = {
          status: "ok",
          runtime: options.runtimeKind,
          uin: options.uin
        };
        sendJson(response, 200, _0x1702b8);
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
          const _0x260f57 = {
            code: -1,
            message: "静态文件路径无效"
          };
          sendJson(response, 400, _0x260f57);
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
        const _0x24248a = await plugin.scheduler?.runOnce();
        sendJson(response, 200, {
          code: 0,
          data: {
            action: _0x24248a,
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
      const _0x4fd47e = {
        code: -1,
        message: "接口不存在"
      };
      sendJson(response, 404, _0x4fd47e);
    } catch (_0x57a538) {
      const _0xdb6dbc = _0x57a538 instanceof Error ? _0x57a538.message : String(_0x57a538);
      sendJson(response, _0xdb6dbc === "请求体过大" ? 413 : 500, {
        code: -1,
        message: _0xdb6dbc
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
  const _0x783e1d = {
    recursive: true
  };
  fs.mkdirSync(accountDataDir, _0x783e1d);
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
    const _0x5f25ee = {
      type: "stopping",
      pid: process.pid
    };
    if (!stopping) {
      stopping = true;
      sendDesktopEvent(_0x5f25ee);
      plugin.cleanup();
      await new Promise(_0x5b215f => server.close(() => _0x5b215f()));
      sendDesktopEvent({
        type: "stopped",
        pid: process.pid
      });
    }
  };
  const _0x7390f0 = {
    input: process.stdin,
    terminal: false
  };
  if (isDesktopMode()) {
    readline.createInterface(_0x7390f0).on("line", _0x314077 => {
      try {
        if (JSON.parse(_0x314077).command === "shutdown") {
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
