"use client";

import { useState, type CSSProperties } from "react";
import type { Appointment } from "@dra/contracts";
import { localDateTime } from "@/lib/calendar";

const minutes = (value: string) => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));

export function CalendarTimeline({ days, anchor, items, zone, selectedId, busy, onOpen, onCreate }: {
  days: string[]; anchor: string; items: Appointment[]; zone: string; selectedId?: string; busy: boolean;
  onOpen: (item: Appointment) => void; onCreate: (day: string) => void;
}) {
  const [picked, setPicked] = useState(anchor);
  const selected = days.includes(picked) ? picked : days.includes(anchor) ? anchor : days[0];
  const today = localDateTime(new Date(), zone).slice(0, 10);
  const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const onDay = (day: string) => items.filter((item) => item.allDay ? item.start <= day && item.end > day : localDateTime(item.start, zone).slice(0, 10) <= day && localDateTime(new Date(new Date(item.end).getTime() - 1), zone).slice(0, 10) >= day);
  function timed(day: string) {
    const events = onDay(day).filter((item) => !item.allDay).map((item) => {
      const start = localDateTime(item.start, zone), end = localDateTime(item.end, zone);
      const from = start.slice(0, 10) < day ? 0 : minutes(start);
      const to = end.slice(0, 10) > day ? 1440 : Math.max(from + 1, minutes(end));
      return { item, from, to, lane: 0 };
    }).sort((a, b) => a.from - b.from || a.to - b.to);
    const lanes: number[] = [];
    for (const event of events) {
      let lane = lanes.findIndex((end) => end <= event.from);
      if (lane < 0) lane = lanes.length;
      event.lane = lane; lanes[lane] = Math.max(event.to, event.from + 36);
    }
    return { events, laneCount: Math.max(1, lanes.length) };
  }
  const columns = days.map((day) => ({ day, ...timed(day) }));
  const starts = columns.flatMap(({ events }) => events.map(({ from }) => from));
  const ends = columns.flatMap(({ events }) => events.map(({ to }) => to));
  const firstHour = Math.max(0, Math.min(8, Math.floor(Math.min(...starts, 480) / 60)));
  const lastHour = Math.min(24, Math.max(18, Math.ceil(Math.max(...ends, 1080) / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const label = (day: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
  return <div className={`calendar-timeline ${items.some((item) => item.allDay) ? "has-all-day" : ""}`} style={{ "--day-count": days.length, "--timeline-height": `${hours.length * 60}px` } as CSSProperties}>
    <div className="calendar-day-strip">{days.map((day) => <button key={day} type="button" aria-label={`Ver ${label(day)}`} aria-pressed={selected === day} className={today === day ? "is-today" : ""} onClick={() => setPicked(day)}><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "")}</span><strong>{Number(day.slice(-2))}</strong></button>)}</div>
    <div className="calendar-time-grid">
      <div className="calendar-hours" aria-hidden="true">{hours.map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div>
      {columns.map(({ day, events, laneCount }) => <section className="calendar-time-column" data-selected={selected === day} key={day} aria-label={label(day)}>
        <div className="calendar-all-day">{onDay(day).filter((item) => item.allDay).map((item) => <button key={item.id} className="calendar-event is-readonly" disabled={busy} onClick={() => onOpen(item)}><strong>{item.title}</strong><small>Dia inteiro · Somente visualização</small></button>)}</div>
        <div className="calendar-hour-slots">{events.map(({ item, from, to, lane }) => <button key={item.id} className={`calendar-event calendar-slot-event ${!item.editable ? "is-readonly" : ""}`} aria-current={selectedId === item.id ? "true" : undefined} disabled={busy} onClick={() => onOpen(item)} style={{ "--event-top": `${from - firstHour * 60}px`, "--event-height": `${Math.max(36, to - from)}px`, "--event-lane": lane, "--event-lanes": laneCount } as CSSProperties}><strong>{item.title}</strong><span>{time(item.start)} – {time(item.end)}</span>{item.recurring && <small>Recorrente</small>}{!item.editable && <small>Somente visualização</small>}</button>)}</div>
        <div className="calendar-mobile-events">{events.map(({ item }) => <button key={item.id} className={`calendar-event ${!item.editable ? "is-readonly" : ""}`} disabled={busy} aria-current={selectedId === item.id ? "true" : undefined} onClick={() => onOpen(item)}><strong>{item.title}</strong><span>{time(item.start)} – {time(item.end)}</span>{item.recurring && <small>Recorrente</small>}{!item.editable && <small>Somente visualização</small>}</button>)}{!onDay(day).length && <p className="calendar-empty">Sem compromissos neste dia.</p>}</div>
        <button className="text-action calendar-add-day" disabled={busy} aria-label={`Nova consulta em ${day}`} onClick={() => onCreate(day)}>+ Nova consulta</button>
      </section>)}
    </div>
  </div>;
}
