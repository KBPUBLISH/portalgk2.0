import React from 'react';

const Dashboard: React.FC = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700">Total Books</h2>
                    <p className="text-4xl font-bold text-indigo-600 mt-2">0</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700">Total Playlists</h2>
                    <p className="text-4xl font-bold text-green-600 mt-2">0</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700">Recent Activity</h2>
                    <p className="text-gray-500 mt-2">No recent activity</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
