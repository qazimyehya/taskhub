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

const TaskCard = ({ task, onEdit, onDelete }: TaskCardProps) => {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eee',
      borderRadius: '10px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600 }}>
            {task.title}
          </h3>
          {task.description && (
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#666' }}>
              {task.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
            )}
            {task.project_name && (
              <span style={{
                background: '#f0f0f0',
                color: '#555',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
              }}>
                {task.project_name}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
          <button
            onClick={() => onEdit(task)}
            style={{
              padding: '6px 12px',
              background: '#3498db',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(task.id)}
            style={{
              padding: '6px 12px',
              background: '#e74c3c',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
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