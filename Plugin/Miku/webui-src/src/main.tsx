import { Badge } from '@cloudflare/kumo/components/badge';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Text } from '@cloudflare/kumo/components/text';
import '@cloudflare/kumo/styles/standalone';
import './legacy.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

type MetricProps = {
  id: string;
  label: string;
  detailId?: string;
  iconId?: string;
};

type AttributeProps = {
  id: string;
  label: string;
  telemetryId: string;
  badge: 'red' | 'blue' | 'orange';
};

function MetricCard({ id, label, detailId, iconId }: MetricProps) {
  return (
    <LayerCard className="relative min-w-0 p-3">
      {iconId ? (
        <img
          id={iconId}
          className="absolute right-3 top-1/2 hidden size-8 -translate-y-1/2 object-contain opacity-30"
          alt=""
          width="32"
          height="32"
        />
      ) : null}
      <div className="flex min-h-14 flex-col justify-between gap-1">
        <Text as="span" size="xs" variant="secondary">{label}</Text>
        <Text id={id} as="span" variant="heading2">--</Text>
        {detailId ? <Text id={detailId} as="span" size="xs" variant="secondary" /> : null}
      </div>
    </LayerCard>
  );
}

function AttributeCard({ id, label, telemetryId, badge }: AttributeProps) {
  return (
    <LayerCard className="min-w-0">
      <LayerCard.Secondary className="flex items-center justify-between gap-2">
        <Text as="span" size="xs" bold>{label}累计</Text>
        <Badge variant={badge}>{label}</Badge>
      </LayerCard.Secondary>
      <LayerCard.Primary className="flex flex-col gap-2">
        <Text id={id} as="span" variant="heading2">--</Text>
        <Text id={telemetryId} as="span" size="sm" variant="success" bold>等待目录同步</Text>
      </LayerCard.Primary>
    </LayerCard>
  );
}

function Metrics() {
  return (
    <section className="my-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8" aria-label="宠物状态">
      <MetricCard id="gold" iconId="gold-reward-icon" label="金币" />
      <MetricCard id="feel" label="心情" />
      <MetricCard id="hunger" label="体力" />
      <MetricCard id="clean" label="清洁" />
      <MetricCard id="total" label="综合" />
      <AttributeCard id="strength" label="力量" telemetryId="strength-telemetry" badge="red" />
      <AttributeCard id="intelligence" label="智力" telemetryId="intelligence-telemetry" badge="blue" />
      <AttributeCard id="charm" label="魅力" telemetryId="charm-telemetry" badge="orange" />
      <MetricCard id="pet-level" label="等级" />
      <MetricCard id="pet-experience" detailId="experience-rate" label="经验" />
      <MetricCard id="fatigue" label="疲劳状态" />
    </section>
  );
}

const root = document.getElementById('kumo-metrics');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Metrics />
    </StrictMode>,
  );
}
