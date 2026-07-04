'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import PlaybackControls from './PlaybackControls';
import { MUX_SOURCE_TYPE, YOUTUBE_PLAYLIST_SOURCE_TYPE, YOUTUBE_VIDEO_SOURCE_TYPE } from '@/lib/youtube';

interface MediaItem {
  id: string;
  playback_id: string;
  label: string;
  kind: string;
  duration_seconds?: number;
  source_type?: string;
  youtube_playlist_id?: string | null;
  source_url?: string | null;
}

interface CurrentStream {
  playback_id: string;
  title: string;
  kind: string;
  updated_at: string;
  source_type?: string;
  youtube_playlist_id?: string | null;
  source_url?: string | null;
}

interface Poll {
  id: string;
  question: string;
  type: 'fixed' | 'open';
  is_open: boolean;
  created_at: string;
  closed_at: string | null;
  total_votes: number;
  options: {
    id: string;
    label: string;
    vote_count: number;
    percentage: number;
    author_name?: string | null;
  }[];
}

interface DetailedVoteResult {
  option_id: string;
  option_label: string;
  voters: string[];
  vote_count: number;
}

interface StreamControlProps {
  showLibraryControls?: boolean;
  showPlaybackControls?: boolean;
  showPollControls?: boolean;
}

interface MuxLibraryAsset {
  assetId: string;
  playbackId: string | null;
  playbackPolicy: string | null;
  status: string;
  durationSeconds: number | null;
  aspectRatio: string | null;
  createdAt: string | null;
  defaultTitle: string;
  thumbnailUrl: string | null;
  thumbnailStatus: 'available' | 'placeholder';
  canImport: boolean;
  disabledReason: string | null;
}

