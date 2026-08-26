'use client';

type Series = {
  label: string;
  color: string;
  values: number[];
};

type LineChartProps = {
  labels: string[];
  series: Series[];
  height?: number;
};

function buildPath(values: number[], width: number, height: number, pad: number, max: number) {
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + innerH - (max > 0 ? (v / max) * innerH : 0);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildArea(values: number[], width: number, height: number, pad: number, max: number) {
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const line = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + innerH - (max > 0 ? (v / max) * innerH : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' L ');
  const baseY = pad + innerH;
  const firstX = pad;
  const lastX = pad + (values.length - 1) * step;
  return `M${firstX},${baseY} L ${line} L ${lastX},${baseY} Z`;
}

export function LineChart({ labels, series, height = 220 }: LineChartProps) {
  const width = 560;
  const pad = 28;
  const max = Math.max(1, ...series.flatMap((s) => s.values));

  return (
    <div className="dash-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="dash-chart-svg"
        role="img"
        aria-label="Graphique en courbes"
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad + (height - pad * 2) * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={pad}
              y1={y}
              x2={width - pad}
              y2={y}
              className="dash-chart-grid"
            />
          );
        })}
        {series.map((s) => (
          <g key={s.label}>
            <path d={buildArea(s.values, width, height, pad, max)} fill={s.color} opacity={0.12} />
            <path
              d={buildPath(s.values, width, height, pad, max)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
        {labels.map((label, i) => {
          const x =
            pad + (labels.length > 1 ? (i / (labels.length - 1)) * (width - pad * 2) : 0);
          return (
            <text key={label + i} x={x} y={height - 6} className="dash-chart-axis">
              {label}
            </text>
          );
        })}
      </svg>
      <div className="dash-chart-legend">
        {series.map((s) => (
          <span key={s.label} className="dash-legend-item">
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type BarItem = { label: string; value: number; color?: string };

export function BarChart({ items, height = 200 }: { items: BarItem[]; height?: number }) {
  const width = 560;
  const pad = { t: 16, r: 16, b: 36, l: 16 };
  const max = Math.max(1, ...items.map((i) => i.value));
  const barW = Math.min(48, (width - pad.l - pad.r) / Math.max(items.length, 1) - 12);
  const gap = (width - pad.l - pad.r - barW * items.length) / Math.max(items.length + 1, 1);

  return (
    <div className="dash-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="dash-chart-svg" role="img">
        {items.map((item, i) => {
          const h = ((height - pad.t - pad.b) * item.value) / max;
          const x = pad.l + gap + i * (barW + gap);
          const y = height - pad.b - h;
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx={6}
                fill={item.color ?? 'var(--esay-blue)'}
                className="dash-bar"
              />
              <text x={x + barW / 2} y={height - 8} className="dash-chart-axis" textAnchor="middle">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type DonutSegment = { label: string; value: number; color: string };

export function DonutChart({
  segments,
  size = 160,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;

  const arcs = segments.map((seg) => {
    const slice = (seg.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...seg, d };
  });

  return (
    <div className="dash-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {arcs.map((a) => (
          <path key={a.label} d={a.d} fill={a.color} className="dash-donut-slice" />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.58} fill="var(--paper-card)" />
        {centerValue != null ? (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" className="dash-donut-value">
              {centerValue}
            </text>
            {centerLabel ? (
              <text x={cx} y={cy + 16} textAnchor="middle" className="dash-donut-label">
                {centerLabel}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
      <ul className="dash-donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SparkBars({ values, color = 'var(--esay-blue)' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="dash-spark" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: color,
          }}
        />
      ))}
    </div>
  );
}
