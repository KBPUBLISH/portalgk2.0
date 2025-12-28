import React, { useState, useEffect } from 'react';
import { Star, GripVertical, BookOpen, Music, Save, Loader2, ChevronDown, ChevronRight, Headphones } from 'lucide-react';
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

interface PlaylistItem {
  _id: string;
  title: string;
  artist?: string;
  coverImage?: string;
  audioUrl?: string;
  duration?: number;
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
  items?: PlaylistItem[];
}

interface FeaturedEpisode {
  _id: string; // Composite ID: playlistId_itemId
  playlistId: string;
  itemId: string;
  title: string;
  artist?: string;
  coverImage?: string;
  playlistTitle: string;
  playlistType: string;
  isFeatured?: boolean;
  featuredOrder?: number;
}

type FeaturedItem = (Book | Playlist | FeaturedEpisode) & { itemType: 'book' | 'playlist' | 'episode' };

const FeaturedContent: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'featured' | 'books' | 'playlists'>('featured');
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAllPages = async <T,>(endpoint: string): Promise<T[]> => {
    const pageSize = 100; // backend cap is 100
    let page = 1;
    let results: T[] = [];

    while (true) {
      const res = await apiClient.get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=${pageSize}`);
      const payload = res.data;

      // Support both paginated { data, pagination } and direct arrays
      const pageItems: T[] = Array.isArray(payload) ? payload : (payload.data || payload.playlists || payload.books || []);
      results = results.concat(pageItems);

      const hasMore = Array.isArray(payload)
        ? false
        : Boolean(payload.pagination?.hasMore);

      if (!hasMore) break;
      page += 1;
    }

    return results;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksArray, playlistsArray] = await Promise.all([
        fetchAllPages<Book>('/api/books?status=all'),
        fetchAllPages<Playlist>('/api/playlists?status=all'),
      ]);

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
        
        // Check for featured episodes within playlists
        if (playlist.items) {
          playlist.items.forEach((item: PlaylistItem) => {
            if (item.isFeatured) {
              const episodeItem: FeaturedItem = {
                _id: `${playlist._id}_${item._id}`,
                playlistId: playlist._id,
                itemId: item._id,
                title: item.title,
                artist: item.artist,
                coverImage: item.coverImage || playlist.coverImage,
                playlistTitle: playlist.title,
                playlistType: playlist.type,
                isFeatured: true,
                featuredOrder: item.featuredOrder || 0,
                itemType: 'episode',
              };
              featured.push(episodeItem);
            }
          });
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

  const togglePlaylistExpanded = (playlistId: string) => {
    setExpandedPlaylists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playlistId)) {
        newSet.delete(playlistId);
      } else {
        newSet.add(playlistId);
      }
      return newSet;
    });
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

  const addEpisodeToFeatured = (playlist: Playlist, episode: PlaylistItem) => {
    const compositeId = `${playlist._id}_${episode._id}`;
    const alreadyFeatured = featuredItems.some(
      f => f._id === compositeId && f.itemType === 'episode'
    );
    
    if (alreadyFeatured) return;

    const newFeaturedItem: FeaturedItem = {
      _id: compositeId,
      playlistId: playlist._id,
      itemId: episode._id,
      title: episode.title,
      artist: episode.artist,
      coverImage: episode.coverImage || playlist.coverImage,
      playlistTitle: playlist.title,
      playlistType: playlist.type,
      isFeatured: true,
      featuredOrder: featuredItems.length,
      itemType: 'episode',
    };

    setFeaturedItems([...featuredItems, newFeaturedItem]);
  };

  const removeFromFeatured = (itemId: string, itemType: 'book' | 'playlist' | 'episode') => {
    setFeaturedItems(featuredItems.filter(
      f => !(f._id === itemId && f.itemType === itemType)
    ));
  };

  const isEpisodeFeatured = (playlistId: string, itemId: string) => {
    const compositeId = `${playlistId}_${itemId}`;
    return featuredItems.some(f => f._id === compositeId && f.itemType === 'episode');
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
    console.log('🔄 Starting save featured items...');
    console.log('📋 Featured items to save:', featuredItems);
    setSaving(true);
    try {
      // First, unfeatured all books and playlists
      const unfeaturedBooks = books.filter(b => b.isFeatured);
      const unfeaturedPlaylists = playlists.filter(p => p.isFeatured);
      console.log('📚 Books to check for unfeaturing:', unfeaturedBooks.length);
      console.log('🎵 Playlists to check for unfeaturing:', unfeaturedPlaylists.length);

      // Unfeatured items that are no longer in the featured list
      for (const book of unfeaturedBooks) {
        const stillFeatured = featuredItems.some(f => f._id === book._id && f.itemType === 'book');
        if (!stillFeatured) {
          console.log(`📕 Unfeaturing book: ${book.title}`);
          const res = await apiClient.put(`/api/books/${book._id}`, {
            isFeatured: false,
            featuredOrder: 0,
          });
          console.log('📕 Unfeatured book response:', res.data);
        }
      }

      for (const playlist of unfeaturedPlaylists) {
        const stillFeatured = featuredItems.some(f => f._id === playlist._id && f.itemType === 'playlist');
        if (!stillFeatured) {
          console.log(`🎵 Unfeaturing playlist: ${playlist.title}`);
          const res = await apiClient.put(`/api/playlists/${playlist._id}`, {
            isFeatured: false,
            featuredOrder: 0,
          });
          console.log('🎵 Unfeatured playlist response:', res.data);
        }
      }

      // Unfeatured episodes that are no longer in the featured list
      for (const playlist of playlists) {
        if (playlist.items) {
          for (const item of playlist.items) {
            if (item.isFeatured) {
              const compositeId = `${playlist._id}_${item._id}`;
              const stillFeatured = featuredItems.some(f => f._id === compositeId && f.itemType === 'episode');
              if (!stillFeatured) {
                console.log(`🎧 Unfeaturing episode: ${item.title}`);
                await apiClient.put(`/api/playlists/${playlist._id}/items/${item._id}/featured`, {
                  isFeatured: false,
                  featuredOrder: 0,
                });
              }
            }
          }
        }
      }

      // Update featured items with their order
      console.log(`⭐ Updating ${featuredItems.length} featured items...`);
      for (let i = 0; i < featuredItems.length; i++) {
        const item = featuredItems[i];
        
        if (item.itemType === 'episode') {
          // Handle episode featuring
          const episodeItem = item as FeaturedEpisode & { itemType: 'episode' };
          console.log(`⭐ Setting featured episode #${i + 1}: ${episodeItem.title}`);
          await apiClient.put(`/api/playlists/${episodeItem.playlistId}/items/${episodeItem.itemId}/featured`, {
            isFeatured: true,
            featuredOrder: i,
          });
          console.log(`✅ Updated episode ${episodeItem.title}`);
        } else {
          // Handle book or playlist featuring
          const endpoint = item.itemType === 'book' ? '/api/books' : '/api/playlists';
          console.log(`⭐ Setting featured #${i + 1}: ${item.title} (${item.itemType})`);
          const res = await apiClient.put(`${endpoint}/${item._id}`, {
            isFeatured: true,
            featuredOrder: i,
          });
          console.log(`✅ Updated ${item.title}:`, res.data.isFeatured, res.data.featuredOrder);
        }
      }

      console.log('✅ All featured items saved successfully!');
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
              {featuredItems.map((item, index) => {
                const isEpisode = item.itemType === 'episode';
                const episodeItem = isEpisode ? (item as FeaturedEpisode & { itemType: 'episode' }) : null;
                
                return (
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
                      {(isEpisode ? episodeItem?.coverImage : getCoverImage(item as Book | Playlist)) ? (
                        <img
                          src={isEpisode ? episodeItem?.coverImage : getCoverImage(item as Book | Playlist)}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {item.itemType === 'book' ? <BookOpen className="w-6 h-6" /> : 
                           item.itemType === 'episode' ? <Headphones className="w-6 h-6" /> : <Music className="w-6 h-6" />}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.title}</p>
                      {isEpisode && episodeItem ? (
                        <p className="text-sm text-gray-500">
                          from <span className="font-medium">{episodeItem.playlistTitle}</span>
                          {episodeItem.artist && <span> • {episodeItem.artist}</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">{(item as Book | Playlist).author}</p>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                        item.itemType === 'book' 
                          ? 'bg-blue-100 text-blue-800' 
                          : item.itemType === 'episode'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.itemType === 'book' ? '📚 Book' : 
                         item.itemType === 'episode' ? `🎧 Episode` : '🎵 Playlist'}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => removeFromFeatured(item._id, item.itemType)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
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
            <p className="text-sm text-gray-500">Click "Add to Featured" to include a playlist in the carousel, or expand to feature individual episodes.</p>
          </div>
          
          {playlists.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Music className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No published playlists available.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {playlists.map((playlist) => (
                <li key={playlist._id} className="border-b border-gray-100 last:border-b-0">
                  {/* Playlist Row */}
                  <div className="p-4 flex items-center gap-4 hover:bg-gray-50">
                    {/* Expand Button */}
                    {playlist.items && playlist.items.length > 0 && (
                      <button
                        onClick={() => togglePlaylistExpanded(playlist._id)}
                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title={expandedPlaylists.has(playlist._id) ? 'Collapse episodes' : 'Expand episodes'}
                      >
                        {expandedPlaylists.has(playlist._id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    {(!playlist.items || playlist.items.length === 0) && (
                      <div className="w-7" /> // Spacer for alignment
                    )}
                    
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {playlist.coverImage ? (
                        <img
                          src={playlist.coverImage}
                          alt={playlist.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {playlist.type === 'Audiobook' ? <Headphones className="w-6 h-6" /> : <Music className="w-6 h-6" />}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{playlist.title}</p>
                      <p className="text-sm text-gray-500">{playlist.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          playlist.type === 'Audiobook' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {playlist.type === 'Audiobook' ? '📖 Audiobook' : '🎵 Music'}
                        </span>
                        {playlist.items && playlist.items.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {playlist.items.length} {playlist.type === 'Audiobook' ? 'episodes' : 'songs'}
                          </span>
                        )}
                      </div>
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
                  </div>
                  
                  {/* Expanded Episodes */}
                  {expandedPlaylists.has(playlist._id) && playlist.items && playlist.items.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {playlist.type === 'Audiobook' ? 'Episodes' : 'Songs'} ({playlist.items.length})
                        </p>
                      </div>
                      <ul className="divide-y divide-gray-200">
                        {playlist.items.map((episode, index) => (
                          <li key={episode._id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-100">
                            <span className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">
                              {index + 1}
                            </span>
                            
                            <div className="w-12 h-12 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                              {(episode.coverImage || playlist.coverImage) ? (
                                <img
                                  src={episode.coverImage || playlist.coverImage}
                                  alt={episode.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  {playlist.type === 'Audiobook' ? <Headphones className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate text-sm">{episode.title}</p>
                              {episode.artist && (
                                <p className="text-xs text-gray-500">{episode.artist}</p>
                              )}
                            </div>
                            
                            {isEpisodeFeatured(playlist._id, episode._id) ? (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                Featured
                              </span>
                            ) : (
                              <button
                                onClick={() => addEpisodeToFeatured(playlist, episode)}
                                className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              >
                                Feature Episode
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
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

