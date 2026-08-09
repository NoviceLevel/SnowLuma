import { describe, expect, it } from 'vitest';
import { normalizeBridgeErrorMessage } from '../src/bridge/error-messages';

describe('bridge error messages', () => {
  it('translates known QQ pet errors by command and code', () => {
    expect(normalizeBridgeErrorMessage('OidbSvcTrpcTcp.0x9ab2_1', 135061, '乱码')).toBe('你的宠物还未达到该职业参与要求');
    expect(normalizeBridgeErrorMessage('OidbSvcTrpcTcp.0x976c_0', 1000100, '')).toBe('用户没有宠物');
  });

  it('preserves unknown messages', () => {
    expect(normalizeBridgeErrorMessage('Other', 1, '原始消息')).toBe('原始消息');
  });
});
