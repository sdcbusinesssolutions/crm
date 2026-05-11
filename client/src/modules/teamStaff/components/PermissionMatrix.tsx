import React from 'react';
import { MODULES, ACCESS_TYPES } from '../constants';

interface PermissionMatrixProps {
  permissions: Record<string, string>;
  onChange: (module: string, access: string) => void;
  loading?: boolean;
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ permissions, onChange, loading }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">CRM Module</th>
              {Object.entries(ACCESS_TYPES).map(([value, label]) => (
                <th key={value} className="px-4 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MODULES.map((module) => (
              <tr key={module} className="hover:bg-indigo-50/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 rounded-lg flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </div>
                    <span className="text-[14px] font-bold text-slate-700 tracking-tight">{module}</span>
                  </div>
                </td>
                {Object.keys(ACCESS_TYPES).map((value) => {
                  const isActive = permissions[module] === value;
                  
                  // Color coding based on access type
                  const activeColors = {
                    no_access: 'bg-slate-400 border-slate-400 shadow-slate-100',
                    read: 'bg-sky-500 border-sky-500 shadow-sky-100',
                    read_write: 'bg-indigo-600 border-indigo-600 shadow-indigo-100',
                    all_access: 'bg-emerald-500 border-emerald-500 shadow-emerald-100'
                  }[value] || 'bg-indigo-600 border-indigo-600 shadow-indigo-100';

                  const hoverColors = {
                    no_access: 'hover:border-slate-400',
                    read: 'hover:border-sky-400',
                    read_write: 'hover:border-indigo-400',
                    all_access: 'hover:border-emerald-400'
                  }[value] || 'hover:border-indigo-300';

                  return (
                    <td key={value} className="px-4 py-4 text-center">
                      <button
                        onClick={() => onChange(module, value)}
                        disabled={loading}
                        className={`w-7 h-7 rounded-full border-2 transition-all duration-300 flex items-center justify-center mx-auto
                          ${isActive 
                            ? `${activeColors} shadow-lg scale-110` 
                            : `border-slate-200 ${hoverColors} bg-white shadow-sm`}`}
                      >
                        {isActive && (
                          <svg className="w-4 h-4 text-white animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionMatrix;
