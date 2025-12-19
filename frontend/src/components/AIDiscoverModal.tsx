'use client';

import { useState, useEffect } from 'react';
import {
  discoverPlaces,
  DiscoveredRecommendation,
  AIDiscoverResponse,
} from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  placeIds?: number[];
  onPlaceAdded: () => void;
}

export function AIDiscoverModal({ isOpen, onClose, placeIds, onPlaceAdded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIDiscoverResponse | null>(null);

  useEffect(() => {
    if (isOpen && !data && !loading) {
      handleDiscover();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
    }
  }, [isOpen]);

  const handleDiscover = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverPlaces({ placeIds, maxResults: 10 });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-zinc-900 rounded-xl
                      border border-zinc-700 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🔮</span> AI Discover
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              AI-curated photogenic locations within 50km of your places
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4" />
              <p className="text-zinc-400">Searching for photogenic places...</p>
              <p className="text-xs text-zinc-500 mt-2">This may take 30-60 seconds</p>
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">😞</div>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={handleDiscover}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}

          {data && data.recommendations.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-zinc-400">No new recommendations found.</p>
              <p className="text-sm text-zinc-500 mt-2">
                Try adding more places or searching again later.
              </p>
            </div>
          )}

          {data && data.recommendations.length > 0 && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex items-center justify-between text-sm text-zinc-500 mb-4">
                <span>
                  Found {data.recommendations.length} recommendations near {data.searchedPlaces.length} place{data.searchedPlaces.length !== 1 ? 's' : ''}
                </span>
                <span>
                  Powered by {data.model === 'workers-ai' ? 'Llama 3.3' : 'Claude'}
                  {' '}({(data.processingTime / 1000).toFixed(1)}s)
                </span>
              </div>

              {/* Recommendations grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {data.recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onPlaceAdded={onPlaceAdded}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="p-4 border-t border-zinc-700 shrink-0">
            <button
              onClick={handleDiscover}
              disabled={loading}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg
                         text-zinc-300 disabled:opacity-50"
            >
              {loading ? 'Searching...' : '🔄 Search Again'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

interface CardProps {
  recommendation: DiscoveredRecommendation;
  onPlaceAdded: () => void;
}

function RecommendationCard({ recommendation: rec, onPlaceAdded }: CardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleAddPlace = () => {
    // For now, show alert with details
    // Full implementation would add to sheet via API
    alert(`📍 ${rec.name}\n\n📸 Why it's great:\n${rec.whyPhotogenic}\n\n💬 What people say:\n${rec.testimonials}\n\n✨ Near: ${rec.nearPlaceName}\n\nNote: Full implementation would add this to your Google Sheet.`);
    onPlaceAdded();
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden hover:border-zinc-600 transition-colors">
      {/* Card Header */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg pr-2">{rec.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
            rec.confidenceScore >= 80 ? 'bg-green-500/20 text-green-400' :
            rec.confidenceScore >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-zinc-500/20 text-zinc-400'
          }`}>
            {rec.confidenceScore}%
          </span>
        </div>

        <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{rec.description}</p>

        {/* Near badge */}
        <div className="inline-flex items-center gap-1 text-xs bg-zinc-700/50 px-2 py-1 rounded">
          <span>📍</span>
          <span>Near {rec.nearPlaceName}</span>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-700 pt-3">
          {/* Why photogenic */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase mb-1">
              📸 Why It's Great for Photos
            </h4>
            <p className="text-sm text-zinc-300">{rec.whyPhotogenic}</p>
          </div>

          {/* Testimonials */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase mb-1">
              💬 What People Say
            </h4>
            <p className="text-sm text-zinc-400 italic">"{rec.testimonials}"</p>
          </div>

          {/* Sources */}
          {rec.sourceUrls.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 uppercase mb-1">
                🔗 Sources
              </h4>
              <div className="flex flex-wrap gap-2">
                {rec.sourceUrls.slice(0, 3).map((url, i) => {
                  try {
                    const hostname = new URL(url).hostname;
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 truncate max-w-[150px]"
                      >
                        {hostname}
                      </a>
                    );
                  } catch {
                    return null;
                  }
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
        >
          {expanded ? '▲ Show Less' : '▼ Show Details'}
        </button>
        <button
          onClick={handleAddPlace}
          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm
                     font-medium transition-colors"
        >
          ➕ Add to My Places
        </button>
      </div>
    </div>
  );
}
