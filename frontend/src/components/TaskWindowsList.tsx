'use client';

import { TaskWindowWithTask, formatDate, formatTime, getScoreClass, getRelativeTime } from '@/lib/api';

interface TaskWindowsListProps {
  windows: TaskWindowWithTask[];
}

export function TaskWindowsList({ windows }: TaskWindowsListProps) {
  if (windows.length === 0) {
    return null;
  }
  
  return (
    <div className="card">
      <div className="divide-y divide-zinc-800">
        {windows.map((window) => (
          <TaskWindowCard key={window.id} window={window} />
        ))}
      </div>
    </div>
  );
}

function TaskWindowCard({ window }: { window: TaskWindowWithTask }) {
  const scoreClass = getScoreClass(window.score);
  const startDate = new Date(window.window_start);
  const relative = getRelativeTime(window.window_start);
  
  return (
    <div className="p-4 hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Score badge */}
        <div className={`score-badge ${scoreClass} shrink-0`}>
          {window.score}
        </div>
        
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">{window.task_title}</h3>
              <p className="text-sm text-zinc-500 mt-0.5">{window.reason}</p>
            </div>
            
            {/* Time info */}
            <div className="text-right shrink-0">
              <div className="text-sm font-medium text-zinc-300">
                {formatDate(window.window_start)}
              </div>
              <div className="text-xs text-zinc-500">
                {formatTime(window.window_start)} - {formatTime(window.window_end)}
              </div>
              <div className="text-xs text-blue-400 mt-1">
                {relative}
              </div>
            </div>
          </div>
          
          {/* Notes (if any) */}
          {window.task_notes && (
            <p className="text-xs text-zinc-600 mt-2 line-clamp-2">
              📝 {window.task_notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
