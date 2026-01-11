import React, { useState, useEffect } from 'react';
import { getFormByToken, submitForm } from '../services/lead-management-api';
import { FormDefinition } from '../types/lead-management';
import PhoneInputWithCountry from './PhoneInputWithCountry';

interface FormPublicViewProps {
    token: string;
}

const FormPublicView: React.FC<FormPublicViewProps> = ({ token }) => {
    const [form, setForm] = useState<FormDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        const loadForm = async () => {
            try {
                const data = await getFormByToken(token);
                if (data) {
                    setForm(data);
                } else {
                    setError('Form not found');
                }
            } catch (err) {
                setError('Failed to load form');
            } finally {
                setLoading(false);
            }
        };
        loadForm();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form) return;

        if (form.settings?.declaration?.enabled && !agreed) {
            alert('Please agree to the declaration');
            return;
        }

        setSubmitting(true);
        try {
            await submitForm(token, formData);
            setSuccess(true);
            if (form.success_redirect_url) {
                window.location.href = form.success_redirect_url;
            }
        } catch (err: any) {
            alert(err.message || 'Failed to submit form');
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (label: string, value: string) => {
        setFormData(prev => ({ ...prev, [label]: value }));
    };

    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
    if (error) return <div className="flex justify-center items-center h-screen text-red-600">{error}</div>;
    if (!form) return null;

    if (success && !form.success_redirect_url) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h2>
                    <p className="text-slate-600">{form.success_message || 'Your submission has been received.'}</p>
                </div>
            </div>
        );
    }

    const style = form.styling || {};
    const isTransparent = style.backgroundColor === 'transparent';

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div
                className="w-full max-w-md rounded-xl shadow-lg overflow-hidden"
                style={{
                    backgroundColor: isTransparent ? 'transparent' : (style.backgroundColor || '#ffffff'),
                    color: style.inputStyle?.color || '#000000'
                }}
            >
                <div className="p-8">
                    <h1 className="text-2xl font-bold mb-2">{form.name}</h1>
                    {form.description && <p className="text-sm opacity-80 mb-6">{form.description}</p>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {form.fields?.map((field, idx) => (
                            <div key={idx}>
                                <label className="block text-sm font-bold mb-1 opacity-90">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                                        rows={3}
                                        onChange={e => handleInputChange(field.name || field.label, e.target.value)}
                                    />
                                ) : field.type === 'phone' ? (
                                    <PhoneInputWithCountry
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        value={formData[field.name || field.label] || ''}
                                        onChange={(val) => handleInputChange(field.name || field.label, val)}
                                        className="bg-white/80"
                                    />
                                ) : (
                                    <input
                                        type={field.type}
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                                        onChange={e => handleInputChange(field.name || field.label, e.target.value)}
                                        value={formData[field.name || field.label] || ''}
                                    />
                                )}
                            </div>
                        ))}

                        {form.settings?.declaration?.enabled && (
                            <div className="flex items-start gap-2 mt-4 text-sm">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    required
                                    checked={agreed}
                                    onChange={e => setAgreed(e.target.checked)}
                                />
                                <span>
                                    I agree to the <span className="text-blue-600 underline">{form.settings.declaration.title || 'Terms'}</span>
                                </span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 rounded font-bold text-sm mt-4 transition-opacity hover:opacity-90 disabled:opacity-70"
                            style={{
                                backgroundColor: style.primaryColor || '#0f172a',
                                color: style.buttonTextColor || '#ffffff'
                            }}
                        >
                            {submitting ? 'Submitting...' : (style.buttonText || 'Submit')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FormPublicView;
