import React, { useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Book, BookOpen, Music, Layout as LayoutIcon, Home, Tag, Volume2, Gamepad2, Video, LogOut, Bell, Music2, Star, CalendarDays, BarChart3, Library, Sparkles, TrendingUp, Radio, Mail, Heart, Users, ClipboardCheck, ShoppingCart, BookHeart, Disc, Image, Mic, Map, Film, Church, AudioLines, Gift, Compass, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type NavItem = {
    path: string;
    icon: LucideIcon;
    label: string;
    title?: string;
};

type NavSection = {
    title: string;
    items: NavItem[];
};

const navSections: NavSection[] = [
    {
        title: 'Overview',
        items: [
            { path: '/', icon: Home, label: 'Dashboard' },
            { path: '/analytics', icon: BarChart3, label: 'Content Analytics' },
            { path: '/onboarding-analytics', icon: TrendingUp, label: 'Onboarding' },
            { path: '/new-tutorial', icon: Compass, label: 'New Tutorial' },
            { path: '/ai-insights', icon: Sparkles, label: 'AI Insights' },
        ],
    },
    {
        title: 'Books',
        items: [
            { path: '/books', icon: Book, label: 'Books' },
            { path: '/book-series', icon: Library, label: 'Book Series' },
            { path: '/bible-map', icon: Map, label: 'Bible Map' },
            { path: '/monthly-books', icon: BookOpen, label: 'Monthly Characters', title: 'Kids Monthly Book Character Design' },
            { path: '/categories', icon: Tag, label: 'Categories' },
            { path: '/featured', icon: Star, label: 'Featured' },
            { path: '/new-user-welcome', icon: Sparkles, label: 'New User Welcome' },
            { path: '/amazon-books', icon: ShoppingCart, label: 'Amazon Store' },
        ],
    },
    {
        title: 'Audio & Video',
        items: [
            { path: '/playlists', icon: Music, label: 'Playlists' },
            { path: '/music-videos', icon: Film, label: 'Music Videos' },
            { path: '/lessons', icon: Video, label: 'Lessons' },
            { path: '/lessons/calendar', icon: CalendarDays, label: 'Lesson Calendar' },
            { path: '/devotional-stories', icon: BookHeart, label: 'Devotionals' },
            { path: '/background-music', icon: Disc, label: 'Story Music' },
            { path: '/story-backgrounds', icon: Image, label: 'Story Backgrounds' },
            { path: '/voices', icon: Volume2, label: 'Voices' },
            { path: '/audio-studio', icon: AudioLines, label: 'Audio Studio' },
            { path: '/music', icon: Music2, label: 'App & UI Music' },
            { path: '/radio', icon: Radio, label: 'Radio' },
            { path: '/karaoke', icon: Mic, label: 'Karaoke' },
        ],
    },
    {
        title: 'Play',
        items: [
            { path: '/games', icon: Gamepad2, label: 'Games' },
        ],
    },
    {
        title: 'Outreach',
        items: [
            { path: '/notifications', icon: Bell, label: 'Notifications' },
            { path: '/email-subscribers', icon: Mail, label: 'Email Subscribers' },
            { path: '/offer-claims', icon: Gift, label: 'Offer Claims' },
            { path: '/campaigns', icon: Heart, label: 'Giving Campaigns' },
        ],
    },
    {
        title: 'Godly Hub',
        items: [
            { path: '/hub/creators', icon: Users, label: 'Creators' },
            { path: '/hub/review', icon: ClipboardCheck, label: 'Content Review' },
        ],
    },
    {
        title: 'Church',
        items: [
            { path: '/churches', icon: Church, label: 'Churches' },
        ],
    },
];

const allNavItems = navSections.flatMap((section) => section.items);

const Layout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const activePath = useMemo(() => {
        const matches = allNavItems.filter((item) => {
            if (item.path === '/') return location.pathname === '/';
            return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        });
        matches.sort((a, b) => b.path.length - a.path.length);
        return matches[0]?.path;
    }, [location.pathname]);

    const isActive = (path: string) => path === activePath;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md flex flex-col h-screen overflow-hidden">
                <div className="px-5 py-5 flex-shrink-0 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                        <LayoutIcon className="w-7 h-7" />
                        Portal
                    </h1>
                </div>
                <nav className="flex-1 overflow-y-auto py-3">
                    {navSections.map((section) => (
                        <div key={section.title} className="mb-2">
                            <p className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                {section.title}
                            </p>
                            {section.items.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    title={item.title || item.label}
                                    className={`flex items-center px-5 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${isActive(item.path) ? 'bg-indigo-50 text-indigo-600 border-r-4 border-indigo-600' : ''
                                        }`}
                                >
                                    <item.icon className="w-4 h-4 mr-3 shrink-0" />
                                    <span className="font-medium truncate">{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>
                
                {/* Logout Button */}
                <div className="p-4 border-t border-gray-200 flex-shrink-0">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
