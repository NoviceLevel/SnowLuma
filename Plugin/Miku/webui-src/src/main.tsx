import { Badge } from '@cloudflare/kumo/components/badge';
import { Button, LinkButton } from '@cloudflare/kumo/components/button';
import { Dialog, DialogClose, DialogDescription, DialogRoot, DialogTitle, DialogTrigger } from '@cloudflare/kumo/components/dialog';
import { Grid, GridItem } from '@cloudflare/kumo/components/grid';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Select } from '@cloudflare/kumo/components/select';
import { Surface } from '@cloudflare/kumo/components/surface';
import { Switch } from '@cloudflare/kumo/components/switch';
import { Table } from '@cloudflare/kumo/components/table';
import { Text } from '@cloudflare/kumo/components/text';
import { Tabs } from '@cloudflare/kumo/components/tabs';
import { Toasty, createKumoToastManager } from '@cloudflare/kumo/components/toast';
import { Toolbar } from '@cloudflare/kumo/components/toolbar';
import './styles.css';
import {
  ArrowClockwise,
  Eye,
  EyeSlash,
  FloppyDisk,
  GithubLogo,
  Play,
  Power,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { Children, StrictMode, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type AnyRecord = Record<string, any>;
type Config = Record<string, string | number | boolean | null | undefined>;
type CatalogOption = AnyRecord & { name?: string; subEventType?: string | number; canDo?: boolean };
type Catalogs = {
  courses: CatalogOption[];
  careers: Array<CatalogOption & { jobs?: CatalogOption[] }>;
  adventures: CatalogOption[];
  bathItems: CatalogOption[];
};

declare global {
  interface Window {
    __MIKU_READ_FORM__?: () => Config;
  }
}

const toastManager = createKumoToastManager();
const emptyCatalogs: Catalogs = { courses: [], careers: [], adventures: [], bathItems: [] };
const numericFields = new Set([
  'intervalSeconds', 'coinThreshold', 'hungerThreshold', 'cleanThreshold', 'foodPurchaseCount',
  'bathPurchaseCount', 'schoolRotationEvery', 'courseSubEvent', 'visitMaxPerDay',
  'visitDelayMinMinutes', 'visitDelayMaxMinutes', 'otherCareDailyExperienceLimit',
  'visitCandidateScanLimit', 'workJobSubEvent', 'workTimesPerDay', 'workFriendScanLimit',
  'adventureTimesPerDay',
]);

const formatNumber = (value: unknown, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '--';
const mask = (value: unknown, start = 3, end = 3) => {
  const source = String(value ?? '');
  return source.length <= start + end ? source : `${source.slice(0, start)}${'•'.repeat(Math.min(6, source.length - start - end))}${source.slice(-end)}`;
};
const profileDate = (value: unknown) => {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000) : new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};
const storyType = (story: AnyRecord = {}) => ({ '6100': '学习', '6400': '打工', '6700': '冒险' })[String(story.storyId || '').split('_', 1)[0]] || '任务';
const duration = (seconds: unknown) => {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const secs = total % 60;
  return [hours ? `${hours}时` : '', minutes ? `${minutes}分` : '', `${secs}秒`].filter(Boolean).join('');
};
const compactLogs = (lines: unknown[] = []) => {
  const output: Array<{ line: string; count: number }> = [];
  const indexes = new Map<string, number>();
  for (const raw of lines) {
    const line = String(raw);
    const message = line.replace(/^\[[^\]]+\]\s*/, '').replace(/（(?:连续|共) \d+ 次）$/, '');
    const repeated = line.match(/（(?:连续|共) (\d+) 次）$/);
    const amount = repeated ? Number(repeated[1]) : 1;
    if (indexes.has(message)) {
      output[indexes.get(message)!].count += amount;
      continue;
    }
    indexes.set(message, output.length);
    output.push({ line: line.replace(/（(?:连续|共) \d+ 次）$/, ''), count: amount });
  }
  return output.slice(0, 60).map((item) => item.count > 1 ? `${item.line}（共 ${item.count} 次）` : item.line);
};

function SectionHeader({ title, description, badge }: { title: string; description?: string; badge?: React.ReactNode }) {
  return (
    <LayerCard.Secondary className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Text as="h2" variant="heading3">{title}</Text>
        {description ? <Text size="sm" variant="secondary">{description}</Text> : null}
      </div>
      {badge}
    </LayerCard.Secondary>
  );
}

function MetricCard({ label, value, detail, badge, icon }: { label: string; value: React.ReactNode; detail?: React.ReactNode; badge?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <LayerCard className="h-full min-w-0">
      <LayerCard.Primary className="flex h-full min-h-24 flex-col justify-between gap-2">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <Text size="xs" variant="secondary" truncate>{label}</Text>
          {badge || icon}
        </div>
        <Text as="span" variant="heading2">{value}</Text>
        {detail ? <Text size="xs" variant="secondary">{detail}</Text> : <span aria-hidden="true" className="h-4" />}
      </LayerCard.Primary>
    </LayerCard>
  );
}

function DefinitionList({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <Text as="dt" size="sm" variant="secondary">{label}</Text>
          <dd className="m-0 max-w-72 truncate text-right"><Text size="sm" bold>{value}</Text></dd>
        </div>
      ))}
    </dl>
  );
}