interface MuxAssetsPagination {
  page: number;
  limit: number;
  hasNextPage: boolean;
  nextPage: number | null;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return 'Duration unavailable';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatAssetDate(value?: string | null) {
  if (!value) return 'Created date unavailable';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getSourceLabel(sourceType?: string | null) {
  switch (sourceType || MUX_SOURCE_TYPE) {
    case YOUTUBE_PLAYLIST_SOURCE_TYPE:
      return 'YouTube Playlist';
    case YOUTUBE_VIDEO_SOURCE_TYPE:
      return 'YouTube Video';
    default:
      return 'Mux';
  }
}

export default function StreamControl({ 
  showLibraryControls = true, 
  showPlaybackControls = true,
  showPollControls = showLibraryControls,
}: StreamControlProps) {
  const [muxItems, setMuxItems] = useState<MediaItem[]>([]);
  const [currentStream, setCurrentStream] = useState<CurrentStream | null>(null);
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState('');
  const [youtubePlaylistTitle, setYoutubePlaylistTitle] = useState('');
  const [youtubeSourceType, setYoutubeSourceType] = useState<
    typeof YOUTUBE_PLAYLIST_SOURCE_TYPE | typeof YOUTUBE_VIDEO_SOURCE_TYPE
  >(YOUTUBE_PLAYLIST_SOURCE_TYPE);
  const [addMediaTab, setAddMediaTab] = useState<'mux' | 'youtube'>('mux');
  const [muxLibraryAssets, setMuxLibraryAssets] = useState<MuxLibraryAsset[]>([]);
  const [muxLibraryPagination, setMuxLibraryPagination] = useState<MuxAssetsPagination | null>(null);
  const [muxLibraryQuery, setMuxLibraryQuery] = useState('');
  const [muxLibraryTitles, setMuxLibraryTitles] = useState<Record<string, string>>({});
  const [muxLibraryLoading, setMuxLibraryLoading] = useState(false);
  const [muxLibraryError, setMuxLibraryError] = useState<string | null>(null);
  const [importingMuxAssetId, setImportingMuxAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Hold screen state
  const [holdScreenMuxItemId, setHoldScreenMuxItemId] = useState<string | null>(null);
  const [holdScreenEnabled, setHoldScreenEnabled] = useState(false);
  
  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollType, setPollType] = useState<'fixed' | 'open'>('fixed');
  const [pollLoading, setPollLoading] = useState(false);
  
  // Poll management state
  const [polls, setPolls] = useState<Poll[]>([]);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState('');
  
  // Voter details state
  const [viewingVotersForPoll, setViewingVotersForPoll] = useState<string | null>(null);
  const [voterDetails, setVoterDetails] = useState<Record<string, DetailedVoteResult[]>>({});
  const [loadingVoters, setLoadingVoters] = useState(false);

  useEffect(() => {
    loadMuxItems();
    if (showLibraryControls) {
      loadMuxLibraryAssets(true);
    }
    loadCurrentStream();
    loadPolls();
    loadHoldScreenConfig();
    
    // Refresh current stream periodically to keep in sync
    const interval = setInterval(() => {
      loadCurrentStream();
      loadPolls();
      loadHoldScreenConfig();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
    // This dashboard bootstrap effect should run once; periodic refresh handles updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMuxItems() {
    try {
      const response = await fetch('/api/admin/mux-items');
      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];
        setMuxItems(items);
        return items as MediaItem[];
      }
    } catch (error) {
      console.error('Failed to load Mux items:', error);
    }

    return [] as MediaItem[];
  }

  async function loadMuxLibraryAssets(reset = false) {
    const page = reset ? 1 : muxLibraryPagination?.nextPage;

    if (!page) return;

    setMuxLibraryLoading(true);
    setMuxLibraryError(null);

    try {
      const response = await fetch(`/api/admin/mux-assets?page=${page}&limit=20`);
      const data = await response.json();

      if (!response.ok) {
        setMuxLibraryError(data.error || 'Failed to load Mux library');
        return;
      }

      const nextAssets: MuxLibraryAsset[] = data.assets || [];
      setMuxLibraryAssets((currentAssets) => {
        if (reset) return nextAssets;

        const existingAssetIds = new Set(currentAssets.map((asset) => asset.assetId));
        const uniqueNextAssets = nextAssets.filter((asset) => !existingAssetIds.has(asset.assetId));
        return [...currentAssets, ...uniqueNextAssets];
      });
      setMuxLibraryPagination(data.pagination || null);
      setMuxLibraryTitles((currentTitles) => {
        const nextTitles = { ...currentTitles };

        nextAssets.forEach((asset) => {
          if (nextTitles[asset.assetId] === undefined) {
            nextTitles[asset.assetId] = asset.defaultTitle;
          }
        });

        return nextTitles;
      });
    } catch (error) {
      console.error('Failed to load Mux library:', error);
      setMuxLibraryError('Network error occurred');
    } finally {
      setMuxLibraryLoading(false);
    }
  }

  async function loadCurrentStream() {
    try {
      const response = await fetch('/api/admin/set-current');
      if (response.ok) {
        const data = await response.json();
        setCurrentStream(data);
      }
    } catch (error) {
      console.error('Failed to load current stream:', error);
    }
  }

  async function loadPolls() {
    try {
      const response = await fetch('/api/admin/polls?room=event');
      if (response.ok) {
        const data = await response.json();
        setPolls(data.polls || []);
      }
    } catch (error) {
      console.error('Failed to load polls:', error);
    }
  }

  async function loadHoldScreenConfig() {
    try {
      const response = await fetch('/api/admin/hold-screen');
      if (response.ok) {
        const data = await response.json();
        setHoldScreenMuxItemId(data.hold_screen_mux_item_id);
        setHoldScreenEnabled(data.hold_screen_enabled);
      }
    } catch (error) {
      console.error('Failed to load hold screen config:', error);
    }
  }

  async function handleSetStream(
    playbackId: string,
    title: string,
    kind: string = 'vod',
    sourceType: string = MUX_SOURCE_TYPE,
    youtubePlaylistId?: string | null,
    sourceUrl?: string | null
  ) {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/set-current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbackId,
          title,
          kind,
          sourceType,
          youtubePlaylistId,
          sourceUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Stream updated to: ${title}` });
        setCurrentStream(data.stream);
        setYoutubePlaylistUrl('');
        setYoutubePlaylistTitle('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update stream' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  function findImportedMuxItem(playbackId: string | null, items: MediaItem[] = muxItems) {
    if (!playbackId) return null;

    return items.find(
      (item) =>
        item.playback_id === playbackId &&
        (item.source_type || MUX_SOURCE_TYPE) === MUX_SOURCE_TYPE
    ) || null;
  }

  async function importMuxAsset(asset: MuxLibraryAsset) {
    if (!asset.canImport || !asset.playbackId) {
      setMessage({ type: 'error', text: asset.disabledReason || 'This Mux asset cannot be imported' });
      return null;
    }

    const existingItem = findImportedMuxItem(asset.playbackId);
    if (existingItem) {
      return existingItem;
    }

    const title = (muxLibraryTitles[asset.assetId] || asset.defaultTitle || asset.playbackId).trim();

    if (!title) {
      setMessage({ type: 'error', text: 'Title is required' });
      return null;
    }

    const response = await fetch('/api/admin/mux-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playbackId: asset.playbackId,
        label: title,
        kind: 'vod',
        durationSeconds: asset.durationSeconds,
        sourceType: MUX_SOURCE_TYPE,
      }),
    });
    const data = await response.json();

    if (response.ok) {
      const items = await loadMuxItems();
      return (data.item as MediaItem) || findImportedMuxItem(asset.playbackId, items);
    }

    if (response.status === 409) {
      const items = await loadMuxItems();
      const duplicateItem = findImportedMuxItem(asset.playbackId, items);

      if (duplicateItem) {
        return duplicateItem;
      }
    }

    setMessage({ type: 'error', text: data.error || 'Failed to add Mux asset' });
    return null;
  }

  async function handleImportMuxAsset(asset: MuxLibraryAsset, makeCurrent = false) {
    setLoading(true);
    setMessage(null);
    setImportingMuxAssetId(asset.assetId);

    try {
      const importedItem = await importMuxAsset(asset);

      if (!importedItem) return;

      if (makeCurrent) {
        await handleSetStream(
          importedItem.playback_id,
          importedItem.label,
          importedItem.kind,
          importedItem.source_type || MUX_SOURCE_TYPE,
          importedItem.youtube_playlist_id,
          importedItem.source_url
        );
      } else {
        setMessage({ type: 'success', text: `"${importedItem.label}" added to library` });
      }
    } catch (error) {
      console.error('Failed to import Mux asset:', error);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setImportingMuxAssetId(null);
      setLoading(false);
    }
  }

  async function handleAddYouTubeMedia(makeCurrent = false) {
    const youtubeMediaLabel = youtubeSourceType === YOUTUBE_VIDEO_SOURCE_TYPE ? 'video' : 'playlist';

    if (!youtubePlaylistUrl) {
      setMessage({ type: 'error', text: `YouTube ${youtubeMediaLabel} URL is required` });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/mux-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: youtubeSourceType,
          sourceUrl: youtubePlaylistUrl,
          label: youtubePlaylistTitle || undefined,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        await loadMuxItems();
        setMessage({ type: 'success', text: `YouTube ${youtubeMediaLabel} added successfully` });
        setYoutubePlaylistUrl('');
        setYoutubePlaylistTitle('');

        if (makeCurrent && data.item) {
          await handleSetStream(
            data.item.playback_id,
            data.item.label,
            data.item.kind,
            data.item.source_type,
            data.item.youtube_playlist_id,
            data.item.source_url
          );
        }
      } else {
        setMessage({ type: 'error', text: data.error || `Failed to add YouTube ${youtubeMediaLabel}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMuxItem(id: string, label: string) {
    if (!confirm(`Are you sure you want to delete "${label}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/mux-items?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        await loadMuxItems();
        setMessage({ type: 'success', text: `"${label}" deleted successfully` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete item' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetHoldScreen(muxItemId: string, label: string) {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/hold-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_item', muxItemId }),
      });

      const data = await response.json();

      if (response.ok) {
        setHoldScreenMuxItemId(muxItemId);
        setMessage({ type: 'success', text: `Hold screen set to "${label}"` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to set hold screen' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  function addPollOption() {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, '']);
    }
  }

  function removePollOption(index: number) {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  }

  function updatePollOption(index: number, value: string) {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  }

  async function handleCreatePoll() {
    const validOptions = pollOptions.filter(opt => opt.trim().length > 0);

    if (!pollQuestion.trim()) {
      setMessage({ type: 'error', text: 'Poll question is required' });
      return;
    }

    if (pollType === 'fixed' && validOptions.length < 2) {
      setMessage({ type: 'error', text: 'At least 2 options are required' });
      return;
    }

    setPollLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/polls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: 'event',
          question: pollQuestion,
          type: pollType,
          ...(pollType === 'fixed' ? { options: validOptions } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Poll created successfully!' });
        setPollQuestion('');
        setPollOptions(['', '']);
        setPollType('fixed');
        await loadPolls();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create poll' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setPollLoading(false);
    }
  }

  async function handleUpdatePoll(pollId: string, newQuestion: string) {
    if (!newQuestion.trim()) {
      setMessage({ type: 'error', text: 'Question cannot be empty' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/polls/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId, question: newQuestion }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Poll updated successfully' });
        setEditingPollId(null);
        setEditingQuestion('');
        await loadPolls();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update poll' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleClosePoll(pollId: string) {
    if (!confirm('Close this poll? Results will be announced in chat.')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/polls/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Poll closed successfully' });
        await loadPolls();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to close poll' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenPoll(pollId: string) {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/polls/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Poll opened successfully' });
        await loadPolls();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to open poll' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePoll(pollId: string, question: string) {
    if (!confirm(`Delete poll "${question}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/polls/delete?pollId=${pollId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Poll deleted successfully' });
        await loadPolls();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete poll' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function loadVoterDetails(pollId: string) {
    // If already viewing this poll, toggle it off
    if (viewingVotersForPoll === pollId) {
      setViewingVotersForPoll(null);
      return;
    }

    // If we already have the data, just show it
    if (voterDetails[pollId]) {
      setViewingVotersForPoll(pollId);
      return;
    }

    setLoadingVoters(true);
    try {
      const response = await fetch(`/api/admin/polls/${pollId}/voters`);
      
      if (response.ok) {
        const data = await response.json();
        setVoterDetails(prev => ({
          ...prev,
          [pollId]: data.detailedResults,
        }));
        setViewingVotersForPoll(pollId);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to load voter details' });
      }
    } catch (error) {
      console.error('Failed to load voter details:', error);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoadingVoters(false);
    }
  }

  const importedMuxItemsByPlaybackId = new Map(
    muxItems
      .filter((item) => (item.source_type || MUX_SOURCE_TYPE) === MUX_SOURCE_TYPE)
      .map((item) => [item.playback_id, item])
  );
  const normalizedMuxLibraryQuery = muxLibraryQuery.trim().toLowerCase();
  const filteredMuxLibraryAssets = muxLibraryAssets.filter((asset) => {
    if (!normalizedMuxLibraryQuery) return true;

    const importedItem = asset.playbackId ? importedMuxItemsByPlaybackId.get(asset.playbackId) : null;
    const searchText = [
      asset.defaultTitle,
      muxLibraryTitles[asset.assetId],
      importedItem?.label,
      asset.assetId,
      asset.playbackId,
      asset.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchText.includes(normalizedMuxLibraryQuery);
  });

  return (
    <div className="space-y-6">
      {/* Playback Controls Section */}
      {showPlaybackControls && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-twitch-text">Controls</h2>
          
          {/* Synchronized Playback Controls */}
          <PlaybackControls />
        </div>
      )}

      {message && (
        <div className={`rounded p-4 ${
          message.type === 'success'
            ? 'bg-success/10 border border-success text-success'
            : 'bg-error/10 border border-error text-error'
        }`}>
          {message.text}
        </div>
      )}

      {/* Library Controls Section */}
      {showLibraryControls && (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-3 text-twitch-text">Select from Library</h3>
            {muxItems.length === 0 ? (
              <p className="text-twitch-text-alt text-sm">No media items available. Add one below.</p>
            ) : (
              <div className="space-y-2">
                {muxItems.map(item => {
                  const sourceType = item.source_type || MUX_SOURCE_TYPE;

                  return (
                    <div key={item.id} className={`twitch-card p-4 ${holdScreenMuxItemId === item.id ? 'border-yellow-500 bg-yellow-500/10' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
	                            <p className="font-medium text-twitch-text">{item.label}</p>
	                            <span className="text-xs font-semibold px-2 py-1 rounded bg-twitch-purple/20 text-twitch-purple">
	                              {getSourceLabel(sourceType)}
	                            </span>
                            {holdScreenMuxItemId === item.id && (
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Hold Screen
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-twitch-text-alt font-mono break-all">{item.playback_id}</p>
                          {item.source_url && (
                            <p className="text-xs text-twitch-text-alt break-all mt-1">{item.source_url}</p>
                          )}
                          {item.duration_seconds && (
                            <p className="text-xs text-twitch-text-alt">
                              Duration: {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
                          <button
                            onClick={() => handleSetStream(
                              item.playback_id,
                              item.label,
                              item.kind,
                              sourceType,
                              item.youtube_playlist_id,
                              item.source_url
                            )}
                            disabled={loading || currentStream?.playback_id === item.playback_id}
                            className={`px-4 py-2 rounded text-sm transition-colors min-h-[44px] ${
                              currentStream?.playback_id === item.playback_id
                                ? 'bg-twitch-hover text-twitch-text-alt cursor-not-allowed'
                                : 'twitch-button'
                            }`}
                          >
                            {currentStream?.playback_id === item.playback_id ? 'Current' : 'Make Current'}
                          </button>
                          <button
                            onClick={() => handleSetHoldScreen(item.id, item.label)}
                            disabled={loading || holdScreenMuxItemId === item.id}
                            className={`px-4 py-2 rounded text-sm transition-colors min-h-[44px] ${
                              holdScreenMuxItemId === item.id
                                ? 'bg-yellow-500/20 text-yellow-500 cursor-not-allowed border border-yellow-500'
                                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            }`}
                            title="Set this as the hold screen video"
                          >
                            {holdScreenMuxItemId === item.id ? '★ Hold Screen' : 'Set Hold Screen'}
                          </button>
                          <button
                            onClick={() => handleDeleteMuxItem(item.id, item.label)}
                            disabled={loading}
                            className="px-4 py-2 rounded text-sm transition-colors bg-error hover:bg-red-600 disabled:bg-twitch-gray disabled:cursor-not-allowed text-white min-h-[44px]"
                            title="Delete this item from library"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="twitch-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-twitch-text">Add Media</h3>
                <p className="text-xs text-twitch-text-alt mt-1">
                  Choose a Mux asset or add YouTube media.
                </p>
              </div>
              {addMediaTab === 'mux' && (
                <button
                  type="button"
                  onClick={() => loadMuxLibraryAssets(true)}
                  disabled={muxLibraryLoading}
                  className="w-full sm:w-auto twitch-button-secondary disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                >
                  {muxLibraryLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
            </div>

            <div
              role="tablist"
              aria-label="Add media source"
              className="grid grid-cols-2 gap-2 mb-4 rounded-xl bg-white/40 p-1 border border-white/50"
            >
              <button
                type="button"
                role="tab"
                aria-selected={addMediaTab === 'mux'}
                onClick={() => setAddMediaTab('mux')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[44px] ${
                  addMediaTab === 'mux'
                    ? 'bg-casual-pink text-casual-dark shadow-glow-pink'
                    : 'text-twitch-text-alt hover:bg-white/50'
                }`}
              >
                Mux
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={addMediaTab === 'youtube'}
                onClick={() => setAddMediaTab('youtube')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[44px] ${
                  addMediaTab === 'youtube'
                    ? 'bg-casual-pink text-casual-dark shadow-glow-pink'
                    : 'text-twitch-text-alt hover:bg-white/50'
                }`}
              >
                YouTube
              </button>
            </div>

            {addMediaTab === 'mux' ? (
              <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-twitch-text mb-2">
                Search Mux assets
              </label>
              <input
                type="search"
                value={muxLibraryQuery}
                onChange={(e) => setMuxLibraryQuery(e.target.value)}
                className="twitch-input w-full"
                placeholder="Search title, asset ID, or playback ID"
                disabled={muxLibraryLoading && muxLibraryAssets.length === 0}
              />
            </div>

            {muxLibraryError && (
              <div className="rounded p-4 mb-4 bg-error/10 border border-error text-error">
                {muxLibraryError}
              </div>
            )}

            {muxLibraryLoading && muxLibraryAssets.length === 0 ? (
              <div className="text-sm text-twitch-text-alt text-center py-8">
                Loading Mux assets...
              </div>
            ) : muxLibraryAssets.length === 0 && !muxLibraryError ? (
              <div className="text-sm text-twitch-text-alt text-center py-8">
                No Mux assets found.
              </div>
            ) : filteredMuxLibraryAssets.length === 0 ? (
              <div className="text-sm text-twitch-text-alt text-center py-8">
                No assets match your search.
              </div>
            ) : (
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {filteredMuxLibraryAssets.map((asset) => {
                  const importedItem = asset.playbackId
                    ? importedMuxItemsByPlaybackId.get(asset.playbackId)
                    : null;
                  const isImported = Boolean(importedItem);
                  const isCurrent = Boolean(importedItem && currentStream?.playback_id === importedItem.playback_id);
                  const isImporting = importingMuxAssetId === asset.assetId;
                  const titleValue = importedItem?.label || muxLibraryTitles[asset.assetId] || asset.defaultTitle;

                  return (
                    <div
                      key={asset.assetId}
                      className={`bg-white/50 border border-twitch-border rounded-xl p-3 ${
                        asset.canImport ? '' : 'opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="h-28 w-full sm:w-44 flex-shrink-0 overflow-hidden rounded-lg border border-white/60 bg-twitch-gray">
                          {asset.thumbnailUrl ? (
                            <Image
                              src={asset.thumbnailUrl}
                              alt={`${asset.defaultTitle} thumbnail`}
                              width={320}
                              height={180}
                              className="h-full w-full object-cover"
                              sizes="(min-width: 640px) 176px, 100vw"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center px-3 text-center text-xs text-twitch-text-alt">
                              Thumbnail unavailable
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded ${
                                  asset.status === 'ready'
                                    ? 'bg-success/30 text-green-700'
                                    : asset.status === 'errored'
                                      ? 'bg-error/30 text-red-700'
                                      : 'bg-yellow-500/20 text-yellow-700'
                                }`}
                              >
                                {asset.status}
                              </span>
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-twitch-purple/20 text-twitch-purple">
                                {asset.playbackPolicy ? `${asset.playbackPolicy} playback` : 'No playback ID'}
                              </span>
                              {isImported && (
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-success/30 text-green-700">
                                  In Library
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-twitch-text-alt font-mono break-all">
                              Asset: {asset.assetId}
                            </p>
                            <p className="text-xs text-twitch-text-alt font-mono break-all">
                              Playback: {asset.playbackId || 'None'}
                            </p>
                            <p className="text-xs text-twitch-text-alt mt-1">
                              {formatDuration(asset.durationSeconds)} • {formatAssetDate(asset.createdAt)}
                              {asset.aspectRatio ? ` • ${asset.aspectRatio}` : ''}
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-twitch-text mb-2">
                              Title/Label
                            </label>
                            <input
                              type="text"
                              value={titleValue}
                              onChange={(e) =>
                                setMuxLibraryTitles((currentTitles) => ({
                                  ...currentTitles,
                                  [asset.assetId]: e.target.value,
                                }))
                              }
                              className="twitch-input w-full"
                              disabled={loading || isImported || !asset.canImport}
                            />
                          </div>

                          {asset.disabledReason && (
                            <p className="text-sm text-twitch-text-alt">
                              {asset.disabledReason}
                            </p>
                          )}

                          <div className="flex flex-col sm:flex-row gap-2">
                            {importedItem ? (
                              <button
                                onClick={() => handleSetStream(
                                  importedItem.playback_id,
                                  importedItem.label,
                                  importedItem.kind,
                                  importedItem.source_type || MUX_SOURCE_TYPE,
                                  importedItem.youtube_playlist_id,
                                  importedItem.source_url
                                )}
                                disabled={loading || isCurrent}
                                className={`px-4 py-2 rounded text-sm transition-colors min-h-[44px] ${
                                  isCurrent
                                    ? 'bg-twitch-hover text-twitch-text-alt cursor-not-allowed'
                                    : 'twitch-button'
                                }`}
                              >
                                {isCurrent ? 'Current' : 'Make Current'}
                              </button>
                            ) : asset.canImport ? (
                              <>
                                <button
                                  onClick={() => handleImportMuxAsset(asset, false)}
                                  disabled={loading || isImporting || !titleValue.trim()}
                                  className="twitch-button-secondary disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                                >
                                  {isImporting ? 'Adding...' : 'Add to Library'}
                                </button>
                                <button
                                  onClick={() => handleImportMuxAsset(asset, true)}
                                  disabled={loading || isImporting || !titleValue.trim()}
                                  className="twitch-button disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                                >
                                  {isImporting ? 'Adding...' : 'Add & Make Current'}
                                </button>
                              </>
                            ) : (
                              <button
                                disabled
                                className="px-4 py-2 rounded text-sm min-h-[44px] bg-twitch-gray text-twitch-text-alt cursor-not-allowed"
                              >
                                Unavailable
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {muxLibraryPagination?.hasNextPage && (
              <button
                type="button"
                onClick={() => loadMuxLibraryAssets(false)}
                disabled={muxLibraryLoading}
                className="w-full mt-4 twitch-button-secondary disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
              >
                {muxLibraryLoading ? 'Loading...' : 'Load more'}
              </button>
            )}
              </>
            ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-twitch-text mb-2">
                  Type
                </label>
                <div className="inline-flex rounded-lg border border-twitch-border bg-white/50 p-1" role="group" aria-label="YouTube media type">
                  <button
                    type="button"
                    onClick={() => setYoutubeSourceType(YOUTUBE_PLAYLIST_SOURCE_TYPE)}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors min-h-[40px] ${
                      youtubeSourceType === YOUTUBE_PLAYLIST_SOURCE_TYPE
                        ? 'bg-casual-pink text-casual-dark shadow-glow-pink'
                        : 'text-twitch-text-alt hover:bg-white/60'
                    }`}
                  >
                    Playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setYoutubeSourceType(YOUTUBE_VIDEO_SOURCE_TYPE)}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors min-h-[40px] ${
                      youtubeSourceType === YOUTUBE_VIDEO_SOURCE_TYPE
                        ? 'bg-casual-pink text-casual-dark shadow-glow-pink'
                        : 'text-twitch-text-alt hover:bg-white/60'
                    }`}
                  >
                    Video
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-twitch-text mb-2">
                  {youtubeSourceType === YOUTUBE_VIDEO_SOURCE_TYPE ? 'Video URL or ID' : 'Playlist URL or ID'}
                </label>
                <input
                  type="text"
                  value={youtubePlaylistUrl}
                  onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
                  className="twitch-input w-full"
                  placeholder={
                    youtubeSourceType === YOUTUBE_VIDEO_SOURCE_TYPE
                      ? 'https://www.youtube.com/watch?v=...'
                      : 'https://www.youtube.com/playlist?list=...'
                  }
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-twitch-text mb-2">
                  Title/Label
                </label>
                <input
                  type="text"
                  value={youtubePlaylistTitle}
                  onChange={(e) => setYoutubePlaylistTitle(e.target.value)}
                  className="twitch-input w-full"
                  placeholder={youtubeSourceType === YOUTUBE_VIDEO_SOURCE_TYPE ? 'e.g., Opening Segment' : 'e.g., Late Night Clips'}
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleAddYouTubeMedia(false)}
                  disabled={loading || !youtubePlaylistUrl}
                  className="twitch-button-secondary disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                >
                  Add to Library
                </button>
                <button
                  onClick={() => handleAddYouTubeMedia(true)}
                  disabled={loading || !youtubePlaylistUrl}
                  className="twitch-button disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                >
                  Add & Make Current
                </button>
              </div>
            </div>
            )}
          </div>
        </>
      )}

      {showPollControls && (
          <div className="twitch-card p-4 border-t border-twitch-purple">
            <h3 className="text-lg font-semibold mb-3 text-twitch-text">Poll Management</h3>
            
            {/* Create Poll Section */}
            <div className="mb-6 p-4 bg-twitch-darker rounded-lg border border-twitch-border">
              <h4 className="text-md font-semibold mb-3 text-twitch-purple">Create New Poll</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-twitch-text mb-2">
                    Poll Question
                  </label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="twitch-input w-full"
                    placeholder="e.g., What should we watch next?"
                    disabled={pollLoading}
                    maxLength={300}
                  />
                  <p className="text-xs text-twitch-text-alt mt-1">{pollQuestion.length}/300</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-twitch-text mb-2">
                    Poll Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPollType('fixed')}
                      disabled={pollLoading}
                      className={`flex-1 px-3 py-2 rounded border min-h-[44px] transition-colors ${
                        pollType === 'fixed'
                          ? 'bg-twitch-purple text-white border-twitch-purple'
                          : 'bg-transparent text-twitch-text border-twitch-border'
                      }`}
                    >
                      Fixed choices
                    </button>
                    <button
                      type="button"
                      onClick={() => setPollType('open')}
                      disabled={pollLoading}
                      className={`flex-1 px-3 py-2 rounded border min-h-[44px] transition-colors ${
                        pollType === 'open'
                          ? 'bg-twitch-purple text-white border-twitch-purple'
                          : 'bg-transparent text-twitch-text border-twitch-border'
                      }`}
                    >
                      Open answers
                    </button>
                  </div>
                  <p className="text-xs text-twitch-text-alt mt-1">
                    {pollType === 'fixed'
                      ? 'You pick the answer choices up front.'
                      : "Viewers type their own answers, then vote on each other's — no answer choices to set up here."}
                  </p>
                </div>

                {pollType === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-twitch-text mb-2">
                      Options (2-5)
                    </label>
                    <div className="space-y-2">
                      {pollOptions.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updatePollOption(index, e.target.value)}
                            className="twitch-input flex-1"
                            placeholder={`Option ${index + 1}`}
                            disabled={pollLoading}
                            maxLength={280}
                          />
                          {pollOptions.length > 2 && (
                            <button
                              onClick={() => removePollOption(index)}
                              disabled={pollLoading}
                              className="px-3 py-2 bg-error hover:bg-red-600 disabled:bg-twitch-gray disabled:cursor-not-allowed rounded transition-colors text-white min-h-[44px]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {pollOptions.length < 5 && (
                      <button
                        onClick={addPollOption}
                        disabled={pollLoading}
                        className="mt-2 text-sm text-twitch-purple hover:text-purple-400 disabled:text-twitch-text-alt"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCreatePoll}
                  disabled={pollLoading || !pollQuestion.trim() || (pollType === 'fixed' && pollOptions.filter(o => o.trim()).length < 2)}
                  className="w-full twitch-button disabled:bg-twitch-gray disabled:cursor-not-allowed font-medium min-h-[44px]"
                >
                  {pollLoading ? 'Creating Poll...' : 'Create Poll in Chat'}
                </button>
              </div>
            </div>

            {/* Manage Existing Polls */}
            <div>
              <h4 className="text-md font-semibold mb-3 text-twitch-purple">Manage Existing Polls</h4>
              {polls.length === 0 ? (
                <p className="text-twitch-text-alt text-sm text-center py-4">No polls yet. Create one above!</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {polls.map((poll) => {
                    const isEditing = editingPollId === poll.id;
                    const maxVotes = poll.options.length > 0 ? Math.max(...poll.options.map(o => o.vote_count)) : 0;
                    const winners = poll.options.filter(o => o.vote_count === maxVotes);
                    
                    return (
                      <div key={poll.id} className={`twitch-card p-4 ${poll.is_open ? 'border border-twitch-purple/60' : 'border border-success/70 opacity-75'}`}>
                        {/* Poll Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${poll.is_open ? 'bg-twitch-purple/20 text-twitch-purple' : 'bg-success/20 text-success'}`}>
                                {poll.is_open ? 'OPEN' : 'CLOSED'}
                              </span>
                              {poll.type === 'open' && (
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-casual-indigo/40 text-twitch-text">
                                  OPEN ANSWERS
                                </span>
                              )}
                              <span className="text-xs text-twitch-text-alt">
                                {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>
                            
                            {isEditing ? (
                              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                <input
                                  type="text"
                                  value={editingQuestion}
                                  onChange={(e) => setEditingQuestion(e.target.value)}
                                  className="twitch-input flex-1 text-sm min-h-[44px]"
                                  maxLength={300}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdatePoll(poll.id, editingQuestion)}
                                    disabled={loading}
                                    className="px-3 py-2 bg-success hover:bg-green-600 rounded text-sm text-white flex-1 sm:flex-none min-h-[44px]"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPollId(null);
                                      setEditingQuestion('');
                                    }}
                                    className="px-3 py-2 bg-twitch-gray hover:bg-twitch-hover rounded text-sm flex-1 sm:flex-none min-h-[44px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-twitch-text">{poll.question}</p>
                            )}
                          </div>
                        </div>

                        {/* Poll Results Summary */}
                        {!poll.is_open && poll.total_votes > 0 && (
                          <div className="mb-2 p-2 bg-success/10 rounded text-xs text-success">
                            <span className="font-semibold">Winner{winners.length > 1 ? 's' : ''}:</span> {winners.map(w => `${w.label} (${w.percentage}%)`).join(', ')}
                          </div>
                        )}

                        {/* Poll Options */}
                        <div className="space-y-1 mb-3">
                          {poll.options.length === 0 && poll.type === 'open' && (
                            <p className="text-xs text-twitch-text-alt italic">No answers submitted yet.</p>
                          )}
                          {poll.options.map((option) => (
                            <div key={option.id} className="flex items-center justify-between text-xs gap-2">
                              <span className="text-twitch-text">
                                {option.label}
                                {poll.type === 'open' && option.author_name && (
                                  <span className="text-twitch-text-alt"> — {option.author_name}</span>
                                )}
                              </span>
                              <span className="text-twitch-text-alt ml-2 flex-shrink-0">
                                {option.vote_count} ({option.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-twitch-border">
                          {poll.is_open && !isEditing && (
                            <button
                              onClick={() => {
                                setEditingPollId(poll.id);
                                setEditingQuestion(poll.question);
                              }}
                              disabled={loading}
                              className="px-3 py-2 text-xs bg-twitch-purple hover:bg-purple-600 rounded transition-colors text-white disabled:bg-twitch-gray min-h-[44px]"
                            >
                              Edit Question
                            </button>
                          )}
                          {poll.is_open && (
                            <button
                              onClick={() => handleClosePoll(poll.id)}
                              disabled={loading}
                              className="px-3 py-2 text-xs bg-twitch-gray hover:bg-twitch-hover rounded transition-colors disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                            >
                              Close Poll
                            </button>
                          )}
                          {!poll.is_open && (
                            <button
                              onClick={() => handleOpenPoll(poll.id)}
                              disabled={loading}
                              className="px-3 py-2 text-xs bg-success hover:bg-green-600 rounded transition-colors text-white disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
                            >
                              Open Poll
                            </button>
                          )}
                          {!poll.is_open && poll.total_votes > 0 && (
                            <button
                              onClick={() => loadVoterDetails(poll.id)}
                              disabled={loadingVoters}
                              className="px-3 py-2 text-xs bg-twitch-purple hover:bg-purple-600 rounded transition-colors text-white disabled:bg-twitch-gray min-h-[44px]"
                            >
                              {viewingVotersForPoll === poll.id ? 'Hide Voters' : 'View Voters'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePoll(poll.id, poll.question)}
                            disabled={loading}
                            className="px-3 py-2 text-xs bg-error hover:bg-red-600 rounded transition-colors text-white disabled:bg-twitch-gray disabled:cursor-not-allowed sm:ml-auto min-h-[44px]"
                          >
                            Delete
                          </button>
                        </div>

                        {/* Voter Details */}
                        {!poll.is_open && viewingVotersForPoll === poll.id && voterDetails[poll.id] && (
                          <div className="mt-3 p-3 bg-twitch-dark rounded border border-twitch-border">
                            <h5 className="text-xs font-semibold text-twitch-purple mb-2 uppercase tracking-wider">
                              Voter Breakdown
                            </h5>
                            <div className="space-y-3">
                              {voterDetails[poll.id].map((result) => (
                                <div key={result.option_id} className="border border-twitch-purple/40 rounded p-2">
                                  <div className="text-xs font-medium text-twitch-text mb-1">
                                    {result.option_label} ({result.vote_count} {result.vote_count === 1 ? 'vote' : 'votes'})
                                  </div>
                                  {result.voters.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {result.voters.map((voter, index) => (
                                        <span
                                          key={index}
                                          className="text-xs px-2 py-1 bg-twitch-hover rounded text-twitch-text-alt"
                                        >
                                          {voter}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-twitch-text-alt italic">No votes</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      )}
    </div>
  );
}
