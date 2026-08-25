import React, { useState, useEffect } from 'react';
import { customMenuService, CustomMenu as CustomMenuType } from '../services/customMenuService';

// Reusing basic icons for consistency without needing external imports if they don't exist
const PlusIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const SearchIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const TrashIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CloseIcon = ({ className = "w-5 h-5" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const LinkIcon = ({ className = "w-8 h-8 text-slate-300" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;

const CustomMenu: React.FC = () => {
    const [menus, setMenus] = useState<CustomMenuType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage] = useState(10);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: '', type: 'URL', value: '' });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchMenus();
    }, []);

    const fetchMenus = async () => {
        setIsLoading(true);
        const data = await customMenuService.getMenus();
        setMenus(data);
        setIsLoading(false);
    };

    const handleOpenModal = () => {
        setFormData({ name: '', type: 'URL', value: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({ name: '', type: 'URL', value: '' });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.value) return;

        let formattedValue = formData.value;
        if (formData.type === 'URL' && !formattedValue.startsWith('http://') && !formattedValue.startsWith('https://')) {
            formattedValue = `https://${formattedValue}`;
        }

        setIsSubmitting(true);
        const newMenu = await customMenuService.createMenu({
            ...formData,
            value: formattedValue
        });
        
        if (newMenu) {
            setMenus([newMenu, ...menus]);
            handleCloseModal();
        }
        setIsSubmitting(false);
    };

    const handleDeleteClick = (id: string) => {
        setMenuToDelete(id);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!menuToDelete) return;
        
        setIsDeleting(true);
        const success = await customMenuService.deleteMenu(menuToDelete);
        if (success) {
            setMenus(menus.filter(m => m.id !== menuToDelete));
            setDeleteModalOpen(false);
            setMenuToDelete(null);
        }
        setIsDeleting(false);
    };

    const cancelDelete = () => {
        setDeleteModalOpen(false);
        setMenuToDelete(null);
    };

    const filteredMenus = menus.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const totalPages = Math.ceil(filteredMenus.length / entriesPerPage) || 1;
    const currentEntries = filteredMenus.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <>
            <div className="p-4 sm:p-8 space-y-6 animate-fade-in h-full overflow-y-auto bg-slate-50">
                {/* Header Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:max-w-2xl">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600 group-focus-within:text-brand-600 transition-colors">
                            <SearchIcon />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Search references..." 
                            value={searchTerm} 
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                            className="pl-10 pr-4 py-2.5 w-full bg-white border border-brand-600 rounded-btn focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm outline-none transition-all placeholder:text-slate-400" 
                        />
                    </div>
                </div>
                
                <button 
                    onClick={handleOpenModal} 
                    className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm w-full sm:w-auto"
                >
                    <PlusIcon />
                    <span>Create Reference</span>
                </button>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-slate-400">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                        Loading references...
                    </div>
                ) : filteredMenus.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <LinkIcon />
                        </div>
                        <p className="text-slate-900 font-bold text-lg">No references found</p>
                        <p className="text-slate-500 mt-1">Create your first reference to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-brand-600 text-white shadow-md">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Value</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {currentEntries.map((menu) => (
                                    <tr key={menu.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-slate-900">{menu.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                                                {menu.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {menu.type === 'URL' ? (
                                                <a 
                                                    href={menu.value} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                                >
                                                    <span>Open Link</span>
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                </a>
                                            ) : (
                                                <span className="break-all">{menu.value}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {formatDate(menu.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end">
                                                {!menu.is_global && (
                                                    <button 
                                                        onClick={() => handleDeleteClick(menu.id)} 
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors group" 
                                                        title="Delete"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                )}
                                                {menu.is_global && (
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Global</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {filteredMenus.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm">Previous</button>
                            <div className="px-4 py-2 bg-brand-600 text-white rounded-btn text-sm font-bold shadow-sm shadow-brand-200">{currentPage}</div>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm">Next</button>
                        </div>
                    </div>
                )}
            </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={handleCloseModal}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-900">Add New Reference</h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Support Portal"
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Type</label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm outline-none"
                                    >
                                        <option value="URL">URL Link</option>
                                        <option value="Text">Text Reference</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Value <span className="text-red-500">*</span></label>
                                    <input
                                        type={formData.type === 'URL' ? 'url' : 'text'}
                                        name="value"
                                        value={formData.value}
                                        onChange={handleInputChange}
                                        placeholder={formData.type === 'URL' ? "https://example.com" : "Some reference data"}
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm outline-none"
                                    />
                                </div>
                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-btn transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !formData.name || !formData.value}
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-btn transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            'Save Entry'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={cancelDelete}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative z-10 animate-fade-in-up text-center p-6 sm:p-8">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-6">
                            <TrashIcon className="h-8 w-8 text-rose-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Reference</h3>
                        <p className="text-sm text-slate-500 mb-8">
                            Are you sure you want to delete this reference? This action cannot be undone.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                            <button
                                type="button"
                                onClick={cancelDelete}
                                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-btn transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={confirmDelete}
                                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-btn transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                            >
                                {isDeleting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    'Yes, Delete'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CustomMenu;
