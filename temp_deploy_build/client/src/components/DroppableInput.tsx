import React, { useRef, useCallback } from 'react';

interface DroppableInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    maxLength?: number;
    multiline?: boolean;
    rows?: number;
    className?: string;
    theme?: 'light' | 'dark';
    onFocus?: (insert: (token: string) => void) => void;
    id?: string;
    isActive?: boolean;
    type?: string;
    disabled?: boolean;
}

const DroppableInput: React.FC<DroppableInputProps> = ({
    value,
    onChange,
    placeholder,
    maxLength,
    multiline = false,
    rows = 3,
    className = '',
    theme = 'dark',
    onFocus,
    id,
    isActive = false,
    type = 'text',
    disabled
}) => {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const valueRef = useRef(value);
    const lastSelection = useRef({ start: 0, end: 0 });

    // Update valueRef whenever value changes
    React.useEffect(() => {
        valueRef.current = value;
    }, [value]);

    const updateSelection = () => {
        if (inputRef.current) {
            lastSelection.current = {
                start: inputRef.current.selectionStart ?? valueRef.current.length,
                end: inputRef.current.selectionEnd ?? valueRef.current.length
            };
        }
    };

    const insertVariable = useCallback((token: string) => {
        if (!token) return;

        const input = inputRef.current;
        const currentValue = valueRef.current;

        if (input) {
            // Use tracked selection to ensure we insert where the user was
            const startPos = lastSelection.current.start;
            const endPos = lastSelection.current.end;

            const newValue = currentValue.substring(0, startPos) + token + currentValue.substring(endPos);

            if (maxLength && newValue.length > maxLength) return;

            onChange(newValue);

            setTimeout(() => {
                input.focus();
                const newCursorPos = startPos + token.length;
                input.setSelectionRange(newCursorPos, newCursorPos);
                // Update selection after insertion
                lastSelection.current = { start: newCursorPos, end: newCursorPos };
            }, 0);
        }
    }, [maxLength, onChange]);

    const handleInputFocus = () => {
        // Update selection on focus/click
        updateSelection();

        if (onFocus) {
            onFocus(insertVariable);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        const variableToken = e.dataTransfer.getData('application/vnd.flow.variable');
        e.preventDefault();
        e.stopPropagation();

        if (variableToken && variableToken !== 'undefined' && variableToken !== 'null') {
            const input = inputRef.current;
            if (input) {
                const startPos = input.selectionStart ?? value.length;
                const endPos = input.selectionEnd ?? value.length;

                const newValue = value.substring(0, startPos) + variableToken + value.substring(endPos);

                if (maxLength && newValue.length > maxLength) return;

                onChange(newValue);

                setTimeout(() => {
                    input.focus();
                    const newCursorPos = startPos + variableToken.length;
                    input.setSelectionRange(newCursorPos, newCursorPos);
                    lastSelection.current = { start: newCursorPos, end: newCursorPos };
                }, 0);
            }
        }
    };

    const baseClasses = `w-full p-2.5 border rounded-lg shadow-sm text-sm outline-none transition-all duration-200 ${theme === 'dark'
        ? `bg-slate-950 text-slate-200 placeholder-slate-600 ${isActive ? 'border-brand-500 ring-1 ring-brand-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'}`
        : `bg-white text-gray-900 ${isActive ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'}`
        } ${disabled ? 'opacity-50 cursor-not-allowed text-slate-500' : ''}`;

    return (
        <div className={`relative ${className}`}>
            {multiline ? (
                <textarea
                    ref={inputRef as any}
                    value={value}
                    onChange={(e) => { onChange(e.target.value); updateSelection(); }}
                    onFocus={handleInputFocus}
                    onBlur={updateSelection}
                    onSelect={updateSelection}
                    onKeyUp={updateSelection}
                    onClick={handleInputFocus}
                    onTouchEnd={handleInputFocus}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder={placeholder}
                    rows={rows}
                    maxLength={maxLength}
                    disabled={disabled}
                    className={`${baseClasses} resize-none leading-relaxed`}
                />
            ) : (
                <input
                    ref={inputRef as any}
                    type={type}
                    value={value}
                    onChange={(e) => { onChange(e.target.value); updateSelection(); }}
                    onFocus={handleInputFocus}
                    onBlur={updateSelection}
                    onSelect={updateSelection}
                    onKeyUp={updateSelection}
                    onClick={handleInputFocus}
                    onTouchEnd={handleInputFocus}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    disabled={disabled}
                    className={baseClasses}
                />
            )}
            {maxLength && (
                <div className="text-right text-[10px] mt-1 text-slate-500">
                    {maxLength - value.length} chars left
                </div>
            )}
        </div>
    );
};

export default DroppableInput;
