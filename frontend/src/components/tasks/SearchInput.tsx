import { useState, useEffect } from 'react';
import useDebounce from '../../hooks/useDebounce';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
}

const SearchInput = ({ onSearch, placeholder = 'Search tasks...' }: SearchInputProps) => {
  const [value, setValue] = useState('');
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '10px 14px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '14px',
        width: '280px',
        outline: 'none',
      }}
    />
  );
};

export default SearchInput;