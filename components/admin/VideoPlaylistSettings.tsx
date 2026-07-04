'use client';

import { useEffect, useState } from 'react';

interface PlaylistSettings {
  sourceUrl: string | null;
  playlistId: string | null;
  title: string;
  isEnabled: boolean;
  updatedAt: string | null;
}

interface PlaylistItem {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  position: number;
}

const DEFAULT_TITLE = 'Clip show';

function formatUpdatedAt(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function VideoPlaylistSettings() {
  const [settings, setSettings] = useState<PlaylistSettings | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadPlaylistSettings() {
    try {
      const response = await fetch('/api/admin/video-playlist');
      const data = await response.json();

      if (response.ok) {
        setSettings(data.settings);
        setItems(data.items || []);
        setSourceUrl(data.settings?.sourceUrl || '');
        setTitle(data.settings?.title || DEFAULT_TITLE);
        setIsEnabled(data.settings?.isEnabled ?? true);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load video playlist' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    }
  }

  useEffect(() => {
    loadPlaylistSettings();
  }, []);

  async function handleSave() {
    if (!sourceUrl.trim()) {
      setMessage({ type: 'error', text: 'Playlist URL is required' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/video-playlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl,
          title,
          isEnabled,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setSettings(data.settings);
        setItems(data.items || []);
        setSourceUrl(data.settings?.sourceUrl || sourceUrl);
        setTitle(data.settings?.title || DEFAULT_TITLE);
        setIsEnabled(data.settings?.isEnabled ?? true);
        setMessage({ type: 'success', text: `Video playlist saved with ${(data.items || []).length} videos` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save video playlist' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/video-playlist', {
        method: 'DELETE',
      });
      const data = await response.json();

      if (response.ok) {
        setSettings(data.settings);
        setItems(data.items || []);
        setSourceUrl('');
        setTitle(DEFAULT_TITLE);
        setIsEnabled(false);
        setMessage({ type: 'success', text: 'Video playlist disabled' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disable video playlist' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="twitch-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-twitch-text">Event Extras</h2>
          <p className="text-xs text-twitch-text-alt mt-1">Video playlist shelf</p>
        </div>
        <div className={`text-xs font-semibold px-2 py-1 rounded self-start ${
          settings?.isEnabled
            ? 'bg-success/10 text-success border border-success/30'
            : 'bg-twitch-hover text-twitch-text-alt border border-twitch-border'
        }`}>
          {settings?.isEnabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>

      {message && (
        <div className={`rounded p-3 mb-4 text-sm ${
          message.type === 'success'
            ? 'bg-success/10 border border-success text-success'
            : 'bg-error/10 border border-error text-error'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-twitch-text mb-2">
            YouTube Playlist URL
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            className="twitch-input w-full"
            placeholder="https://www.youtube.com/playlist?list=..."
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-twitch-text mb-2">
            Shelf Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="twitch-input w-full"
            placeholder={DEFAULT_TITLE}
            disabled={loading}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-twitch-text">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded border-twitch-border bg-twitch-darker"
          />
          Show on event page
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-twitch-text-alt">
          <div>
            <p className="uppercase tracking-wide mb-1">Videos</p>
            <p className="font-semibold text-twitch-text">{items.length}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide mb-1">Playlist ID</p>
            <p className="font-mono text-twitch-text break-all">{settings?.playlistId || 'None'}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide mb-1">Last Updated</p>
            <p className="text-twitch-text">{formatUpdatedAt(settings?.updatedAt || null)}</p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.slice(0, 8).map((item) => (
              <div key={item.videoId} className="w-28 flex-shrink-0">
                <div className="aspect-video bg-twitch-darker rounded overflow-hidden border border-twitch-border">
                  {item.thumbnailUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${item.thumbnailUrl})` }}
                    />
                  ) : null}
                </div>
                <p className="text-[11px] text-twitch-text-alt mt-1 truncate">{item.title}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !sourceUrl.trim()}
            className="twitch-button disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
          >
            {loading ? 'Saving...' : 'Save / Refresh Playlist'}
          </button>
          <button
            type="button"
            onClick={handleDisable}
            disabled={loading || !settings?.playlistId}
            className="twitch-button-secondary disabled:bg-twitch-gray disabled:cursor-not-allowed min-h-[44px]"
          >
            Disable Shelf
          </button>
        </div>
      </div>
    </div>
  );
}
