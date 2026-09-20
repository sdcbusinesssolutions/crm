import React, { useState, useEffect } from 'react';
import { integrationsService } from '../../services/integrationsService';
import Modal from '../Modal';

const SmtpIcon = () => (
    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    </div>
);

const SmtpCard: React.FC = () => {
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);

    // Auth Modal State
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [data, setData] = useState({
        name: '',
        host: '',
        port: '',
        user: '',
        pass: '',
        fromEmail: '',
        encryption: ''
    });

    // Notification State
    const [notification, setNotification] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        loadConnections();
    }, []);

    const showNotification = (title: string, message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ isOpen: true, title, message, type });
    };

    const loadConnections = async () => {
        try {
            const res = await integrationsService.getSmtpConnections();
            setConnections(res);
        } catch (e) {
            console.error('Failed to load SMTP connections', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!data.host || !data.port || !data.user || !data.pass) {
            showNotification('Validation Error', 'Please fill in Host, Port, Username and Password.', 'error');
            return;
        }

        setConnecting(true);
        try {
            await integrationsService.saveSmtpConnection(data);
            setShowAuthModal(false);
            setData({ name: '', host: '', port: '', user: '', pass: '', fromEmail: '', encryption: '' });
            await loadConnections();
            showNotification('Success', 'SMTP Connection Saved & Verified!', 'success');
        } catch (e: any) {
            showNotification('Connection Failed', e.message, 'error');
        } finally {
            setConnecting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this connection?')) return;
        try {
            await integrationsService.deleteSmtpConnection(id);
            await loadConnections();
            showNotification('Deleted', 'Account removed successfully.', 'success');
        } catch (e: any) {
            showNotification('Error', 'Failed to delete: ' + e.message, 'error');
        }
    };

    return (
        <>
            <div className="bg-white p-6 rounded-2xl border-2 border-orange-100 shadow-sm hover:shadow-md hover:border-orange-300 transition-all flex flex-col items-start h-full">
                <div className="flex justify-between items-start w-full mb-4">
                    <SmtpIcon />
                    {connections.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            {connections.length} Connected
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-800">SMTP / Custom Email</h3>
                                    </div>
                <p className="text-slate-500 text-sm mb-6 flex-grow">
                    Connect your own SMTP server (Outlook, Zoho, Fastmail, etc.) to send emails.
                </p>

                <div className="flex gap-3 w-full mt-auto">
                    {connections.length > 0 ? (
                        <>
                            <button
                                onClick={() => setShowManageModal(true)}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Manage
                            </button>
                            <button
                                onClick={() => setShowAuthModal(true)}
                                disabled={connecting}
                                className="flex-1 px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors"
                            >
                                Add New
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="w-full px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors"
                        >
                            Connect SMTP
                        </button>
                    )}
                </div>
            </div>

            {/* Manage Modal */}
            <Modal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                title="SMTP Connections"
                size="lg"
                footer={
                    <button
                        onClick={() => {
                            setShowManageModal(false);
                            setShowAuthModal(true);
                        }}
                        className="w-full py-3 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:opacity-90 transition-all font-bold flex items-center justify-center gap-2"
                    >
                        <span>+</span> Add New Connection
                    </button>
                }
            >
                <div className="space-y-4">
                    {connections.map(conn => (
                        <div key={conn.id} className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg">
                            <div>
                                <p className="font-bold text-[var(--color-text)]">{conn.connection_name}</p>
                                <p className="text-xs text-slate-400">{conn.host} • {conn.fromEmail || conn.user}</p>
                            </div>
                            <button
                                onClick={() => handleDelete(conn.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg text-sm font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                    {connections.length === 0 && <p className="text-slate-500 text-center py-4">No connections found.</p>}
                </div>
            </Modal>

            {/* Auth Modal */}
            <Modal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                title="Add SMTP Connection"
                size="md"
                footer={
                    <>
                        <button onClick={() => setShowAuthModal(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
                        <button onClick={handleSave} disabled={connecting} className="px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors">
                            {connecting ? 'Testing & Saving...' : 'Save Connection'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Connection Name</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]" placeholder="e.g. Corporate Email" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Host <span className="text-red-500">*</span></label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]" placeholder="smtp.gmail.com" value={data.host} onChange={e => setData({ ...data, host: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Port <span className="text-red-500">*</span></label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]" placeholder="587" value={data.port} onChange={e => setData({ ...data, port: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Encryption</label>
                        <select
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]"
                            value={data.encryption}
                            onChange={e => setData({ ...data, encryption: e.target.value })}
                        >
                            <option value="">Auto (Default)</option>
                            <option value="ssl">SSL (Implicit TLS)</option>
                            <option value="tls">TLS (STARTTLS)</option>
                            <option value="none">None</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Username <span className="text-red-500">*</span></label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]" placeholder="user@example.com" value={data.user} onChange={e => setData({ ...data, user: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                        <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]" placeholder="App Password" value={data.pass} onChange={e => setData({ ...data, pass: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">From Name / Email (Optional)</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 border-slate-200 outline-none focus:border-[var(--color-brand)]" placeholder="Support <support@example.com>" value={data.fromEmail} onChange={e => setData({ ...data, fromEmail: e.target.value })} />
                        <p className="text-[10px] text-slate-400 mt-1">If empty, defaults to Username.</p>
                    </div>
                </div>
            </Modal>

            {/* Notification */}
            <Modal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                title={notification.title}
                size="sm"
                footer={<button onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))} className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:opacity-90">OK</button>}
            >
                <div className="flex flex-col items-center justify-center p-4 text-center">
                    {notification.type === 'success' && (
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                    )}
                    {notification.type === 'error' && (
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                    )}
                    <p className="text-slate-700">{notification.message}</p>
                </div>
            </Modal>
        </>
    );
};

export default SmtpCard;
