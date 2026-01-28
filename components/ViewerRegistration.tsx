'use client';

import { useState, useEffect } from 'react';
import { saveViewerData, getViewerData } from '@/lib/viewer';

interface ViewerRegistrationProps {
  onComplete: () => void;
}

export default function ViewerRegistration({ onComplete }: ViewerRegistrationProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if viewer is already registered
    const existingData = getViewerData();
    if (existingData) {
      onComplete();
    }
  }, [onComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate with server
      const response = await fetch('/api/viewer/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });

      const data = await response.json();

      if (!data.valid) {
        setError(data.error || 'Validation failed');
        setLoading(false);
        return;
      }

      // Save to localStorage
      saveViewerData(email, displayName);

      // Proceed to event
      onComplete();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="twitch-card p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <img 
          src="/assets/logos/alecmklogo.png" 
          alt="After Party Logo" 
          className="h-16 w-16 rounded-full object-cover mx-auto mb-4 ring-4 ring-casual-yellow"
        />
        <h2 className="text-3xl font-bold text-white mb-2">Join the Movie Marathon!</h2>
        <p className="text-white/70">
          Enter your details to access the stream and chat
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="twitch-input w-full"
            placeholder="your@email.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-white mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="twitch-input w-full"
            placeholder="How you'll appear in chat"
            required
            minLength={2}
            maxLength={50}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-300 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full twitch-button disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Validating...' : 'Join the Stream'}
        </button>
      </form>

      <p className="text-xs text-white/50 mt-4 text-center">
        Your information is stored locally in your browser
      </p>
    </div>
  );
}

