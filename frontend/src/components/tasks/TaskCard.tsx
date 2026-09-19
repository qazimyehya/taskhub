import type { Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

const statusColors: Record<string, string> = {
  todo: '#f39c12',
  in_progress: '#3498db',
  done: '#2ecc71',
};

const priorityColors: Record<string, string> = {
  low: '#95a5a6',
  medium: '#e67e22',
  high: '#e74c3c',
};

const formatDate = (dateString: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TaskCard = ({ task, onEdit, onDelete }: TaskCardProps) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div className="task-card" style={{
      background: '#fff',
      border: '1px solid #eee',
      borderRadius: '10px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderLeft: `4px solid ${statusColors[task.status] || '#ddd'}`,
    }}>
      <div className="task-card__row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

        {/* Left: Task Info */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Title */}
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600 }}>
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
              {task.description}
            </p>
          )}

          {/* Badges Row */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{
              background: statusColors[task.status] + '22',
              color: statusColors[task.status],
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
            }}>
              {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>

            {task.priority && (
              <span style={{
                background: priorityColors[task.priority] + '22',
                color: priorityColors[task.priority],
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
              }}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
              </span>
            )}

            {task.project_name && (
              <span style={{
                background: '#eef2ff',
                color: '#4f46e5',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
              }}>
                📁 {task.project_name}
              </span>
            )}

            {(task as any).tenant_slug && (
              <span style={{
                background: '#f0fdf4',
                color: '#16a34a',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
              }}>
                🏢 {(task as any).tenant_slug}
              </span>
            )}

            {isOverdue && (
              <span style={{
                background: '#fee2e2',
                color: '#e74c3c',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                ⚠️ Overdue
              </span>
            )}
          </div>

          {/* Meta Info */}
          <div className="task-card__meta" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '6px',
          }}>

            {/* Assigned To */}
            {task.assigned_to_email && (
              <div style={{ fontSize: '12px', color: '#555', display: 'flex', gap: '4px' }}>
                <span>👤</span>
                <span><strong>Assigned to:</strong> {task.assigned_to_email}</span>
              </div>
            )}

            {/* Assigned By */}
            {(task as any).created_by_email && (
              <div style={{ fontSize: '12px', color: '#555', display: 'flex', gap: '4px' }}>
                <span>✍️</span>
                <span><strong>Assigned by:</strong> {(task as any).created_by_email}</span>
              </div>
            )}

            {/* Due Date */}
            {task.due_date && (
              <div style={{
                fontSize: '12px',
                color: isOverdue ? '#e74c3c' : '#555',
                display: 'flex',
                gap: '4px',
              }}>
                <span>📅</span>
                <span><strong>Due:</strong> {formatDate(task.due_date)}</span>
              </div>
            )}

            {/* Created At */}
            <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '4px' }}>
              <span>🕐</span>
              <span><strong>Created:</strong> {formatDateTime(task.created_at)}</span>
            </div>

            {/* Updated At */}
            {task.updated_at !== task.created_at && (
              <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '4px' }}>
                <span>✏️</span>
                <span><strong>Updated:</strong> {formatDateTime(task.updated_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Buttons */}
        <div className="task-card__actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '16px' }}>
          <button
            onClick={() => onEdit(task)}
            style={{
              padding: '6px 16px',
              background: '#3498db',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(task.id)}
            style={{
              padding: '6px 16px',
              background: '#e74c3c',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;