import { Check, StickyNote } from 'lucide-react';

type NotesPanelProps = {
  value: string;
  onChange: (value: string) => void;
};

export function NotesPanel({ value, onChange }: NotesPanelProps) {
  return (
    <article className="panel note-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">QUICK NOTES</span>
          <h2>Family notes</h2>
        </div>
        <StickyNote size={19} className="muted-icon" />
      </div>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="Grocery list, reminders, a note for the family…"
        aria-label="Family notes"
      />
      <div className="note-footer">
        <span>
          {value.trim().length} character{value.trim().length === 1 ? '' : 's'}
        </span>
        <span>
          <Check size={12} /> Saved on this device
        </span>
      </div>
    </article>
  );
}