function CatalogPreview({ item, fallback }: { item?: CatalogOption; fallback: string }) {
  return (
    <div data-miku-wide className="flex items-center gap-3">
      {item?.iconUrl ? <img src={item.iconUrl} alt="" width="42" height="42" className="size-10 object-contain" /> : <Sparkle size={36} className="text-kumo-subtle" />}
      <div className="min-w-0">
        <div className="truncate"><Text bold>{item?.name || fallback}</Text></div>
        <div className="truncate"><Text size="xs" variant="secondary">{item ? [item.careerName, item.duration, item.reward].filter(Boolean).join(' · ') : '等待目录同步'}</Text></div>
      </div>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <LayerCard className="h-full">
      <LayerCard.Secondary><Text as="h3" variant="heading3">{title}</Text></LayerCard.Secondary>
      <LayerCard.Primary>
        <Grid variant="2up" gap="sm">
          {Children.toArray(children).map((child, index) => {
            const element = isValidElement<{ 'data-miku-wide'?: boolean }>(child) ? child : null;
            const wide = Boolean(element?.props['data-miku-wide']);
            return <GridItem key={element?.key ?? index} className={wide ? 'md:col-span-2' : undefined}>{child}</GridItem>;
          })}
        </Grid>
      </LayerCard.Primary>
    </LayerCard>
  );
}

