'use client';

import { useState, useEffect } from 'react';

interface QueueItem {
  id: string;
  position: number;
  mux_item_id: string;
  created_at: string;
  mux_items: {
    id: string;
    playback_id: string;
    label: string;
    kind: string;
    duration_seconds?: number;
  };
}

interface MuxItem {
  id: string;
  playback_id: string;
  label: string;
  kind: string;
  duration_seconds?: number;
}

export default function QueueManager() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [muxItems, setMuxItems] = useState<MuxItem[]>([]);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadQueue();
    loadMuxItems();
    loadAutoAdvanceStatus();

    // Refresh periodically
    const interval = setInterval(() => {
      loadQueue();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function loadQueue() {
    try {
      const response = await fetch('/api/admin/queue');
      if (response.ok) {
        const data = await response.json();
        setQueue(data.queue || []);
      }
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  }

  async function loadMuxItems() {
    try {
      const response = await fetch('/api/admin/mux-items');
      if (response.ok) {
        const data = await response.json();
        setMuxItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load mux items:', error);
    }
  }

  async function loadAutoAdvanceStatus() {
    try {
      const response = await fetch('/api/admin/queue/auto-advance');
      if (response.ok) {
        const data = await response.json();
        setAutoAdvanceEnabled(data.auto_advance_enabled || false);
      }
    } catch (error) {
      console.error('Failed to load auto-advance status:', error);
    }
  }

  async function handleAddToQueue(muxItemId: string, label: string) {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muxItemId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Added "${label}" to queue` });
        await loadQueue();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add to queue' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleRemoveFromQueue(queueItemId: string, label: string) {
    if (!confirm(`Remove "${label}" from queue?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/queue/${queueItemId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Removed "${label}" from queue` });
        await loadQueue();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove from queue' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;

    const newQueue = [...queue];
    [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];

    // Update positions
    const items = newQueue.map((item, idx) => ({
      id: item.id,
      position: idx + 1,
    }));

    await updateQueueOrder(items);
  }

  async function handleMoveDown(index: number) {
    if (index === queue.length - 1) return;

    const newQueue = [...queue];
    [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];

    // Update positions
    const items = newQueue.map((item, idx) => ({
      id: item.id,
      position: idx + 1,
    }));

    await updateQueueOrder(items);
  }

  async function updateQueueOrder(items: { id: string; position: number }[]) {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (response.ok) {
        await loadQueue();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to reorder queue' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAutoAdvance() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/queue/auto-advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !autoAdvanceEnabled }),
      });

      const data = await response.json();

      if (response.ok) {
        setAutoAdvanceEnabled(data.auto_advance_enabled);
        setMessage({ 
          type: 'success', 
          text: `Auto-advance ${data.auto_advance_enabled ? 'enabled' : 'disabled'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to toggle auto-advance' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleNextVideo() {
    if (queue.length === 0) {
      setMessage({ type: 'error', text: 'No videos in queue' });
      return;
    }

    if (!confirm('Advance to next video in queue?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/queue/next', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Now playing: ${data.advanced_to.title}` 
        });
        await loadQueue();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to advance to next video' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  const isInQueue = (muxItemId: string) => {
    return queue.some(item => item.mux_item_id === muxItemId);
  };

  return (
    <div className="space-y-4">
      <div className="twitch-card p-4 border-t-4 border-twitch-purple">
        <h3 className="text-lg font-semibold mb-3 text-twitch-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-twitch-purple" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <span>Video Queue</span>
          </div>
          <span className="text-sm font-normal text-twitch-text-alt">
            {queue.length} {queue.length === 1 ? 'video' : 'videos'}
          </span>
        </h3>

        {message && (
          <div className={`rounded p-3 mb-3 text-sm ${
            message.type === 'success' 
              ? 'bg-success/10 border border-success text-success' 
              : 'bg-error/10 border border-error text-error'
          }`}>
            {message.text}
          </div>
        )}

        {/* Auto-advance Toggle */}
        <div className="bg-twitch-darker border border-twitch-border rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-twitch-text">Auto-advance</p>
              <p className="text-xs text-twitch-text-alt">
                Automatically play next video when current one ends
              </p>
            </div>
            <button
              onClick={handleToggleAutoAdvance}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoAdvanceEnabled ? 'bg-twitch-purple' : 'bg-twitch-gray'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoAdvanceEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Manual Next Button */}
        <button
          onClick={handleNextVideo}
          disabled={loading || queue.length === 0}
          className="w-full mb-4 bg-success hover:bg-green-600 disabled:bg-twitch-gray disabled:cursor-not-allowed text-white py-2 px-4 rounded font-medium text-sm transition-colors"
        >
          {queue.length > 0 ? '▶ Play Next in Queue' : 'Queue is Empty'}
        </button>

        {/* Current Queue */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-twitch-text-alt uppercase tracking-wider">
            Current Queue
          </p>
          {queue.length === 0 ? (
            <div className="text-center py-6 text-twitch-text-alt text-sm">
              <p>No videos in queue</p>
              <p className="text-xs mt-1">Add videos from your library below</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {queue.map((item, index) => {
                const muxItem = Array.isArray(item.mux_items) 
                  ? item.mux_items[0] 
                  : item.mux_items;
                
                return (
                  <div key={item.id} className="bg-twitch-hover border border-twitch-border rounded p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={loading || index === 0}
                          className="text-twitch-text hover:text-twitch-purple disabled:text-twitch-text-alt disabled:cursor-not-allowed p-1"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={loading || index === queue.length - 1}
                          className="text-twitch-text hover:text-twitch-purple disabled:text-twitch-text-alt disabled:cursor-not-allowed p-1"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-twitch-purple bg-twitch-purple/20 px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-sm text-twitch-text truncate">
                            {muxItem?.label || 'Unknown'}
                          </p>
                        </div>
                        <p className="text-xs text-twitch-text-alt font-mono truncate">
                          {muxItem?.playback_id || ''}
                        </p>
                        {muxItem?.duration_seconds && (
                          <p className="text-xs text-twitch-text-alt mt-1">
                            {Math.floor(muxItem.duration_seconds / 60)}m {muxItem.duration_seconds % 60}s
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveFromQueue(item.id, muxItem?.label || 'video')}
                        disabled={loading}
                        className="text-error hover:text-red-600 disabled:text-twitch-text-alt disabled:cursor-not-allowed p-1 flex-shrink-0"
                        title="Remove from queue"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add to Queue from Library */}
        <div>
          <p className="text-xs font-semibold text-twitch-text-alt uppercase tracking-wider mb-2">
            Add from Library
          </p>
          {muxItems.length === 0 ? (
            <p className="text-sm text-twitch-text-alt text-center py-4">
              No videos in library. Add videos from the main controls.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {muxItems.map((item) => (
                <div key={item.id} className="bg-twitch-darker border border-twitch-border rounded p-3 flex justify-between items-center">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-sm text-twitch-text truncate">
                      {item.label}
                    </p>
                    <p className="text-xs text-twitch-text-alt font-mono truncate">
                      {item.playback_id}
                    </p>
                    {item.duration_seconds && (
                      <p className="text-xs text-twitch-text-alt mt-1">
                        {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddToQueue(item.id, item.label)}
                    disabled={loading || isInQueue(item.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                      isInQueue(item.id)
                        ? 'bg-twitch-hover text-twitch-text-alt cursor-not-allowed'
                        : 'bg-twitch-purple hover:bg-purple-600 text-white'
                    }`}
                  >
                    {isInQueue(item.id) ? 'In Queue' : 'Add to Queue'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

