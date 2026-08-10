import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Play, RefreshCw, RotateCw, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useApi } from '@/lib/api';
import type { PluginState } from '@/types';

const labels: Record<PluginState['state'], string> = {
  running: '运行中',
  external: '外部运行',
  stopped: '已停止',
  error: '异常',
};

function statusVariant(state: PluginState['state']) {
  if (state === 'running') return 'success' as const;
  if (state === 'external') return 'warning' as const;
  if (state === 'error') return 'destructive' as const;
  return 'secondary' as const;
}

export function PluginsPage() {
  const api = useApi();
  const [plugins, setPlugins] = useState<PluginState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setPlugins(await api.plugins.list());
      setUpdatedAt(new Date());
      if (!quiet) setMessage(null);
    } catch (error) {
      if (!quiet) setMessage(error instanceof Error ? error.message : '插件状态加载失败');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => ({
    total: plugins.length,
    running: plugins.filter((item) => item.running).length,
    stopped: plugins.filter((item) => item.state === 'stopped').length,
    error: plugins.filter((item) => item.state === 'error').length,
  }), [plugins]);

  const run = async (plugin: PluginState, action: 'start' | 'stop' | 'restart') => {
    setBusy(`${plugin.id}:${action}`);
    setMessage(null);
    try {
      await api.plugins[action](plugin.id);
      await load(true);
      setMessage(action === 'start' ? '插件已启动' : action === 'stop' ? '插件已停止' : '插件已重启');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '插件操作失败');
    } finally { setBusy(null); }
  };

  const setEnabled = async (plugin: PluginState, enabled: boolean) => {
    setBusy(`${plugin.id}:enabled`);
    setMessage(null);
    try {
      await api.plugins.setEnabled(plugin.id, enabled);
      await load(true);
      setMessage(enabled ? '插件已启用' : '插件已禁用');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '插件设置保存失败');
      await load(true);
    } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>插件</CardTitle>
            <CardDescription>查看 Plugin 目录中的组件，并管理由当前 SnowLuma 启动的插件</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} /> 刷新
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/70 sm:grid-cols-4">
            {([['已发现', counts.total], ['运行中', counts.running], ['已停止', counts.stopped], ['异常', counts.error]] as const).map(([label, value], index) => (
              <div key={label} className={`flex min-h-20 items-center justify-between gap-4 px-4 py-3 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b sm:border-b-0' : ''} ${index < 3 ? 'sm:border-r' : ''}`}>
                <span className="text-xs text-muted-foreground">{label}</span><strong className="text-xl tabular-nums">{value}</strong>
              </div>
            ))}
          </div>
          {message && <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60">
          <div><CardTitle>已安装插件</CardTitle><CardDescription>{updatedAt ? `更新于 ${updatedAt.toLocaleTimeString('zh-CN', { hour12: false })}` : '正在读取状态'}</CardDescription></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-sm">
              <colgroup>
                <col className="w-[29%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[9%]" /><col className="w-[16%]" />
              </colgroup>
              <thead className="bg-muted/45 text-left text-xs text-muted-foreground"><tr><th className="px-5 py-3">插件</th><th className="px-4 py-3 text-center">状态</th><th className="px-4 py-3 text-center">启用</th><th className="px-4 py-3">版本</th><th className="px-4 py-3">WebUI</th><th className="px-4 py-3">PID</th><th className="px-5 py-3 text-center">操作</th></tr></thead>
              <tbody>
                {loading && plugins.length === 0 ? <tr><td colSpan={7} className="h-36 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 animate-spin" />正在加载</td></tr>
                  : plugins.length === 0 ? <tr><td colSpan={7} className="h-36 text-center text-muted-foreground">Plugin 目录中没有可用插件</td></tr>
                    : plugins.map((plugin) => (
                      <tr key={plugin.id} className="border-t border-border/60 transition-colors hover:bg-muted/25">
                        <td className="px-5 py-4 align-middle"><div className="truncate font-medium">{plugin.name}</div><div className="mt-1 truncate text-xs text-muted-foreground">{plugin.description || `${plugin.folderName} · ${plugin.protocol || '本地组件'}`}</div></td>
                        <td className="px-4 py-4 align-middle"><div className="flex w-full justify-center"><Badge variant={plugin.enabled ? statusVariant(plugin.state) : 'secondary'} title={plugin.lastError ?? undefined}>{plugin.enabled ? labels[plugin.state] : '已禁用'}</Badge></div></td>
                        <td className="px-4 py-4 align-middle"><div className="flex w-full justify-center"><ToggleSwitch value={plugin.enabled} onChange={(value) => void setEnabled(plugin, value)} disabled={busy !== null} ariaLabel={`${plugin.name}${plugin.enabled ? '禁用' : '启用'}`} /></div></td>
                        <td className="px-4 py-4 align-middle font-mono text-xs text-muted-foreground">{plugin.version}</td>
                        <td className="px-4 py-4 align-middle">
                          {plugin.instances.length > 0 ? <div className="flex flex-col gap-0.5">{plugin.instances.map((instance) => <a key={instance.webUrl} href={instance.webUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"><ExternalLink className="size-3 shrink-0" />{instance.uin ? `${instance.uin} :${instance.webPort}` : `:${instance.webPort}`}</a>)}</div> : <span className="text-muted-foreground">--</span>}
                        </td>
                        <td className="px-4 py-4 align-middle font-mono text-xs text-muted-foreground">{plugin.pid ?? (plugin.state === 'external' ? '外部' : '--')}</td>
                        <td className="px-5 py-4 align-middle text-center">
                          {!plugin.enabled ? <Badge variant="secondary">已禁用</Badge>
                            : !plugin.running ? <Button size="sm" onClick={() => void run(plugin, 'start')} disabled={busy !== null}>{busy === `${plugin.id}:start` ? <Loader2 className="animate-spin" /> : <Play />}启动</Button>
                              : plugin.managed ? <div className="inline-flex gap-2"><Button variant="outline" size="sm" onClick={() => void run(plugin, 'restart')} disabled={busy !== null}><RotateCw />重启</Button><Button variant="destructive" size="sm" onClick={() => void run(plugin, 'stop')} disabled={busy !== null}><Square />停止</Button></div>
                                : <Badge variant="warning" title="该插件不是由当前 SnowLuma 进程启动，请在插件窗口中管理">外部管理</Badge>}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
