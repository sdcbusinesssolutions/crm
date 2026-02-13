
import React, { useState, useEffect } from 'react';
import { inputFieldService } from '../services/inputFieldService';
import { InputField } from '../types';
import { PlusIcon, EditIcon, TrashIcon, CloseIcon, SearchIcon } from './icons';

const InputFields: React.FC = () => {
    const [inputs, setInputs] = useState<InputField[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInput, setEditingInput] = useState<InputField | null>(null);
    const [formData, setFormData] = useState<Partial<InputField>>({ name: '', type: 'text', placeholder: '' });

    useEffect(() => {
        loadInputs();
    }, []);

    const loadInputs = async () => {
        setIsLoading(true);
        const data = await inputFieldService.getInputs();
        setInputs(data);
        setIsLoading(false);
    };

    const handleOpenModal = (input?: InputField) => {
        if (input) { setEditingInput(input); setFormData({ ...input }); }
        else { setEditingInput(null); setFormData({ name: '', type: 'text', placeholder: '' }); }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const newInput: InputField = { id: editingInput ? editingInput.id : `inp-${Date.now()}`, name: formData.name || 'Unnamed', type: formData.type || 'text', placeholder: formData.placeholder || '' };
        await inputFieldService.saveInput(newInput); await loadInputs(); setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete field?')) { await inputFieldService.deleteInput(id); await loadInputs(); }
    };

    const filteredInputs = inputs.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalPages = Math.ceil(filteredInputs.length / entriesPerPage);
    const currentEntries = filteredInputs.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
    const inputTypeOptions = [{ label: 'Text', value: 'text' }, { label: 'Number', value: 'number' }, { label: 'Email', value: 'email' }, { label: 'URL', value: 'url' }, { label: 'Date', value: 'date' }];

    return (
        <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 animate-fade-in relative overflow-hidden container-mobile-fix">
            {/* Sticky Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-3 max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Custom Fields</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Manage custom data fields for your contacts.</p>
                    </div>
                    <button onClick={() => handleOpenModal()} className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm w-full sm:w-auto">
                        <PlusIcon /><span>Add Field</span>
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto space-y-6">
                    <div className="flex justify-end">
                        <div className="relative group w-full sm:w-72">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600 group-focus-within:text-brand-600 transition-colors"><SearchIcon /></div>
                            <input type="text" placeholder="Search fields..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-white border border-brand-600 rounded-btn focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm outline-none transition-all placeholder:text-slate-400" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="hidden md:block overflow-x-auto flex-1">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-brand-600 text-white shadow-md">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Field Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Data Type</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {isLoading ? (
                                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400"><div className="inline-block w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></div>Loading...</td></tr>
                                    ) : filteredInputs.length === 0 ? (
                                        <tr><td colSpan={3} className="px-6 py-16 text-center text-slate-500">No input fields found.</td></tr>
                                    ) : (
                                        currentEntries.map((input) => (
                                            <tr key={input.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4 text-sm font-bold text-slate-900">{input.name}</td>
                                                <td className="px-6 py-4 text-sm text-slate-500"><span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-mono border border-slate-200">{inputTypeOptions.find(o => o.value === input.type)?.label || input.type}</span></td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleOpenModal(input)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-brand-600 border border-slate-200 hover:border-brand-200 transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDelete(input.id)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile */}
                        <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-slate-50/50">
                            {currentEntries.map((input) => (
                                <div key={input.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div><h3 className="font-bold text-slate-900 text-lg">{input.name}</h3><span className="inline-block mt-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono border border-slate-200">{inputTypeOptions.find(o => o.value === input.type)?.label || input.type}</span></div>
                                        <div className="flex gap-2"><button onClick={() => handleOpenModal(input)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-brand-600 border border-slate-200 hover:border-brand-200"><EditIcon className="w-4 h-4" /></button><button onClick={() => handleDelete(input.id)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200"><TrashIcon className="w-4 h-4" /></button></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm">Prev</button>
                                <div className="px-4 py-2 bg-brand-600 text-white rounded-btn text-sm font-bold shadow-sm shadow-brand-200">{currentPage}</div>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm">Next</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up sm:animate-fade-in">
                        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                            <h3 className="text-lg font-extrabold text-slate-900">{editingInput ? 'Edit Field' : 'New Field'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <form id="input-form" onSubmit={handleSave}>
                                <div className="mb-5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 text-slate-900 outline-none font-medium transition-all" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data Type</label><div className="relative"><select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 text-slate-900 outline-none font-medium appearance-none" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>{inputTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div></div>
                            </form>
                        </div>
                        <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-btn font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">Cancel</button>
                            <button type="submit" form="input-form" className="px-6 py-3 bg-brand-600 text-white rounded-btn font-bold hover:bg-brand-700 shadow-md shadow-brand-200 transition-transform transform hover:-translate-y-0.5">Save Field</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default InputFields;
