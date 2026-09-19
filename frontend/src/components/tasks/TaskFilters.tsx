interface TaskFiltersProps {
  status: string;
  onStatusChange: (status: string) => void;
}

const TaskFilters = ({ status, onStatusChange }: TaskFiltersProps) => {
  return (
    <div className="status-filters" style={{ display: 'flex', gap: '8px' }}>
      {['all', 'todo', 'in_progress', 'done'].map((s) => (
        <button
          key={s}
          onClick={() => onStatusChange(s === 'all' ? '' : s)}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid #ddd',
            background: status === (s === 'all' ? '' : s) ? '#3498db' : '#fff',
            color: status === (s === 'all' ? '' : s) ? '#fff' : '#333',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </div>
  );
};

export default TaskFilters;