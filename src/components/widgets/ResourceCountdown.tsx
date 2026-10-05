import { t, useLocale } from "../../i18n";
import { useEffect, useState } from 'react';

type CountdownPart = { value: number; unit: string };
function countdownParts(remaining: number): CountdownPart[] {
  if (remaining <= 0) return [];
  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const hourPart = (value: number) => ({ value, unit: value === 1 ? 'hour' : 'hours' });
  if (hours >= 24) {
    const days = Math.floor(hours / 24), rest = hours % 24;
    return [{ value: days, unit: days === 1 ? 'day' : 'days' }, ...(rest ? [hourPart(rest)] : [])];
  }
  if (hours) {
    const rest = minutes % 60;
    return [hourPart(hours), ...(rest ? [{ value: rest, unit: 'min' }] : [])];
  }
  return [{ value: Math.max(1, minutes), unit: 'min' }];
}

export function ResourceCountdown({ datetime }: { datetime?: string }) {
  useLocale();
  const target = datetime?.trim() ? Date.parse(datetime) : NaN;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const current = Date.now();
    setNow(current);
    if (!Number.isFinite(target) || target <= current) return;
    const timer = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= target) clearInterval(timer);
    }, 60_000);
    return () => clearInterval(timer);
  }, [target]);
  if (!Number.isFinite(target)) return null;
  const parts = countdownParts(target - now);
  const text = parts.length ? parts.map(part => `${part.value} ${t(part.unit)}`).join(' ') : t("It's time");
  return <span className="resource-countdown" title={text} aria-label={text}>
    {parts.length ? parts.map(part => <span className="resource-countdown-part" key={part.unit} aria-hidden="true">
      <strong className="resource-countdown-value">{part.value}</strong>
      <span className="resource-countdown-unit">{t(part.unit)}</span>
    </span>) : <span className="resource-countdown-reached">{t("It's time")}</span>}
  </span>;
}
