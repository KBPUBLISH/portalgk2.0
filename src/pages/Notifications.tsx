import React, { useState } from 'react';
import { Bell, Send, Clock, Users, Image, Link, AlertCircle, CheckCircle } from 'lucide-react';
import apiClient from '../services/apiClient';

interface NotificationForm {
    title: string;
    message: string;
    url: string;
    imageUrl: string;
    segment: string;
    scheduledTime: string;
}

const Notifications: React.FC = () => {
    const [form, setForm] = useState<NotificationForm>({
        title: '',
        message: '',
        url: '',
        imageUrl: '',
        segment: 'All',
        scheduledTime: ''
    });
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const segments = [
        { id: 'All', name: 'All Users', description: 'Send to all subscribed users' },
        { id: 'Active Users', name: 'Active Users', description: 'Users active in the last 7 days' },
        { id: 'Inactive Users', name: 'Inactive Users', description: 'Users inactive for 7+ days' },
        { id: 'Engaged Users', name: 'Engaged Users', description: 'Highly engaged users' }
    ];

    const handleSubmit = async (e: React.FormEvent, scheduled: boolean = false) => {
        e.preventDefault();
        
        if (!form.title.trim() || !form.message.trim()) {
            setResult({ success: false, message: 'Title and message are required' });
            return;
        }

        setSending(true);
        setResult(null);

        try {
            const endpoint = scheduled ? '/api/notifications/schedule' : '/api/notifications/send';
            const payload: any = {
                title: form.title,
                message: form.message,
                segments: [form.segment]
            };

            if (form.url) payload.url = form.url;
            if (form.imageUrl) payload.imageUrl = form.imageUrl;
            if (scheduled && form.scheduledTime) {
                payload.sendAt = new Date(form.scheduledTime).toISOString();
            }

            const response = await apiClient.post(endpoint, payload);

            if (response.data.success) {
                setResult({ 
                    success: true, 
                    message: scheduled 
                        ? `Notification scheduled for ${new Date(form.scheduledTime).toLocaleString()}`
                        : `Notification sent to ${response.data.recipients || 'all'} users!`
                });
                // Reset form
                setForm({
                    title: '',
                    message: '',
                    url: '',
                    imageUrl: '',
                    segment: 'All',
                    scheduledTime: ''
                });
            } else {
                setResult({ success: false, message: 'Failed to send notification' });
            }
        } catch (error: any) {
            console.error('Notification error:', error);
            setResult({ 
                success: false, 
                message: error.response?.data?.message || 'Failed to send notification' 
            });
        } finally {
            setSending(false);
        }
    };

    const quickTemplates = [
        { 
            title: '📚 New Story Available!', 
            message: 'Check out our latest adventure waiting for you!',
            icon: '📚'
        },
        { 
            title: '🎵 New Audio Content', 
            message: 'New songs and stories are ready to listen!',
            icon: '🎵'
        },
        { 
            title: '⭐ Daily Lesson Ready', 
            message: "Today's lesson is waiting for you. Let's learn together!",
            icon: '⭐'
        },
        { 
            title: '🎁 Special Reward!', 
            message: 'You have earned a special reward. Come claim it!',
            icon: '🎁'
        }
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-100 rounded-xl">
                    <Bell className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Push Notifications</h1>
                    <p className="text-gray-500">Send notifications to your app users</p>
                </div>
            </div>

            {/* Result Message */}
            {result && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                    result.success 
                        ? 'bg-green-50 border border-green-200 text-green-800' 
                        : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                    {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {result.message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Send className="w-5 h-5 text-indigo-600" />
                            Compose Notification
                        </h2>

                        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="Notification title..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    maxLength={50}
                                />
                                <p className="text-xs text-gray-400 mt-1">{form.title.length}/50 characters</p>
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Message *
                                </label>
                                <textarea
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    placeholder="Notification message..."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    maxLength={200}
                                />
                                <p className="text-xs text-gray-400 mt-1">{form.message.length}/200 characters</p>
                            </div>

                            {/* Target Segment */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Users className="w-4 h-4 inline mr-1" />
                                    Target Audience
                                </label>
                                <select
                                    value={form.segment}
                                    onChange={(e) => setForm({ ...form, segment: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    {segments.map((seg) => (
                                        <option key={seg.id} value={seg.id}>
                                            {seg.name} - {seg.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Optional URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Link className="w-4 h-4 inline mr-1" />
                                    Link URL (optional)
                                </label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            {/* Optional Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Image className="w-4 h-4 inline mr-1" />
                                    Image URL (optional)
                                </label>
                                <input
                                    type="url"
                                    value={form.imageUrl}
                                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            {/* Schedule Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    Schedule (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={form.scheduledTime}
                                    onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={sending || !form.title || !form.message}
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {sending ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Send Now
                                        </>
                                    )}
                                </button>

                                {form.scheduledTime && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={sending || !form.title || !form.message}
                                        className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Clock className="w-5 h-5" />
                                        Schedule
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Quick Templates Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Templates</h2>
                        <div className="space-y-3">
                            {quickTemplates.map((template, index) => (
                                <button
                                    key={index}
                                    onClick={() => setForm({
                                        ...form,
                                        title: template.title,
                                        message: template.message
                                    })}
                                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{template.icon}</span>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">{template.title}</p>
                                            <p className="text-xs text-gray-500 mt-1">{template.message}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Card */}
                    {(form.title || form.message) && (
                        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Preview</h2>
                            <div className="bg-gray-100 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-lg">✨</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm truncate">
                                            {form.title || 'Notification Title'}
                                        </p>
                                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                                            {form.message || 'Notification message will appear here...'}
                                        </p>
                                        <p className="text-gray-400 text-xs mt-2">Godly Kids • now</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;