function App() {
  const [state, setState] = useState<AnyRecord>({});
  const [config, setConfig] = useState<Config>({});
  const [catalogs, setCatalogs] = useState<Catalogs>(emptyCatalogs);
  const [dirty, setDirty] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [now, setNow] = useState(Date.now());
  const configRef = useRef(config);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => {
    window.__MIKU_READ_FORM__ = () => ({ ...configRef.current });
    const onState = (event: Event) => {
      const next = (event as CustomEvent<AnyRecord>).detail || {};
      setState(next);
      if (!dirty) setConfig(next.config || {});
    };
    const onConfig = (event: Event) => { setConfig((event as CustomEvent<Config>).detail || {}); setDirty(false); };
    const onCatalogs = (event: Event) => setCatalogs((event as CustomEvent<Catalogs>).detail || emptyCatalogs);
    const onSaved = () => setDirty(false);
    const onError = (event: Event) => setState((current) => ({ ...current, error: (event as CustomEvent<string>).detail }));
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }>).detail;
      if (detail?.message) toastManager.add({ title: detail.message, variant: detail.variant || 'success' });
    };
    window.addEventListener('miku:state', onState);
    window.addEventListener('miku:config', onConfig);
    window.addEventListener('miku:catalogs', onCatalogs);
    window.addEventListener('miku:form-saved', onSaved);
    window.addEventListener('miku:error', onError);
    window.addEventListener('miku:toast', onToast);
    window.dispatchEvent(new Event('miku:ui-ready'));
    return () => {
      delete window.__MIKU_READ_FORM__;
      window.removeEventListener('miku:state', onState);
      window.removeEventListener('miku:config', onConfig);
      window.removeEventListener('miku:catalogs', onCatalogs);
      window.removeEventListener('miku:form-saved', onSaved);
      window.removeEventListener('miku:error', onError);
      window.removeEventListener('miku:toast', onToast);
    };
  }, [dirty]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const setField = (name: string, value: string | boolean) => {
    const normalized = numericFields.has(name) ? Number(value) : value;
    setConfig((current) => ({ ...current, [name]: normalized }));
    setDirty(true);
    queueMicrotask(() => window.dispatchEvent(new CustomEvent('miku:form-change', { detail: { name, value: normalized } })));
  };
  const input = (name: string, label: string, type: 'text' | 'number' | 'time' = 'text', props: AnyRecord = {}) => (
    <Input
      name={name}
      label={label}
      type={type}
      value={String(config[name] ?? '')}
      onChange={(event) => setField(name, event.currentTarget.value)}
      {...props}
    />
  );
  const toggle = (name: string, label: string) => (
    <Switch name={name} label={label} checked={Boolean(config[name])} onCheckedChange={(checked) => setField(name, checked)} />
  );
  const select = (name: string, label: string, options: Array<[string, string]>, props: AnyRecord = {}) => (
    <Select
      name={name}
      label={label}
      value={String(config[name] ?? props.defaultValue ?? '')}
      onValueChange={(value) => value !== null && setField(name, String(value))}
      {...props}
    >
      {options.map(([value, text]) => <Select.Option key={value} value={value}>{text}</Select.Option>)}
    </Select>
  );

  const account = state.account || {};
  const values = state.values || {};
  const profile = state.profile || {};
  const progress = state.progress || {};
  const inventory = state.inventory || {};
  const story = state.story || {};
  const automationRunning = Boolean(state.automationRunning);
  const connected = Boolean(state.connected);
  const fatigueBenefitPercent = Number.isFinite(Number(state.fatigue?.benefitRate)) ? Math.round(Number(state.fatigue.benefitRate) * 100) : null;
  const jobs: CatalogOption[] = catalogs.careers.flatMap((career) => (career.jobs || []).map((job) => ({ ...job, careerName: job.careerName || career.name }) as CatalogOption));
  const order = ['physical', 'culture', 'art'];
  const valueKeys: AnyRecord = { physical: 'strength', culture: 'intelligence', art: 'charm' };
  const attributeNames: AnyRecord = { physical: '力量', culture: '智力', art: '魅力' };
  const base = Math.max(0, order.indexOf(String(config.schoolAttribute || 'physical')));
  const activeAttribute = config.schoolSelectionMode === 'lowest'
    ? [...order].sort((a, b) => Number(values[valueKeys[a]] ?? Number.MAX_SAFE_INTEGER) - Number(values[valueKeys[b]] ?? Number.MAX_SAFE_INTEGER))[0]
    : config.schoolSelectionMode === 'rotation'
      ? order[(base + Number(progress.schoolRotationIndex || 0)) % order.length]
      : String(config.schoolAttribute || 'physical');
  const rewardKeyword = attributeNames[activeAttribute];
  const rewardValue = (value: unknown) => Number(String(value || '').match(/\d+(?:\.\d+)?/g)?.at(-1) || 0);
  const durationSeconds = (value: unknown) => Number(String(value || '').match(/(\d+)\s*小时/)?.[1] || 0) * 3600 + Number(String(value || '').match(/(\d+)\s*分钟/)?.[1] || 0) * 60 + Number(String(value || '').match(/(\d+)\s*秒/)?.[1] || 0);
  const efficient = (items: CatalogOption[]) => [...items].sort((a, b) => rewardValue(b.reward) / Math.max(1, durationSeconds(b.duration)) - rewardValue(a.reward) / Math.max(1, durationSeconds(a.duration)));
  const selectedCourse = catalogs.courses.find((item) => String(item.subEventType) === String(config.courseSubEvent) && String(config.courseSubEvent) !== '0')
    || efficient(catalogs.courses.filter((item) => item.canDo && String(item.reward || '').includes(rewardKeyword)))[0]
    || catalogs.courses[0];
  const selectedJob = jobs.find((item) => String(item.subEventType) === String(config.workJobSubEvent) && String(config.workJobSubEvent) !== '0')
    || efficient(jobs.filter((item) => item.canDo))[0]
    || jobs[0];
  const selectedAdventure = catalogs.adventures.find((item) => item.name === config.adventureOption) || catalogs.adventures.find((item) => item.canDo) || catalogs.adventures[0];
  const expectedGain = (item: CatalogOption | undefined, attribute: string) => {
    const label = attributeNames[attribute];
    const match = label && String(item?.reward || '').match(new RegExp(`${label}\\s*\\+?([0-9]+(?:\\.[0-9]+)?)`));
    return match ? Number(match[1]) : null;
  };
  const pending = progress.pending?.kind && progress.pending.beforeValues ? progress.pending : null;
  const targetAttribute = pending?.kind === 'school' && pending.attribute ? pending.attribute : activeAttribute;
  const expectedItem = pending?.kind === 'school' && pending.item ? pending.item : selectedCourse;
  const telemetry = (progress.telemetry || []).filter((item: AnyRecord) => item?.status === 'settled').slice(-30).reverse();
  const telemetryItems = pending ? [{ ...pending, status: 'running', elapsedSeconds: Math.max(0, Math.round((now - Date.parse(pending.startedAt || pending.createdAt || new Date().toISOString())) / 1000)) }, ...telemetry] : telemetry;
  const totalGain = telemetry.reduce((sum: number, item: AnyRecord) => sum + Object.values(item.delta || {}).reduce((value: number, delta) => value + Math.max(0, Number(delta) || 0), 0), 0);
  const storyRemaining = story.storyId && !story.finished ? Math.max(0, Number(story.remainingSeconds || 0) - Math.max(0, Math.floor((now - Date.parse(state.updatedAt || new Date().toISOString())) / 1000))) : 0;
  const modeLabel = ({ lowest: '动态补最低属性', rotation: `每 ${config.schoolRotationEvery || 1} 次轮换`, fixed: '固定属性' } as AnyRecord)[String(config.schoolSelectionMode)] || String(config.schoolSelectionMode || '--');

  return (
    <Toasty toastManager={toastManager}>
      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 p-3">
        <LayerCard>
          <LayerCard.Primary className="flex flex-col gap-4 p-5 xl:flex-row">
            <DialogRoot>
              <DialogTrigger render={(props) => (
                <Button {...props} id="pet-portrait" variant="ghost" shape="square" aria-label="查看宠物高清立绘" className="relative size-24 shrink-0 overflow-hidden">
                  {profile.personalityUrl ? <img src={profile.personalityUrl} alt="" className="absolute inset-0 size-full object-contain opacity-60" /> : null}
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="当前宠物" referrerPolicy="no-referrer" className="relative size-20 object-contain" /> : <Sparkle size={44} />}
                </Button>
              )} />
              <Dialog className="max-w-2xl">
                <DialogTitle>{profile.name || '宠物高清立绘'}</DialogTitle>
                <DialogDescription>手机端高清宠物立绘</DialogDescription>
                {profile.fullAvatarUrl || profile.avatarUrl ? <img src={profile.fullAvatarUrl || profile.avatarUrl} alt="宠物高清立绘" referrerPolicy="no-referrer" className="mx-auto max-h-[70vh] max-w-full object-contain" /> : null}
                <DialogClose render={(props) => <Button {...props} variant="secondary" icon={<X />}>关闭</Button>} />
              </Dialog>
            </DialogRoot>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="purple">MIKU · ONEBOT QQ PET</Badge>
                <LinkButton href="https://github.com/wassamriehlei/onebot-qqpet" target="_blank" rel="noopener noreferrer" variant="ghost" size="sm" icon={<GithubLogo />}>上游项目</LinkButton>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <Text as="h1" variant="heading1">Miku QQ 宠物</Text>
                {account.petName ? <span className="text-kumo-brand"><Text as="span" variant="heading3">· {account.petName}</Text></span> : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="truncate"><Text size="sm" variant="secondary">
                  {account.uin ? `QQ ${accountVisible ? account.uin : mask(account.uin)} · Pet ID ${account.petIdReady ? accountVisible ? account.petId || '未知' : mask(account.petId, 4, 4) : '自动获取中'}` : '正在连接 OneBot…'}
                </Text></div>
                <Button variant="ghost" size="sm" shape="square" aria-label={accountVisible ? '隐藏完整账号信息' : '显示完整账号信息'} onClick={() => setAccountVisible((value) => !value)}>{accountVisible ? <EyeSlash /> : <Eye />}</Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="neutral">生日 {profileDate(profile.birthdayAt)}</Badge>
                <Badge variant="neutral">性别 {profile.gender || '--'}</Badge>
                <Badge variant="neutral">物种 {profile.species || '--'}</Badge>
                <Badge variant="neutral">性格 {profile.personality || '--'}</Badge>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2">
              <Badge variant={connected ? 'green' : 'orange'}>{connected ? '已连接' : '未连接'}</Badge>
              <Text size="xs" variant="secondary">{state.updatedAt ? `同步于 ${new Date(state.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '等待首次同步'}</Text>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <Tabs
          variant="underline"
          value={activeView}
          onValueChange={setActiveView}
          tabs={[
            { value: 'overview', label: '概览' },
            { value: 'settings', label: '托管设置' },
            { value: 'activity', label: '记录' },
          ]}
        />

        <section className="flex flex-col gap-3" aria-label="宠物状态" hidden={activeView !== 'overview'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text as="h2" variant="heading3">当前状态</Text>
            <Text size="xs" variant="secondary">同步数值</Text>
          </div>
          <Grid variant="6up" gap="sm">
            <GridItem><MetricCard label="金币" value={formatNumber(values.gold)} icon={selectedCourse?.rewardIconUrl ? <img src={selectedCourse.rewardIconUrl} alt="" className="size-5 object-contain" /> : undefined} /></GridItem>
            <GridItem><MetricCard label="心情" value={formatNumber(values.feel)} /></GridItem>
            <GridItem><MetricCard label="体力" value={formatNumber(values.hunger)} /></GridItem>
            <GridItem><MetricCard label="清洁" value={formatNumber(values.clean)} /></GridItem>
            <GridItem><MetricCard label="综合" value={formatNumber(values.total)} /></GridItem>
            <GridItem><MetricCard label="疲劳" value={state.fatigue?.fatigued === true ? '疲劳中' : state.fatigue?.fatigued === false ? '正常' : '未知'} detail={state.fatigue?.fatigued === true ? `任务收益下降至 ${fatigueBenefitPercent ?? '--'}% · ${state.fatigue.tier} 小时档` : undefined} /></GridItem>
          </Grid>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Text as="h2" variant="heading3">成长训练</Text>
            <Badge variant="purple">当前学习：{attributeNames[targetAttribute] || '--'}（{modeLabel}）</Badge>
          </div>
          <Grid variant="6up" gap="sm">
            {(['strength', 'intelligence', 'charm'] as const).map((key) => {
              const attribute = ({ strength: 'physical', intelligence: 'culture', charm: 'art' })[key];
              const isTrainingTarget = attribute === targetAttribute;
              const gain = isTrainingTarget ? expectedGain(expectedItem, targetAttribute) ?? 0 : 0;
              const label = ({ strength: '力量', intelligence: '智力', charm: '魅力' })[key];
              return <GridItem key={key}><MetricCard label={isTrainingTarget ? `${label} · 下次训练` : label} value={isTrainingTarget ? `${gain >= 0 ? '+' : ''}${formatNumber(gain)}` : formatNumber(values[key])} detail={isTrainingTarget ? `当前 ${formatNumber(values[key])}` : '本次不训练'} badge={<Badge variant={({ strength: 'red', intelligence: 'blue', charm: 'orange' } as const)[key]}>{({ strength: '力', intelligence: '智', charm: '魅' })[key]}</Badge>} /></GridItem>;
            })}
            <GridItem><MetricCard label="经验" value={profile.levelExperience ? `${formatNumber(profile.currentExperience)} / ${formatNumber(profile.levelExperience)}` : formatNumber(profile.currentExperience)} detail={profile.experienceRate ? `成长倍率 ×${formatNumber(profile.experienceRate, 1)}` : undefined} /></GridItem>
            <GridItem><MetricCard label="等级" value={profile.level ? `Lv.${profile.level}` : '--'} detail={profile.levelExperience ? `升级还需 ${Math.max(0, Number(profile.levelExperience) - Number(profile.currentExperience || 0))}` : undefined} /></GridItem>
            <GridItem><MetricCard label="今日经验" value={formatNumber(progress.dailyExperienceGain)} detail="今日累计获取" /></GridItem>
          </Grid>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-4" hidden={activeView !== 'overview'}>
          <LayerCard>
            <SectionHeader title="自动托管" description="按当前设置自动照顾宠物并执行任务" badge={<Badge variant={automationRunning ? 'green' : 'neutral'}>{automationRunning ? '运行中' : '已停止'}</Badge>} />
            <LayerCard.Primary>
              <div className="flex flex-wrap items-center gap-3">
                <Toolbar size="sm" aria-label="自动托管操作" className="max-w-full">
                  <Toolbar.Button id="start" icon={automationRunning ? <Power /> : <Play />}>{automationRunning ? '停止托管' : '启动托管'}</Toolbar.Button>
                  <Toolbar.Button id="refresh" icon={<ArrowClockwise />}>刷新</Toolbar.Button>
                  <Toolbar.Button id="once" icon={<Sparkle />}>执行一轮</Toolbar.Button>
                </Toolbar>
                {state.error ? <Badge variant="red">{state.error}</Badge> : null}
              </div>
            </LayerCard.Primary>
          </LayerCard>

          <LayerCard>
            <SectionHeader title="当前任务" badge={<Badge variant={story.storyId ? story.finished ? 'orange' : 'green' : 'neutral'}>{story.storyId ? story.finished ? '待结算' : '进行中' : '空闲'}</Badge>} />
            <LayerCard.Primary className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                {story.storyId ? (() => {
                  const item = String(story.storyId).startsWith('6100') ? selectedCourse : String(story.storyId).startsWith('6400') ? selectedJob : selectedAdventure;
                  return item?.iconUrl ? <img src={item.iconUrl} alt="任务素材" className="size-20 shrink-0 object-contain" /> : <Sparkle size={44} className="shrink-0 text-kumo-subtle" />;
                })() : <Sparkle size={44} className="shrink-0 text-kumo-subtle" />}
                <div className="min-w-0">
                  <Text as="h3" variant="heading2">{story.storyId ? storyType(story) : '暂无任务'}</Text>
                  <Text size="sm" variant="secondary">{story.storyId ? story.finished ? '任务已完成，等待自动结算' : '自动托管正在跟踪任务进度' : '自动托管会在满足条件时开始任务'}</Text>
                </div>
              </div>
              <div className="min-w-32 text-right">
                <Text as="span" size="xs" variant="secondary">剩余时间</Text>
                <div><Text as="span" variant="heading2">{story.storyId ? duration(storyRemaining) : '--'}</Text></div>
                <Text as="span" size="xs" variant="secondary">{story.storyId ? `总时长 ${duration(story.durationSeconds)}` : '等待下一次任务'}</Text>
              </div>
            </LayerCard.Primary>
          </LayerCard>

          <section className="flex flex-col gap-3" aria-labelledby="inventory-title">
            <Text as="h2" variant="heading3" id="inventory-title">背包</Text>
            <Grid variant="4up" gap="sm">
              <GridItem><MetricCard label="饼干" value={formatNumber(inventory.biscuits)} detail="库存" /></GridItem>
              <GridItem><MetricCard label="虾仁" value={formatNumber(inventory.shrimp)} detail="库存" /></GridItem>
              <GridItem><MetricCard label="香皂片" value={formatNumber(inventory.soap)} detail="库存" /></GridItem>
              <GridItem><MetricCard label="沐浴球" value={formatNumber(inventory.bathBall)} detail="库存" /></GridItem>
            </Grid>
          </section>

          <LayerCard>
            <SectionHeader title="今日进度" />
            <LayerCard.Primary className="flex flex-wrap gap-2">
              {([['school', '学习'], ['work', '打工'], ['adventure', '冒险'], ['feed', '喂食'], ['wash', '洗澡'], ['visitFriend', '好友走访'], ['visitStranger', '陌生人走访'], ['careOther', '照顾别人']] as const).map(([key, label]) => <Badge key={key} variant="neutral">{label} {progress.counts?.[key] || 0}</Badge>)}
              <Badge variant="purple">今日经验 {progress.dailyExperienceGain || 0}</Badge>
            </LayerCard.Primary>
          </LayerCard>

          {telemetryItems.length ? <LayerCard className="overflow-x-auto p-0">
            <SectionHeader title="成长遥测" description="任务结算前后属性、实际耗时与目录收益" badge={<Badge variant="purple">{pending ? `${telemetry.length} 次结算 · 当前任务进行中` : `${telemetry.length} 次结算 · 属性增量 ${formatNumber(totalGain, 1)}`}</Badge>} />
            <Table layout="fixed">
              <colgroup><col className="w-[28%]" /><col className="w-[28%]" /><col className="w-[44%]" /></colgroup>
              <Table.Header variant="compact"><Table.Row><Table.Head>任务</Table.Head><Table.Head>耗时与收益</Table.Head><Table.Head>属性变化</Table.Head></Table.Row></Table.Header>
              <Table.Body>
              {telemetryItems.map((item: AnyRecord, index: number) => {
                const name = item.item?.name || ({ school: '学习', work: '打工', adventure: '冒险' } as AnyRecord)[item.kind] || item.kind || '任务';
                const delta = item.delta ? Object.entries({ strength: '力量', intelligence: '智力', charm: '魅力' }).map(([key, label]) => `${label} ${Number(item.delta[key] || 0) >= 0 ? '+' : ''}${formatNumber(item.delta[key], 1)}`).join(' · ') : '属性快照缺失';
                return <Table.Row key={`${item.startedAt || item.createdAt || index}-${index}`}>
                  <Table.Cell><Text bold>{name}{item.attribute ? ` · ${attributeNames[item.attribute] || item.attribute}` : ''}</Text></Table.Cell>
                  <Table.Cell><Text size="xs" variant="secondary">{[item.kind, item.elapsedSeconds ? `${item.elapsedSeconds}s` : '耗时未知', item.item?.reward || '收益未知'].filter(Boolean).join(' · ')}</Text></Table.Cell>
                  <Table.Cell><Text size="sm" variant={item.status === 'running' ? 'secondary' : 'success'} bold>{item.status === 'running' ? '等待结算后记录实际属性增量' : delta}</Text></Table.Cell>
                </Table.Row>;
              })}
              </Table.Body>
            </Table>
          </LayerCard> : null}
          </div>

          <div className="flex flex-col gap-4" hidden={activeView !== 'activity'}>
          {profile.medals?.length ? <LayerCard>
            <SectionHeader title="我的徽章" description="全部徽章、获得状态与佩戴状态" badge={<Badge variant="purple">{profile.medals.filter((item: AnyRecord) => item.acquired).length}/{profile.medals.length} 枚</Badge>} />
            <LayerCard.Primary>
              <Grid variant="4up" gap="sm">
              {profile.medals.map((item: AnyRecord) => <GridItem key={item.id}><Surface className={`rounded-lg p-3 ${item.acquired ? '' : 'opacity-50 grayscale'}`} title={[item.requirement, item.description].filter(Boolean).join('\n')}>
                <div className="flex items-center gap-3">
                <img src={item.imageUrl} alt={item.name} loading="lazy" className="size-14 object-contain" />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="truncate"><Text bold>{item.name}</Text></div>{item.equipped ? <Badge variant="purple">已佩戴</Badge> : null}</div><div className="truncate"><Text size="xs" variant="secondary">{[item.category, item.progress].filter(Boolean).join(' · ')}</Text></div></div>
                </div>
              </Surface></GridItem>)}
              </Grid>
            </LayerCard.Primary>
          </LayerCard> : null}

          {state.interactions?.length ? <LayerCard className="overflow-x-auto p-0">
            <SectionHeader title="互动消息" description="服务器返回的最近互动记录" badge={<Badge variant="purple">{state.interactions.length} 条</Badge>} />
            <Table layout="fixed">
              <colgroup><col className="w-[22%]" /><col className="w-[28%]" /><col className="w-[50%]" /></colgroup>
              <Table.Header variant="compact"><Table.Row><Table.Head>对象</Table.Head><Table.Head>互动时间</Table.Head><Table.Head>内容</Table.Head></Table.Row></Table.Header>
              <Table.Body>{state.interactions.map((item: AnyRecord) => <Table.Row key={item.id}>
                <Table.Cell><Text bold>{item.petName || `QQ ${item.uin || '未知'}`}</Text></Table.Cell>
                <Table.Cell><Text size="xs" variant="secondary">{[({ 1: '喂食', 2: '踩踩', 5: '洗澡', 6: '火花', 6400: '打工', 6700: '冒险' } as AnyRecord)[item.eventType] || '互动', item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN', { hour12: false }) : '时间未知'].filter(Boolean).join(' · ')}</Text></Table.Cell>
                <Table.Cell><Text size="sm">{item.text || ''}</Text></Table.Cell>
              </Table.Row>)}</Table.Body>
            </Table>
          </LayerCard> : null}

          {catalogs.careers.length ? <LayerCard className="overflow-x-auto p-0">
            <SectionHeader title="职业树" description="职业名称、编号与解锁说明" />
            <Table layout="fixed">
              <colgroup><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[50%]" /></colgroup>
              <Table.Header variant="compact"><Table.Row><Table.Head>职业</Table.Head><Table.Head>编号</Table.Head><Table.Head>解锁说明</Table.Head></Table.Row></Table.Header>
              <Table.Body>{catalogs.careers.map((career) => <Table.Row key={String(career.careerType)}>
                <Table.Cell><Text bold>{career.name || '未知职业'}</Text></Table.Cell>
                <Table.Cell><Text size="sm" variant="secondary">{career.careerType}</Text></Table.Cell>
                <Table.Cell><Text size="sm" variant="secondary">{career.message || '已解锁'}</Text></Table.Cell>
              </Table.Row>)}</Table.Body>
            </Table>
          </LayerCard> : null}
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="settings-title" hidden={activeView !== 'settings'}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Text as="h2" variant="heading2" id="settings-title">托管设置</Text>
                <Text size="sm" variant="secondary">配置保存在 Miku 独立组件中</Text>
              </div>
              <Button id="save" variant="primary" icon={<FloppyDisk />}>{dirty ? '保存设置（未保存）' : '保存设置'}</Button>
            </div>
            <form id="settings" onSubmit={(event) => event.preventDefault()}>
              <Grid variant="2up" gap="sm">
                <GridItem><SettingSection title="培训策略">
                  {select('schoolSelectionMode', '属性策略', [['lowest', '动态补最低属性'], ['rotation', '轮换三项属性'], ['fixed', '固定属性']])}
                  <div className="flex items-end"><Badge variant="purple">当前学习属性：{attributeNames[activeAttribute] || '--'}（{modeLabel}）</Badge></div>
                  <div data-miku-wide><Text size="xs" variant="secondary">动态模式会根据当前力量、智力和魅力的差距选择下一项课程。</Text></div>
                </SettingSection></GridItem>
                <GridItem><SettingSection title="安全与轮询">
                  {toggle('safeMode', '安全模式（只读）')}
                  {toggle('autoStart', '启动时自动托管')}
                  {input('petId', 'Pet ID', 'text', { placeholder: 'AUTO 表示自动获取' })}
                  {input('intervalSeconds', '页面与后端刷新秒数', 'number', { min: 3, max: 300, description: '页面轮询与后端检查使用同一周期' })}
                  {input('coinThreshold', '学习金币阈值', 'number', { min: 0 })}
                  {select('taskPriority', '任务优先顺序', [['school', '优先学习'], ['work', '优先打工']], { description: '金币不足时自动改为打工' })}
                  {select('fatigue8HourAction', '超过 8 小时后', [['rest', '休息'], ['work', '打工'], ['school', '学习'], ['adventure', '冒险']])}
                  {select('fatigue12HourAction', '超过 12 小时后', [['rest', '休息'], ['work', '打工'], ['school', '学习'], ['adventure', '冒险']])}
                </SettingSection></GridItem>
                <GridItem><SettingSection title="自动照顾">
                  {toggle('careEnabled', '启用自动照顾')}
                  {toggle('autoBuySupplies', '自动购买用品')}
                  {input('hungerThreshold', '喂食阈值', 'number', { min: 0 })}
                  {input('cleanThreshold', '洗澡阈值', 'number', { min: 0 })}
                  {input('foodPurchaseCount', '购买饼干数', 'number', { min: 1 })}
                  {input('bathPurchaseCount', '购买沐浴球数', 'number', { min: 1 })}
                </SettingSection></GridItem>
                <GridItem><SettingSection title="学习">
                  {toggle('schoolEnabled', '启用自动学习')}
                  {select('schoolAttribute', '属性', [['physical', '力量'], ['culture', '智力'], ['art', '魅力']])}
                  {toggle('schoolRotationEnabled', '轮换模式启用周期轮换')}
                  {input('schoolRotationEvery', '每完成几次轮换', 'number', { min: 1 })}
                  {select('courseSubEvent', '课程', [['0', '自动最高效率'], ...catalogs.courses.map((item) => [String(item.subEventType), `${[item.name, item.duration, item.reward].filter(Boolean).join(' · ')}${item.canDo ? '' : '（不可用）'}`] as [string, string])])}
                  <CatalogPreview item={selectedCourse} fallback="自动选择课程" />
                </SettingSection></GridItem>
                <GridItem className="md:col-span-2"><SettingSection title="走访与照顾别人">
                  {toggle('visitEnabled', '启用自动走访')}
                  {toggle('visitFriends', '走访好友')}
                  {toggle('visitStrangers', '走访陌生人')}
                  {toggle('visitAutoCare', '自动照顾别人')}
                  {input('visitMaxPerDay', '主动走访人数上限/日', 'number', { min: 0, description: '0 不限' })}
                  {input('visitDelayMinMinutes', '走访等待最短分钟', 'number', { min: 0 })}
                  {input('visitDelayMaxMinutes', '走访等待最长分钟', 'number', { min: 0 })}
                  {input('otherCareDailyExperienceLimit', '停止照顾的每日经验值', 'number', { min: 0 })}
                  {input('visitCandidateScanLimit', '候选扫描数', 'number', { min: 1, max: 200 })}
                  {input('visitStrangerGroupIds', '陌生人群号', 'text', { placeholder: '留空自动选群' })}
                </SettingSection></GridItem>
                <GridItem><SettingSection title="打工">
                  {toggle('workEnabled', '启用自动打工')}
                  {select('workJobSubEvent', '岗位', [['0', '自动最高效率'], ...jobs.map((item) => [String(item.subEventType), `${[item.careerName, item.name, item.duration, item.reward].filter(Boolean).join(' · ')}${item.canDo ? '' : '（不可用）'}`] as [string, string])])}
                  <CatalogPreview item={selectedJob} fallback="自动选择岗位" />
                  {input('workTimesPerDay', '每日打工次数', 'number', { min: 0 })}
                  {toggle('employFriend', '自动雇佣好友宠物')}
                  {input('workFriendScanLimit', '雇佣候选扫描数', 'number', { min: 1, max: 200 })}
                </SettingSection></GridItem>
                <GridItem><SettingSection title="冒险">
                  {toggle('adventureEnabled', '启用自动冒险')}
                  {select('adventureOption', '冒险', [['', '服务器首个可用项'], ...catalogs.adventures.map((item) => [String(item.name), `${item.name} · ${item.duration}${item.canDo ? '' : '（不可用）'}`] as [string, string])])}
                  {input('adventureStartTime', '开始时间', 'time')}
                  {input('adventureTimesPerDay', '每日冒险次数', 'number', { min: 0 })}
                </SettingSection></GridItem>
              </Grid>
            </form>
          </section>

          <div className="flex flex-col gap-4" hidden={activeView !== 'activity'}>
          <LayerCard>
            <SectionHeader title="运行日志" />
            <LayerCard.Primary><pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-kumo-inverse p-4 font-mono text-xs text-kumo-inverse">{compactLogs(state.logs || []).join('\n') || '尚无日志'}</pre></LayerCard.Primary>
          </LayerCard>
          </div>
        </section>
      </main>
    </Toasty>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
