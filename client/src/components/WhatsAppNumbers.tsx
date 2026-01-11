
import React, { useState, useEffect } from 'react';
import { whatsappService } from '../services/whatsappService';
import { WhatsAppNumber } from '../types';
import { PlusIcon, EditIcon, TrashIcon, PhoneIcon, BadgeIcon, CloseIcon } from './icons';

const WhatsAppNumbers: React.FC = () => {
    const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNumber, setEditingNumber] = useState<WhatsAppNumber | null>(null);
    const [formData, setFormData] = useState<Partial<WhatsAppNumber>>({ verifiedName: '', businessApp: 'Cloud API', phoneNumber: '', phoneNumberId: '', wabaId: '', quality: 'GREEN', throughput: 'STANDARD' });

    useEffect(() => { loadNumbers(); }, []);
    const loadNumbers = async () => { setIsLoading(true); const data = await whatsappService.getNumbers(); setNumbers(data); setIsLoading(false); };

    const handleOpenModal = (num?: WhatsAppNumber) => {
        if (num) { setEditingNumber(num); setFormData(num); } else { setEditingNumber(null); setFormData({ verifiedName: '', businessApp: 'Cloud API', phoneNumber: '', phoneNumberId: '', wabaId: '', quality: 'GREEN', throughput: 'STANDARD' }); }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const newNumber: WhatsAppNumber = { id: editingNumber ? editingNumber.id : `wn-${Date.now()}`, verifiedName: formData.verifiedName || 'Unnamed', businessApp: formData.businessApp || 'Cloud API', phoneNumber: formData.phoneNumber || '', phoneNumberId: formData.phoneNumberId || '', wabaId: formData.wabaId || '', quality: (formData.quality as any) || 'GREEN', throughput: (formData.throughput as any) || 'STANDARD' };
        await whatsappService.saveNumber(newNumber); await loadNumbers(); setIsModalOpen(false);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault(); e.stopPropagation();
        if(window.confirm("Delete?")) { await whatsappService.deleteNumber(id); await loadNumbers(); }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div><h1 className="text-2xl font-bold text-gray-900">WhatsApp Numbers</h1><p className="text-gray-500 text-sm mt-1">Manage your WhatsApp Business API numbers.</p></div>
                <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-btn font-medium shadow-sm transition-colors text-sm"><PlusIcon /><span>Add Phone Number</span></button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {isLoading ? ( <div className="flex justify-center items-center h-40 text-gray-500">Loading...</div> ) : numbers.length === 0 ? ( <div className="text-center py-20 text-gray-500">No WhatsApp numbers added yet.</div> ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business App</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">{numbers.map(num => ( <tr key={num.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-4 whitespace-nowrap text-brand-500 font-medium">{num.verifiedName}</td><td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">☁ {num.businessApp}</span></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{num.phoneNumber}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"><button onClick={() => handleOpenModal(num)} className="text-gray-400 hover:text-brand-600 p-1 rounded"><EditIcon /></button><button onClick={(e) => handleDelete(e, num.id)} className="text-gray-400 hover:text-red-600 p-1 rounded"><TrashIcon /></button></td></tr> ))}</tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50"><h3 className="text-lg font-bold text-gray-900">{editingNumber ? 'Edit Number' : 'Add WhatsApp Number'}</h3><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-200"><CloseIcon className="w-6 h-6" /></button></div>
                        <div className="p-6 overflow-y-auto"><form id="wa-form" onSubmit={handleSave} className="space-y-5"><div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Verified Name</label><input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-btn focus:ring-2 focus:ring-brand-500 text-gray-900 outline-none" value={formData.verifiedName} onChange={e => setFormData({...formData, verifiedName: e.target.value})} /></div><div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><PhoneIcon /></div><input type="tel" required className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-btn focus:ring-2 focus:ring-brand-500 text-gray-900 outline-none" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} /></div></div></form></div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3"><button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-btn text-gray-700 bg-white hover:bg-gray-50 font-medium shadow-sm">Cancel</button><button type="submit" form="wa-form" className="px-5 py-2.5 bg-brand-600 text-white rounded-btn hover:bg-brand-700 font-medium shadow-sm flex items-center space-x-2"><BadgeIcon /><span>Save</span></button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default WhatsAppNumbers;
