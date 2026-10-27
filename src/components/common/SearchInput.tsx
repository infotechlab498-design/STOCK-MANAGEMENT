import React, { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  maxWidth?: number | string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search records...',
  className = '',
  maxWidth,
  ...props
}) => {
  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div
      className={`search-input-wrapper ${className}`.trim()}
      style={{ maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : undefined }}
    >
      <Search size={16} className="search-input-icon" aria-hidden="true" />
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        {...props}
      />
      {value && (
        <button
          type="button"
          className="search-input-clear"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search input"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
