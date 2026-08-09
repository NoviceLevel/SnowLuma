/** Operator-facing translations for QQ protocol errors that are commonly
 * returned without a useful text message. Keys include the command so an
 * error code reused by another endpoint is not mislabelled. */
export const BRIDGE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'OidbSvcTrpcTcp.0x976c_0:1000100': '用户没有宠物',
  'OidbSvcTrpcTcp.0x9ab2_1:135061': '你的宠物还未达到该职业参与要求',
};

export function normalizeBridgeErrorMessage(
  serviceCmd: string,
  errorCode: number,
  message: unknown,
): string {
  const key = `${serviceCmd}:${errorCode}`;
  return BRIDGE_ERROR_MESSAGES[key] ?? String(message ?? '');
}
