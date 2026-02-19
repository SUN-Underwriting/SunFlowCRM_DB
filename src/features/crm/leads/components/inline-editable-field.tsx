'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MaskInput } from '@/components/ui/mask-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

interface InlineEditableFieldProps {
  value: string | number | null | undefined;
  displayValue?: string;
  onSave: (value: string | number | null) => void;
  type?: 'text' | 'number' | 'date' | 'select' | 'currency';
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineEditableField({
  value,
  displayValue,
  onSave,
  type = 'text',
  options = [],
  placeholder = 'Click to edit',
  className,
  disabled = false
}: InlineEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(String(value ?? ''));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = editValue.trim();

    if (trimmed === String(value ?? '')) return;

    if (type === 'number' || type === 'currency') {
      const num = parseFloat(trimmed);
      onSave(trimmed === '' ? null : isNaN(num) ? null : num);
    } else if (type === 'date') {
      onSave(trimmed || null);
    } else {
      onSave(trimmed || null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''));
      setEditing(false);
    }
  };

  if (type === 'select') {
    return (
      <Select
        value={String(value ?? '')}
        onValueChange={(v) => onSave(v)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn('h-auto border-transparent bg-transparent px-1 py-0.5 shadow-none hover:border-input', className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (editing && type === 'date') {
    const dateValue =
      typeof editValue === 'string' && editValue
        ? new Date(editValue)
        : undefined;
    const safeDate =
      dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : undefined;

    return (
      <div className={cn('inline-block min-w-[220px]', className)}>
        <DatePicker
          value={safeDate}
          onChange={(d) => {
            setEditing(false);
            onSave(d ? d.toISOString().split('T')[0] : null);
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    );
  }

  if (editing && type === 'currency') {
    return (
      <MaskInput
        mask='currency'
        currency='CHF'
        placeholder='0.00'
        value={editValue}
        onValueChange={(_masked, unmasked) => setEditValue(unmasked)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn('h-auto px-1 py-0.5 text-sm', className)}
        disabled={disabled}
        autoFocus
      />
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn('h-auto px-1 py-0.5 text-sm', className)}
        disabled={disabled}
      />
    );
  }

  const display = displayValue ?? String(value ?? '');

  return (
    <span
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        'inline-block min-w-[40px] cursor-pointer rounded px-1 py-0.5 text-sm transition-colors hover:bg-muted',
        !display && 'text-muted-foreground italic',
        disabled && 'cursor-default',
        className
      )}
    >
      {display || placeholder}
    </span>
  );
}
