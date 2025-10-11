'use client';

import { useState, useEffect } from 'react';

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

export default function StreamControl() {
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
      <div>
        <h2 className="text-2xl font-bold mb-4">Stream Control</h2>
        
        {currentStream && (
          <div className="bg-slate-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-400 mb-1">Currently Streaming</p>
            <p className="font-semibold">{currentStream.title}</p>
            <p className="text-xs text-slate-400 mt-2">
              {currentStream.playback_id} • {currentStream.kind}
            </p>
            <p className="text-xs text-slate-500">
              Last updated: {new Date(currentStream.updated_at).toLocaleString()}
            </p>
          </div>
        )}

        {message && (
          <div className={`rounded-lg p-4 mb-4 ${
            message.type === 'success' 
              ? 'bg-green-500/10 border border-green-500 text-green-400' 
              : 'bg-red-500/10 border border-red-500 text-red-400'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Select from Library</h3>
        {muxItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No Mux items available. Add one below.</p>
        ) : (
          <div className="space-y-2">
            {muxItems.map(item => (
              <div key={item.id} className="bg-slate-700 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-slate-400 font-mono">{item.playback_id}</p>
                  {item.duration_seconds && (
                    <p className="text-xs text-slate-500">
                      Duration: {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSetStream(item.playback_id, item.label, item.kind)}
                  disabled={loading || currentStream?.playback_id === item.playback_id}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {currentStream?.playback_id === item.playback_id ? 'Current' : 'Make Current'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Add New Mux Item</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Playback ID
            </label>
            <input
              type="text"
              value={customPlaybackId}
              onChange={(e) => setCustomPlaybackId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="e.g., abc123xyz456"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title/Label
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="e.g., Opening Segment"
              disabled={loading}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMuxItem}
              disabled={loading || !customPlaybackId || !customTitle}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
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
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
            >
              Add & Make Current
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-lg font-semibold mb-3">Create Poll</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Poll Question
            </label>
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="e.g., What should we discuss next?"
              disabled={pollLoading}
              maxLength={300}
            />
            <p className="text-xs text-slate-500 mt-1">{pollQuestion.length}/300</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Options (2-5)
            </label>
            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    placeholder={`Option ${index + 1}`}
                    disabled={pollLoading}
                    maxLength={100}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removePollOption(index)}
                      disabled={pollLoading}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
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
                className="mt-2 text-sm text-blue-400 hover:text-blue-300 disabled:text-slate-500"
              >
                + Add Option
              </button>
            )}
          </div>

          <button
            onClick={handleCreatePoll}
            disabled={pollLoading || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-colors"
          >
            {pollLoading ? 'Creating Poll...' : 'Create Poll in Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

