const embedded = window.self !== window.top;
if (embedded) window.open(location.href, 'qqpet-dashboard');

const API = window.__QQPET_API_BASE__ || '/api';
const $ = (id) => document.getElementById(id);
const baseDocumentTitle = 'Miku QQ 宠物';
let latestConfig = {};
let latestState = {};
let automationRunning = false;
let formDirty = false;
let savingConfig = false;
let pendingSave = false;
let catalogsLoading = false;
let initialCatalogLoaded = false;
let statusTicket = 0;
let timer;
let saveTimer;
let storyCountdownTimer;
let bootstrapped = false;
let storyCountdown = { storyId: '', remainingSeconds: 0, durationSeconds: 0, syncedAt: 0, finished: false };
const AUTO_SAVE_DELAY_MS = 400;

async function request(path, method = 'GET', body) {
  const token = window.__QQPET_API_TOKEN__ || '';
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API + path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || `HTTP ${response.status}`);
  return payload.data;
}

function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function toast(message, variant = 'success') {
  dispatch('miku:toast', { message, variant });
}

function showError(message) {
  dispatch('miku:error', String(message || ''));
}

function duration(seconds) {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours}小时${String(minutes).padStart(2, '0')}分${String(rest).padStart(2, '0')}秒`
    : minutes > 0 ? `${minutes}分${String(rest).padStart(2, '0')}秒`
      : `${rest}秒`;
}

function storyType(story) {
  const prefix = String(story?.storyId || '').split('_', 1)[0];
  if (prefix === '6100') return '学习';
  if (prefix === '6400') return story.recallable ? '被雇佣打工' : '打工';
  if (prefix === '6700') return '冒险';
  return prefix ? `未知任务（${prefix}）` : '空闲';
}

function titleClock(seconds) {
  const value = Math.max(0, Math.trunc(Number(seconds) || 0));
  return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function updateDocumentTitle() {
  const account = latestState.account || {};
  const accountLabel = account.uin ? `QQ${String(account.uin).slice(-4)}` : '';
  const story = latestState.story || {};
  let activity;
  if (story.storyId && !story.finished) {
    const elapsed = Math.max(0, Math.floor((Date.now() - storyCountdown.syncedAt) / 1000));
    activity = `${storyType(story)} ${titleClock(storyCountdown.remainingSeconds - elapsed)}`;
  } else if (!latestState.connected) {
    activity = '等待登录';
  } else {
    activity = latestState.automationRunning ? '自动托管运行中' : '空闲';
  }
  document.title = [activity, accountLabel].filter(Boolean).join(' · ') || baseDocumentTitle;
}

function syncStoryCountdown(story) {
  storyCountdown = {
    storyId: String(story?.storyId || ''),
    remainingSeconds: Math.max(0, Number(story?.remainingSeconds) || 0),
    durationSeconds: Math.max(0, Number(story?.durationSeconds) || 0),
    syncedAt: Date.now(),
    finished: Boolean(story?.finished),
  };
  updateDocumentTitle();
}

function fillForm(config, force = false) {
  latestConfig = config;
  if (!formDirty || force) dispatch('miku:config', config);
}

function applyControlState() {
  $('start')?.removeAttribute('disabled');
}

async function saveConfig() {
  if (savingConfig) {
    pendingSave = true;
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = undefined;
  savingConfig = true;
  statusTicket += 1;
  dispatch('miku:form-saving');
  try {
    latestConfig = await request('/config', 'PUT', readForm());
    formDirty = false;
    fillForm(latestConfig, true);
    dispatch('miku:form-saved');
    scheduleStatusRefresh();
  } catch (error) {
    showError(error.message);
    dispatch('miku:form-save-error', String(error.message || ''));
  } finally {
    statusTicket += 1;
    savingConfig = false;
    if (pendingSave || formDirty) {
      pendingSave = false;
      void saveConfig();
    }
  }
}

function scheduleAutoSave() {
  formDirty = true;
  dispatch('miku:form-dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveConfig();
  }, AUTO_SAVE_DELAY_MS);
}

function flushAutoSave() {
  if (!formDirty && !pendingSave && !savingConfig) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const token = window.__QQPET_API_TOKEN__ || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    void fetch(API + '/config', {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify(readForm()),
      keepalive: true,
    });
    formDirty = false;
    pendingSave = false;
  } catch {
    // best-effort on unload
  }
}

function render(state) {
  latestState = state;
  automationRunning = Boolean(state.automationRunning);
  syncStoryCountdown(state.story || {});
  fillForm(state.config || {});
  dispatch('miku:state', state);
  applyControlState();
}

async function load() {
  const ticket = ++statusTicket;
  try {
    const state = await request('/status');
    if (ticket !== statusTicket || savingConfig) return;
    render(state);
    if (!initialCatalogLoaded) {
      initialCatalogLoaded = true;
      void loadCatalogs(true);
    }
  } catch (error) {
    if (ticket === statusTicket && !savingConfig) showError(error.message);
  }
}

function scheduleStatusRefresh() {
  clearTimeout(timer);
  const period = Math.max(3, Math.min(300, Math.trunc(Number(latestConfig.intervalSeconds) || 15))) * 1000;
  const updatedAt = Date.parse(latestState.updatedAt || '');
  const untilNext = Number.isFinite(updatedAt) ? updatedAt + period - Date.now() + 250 : period;
  timer = setTimeout(async () => {
    await load();
    scheduleStatusRefresh();
  }, Math.max(750, Math.min(period, untilNext)));
}

async function act(path, message) {
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    const data = await request(path, 'POST');
    toast(typeof message === 'function' ? message(data) : message);
    await load();
  } catch (error) {
    showError(error.message);
  } finally {
    document.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    applyControlState();
  }
}

function readForm() {
  return { ...latestConfig, ...(window.__MIKU_READ_FORM__?.() || {}) };
}

async function loadCatalogs(silent = false) {
  if (catalogsLoading) return;
  catalogsLoading = true;
  try {
    const data = await request('/catalogs', 'POST');
    dispatch('miku:catalogs', data);
    if (!silent) {
      const jobs = (data.careers || []).flatMap((career) => career.jobs || []);
      toast(`已刷新目录：${data.courses?.length || 0} 门课程，${jobs.length} 个岗位`);
    }
  } catch (error) {
    if (!silent) showError(error.message);
  } finally {
    catalogsLoading = false;
  }
}

function bootstrap() {
  if (bootstrapped || !$('settings')) return;
  bootstrapped = true;
  $('start').onclick = () => {
    if (!automationRunning && !latestConfig.safeMode && !window.confirm('当前将允许自动托管发送写请求，确认启动？')) return;
    void act(automationRunning ? '/automation/stop' : '/automation/start', automationRunning ? '自动托管已停止' : '自动托管已启动');
  };
  $('refresh').onclick = () => void act('/refresh', '状态已刷新');
  $('once').onclick = () => {
    if (window.confirm('执行一轮自动化检查？安全模式下不会发送写请求。')) void act('/run-once', (data) => data?.action ? `本轮执行完成：${data.action}` : '检查完成，当前没有可执行动作');
  };
  window.addEventListener('miku:form-change', () => { scheduleAutoSave(); });
  storyCountdownTimer = setInterval(updateDocumentTitle, 1000);
  load().then(scheduleStatusRefresh);
  window.addEventListener('beforeunload', () => {
    clearTimeout(timer);
    clearInterval(storyCountdownTimer);
    flushAutoSave();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (formDirty || pendingSave)) {
      clearTimeout(saveTimer);
      void saveConfig();
    }
  });
}

if ($('settings')) bootstrap();
else window.addEventListener('miku:ui-ready', bootstrap, { once: true });
