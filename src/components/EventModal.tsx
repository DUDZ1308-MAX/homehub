import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import type { EventItem, EventSaveInput } from '../types';
import {
  eventTimeLabel,
  longDateLabel,
  localDateKey,
  splitLocalDateTime,
} from '../lib/homehub';
import { Modal } from './Modal';

type EventModalProps = {
  event: EventItem | null;
  initialDate: string;
  clock24: boolean;
  onClose: () => void;
  onSave: (input: EventSaveInput) => void;
  onDelete: (id: string) => void;
};

export function EventModal({
  event,
  initialDate,
  clock24,
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const isGoogle = event?.source === 'google';
  const editing = event && !isGoogle ? event : null;
  const initial = editing ? splitLocalDateTime(editing.start) : null;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? initialDate);
  const [startTime, setStartTime] = useState(initial?.time ?? '18:00');
  const [endTime, setEndTime] = useState(
    editing?.end ? splitLocalDateTime(editing.end).time : ''
  );
  const [location, setLocation] = useState(editing?.location ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isGoogle && event) {
    return (
      <Modal
        eyebrow="GOOGLE CALENDAR"
        title={event.title}
        onClose={onClose}
        className="event-modal"
      >
        <div className="event-detail">
          <div>
            <span>When</span>
            <strong>
              {longDateLabel(localDateKey(new Date(event.start)))}
              {!event.allDay ? ` · ${eventTimeLabel(event.start, clock24)}` : ' · All day'}
            </strong>
          </div>
          {event.location && (
            <div>
              <span>Where</span>
              <strong>{event.location}</strong>
            </div>
          )}
          {event.notes && (
            <div>
              <span>Notes</span>
              <strong>{event.notes}</strong>
            </div>
          )}
          <div>
            <span>Source</span>
            <strong>Google Calendar · read-only</strong>
          </div>
        </div>
        <a
          className="primary-button event-link"
          href={
            event.htmlLink?.startsWith('https://')
              ? event.htmlLink
              : 'https://calendar.google.com/'
          }
          target="_blank"
          rel="noreferrer"
        >
          Open in Google Calendar <ExternalLink size={14} />
        </a>
      </Modal>
    );
  }

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Give the event a name.');
      return;
    }
    const start = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(start.getTime())) {
      setError('Choose a valid date and start time.');
      return;
    }
    let end: Date | undefined;
    if (endTime) {
      end = new Date(`${date}T${endTime}:00`);
      if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
        setError('The end time needs to be after the start time.');
        return;
      }
    }
    onSave({
      id: editing?.id,
      title: trimmed,
      start: start.toISOString(),
      end: end?.toISOString(),
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      eyebrow="YOUR FAMILY CALENDAR"
      title={editing ? 'Edit event' : 'Add an event'}
      onClose={onClose}
      className="event-modal"
    >
      <form
        onSubmit={formEvent => {
          formEvent.preventDefault();
          submit();
        }}
      >
        <label>
          Event name
          <input
            value={title}
            onChange={inputEvent => setTitle(inputEvent.target.value)}
            placeholder="e.g. Family dinner"
            aria-label="Event name"
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={inputEvent => setDate(inputEvent.target.value)}
            required
            aria-label="Event date"
          />
        </label>
        <div className="form-row">
          <label>
            Starts
            <input
              type="time"
              value={startTime}
              onChange={inputEvent => setStartTime(inputEvent.target.value)}
              required
              aria-label="Start time"
            />
          </label>
          <label>
            Ends <span className="optional">(optional)</span>
            <input
              type="time"
              value={endTime}
              onChange={inputEvent => setEndTime(inputEvent.target.value)}
              aria-label="End time"
            />
          </label>
        </div>
        <label>
          Location <span className="optional">(optional)</span>
          <input
            value={location}
            onChange={inputEvent => setLocation(inputEvent.target.value)}
            placeholder="e.g. Kitchen"
            aria-label="Event location"
          />
        </label>
        <label>
          Notes <span className="optional">(optional)</span>
          <textarea
            value={notes}
            onChange={inputEvent => setNotes(inputEvent.target.value)}
            placeholder="Anything the family should know"
            aria-label="Event notes"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          {editing && (
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                onDelete(editing.id);
              }}
            >
              <Trash2 size={14} />{' '}
              {confirmDelete ? 'Confirm delete' : 'Delete event'}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button compact">
            {editing ? 'Save changes' : 'Save event'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
