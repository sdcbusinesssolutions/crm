import React, { useState } from 'react';
import { tokenService } from '../services/tokenService';
import { ChevronDownIcon, DownloadIcon } from './icons';

interface FacebookPage {
  id: string; // Facebook Page ID
  name: string; // Facebook Page Name
}

interface LeadForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
  expired_leads_count: number;
}

interface LeadData {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
}

const FacebookLeadForms = ({ pages }: { pages: FacebookPage[] }) => {
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [leads, setLeads] = useState<LeadData[]>([]);
  
  const [loadingForms, setLoadingForms] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  const handlePageSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pageId = e.target.value;
    setSelectedPageId(pageId);
    setSelectedFormId('');
    setForms([]);
    setLeads([]);
    setCurrentPage(1);
    
    if (!pageId) return;

    setLoadingForms(true);
    setError(null);
    try {
      const authHeader = await tokenService.getAuthHeader();
      const res = await fetch(`/api/click-to-whatsapp/pages/${pageId}/forms`, {
        headers: authHeader
      });
      const result = await res.json();
      if (res.ok) {
        setForms(result || []);
      } else {
        setError(result.error || 'Failed to fetch forms');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingForms(false);
    }
  };

  const handleFormSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const formId = e.target.value;
    setSelectedFormId(formId);
    setLeads([]);
    setCurrentPage(1);
    
    if (!formId) return;

    setLoadingLeads(true);
    setError(null);
    try {
      const authHeader = await tokenService.getAuthHeader();
      const res = await fetch(`/api/click-to-whatsapp/pages/${selectedPageId}/forms/${formId}/leads`, {
        headers: authHeader
      });
      const result = await res.json();
      if (res.ok) {
        setLeads(result || []);
      } else {
        setError(result.error || 'Failed to fetch leads');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Extract unique column headers from field_data across all leads
  const allFieldNames = new Set<string>();
  leads.forEach(lead => {
    lead.field_data?.forEach(field => {
      allFieldNames.add(field.name);
    });
  });
  const columns = Array.from(allFieldNames);

  const totalLeads = leads.length;
  const totalPages = Math.ceil(totalLeads / entriesPerPage);
  const paginatedLeads = leads.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;
    
    const headers = ['Created Time', ...columns.map(col => col.replace(/_/g, ' '))];
    const rows = leads.map(lead => {
      const fieldMap: Record<string, string> = {};
      lead.field_data?.forEach(f => {
        fieldMap[f.name] = f.values.join(', ');
      });
      
      const rowData = [
        `"${new Date(lead.created_time).toLocaleString().replace(/"/g, '""')}"`,
        ...columns.map(col => `"${(fieldMap[col] || '').replace(/"/g, '""')}"`)
      ];
      return rowData.join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `facebook_leads_${selectedFormId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="ctwa-leads-container pb-8 pt-4">

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 font-medium shadow-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3 flex-1 xl:flex-nowrap lg:max-w-none">
            {/* Facebook Page Dropdown */}
            <div className="relative">
              <select
                value={selectedPageId}
                onChange={handlePageSelect}
                className="pl-4 pr-8 py-2 w-full sm:w-64 bg-white border border-[var(--color-brand)] rounded-xl focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-sm shadow-sm outline-none transition-all appearance-none text-slate-600 font-medium cursor-pointer"
              >
                <option value="">-- Select a Facebook Page --</option>
                {pages.map(page => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                <ChevronDownIcon className="w-3 h-3" />
              </div>
            </div>

            {/* Lead Form Dropdown */}
            <div className="relative">
              <select
                value={selectedFormId}
                onChange={handleFormSelect}
                disabled={!selectedPageId || loadingForms}
                className="pl-4 pr-8 py-2 w-full sm:w-64 bg-white border border-[var(--color-brand)] rounded-xl focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-sm shadow-sm outline-none transition-all appearance-none text-slate-600 font-medium cursor-pointer disabled:opacity-50"
              >
                <option value="">
                  {!selectedPageId 
                    ? 'Select a page first' 
                    : loadingForms 
                      ? 'Loading Forms...' 
                      : '-- Select a Form --'}
                </option>
                {forms.map(form => (
                  <option key={form.id} value={form.id}>
                    {form.name} (Leads: {form.leads_count})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                <ChevronDownIcon className="w-3 h-3" />
              </div>
            </div>
          </div>
          
          {selectedFormId && leads.length > 0 && (
            <div className="flex items-center gap-3">
              <button 
                onClick={exportToCSV}
                className="px-4 py-2 text-sm font-bold bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center gap-2 transition-all shadow-sm"
              >
                <DownloadIcon className="w-4 h-4 text-slate-500" />
                Export CSV
              </button>
            </div>
          )}
        </div>

        {selectedFormId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {loadingLeads && (
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-center">
                <div className="text-sm font-bold text-slate-400 animate-pulse">Fetching leads...</div>
              </div>
            )}

            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-full border-collapse text-left text-sm whitespace-nowrap">
                <thead className="bg-brand-600 text-white shadow-md">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created Time</th>
                    {columns.map(col => (
                      <th key={col} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">{col.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {leads.length === 0 && !loadingLeads ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-400">
                        No leads found for this form.
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map(lead => {
                      // Map field data easily
                      const fieldMap: Record<string, string> = {};
                      lead.field_data?.forEach(f => {
                        fieldMap[f.name] = f.values.join(', ');
                      });

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 border-b border-slate-100 text-slate-600 font-semibold text-xs">
                            {new Date(lead.created_time).toLocaleString()}
                          </td>
                          {columns.map(col => (
                            <td key={col} className="px-6 py-4 border-b border-slate-100 text-slate-600 font-semibold text-sm">
                              {fieldMap[col] || '-'}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalLeads > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 text-sm text-slate-500 font-medium order-2 xl:order-1">
                        <span>
                            Showing <span className="font-bold text-slate-700">{(currentPage - 1) * entriesPerPage + 1}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * entriesPerPage, totalLeads)}</span> of <span className="font-bold text-slate-700">{totalLeads}</span> entries
                        </span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2 outline-none font-bold"
                        >
                            <option value={10}>10 rows</option>
                            <option value={25}>25 rows</option>
                            <option value={50}>50 rows</option>
                            <option value={100}>100 rows</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1 order-1 xl:order-2">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold shadow-sm transition-all"
                        >
                            Prev
                        </button>

                        <div className="flex items-center gap-1 mx-2">
                            {getPageNumbers().map((page, idx) => (
                                page === '...' ? (
                                    <span key={`ell-${idx}`} className="px-2 text-slate-400 font-bold">...</span>
                                ) : (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentPage(Number(page))}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all shadow-sm border ${currentPage === page
                                            ? 'bg-brand-600 text-white border-brand-600 shadow-brand-200 shadow-md transform scale-105'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold shadow-sm transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
          </div>
        )}
      </div>
  );
};

export default FacebookLeadForms;
