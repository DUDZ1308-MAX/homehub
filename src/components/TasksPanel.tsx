import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Task } from '../types';

type TasksPanelProps = {
  tasks: Task[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClearCompleted: () => void;
};

export function TasksPanel({
  tasks,
  onAdd,
  onToggle,
  onDelete,
  onClearCompleted,
}: TasksPanelProps) {
  const [title, setTitle] = useState('');
  const completed = tasks.filter(task => task.done).length;
  const progress = tasks.length ? (completed / tasks.length) * 100 : 0;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  };

  return (
    <article className="panel task-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">AROUND THE HOUSE</span>
          <h2>Household tasks</h2>
        </div>
        <span className="task-count">
          {completed}/{tasks.length || 0} done
        </span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tasks.length}
        aria-valuenow={completed}
        aria-label="Completed household tasks"
      >
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="task-list">
        {tasks.length ? (
          tasks.map(task => (
            <div
              className={`task-row ${task.done ? 'is-done' : ''}`}
              key={task.id}
            >
              <button
                type="button"
                className="check-btn"
                role="checkbox"
                aria-checked={task.done}
                aria-label={`Mark ${task.title} as ${
                  task.done ? 'not done' : 'done'
                }`}
                onClick={() => onToggle(task.id)}
              >
                <span className={`task-check ${task.done ? 'is-checked' : ''}`}>
                  {task.done && <Check size={11} />}
                </span>
              </button>
              <span>{task.title}</span>
              <button
                type="button"
                className="delete-task"
                aria-label={`Delete ${task.title}`}
                onClick={() => onDelete(task.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        ) : (
          <p className="task-empty">
            No chores yet. Add one below to share the load.
          </p>
        )}
      </div>

      <form
        className="add-task"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Add a task, e.g. Water the plants"
          aria-label="New task"
        />
        <button type="submit" aria-label="Add task">
          <Plus size={16} />
        </button>
      </form>

      {completed > 0 && (
        <button type="button" className="task-clear" onClick={onClearCompleted}>
          Clear completed
        </button>
      )}
    </article>
  );
}
