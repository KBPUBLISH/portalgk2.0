import React, { useState, useEffect } from 'react';
import { Star, GripVertical, BookOpen, Music, Save, Loader2 } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Book {
  _id: string;
  title: string;
  author: string;
  coverImage?: string;
  files?: { coverImage?: string };
  status: string;
  isFeatured?: boolean;
  featuredOrder?: number;
}

interface Playlist {
  _id: string;
  title: string;
  author: string;
  coverImage?: string;
  type: string;
  status: string;
  isFeatured?: boolean;
  featuredOrder?: number;
}

type FeaturedItem = (Book | Playlist) & { itemType: 'book' | 'playlist' };

const FeaturedContent: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'featured' | 'books' | 'playlists'>('featured');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksRes, playlistsRes] = await Promise.all([
        apiClient.get('/api/books?status=all'),
        apiClient.get('/api/playlists?status=all'),
      ]);

      // Handle paginated response or direct array
      const booksArray = Array.isArray(booksRes.data) 
        ? booksRes.data 
        : (booksRes.data.data || booksRes.data.books || []);
      const playlistsArray = Array.isArray(playlistsRes.data) 
        ? playlistsRes.data 
        : (playlistsRes.data.data || playlistsRes.data.playlists || []);

      const booksData = booksArray.filter((b: Book) => b.status === 'published');
      const playlistsData = playlistsArray.filter((p: Playlist) => p.status === 'published');

      setBooks(booksData);
      setPlaylists(playlistsData);

      // Build featured items list
      const featured: FeaturedItem[] = [];
      
      booksData.forEach((book: Book) => {
        if (book.isFeatured) {
          featured.push({ ...book, itemType: 'book' });
        }
      });
      
      playlistsData.forEach((playlist: Playlist) => {
        if (playlist.isFeatured) {
          featured.push({ ...playlist, itemType: 'playlist' });
        }
      });

      // Sort by featuredOrder
      featured.sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
      setFeaturedItems(featured);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCoverImage = (item: Book | Playlist): string => {
    if ('files' in item && item.files?.coverImage) {
      return item.files.coverImage;
    }
    return item.coverImage || '';
  };

  const addToFeatured = (item: Book | Playlist, type: 'book' | 'playlist') => {
    const alreadyFeatured = featuredItems.some(
      f => f._id === item._id && f.itemType === type
    );
    
    if (alreadyFeatured) return;

    const newFeaturedItem: FeaturedItem = {
      ...item,
      itemType: type,
      isFeatured: true,
      featuredOrder: featuredItems.length,
    };

    setFeaturedItems([...featuredItems, newFeaturedItem]);
  };

  const removeFromFeatured = (itemId: string, itemType: 'book' | 'playlist') => {
    setFeaturedItems(featuredItems.filter(
      f => !(f._id === itemId && f.itemType === itemType)
    ));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === featuredItems.length - 1)
    ) {
      return;
    }

    const newItems = [...featuredItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setFeaturedItems(newItems);
  };

  const saveFeaturedItems = async () => {
    setSaving(true);
    try {
      // First, unfeatured all books and playlists
      const unfeaturedBooks = books.filter(b => b.isFeatured);
      const unfeaturedPlaylists = playlists.filter(p => p.isFeatured);

      // Unfeatured items that are no longer in the featured list
      for (const book of unfeaturedBooks) {
        const stillFeatured = featuredItems.some(f => f._id === book._id && f.itemType === 'book');
        if (!stillFeatured) {
          await apiClient.put(`/api/books/${book._id}`, {
            isFeatured: false,
            featuredOrder: 0,
          });
        }
      }

      for (const playlist of unfeaturedPlaylists) {
        const stillFeatured = featuredItems.some(f => f._id === playlist._id && f.itemType === 'playlist');
        if (!stillFeatured) {
          await apiClient.put(`/api/playlists/${playlist._id}`, {
            isFeatured: false,
            featuredOrder: 0,
          });
        }
      }

      // Update featured items with their order
      for (let i = 0; i < featuredItems.length; i++) {
        const item = featuredItems[i];
        const endpoint = item.itemType === 'book' ? '/api/books' : '/api/playlists';
        await apiClient.put(`${endpoint}/${item._id}`, {
          isFeatured: true,
          featuredOrder: i,
        });
      }

      alert('Featured content saved successfully!');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving featured items:', error);
      alert('Failed to save featured content. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isItemFeatured = (itemId: string, itemType: 'book' | 'playlist') => {
    return featuredItems.some(f => f._id === itemId && f.itemType === itemType);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            Featured Content
          </h1>
          <p className="text-gray-600 mt-1">
            Select and order content to display in the Explore page carousel
          </p>
        </div>
        <button
          onClick={saveFeaturedItems}
          disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('featured')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'featured'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Featured Carousel ({featuredItems.length})
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${
              activeTab === 'books'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Books ({books.length})
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${
              activeTab === 'playlists'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Music className="w-4 h-4" />
            Playlists ({playlists.length})
          </button>
        </nav>
      </div>

      {/* Featured Items Tab */}
      {activeTab === 'featured' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Carousel Order</h2>
            <p className="text-sm text-gray-500">Drag to reorder or use arrows. Items appear in this order on the Explore page.</p>
          </div>
          
          {featuredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No featured content yet.</p>
              <p className="text-sm">Go to the Books or Playlists tab to add items.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {featuredItems.map((item, index) => (
                <li key={`${item.itemType}-${item._id}`} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === featuredItems.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  
                  <GripVertical className="w-5 h-5 text-gray-400" />
                  
                  <span className="w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full font-semibold text-sm">
                    {index + 1}
                  </span>
                  
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {getCoverImage(item) ? (
                      <img
                        src={getCoverImage(item)}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {item.itemType === 'book' ? <BookOpen className="w-6 h-6" /> : <Music className="w-6 h-6" />}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.author}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      item.itemType === 'book' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {item.itemType === 'book' ? 'Book' : 'Playlist'}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => removeFromFeatured(item._id, item.itemType)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Books Tab */}
      {activeTab === 'books' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Published Books</h2>
            <p className="text-sm text-gray-500">Click "Add to Featured" to include a book in the carousel.</p>
          </div>
          
          {books.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No published books available.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {books.map((book) => (
                <li key={book._id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {getCoverImage(book) ? (
                      <img
                        src={getCoverImage(book)}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <BookOpen className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{book.title}</p>
                    <p className="text-sm text-gray-500">{book.author}</p>
                  </div>
                  
                  {isItemFeatured(book._id, 'book') ? (
                    <span className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded-lg flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Featured
                    </span>
                  ) : (
                    <button
                      onClick={() => addToFeatured(book, 'book')}
                      className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      Add to Featured
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Playlists Tab */}
      {activeTab === 'playlists' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Published Playlists</h2>
            <p className="text-sm text-gray-500">Click "Add to Featured" to include a playlist in the carousel.</p>
          </div>
          
          {playlists.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Music className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No published playlists available.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {playlists.map((playlist) => (
                <li key={playlist._id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {playlist.coverImage ? (
                      <img
                        src={playlist.coverImage}
                        alt={playlist.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Music className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{playlist.title}</p>
                    <p className="text-sm text-gray-500">{playlist.author}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mt-1">
                      {playlist.type}
                    </span>
                  </div>
                  
                  {isItemFeatured(playlist._id, 'playlist') ? (
                    <span className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded-lg flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Featured
                    </span>
                  ) : (
                    <button
                      onClick={() => addToFeatured(playlist, 'playlist')}
                      className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      Add to Featured
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FeaturedContent;

