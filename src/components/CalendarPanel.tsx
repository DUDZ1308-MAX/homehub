import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { EventItem } from '../types';
import {
  eventTimeLabel,
  eventsForDate,
  localDateKey,
  longDateLabel,
  todayKey,
} from '../lib/homehub';

type CalendarPanelProps = {
  month: Date;
  events: EventItem[];
  selectedDate: string;
  clock24: boolean;
  weekStartsOn: 0 | 1;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: string) => void;
  onAddEvent: (date: string) => void;
  onOpenEvent: (event: EventItem) => void;
};

export function CalendarPanel({
  month,
  events,
  selectedDate,
  clock24,
  weekStartsOn,
  onMonthChange,
  onSelectDate,
  onAddEvent,
  onOpenEvent,
}: CalendarPanelProps) {
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const orderedWeekdays =
    weekStartsOn === 1 ? [...weekdays.slice(1), weekdays[0]] : weekdays;

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        return {
          day,
          key: localDateKey(
            new Date(month.getFullYear(), month.getMonth(), day)
          ),
        };
      }),
    ];
  }, [month, weekStartsOn]);

  const selectedEvents = useMemo(
    () => eventsForDate(events, selectedDate),
    [events, selectedDate]
  );

  const goToday = () => {
    const today = new Date();
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(todayKey());
  };

  return (
    <article className="panel calendar-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PLAN AHEAD</span>
          <h2>
            {month.toLocaleDateString([], {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
        </div>
        <div className="month-controls">
          <button type="button" className="text-action" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label="Previous month"
            onClick={() =>
              onMonthChange(
                new Date(month.getFullYear(), month.getMonth() - 1, 1)
              )
            }
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label="Next month"
            onClick={() =>
              onMonthChange(
                new Date(month.getFullYear(), month.getMonth() + 1, 1)
              )
            }
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {orderedWeekdays.map(day => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {days.map((date, index) => {
          if (!date) return <div className="calendar-day is-empty" key={`empty-${index}`} />;
          const dayEvents = eventsForDate(events, date.key);
          const isToday = date.key === todayKey();
          const isSelected = date.key === selectedDate;
          return (
            <button
              type="button"
              key={date.key}
              className={[
                'calendar-day',
                isToday ? 'today' : '',
                isSelected ? 'selected' : '',
                dayEvents.length ? 'has-event' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(date.key)}
              aria-pressed={isSelected}
              aria-label={`${new Date(
                `${date.key}T12:00:00`
              ).toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}${
                dayEvents.length
                  ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                  : ', no events'
              }`}
            >
              <span>{date.day}</span>
            </button>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span>
          <i /> {selectedDate === todayKey() ? 'Today' : longDateLabel(selectedDate)}
        </span>
        <button
          type="button"
          className="text-action"
          onClick={() => onAddEvent(selectedDate)}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <div className="calendar-day-detail">
        {selectedEvents.length ? (
          selectedEvents.map(event => (
            <button
              type="button"
              className="calendar-event-row"
              key={event.id}
              onClick={() => onOpenEvent(event)}
            >
              <span>
                {eventTimeLabel(event.start, clock24, event.allDay)}
              </span>
              <strong>{event.title}</strong>
              {event.source === 'google' && <em>Google</em>}
            </button>
          ))
        ) : (
          <p>
            Nothing planned for this day.{' '}
            <button
              type="button"
              className="inline-action"
              onClick={() => onAddEvent(selectedDate)}
            >
              Add an event
            </button>
          </p>
        )}
      </div>
    </article>
  );
}
