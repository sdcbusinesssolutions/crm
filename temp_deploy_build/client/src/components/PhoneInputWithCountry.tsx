import React, { useState, useEffect, useMemo } from 'react';
import { countries } from '../utils/countries';
import { ChevronDownIcon, SearchIcon, CheckIcon } from './icons';

interface PhoneInputWithCountryProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
    disabled?: boolean;
}

const PhoneInputWithCountry: React.FC<PhoneInputWithCountryProps> = ({
    value = '',
    onChange,
    placeholder = '9876543210',
    required = false,
    className = '',
    disabled = false
}) => {
    const [countryCode, setCountryCode] = useState('+91');
    const [localPhone, setLocalPhone] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Sort countries by code length for accurate parsing
    const sortedCountries = useMemo(() => {
        return [...countries].sort((a, b) => b.code.length - a.code.length);
    }, []);

    // Parse initial value
    useEffect(() => {
        // If value is empty, just reset local but keep default country or current country
        if (!value) {
            setLocalPhone('');
            return;
        }

        // Check if value already matches current state reconstruction
        const currentFull = countryCode.replace('+', '') + localPhone;
        // Strict check: if value passed in matches what we think it is, don't re-parse 
        // (avoids cursor jump or logic loops)
        if (value === currentFull) return;

        let matched = false;
        for (const c of sortedCountries) {
            const cleanCode = c.code.replace('+', '');
            if (value.startsWith(cleanCode)) {
                setCountryCode(c.code);
                setLocalPhone(value.substring(cleanCode.length));
                matched = true;
                break;
            }
        }

        if (!matched) {
            // If no country code match found in the prefix, assume it is just a local number
            // or the country code is missing. We won't change the country code 
            // (user might have selected it manually) but we set the whole value as local
            // UNLESS it's a new load.
            setLocalPhone(value);
        }
    }, [value, sortedCountries]);

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        if (val.length > 10) return;
        setLocalPhone(val);

        if (onChange) {
            const cleanCountry = countryCode.replace('+', '');
            onChange(`${cleanCountry}${val}`);
        }
    };

    const handleCountryChange = (code: string) => {
        setCountryCode(code);
        setIsDropdownOpen(false);
        if (onChange) {
            const cleanCountry = code.replace('+', '');
            onChange(`${cleanCountry}${localPhone}`);
        }
    };


    return (
        <div className={`flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all relative ${className}`}>
            <div className="relative border-r border-slate-200 bg-slate-50 min-w-[120px] rounded-l-xl">
                <button
                    type="button"
                    disabled={disabled}
                    className="w-full h-full px-3 py-3 flex items-center justify-between gap-2 text-sm font-bold text-slate-700 outline-none rounded-l-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                        setIsDropdownOpen(!isDropdownOpen);
                        setSearchTerm('');
                    }}
                >
                    <span className="truncate">{countries.find(c => c.code === countryCode)?.flag} {countryCode}</span>
                    <ChevronDownIcon className="w-3 h-3 text-slate-400 pointer-events-none shrink-0" />
                </button>

                {isDropdownOpen && !disabled && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                        <div className="absolute top-full left-0 w-[300px] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in mt-1 flex flex-col max-h-[300px]">
                            <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                                <div className="relative">
                                    <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Search country..."
                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                {sortedCountries
                                    .filter(c =>
                                        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        c.code.includes(searchTerm)
                                    )
                                    .map((c) => (
                                        <button
                                            key={`${c.code}-${c.name}`}
                                            type="button"
                                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-sm flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0 ${countryCode === c.code ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCountryChange(c.code);
                                            }}
                                        >
                                            <span className="text-xl leading-none">{c.flag}</span>
                                            <span className="font-bold min-w-[3rem]">{c.code}</span>
                                            <span className="text-slate-600 truncate flex-1">{c.name}</span>
                                            {countryCode === c.code && <CheckIcon className="w-4 h-4 text-brand-600 ml-2" />}
                                        </button>
                                    ))}
                                {sortedCountries.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.includes(searchTerm)).length === 0 && (
                                    <div className="p-8 text-center text-slate-400">
                                        <p className="text-sm">No countries found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <input
                type="tel"
                required={required}
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-slate-900 outline-none font-medium placeholder-slate-300 rounded-r-xl disabled:bg-slate-50 disabled:text-slate-500"
                placeholder={placeholder}
                value={localPhone}
                maxLength={10}
                onChange={handleLocalChange}
            />
        </div>
    );
};

export default PhoneInputWithCountry;
