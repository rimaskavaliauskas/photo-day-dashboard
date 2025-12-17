'use client';

import Image from 'next/image';
import { YouTubeVideo, formatDate } from '@/lib/api';

interface VideosGridProps {
  videos: YouTubeVideo[];
}

export function VideosGrid({ videos }: VideosGridProps) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.slice(0, 8).map((video) => (
        <VideoCard key={video.video_id} video={video} />
      ))}
    </div>
  );
}

function VideoCard({ video }: { video: YouTubeVideo }) {
  return (
    <a
      href={video.url || `https://youtube.com/watch?v=${video.video_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="card group hover:border-zinc-700 transition-colors block"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🎬
          </div>
        )}
        
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Info */}
      <div className="p-3">
        <h3 
          className="font-medium text-sm line-clamp-2 group-hover:text-blue-400 transition-colors"
          title={video.title}
        >
          {video.title}
        </h3>
        {video.published_at && (
          <div className="text-xs text-zinc-500 mt-1">
            {formatDate(video.published_at)}
          </div>
        )}
      </div>
    </a>
  );
}

function ChannelCard({
  channel,
  expanded,
  onToggle,
  thumbnail,
}: {
  channel: YouTubeChannelStats;
  expanded: boolean;
  onToggle: () => void;
  thumbnail: string | null;
}) {
  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="relative aspect-video bg-zinc-900 rounded-md overflow-hidden border border-zinc-800">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt="Channel thumbnail"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-lg">
            🎬
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full">
        <div className="text-sm font-semibold text-zinc-100 truncate" title={channel.channel_id}>
          Channel
        </div>
        <button
          className="text-xs text-blue-300 underline"
          onClick={onToggle}
        >
          {expanded ? 'Hide stats' : 'Show stats'}
        </button>
      </div>

      {expanded && (
        <div className="mt-1 flex flex-col gap-1 text-xs text-zinc-400">
          <div>Total videos: {channel.video_count}</div>
          <div>Last upload: {channel.last_published_at ? formatDate(channel.last_published_at) : 'n/a'}</div>
          <div>Last 30d: {channel.videos_last_30d}</div>
          <div>Last 7d: {channel.videos_last_7d}</div>
          <div>
            Activity:{' '}
            {channel.videos_last_30d > 4
              ? 'High'
              : channel.videos_last_30d > 1
              ? 'Medium'
              : 'Low'}
          </div>
        </div>
      )}
    </div>
  );
}
