import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { integrationsService } from '../services/integrationsService';

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientEmail?: string;
    recipientName?: string;
}

const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, recipientEmail = '', recipientName = '' }) => {
    const [emailType, setEmailType] = useState<'gmail' | 'smtp'>('gmail');
    const [gmailConnections, setGmailConnections] = useState<any[]>([]);
    const [smtpConnections, setSmtpConnections] = useState<any[]>([]);
    const [selectedConnection, setSelectedConnection] = useState('');
    const [to, setTo] = useState(recipientEmail);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    // Notification State
    const [notification, setNotification] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        if (isOpen) {
            loadConnections();
            setTo(recipientEmail);
            // Set default subject with recipient name if available
            if (recipientName) {
                setSubject(`Hello ${recipientName}`);
            }
        }
    }, [isOpen, recipientEmail, recipientName]);

    const loadConnections = async () => {
        setLoading(true);
        try {
            const [gmail, smtp] = await Promise.all([
                integrationsService.getGmailConnections(),
                integrationsService.getSmtpConnections()
            ]);
            setGmailConnections(gmail);
            setSmtpConnections(smtp);

            // Auto-select first available connection
            if (emailType === 'gmail' && gmail.length > 0) {
                setSelectedConnection(gmail[0].id);
            } else if (emailType === 'smtp' && smtp.length > 0) {
                setSelectedConnection(smtp[0].id);
            }
        } catch (e) {
            console.error('Failed to load email connections', e);
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (title: string, message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ isOpen: true, title, message, type });
    };

    const handleSendEmail = async () => {
        if (!to || !subject || !body) {
            showNotification('Validation Error', 'Please fill in all fields (To, Subject, and Body).', 'error');
            return;
        }

        if (!selectedConnection) {
            showNotification('Validation Error', 'Please select an email connection.', 'error');
            return;
        }

        setSending(true);
        try {
            if (emailType === 'gmail') {
                await integrationsService.sendGmailEmail(selectedConnection, to, subject, body);
            } else {
                await integrationsService.sendSmtpEmail(selectedConnection, to, subject, body);
            }

            showNotification('Email Sent', 'Your email has been sent successfully!', 'success');
            // Reset form
            setSubject('');
            setBody('');
            // Close modal after short delay
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (e: any) {
            showNotification('Send Failed', e.message || 'Failed to send email. Please try again.', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleEmailTypeChange = (type: 'gmail' | 'smtp') => {
        setEmailType(type);
        // Auto-select first connection of the new type
        if (type === 'gmail' && gmailConnections.length > 0) {
            setSelectedConnection(gmailConnections[0].id);
        } else if (type === 'smtp' && smtpConnections.length > 0) {
            setSelectedConnection(smtpConnections[0].id);
        } else {
            setSelectedConnection('');
        }
    };

    const currentConnections = emailType === 'gmail' ? gmailConnections : smtpConnections;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Send Email"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={onClose}
                            disabled={sending}
                            className="px-4 py-2 text-[var(--color-text)] hover:opacity-80 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSendEmail}
                            disabled={sending || !selectedConnection}
                            className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {sending ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    Send Email
                                </>
                            )}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Email Type Toggle */}
                    <div className="flex border-b border-slate-200 mb-4">
                        <button
                            className={`flex-1 pb-2 text-sm font-bold ${emailType === 'gmail' ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]' : 'text-slate-500'}`}
                            onClick={() => handleEmailTypeChange('gmail')}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                </svg>
                                Gmail
                            </div>
                        </button>
                        <button
                            className={`flex-1 pb-2 text-sm font-bold ${emailType === 'smtp' ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]' : 'text-slate-500'}`}
                            onClick={() => handleEmailTypeChange('smtp')}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                SMTP
                            </div>
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-8 text-slate-500">
                            <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-[var(--color-brand)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading connections...
                        </div>
                    ) : currentConnections.length === 0 ? (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm text-amber-800">
                            <p className="font-bold mb-1">No {emailType === 'gmail' ? 'Gmail' : 'SMTP'} Connection Found</p>
                            <p>Please configure a {emailType === 'gmail' ? 'Gmail' : 'SMTP'} connection in the Integrations settings before sending emails.</p>
                        </div>
                    ) : (
                        <>
                            {/* Connection Selector */}
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">
                                    Select Connection <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedConnection}
                                    onChange={(e) => setSelectedConnection(e.target.value)}
                                    className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none"
                                >
                                    <option value="">-- Select a connection --</option>
                                    {currentConnections.map(conn => (
                                        <option key={conn.id} value={conn.id}>
                                            {conn.connection_name || conn.name || `${emailType === 'gmail' ? 'Gmail' : 'SMTP'} Connection`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* To Field */}
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">
                                    To <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none"
                                    placeholder="recipient@example.com"
                                    value={to}
                                    onChange={e => setTo(e.target.value)}
                                />
                            </div>

                            {/* Subject Field */}
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">
                                    Subject <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none"
                                    placeholder="Email subject"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                />
                            </div>

                            {/* Body Field */}
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    className="w-full h-40 px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none resize-none"
                                    placeholder="Type your message here..."
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Notification Modal */}
            <Modal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                title={notification.title}
                size="sm"
                footer={
                    <button
                        onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                        className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:opacity-90"
                    >
                        OK
                    </button>
                }
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
                    {notification.type === 'info' && (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    )}
                    <p className="text-[var(--color-text)]">{notification.message}</p>
                </div>
            </Modal>
        </>
    );
};

export default EmailModal;
