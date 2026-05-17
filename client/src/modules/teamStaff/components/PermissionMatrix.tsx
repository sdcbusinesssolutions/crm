import React from 'react';
import { MODULES, ACCESS_TYPES } from '../constants';
import {
    MessageIcon, UsersIcon, MegaphoneIcon, SparklesIcon, TriggerIcon,
    ListIcon, ClockIcon, TagIcon, EditIcon, AppointmentIcon,
    CatalogueIcon, ConditionIcon, LinkIcon, GalleryIcon
} from '../../../components/icons';

interface PermissionMatrixProps {
  permissions: Record<string, string>;
  onChange: (module: string, access: string) => void;
  loading?: boolean;
}

const getModuleBadge = (module: string) => {
  const iconClass = "w-4 h-4";
  switch (module) {
    case 'Inbox':
      return {
        icon: <MessageIcon className={iconClass} />,
        style: 'bg-blue-50 text-blue-600 border border-blue-100'
      };
    case 'LeadCRM':
      return {
        icon: <UsersIcon className={iconClass} />,
        style: 'bg-indigo-50 text-indigo-600 border border-indigo-100'
      };
    case 'Campaigns':
      return {
        icon: <MegaphoneIcon className={iconClass} />,
        style: 'bg-emerald-50 text-emerald-600 border border-emerald-100'
      };
    case 'Flows':
      return {
        icon: <TriggerIcon className={iconClass} />,
        style: 'bg-purple-50 text-purple-600 border border-purple-100'
      };
    case 'Drip Campaigns':
      return {
        icon: <ClockIcon className={iconClass} />,
        style: 'bg-amber-50 text-amber-600 border border-amber-100'
      };
    case 'G+Automation':
      return {
        icon: <ListIcon className={iconClass} />,
        style: 'bg-pink-50 text-pink-600 border border-pink-100'
      };
    case 'Whatsapp Templates':
      return {
        icon: <MessageIcon className={iconClass} />,
        style: 'bg-cyan-50 text-cyan-600 border border-cyan-100'
      };
    case 'Integrations':
      return {
        icon: <LinkIcon className={iconClass} />,
        style: 'bg-teal-50 text-teal-600 border border-teal-100'
      };
    case 'AI Buddy':
      return {
        icon: <SparklesIcon className={iconClass} />,
        style: 'bg-violet-50 text-violet-600 border border-violet-100'
      };
    case 'Gallery':
      return {
        icon: <GalleryIcon className={iconClass} />,
        style: 'bg-rose-50 text-rose-600 border border-rose-100'
      };
    case 'Contact List':
      return {
        icon: <ListIcon className={iconClass} />,
        style: 'bg-sky-50 text-sky-600 border border-sky-100'
      };
    case 'Contact Groups':
      return {
        icon: <UsersIcon className={iconClass} />,
        style: 'bg-indigo-50 text-indigo-600 border border-indigo-100'
      };
    case 'Pipelines':
      return {
        icon: <ConditionIcon className={iconClass} />,
        style: 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100'
      };
    case 'Follow-up':
      return {
        icon: <ClockIcon className={iconClass} />,
        style: 'bg-orange-50 text-orange-600 border border-orange-100'
      };
    case 'Form Builder':
      return {
        icon: <CatalogueIcon className={iconClass} />,
        style: 'bg-lime-50 text-lime-600 border border-lime-100'
      };
    case 'Tags':
      return {
        icon: <TagIcon className={iconClass} />,
        style: 'bg-violet-50 text-violet-600 border border-violet-100'
      };
    case 'Input Fields':
      return {
        icon: <EditIcon className={iconClass} />,
        style: 'bg-emerald-50 text-emerald-600 border border-emerald-100'
      };
    case 'Form Contact':
      return {
        icon: <AppointmentIcon className={iconClass} />,
        style: 'bg-sky-50 text-sky-600 border border-sky-100'
      };
    case 'Whatsapp Forms':
      return {
        icon: <CatalogueIcon className={iconClass} />,
        style: 'bg-amber-50 text-amber-600 border border-amber-100'
      };
    default:
      return {
        icon: <ConditionIcon className={iconClass} />,
        style: 'bg-slate-50 text-slate-600 border border-slate-100'
      };
  }
};

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
            {MODULES.map((module) => {
              const badge = getModuleBadge(module);
              return (
                <tr key={module} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-110 ${badge.style}`}>
                        {badge.icon}
                      </div>
                      <span className="text-[14px] font-bold text-slate-800 tracking-tight group-hover:text-indigo-900 transition-colors">{module}</span>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionMatrix;
