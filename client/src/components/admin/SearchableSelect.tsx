import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Select an option', className = '' }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) || opt.value.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={wrapperRef}>
            <div
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-black hover:border-[#006B4D]/50 focus-within:ring-4 focus-within:ring-[#006B4D]/10 focus-within:border-[#006B4D] outline-none transition-all duration-200 cursor-pointer flex justify-between items-center shadow-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedOption ? 'text-black' : 'text-slate-400 font-normal'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] max-h-56 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top">
                    <div className="p-3 border-b border-slate-50 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-black outline-none focus:border-[#006B4D] focus:ring-4 focus:ring-[#006B4D]/10 transition-all placeholder:font-normal placeholder:text-slate-400"
                                placeholder="Search templates..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scroll-smooth">
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-sm font-medium text-slate-400 text-center flex flex-col items-center justify-center gap-2">
                                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    className={`px-4 py-3 text-sm rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-between group ${opt.value === value ? 'bg-[#006B4D]/10 text-[#006B4D] font-bold' : 'text-slate-800 hover:bg-slate-50 font-medium hover:text-black'}`}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    <span className="truncate pr-4">{opt.label}</span>
                                    {opt.value === value && (
                                        <svg className="w-4 h-4 text-[#006B4D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
