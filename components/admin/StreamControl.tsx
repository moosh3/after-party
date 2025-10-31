'use client';

import { useState, useEffect } from 'react';
import PlaybackControls from './PlaybackControls';

interface MuxItem {
  id: string;
  playback_id: string;
  label: string;
  kind: string;
  duration_seconds?: number;
}

interface CurrentStream {
  playback_id: string;
  title: string;
  kind: string;
  updated_at: string;
}

interface StreamControlProps {
  showLibraryControls?: boolean;
  showPlaybackControls?: boolean;
}

export default function StreamControl({ 
  showLibraryControls = true, 
  showPlaybackControls = true 
}: StreamControlProps) {
  const [muxItems, setMuxItems] = useState<MuxItem[]>([]);
  const [currentStream, setCurrentStream] = useState<CurrentStream | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [customPlaybackId, setCustomPlaybackId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollLoading, setPollLoading] = useState(false);

  useEffect(() => {
    loadMuxItems();
    loadCurrentStream();
    
    // Refresh current stream periodically to keep in sync
    const interval = setInterval(() => {
      loadCurrentStream();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  async function loadMuxItems() {
    try {
      const response = await fetch('/api/admin/mux-items');
      if (response.ok) {
        const data = await response.json();
        setMuxItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load Mux items:', error);
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

  async function handleSetStream(playbackId: string, title: string, kind: string = 'vod') {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/set-current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbackId, title, kind }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Stream updated to: ${title}` });
        setCurrentStream(data.stream);
        setCustomPlaybackId('');
        setCustomTitle('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update stream' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMuxItem() {
    if (!customPlaybackId || !customTitle) {
      setMessage({ type: 'error', text: 'Playback ID and title are required' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/mux-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbackId: customPlaybackId,
          label: customTitle,
          kind: 'vod',
        }),
      });

      if (response.ok) {
        await loadMuxItems();
        setMessage({ type: 'success', text: 'Mux item added successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to add item' });
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

    if (validOptions.length < 2) {
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
          options: validOptions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Poll created successfully!' });
        setPollQuestion('');
        setPollOptions(['', '']);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create poll' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setPollLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Playback Controls Section */}
      {showPlaybackControls && (
        <div>
          <h2 className="text-2xl font-bold mb-4 text-twitch-text">Stream Control</h2>
          
          {/* Synchronized Playback Controls */}
          <PlaybackControls />
          
          {currentStream && (
            <div className="twitch-card p-4 mb-6 border-l-4 border-twitch-purple mt-4">
              <p className="text-xs text-twitch-text-alt uppercase tracking-wider mb-1">Currently Streaming</p>
              <p className="font-semibold text-lg text-twitch-text">{currentStream.title}</p>
              <p className="text-xs text-twitch-text-alt mt-2 font-mono">
                {currentStream.playback_id} • {currentStream.kind}
              </p>
              <p className="text-xs text-twitch-text-alt mt-1">
                Last updated: {new Date(currentStream.updated_at).toLocaleString()}
              </p>
            </div>
          )}

          {message && (
            <div className={`rounded p-4 mb-4 ${
              message.type === 'success' 
                ? 'bg-success/10 border border-success text-success' 
                : 'bg-error/10 border border-error text-error'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      )}

      {/* Library Controls Section */}
      {showLibraryControls && (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-3 text-twitch-text">Select from Library</h3>
            {muxItems.length === 0 ? (
              <p className="text-twitch-text-alt text-sm">No Mux items available. Add one below.</p>
            ) : (
              <div className="space-y-2">
                {muxItems.map(item => (
                  <div key={item.id} className="twitch-card p-4 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-twitch-text">{item.label}</p>
                      <p className="text-xs text-twitch-text-alt font-mono">{item.playback_id}</p>
                      {item.duration_seconds && (
                        <p className="text-xs text-twitch-text-alt">
                          Duration: {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSetStream(item.playback_id, item.label, item.kind)}
                      disabled={loading || currentStream?.playback_id === item.playback_id}
                      className={`px-4 py-2 rounded text-sm transition-colors flex-shrink-0 ml-4 ${
                        currentStream?.playback_id === item.playback_id
                          ? 'bg-twitch-hover text-twitch-text-alt cursor-not-allowed'
                          : 'twitch-button'
                      }`}
                    >
                      {currentStream?.playback_id === item.playback_id ? 'Current' : 'Make Current'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="twitch-card p-4">
            <h3 className="text-lg font-semibold mb-3 text-twitch-text">Add New Mux Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-twitch-text mb-2">
                  Playback ID
                </label>
                <input
                  type="text"
                  value={customPlaybackId}
                  onChange={(e) => setCustomPlaybackId(e.target.value)}
                  className="twitch-input w-full"
                  placeholder="e.g., abc123xyz456"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-twitch-text mb-2">
                  Title/Label
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="twitch-input w-full"
                  placeholder="e.g., Opening Segment"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddMuxItem}
                  disabled={loading || !customPlaybackId || !customTitle}
                  className="twitch-button-secondary disabled:bg-twitch-gray disabled:cursor-not-allowed"
                >
                  Add to Library
                </button>
                <button
                  onClick={() => {
                    if (customPlaybackId && customTitle) {
                      handleSetStream(customPlaybackId, customTitle);
                    }
                  }}
                  disabled={loading || !customPlaybackId || !customTitle}
                  className="twitch-button disabled:bg-twitch-gray disabled:cursor-not-allowed"
                >
                  Add & Make Current
                </button>
              </div>
            </div>
          </div>

          <div className="twitch-card p-4 border-t border-twitch-purple">
            <h3 className="text-lg font-semibold mb-3 text-twitch-text">Create Poll</h3>
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
                        maxLength={100}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(index)}
                          disabled={pollLoading}
                          className="px-3 py-2 bg-error hover:bg-red-600 disabled:bg-twitch-gray disabled:cursor-not-allowed rounded transition-colors text-white"
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

              <button
                onClick={handleCreatePoll}
                disabled={pollLoading || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                className="w-full twitch-button disabled:bg-twitch-gray disabled:cursor-not-allowed font-medium"
              >
                {pollLoading ? 'Creating Poll...' : 'Create Poll in Chat'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

