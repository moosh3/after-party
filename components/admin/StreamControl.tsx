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

interface Poll {
  id: string;
  question: string;
  is_open: boolean;
  created_at: string;
  closed_at: string | null;
  total_votes: number;
  options: {
    id: string;
    label: string;
    vote_count: number;
    percentage: number;
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
    loadCurrentStream();
    loadPolls();
    
    // Refresh current stream periodically to keep in sync
    const interval = setInterval(() => {
      loadCurrentStream();
      loadPolls();
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
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => handleSetStream(item.playback_id, item.label, item.kind)}
                        disabled={loading || currentStream?.playback_id === item.playback_id}
                        className={`px-4 py-2 rounded text-sm transition-colors ${
                          currentStream?.playback_id === item.playback_id
                            ? 'bg-twitch-hover text-twitch-text-alt cursor-not-allowed'
                            : 'twitch-button'
                        }`}
                      >
                        {currentStream?.playback_id === item.playback_id ? 'Current' : 'Make Current'}
                      </button>
                      <button
                        onClick={() => handleDeleteMuxItem(item.id, item.label)}
                        disabled={loading}
                        className="px-4 py-2 rounded text-sm transition-colors bg-error hover:bg-red-600 disabled:bg-twitch-gray disabled:cursor-not-allowed text-white"
                        title="Delete this item from library"
                      >
                        Delete
                      </button>
                    </div>
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

            {/* Manage Existing Polls */}
            <div>
              <h4 className="text-md font-semibold mb-3 text-twitch-purple">Manage Existing Polls</h4>
              {polls.length === 0 ? (
                <p className="text-twitch-text-alt text-sm text-center py-4">No polls yet. Create one above!</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {polls.map((poll) => {
                    const isEditing = editingPollId === poll.id;
                    const maxVotes = Math.max(...poll.options.map(o => o.vote_count));
                    const winners = poll.options.filter(o => o.vote_count === maxVotes);
                    
                    return (
                      <div key={poll.id} className={`twitch-card p-4 ${poll.is_open ? 'border-l-4 border-twitch-purple' : 'border-l-4 border-success opacity-75'}`}>
                        {/* Poll Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${poll.is_open ? 'bg-twitch-purple/20 text-twitch-purple' : 'bg-success/20 text-success'}`}>
                                {poll.is_open ? 'OPEN' : 'CLOSED'}
                              </span>
                              <span className="text-xs text-twitch-text-alt">
                                {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>
                            
                            {isEditing ? (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  value={editingQuestion}
                                  onChange={(e) => setEditingQuestion(e.target.value)}
                                  className="twitch-input flex-1 text-sm"
                                  maxLength={300}
                                />
                                <button
                                  onClick={() => handleUpdatePoll(poll.id, editingQuestion)}
                                  disabled={loading}
                                  className="px-3 py-1 bg-success hover:bg-green-600 rounded text-sm text-white"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPollId(null);
                                    setEditingQuestion('');
                                  }}
                                  className="px-3 py-1 bg-twitch-gray hover:bg-twitch-hover rounded text-sm"
                                >
                                  Cancel
                                </button>
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
                          {poll.options.map((option) => (
                            <div key={option.id} className="flex items-center justify-between text-xs">
                              <span className="text-twitch-text truncate">{option.label}</span>
                              <span className="text-twitch-text-alt ml-2">
                                {option.vote_count} ({option.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-twitch-border">
                          {poll.is_open && !isEditing && (
                            <button
                              onClick={() => {
                                setEditingPollId(poll.id);
                                setEditingQuestion(poll.question);
                              }}
                              disabled={loading}
                              className="px-3 py-1 text-xs bg-twitch-purple hover:bg-purple-600 rounded transition-colors text-white disabled:bg-twitch-gray"
                            >
                              Edit Question
                            </button>
                          )}
                          {poll.is_open && (
                            <button
                              onClick={() => handleClosePoll(poll.id)}
                              disabled={loading}
                              className="px-3 py-1 text-xs bg-twitch-gray hover:bg-twitch-hover rounded transition-colors disabled:bg-twitch-gray disabled:cursor-not-allowed"
                            >
                              Close Poll
                            </button>
                          )}
                          {!poll.is_open && poll.total_votes > 0 && (
                            <button
                              onClick={() => loadVoterDetails(poll.id)}
                              disabled={loadingVoters}
                              className="px-3 py-1 text-xs bg-twitch-purple hover:bg-purple-600 rounded transition-colors text-white disabled:bg-twitch-gray"
                            >
                              {viewingVotersForPoll === poll.id ? 'Hide Voters' : 'View Voters'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePoll(poll.id, poll.question)}
                            disabled={loading}
                            className="px-3 py-1 text-xs bg-error hover:bg-red-600 rounded transition-colors text-white disabled:bg-twitch-gray disabled:cursor-not-allowed ml-auto"
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
                                <div key={result.option_id} className="border-l-2 border-twitch-purple pl-2">
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
        </>
      )}
    </div>
  );
}

