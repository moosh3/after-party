import { NextRequest, NextResponse } from 'next/server';
import type { PlaybackID } from '@mux/mux-node/resources/shared';
import type { Asset } from '@mux/mux-node/resources/video/assets';
import { getMuxClient, hasMuxApiCredentials } from '@/lib/mux';
import { getSession } from '@/lib/session';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInteger(value: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(value || '', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return max ? Math.min(parsed, max) : parsed;
}

function choosePlaybackId(asset: Asset): PlaybackID | null {
  const playbackIds = asset.playback_ids || [];
  return playbackIds.find((playbackId) => playbackId.policy === 'public') || playbackIds[0] || null;
}

function toIsoDate(timestamp: string) {
  const seconds = Number.parseInt(timestamp, 10);

  if (!Number.isFinite(seconds)) {
    return timestamp;
  }

  return new Date(seconds * 1000).toISOString();
}

function normalizeMuxAsset(asset: Asset) {
  const playbackId = choosePlaybackId(asset);
  const hasPlaybackId = Boolean(playbackId?.id);
  const canImport = asset.status === 'ready' && hasPlaybackId;
  const defaultTitle = asset.passthrough?.trim() || playbackId?.id || asset.id;
  const thumbnailUrl =
    playbackId?.id && playbackId.policy === 'public'
      ? `https://image.mux.com/${playbackId.id}/thumbnail.jpg?width=320&height=180&fit_mode=smartcrop`
      : null;

  let disabledReason: string | null = null;

  if (asset.status !== 'ready') {
    disabledReason = asset.status === 'errored' ? 'Asset processing failed' : `Asset is ${asset.status}`;
  } else if (!hasPlaybackId) {
    disabledReason = 'No playback ID';
  }

  return {
    assetId: asset.id,
    playbackId: playbackId?.id || null,
    playbackPolicy: playbackId?.policy || null,
    status: asset.status,
    durationSeconds: typeof asset.duration === 'number' ? Math.round(asset.duration) : null,
    aspectRatio: asset.aspect_ratio || null,
    createdAt: toIsoDate(asset.created_at),
    defaultTitle,
    thumbnailUrl,
    thumbnailStatus: thumbnailUrl ? 'available' : 'placeholder',
    canImport,
    disabledReason,
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasMuxApiCredentials()) {
    return NextResponse.json(
      { error: 'Mux API credentials are not configured' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get('page'), 1);
    const limit = parsePositiveInteger(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
    const muxAssetsPage = await getMuxClient().video.assets.list({ page, limit });
    const assets = muxAssetsPage.data.map(normalizeMuxAsset);
    const hasNextPage = muxAssetsPage.hasNextPage();

    return NextResponse.json({
      assets,
      pagination: {
        page,
        limit,
        hasNextPage,
        nextPage: hasNextPage ? page + 1 : null,
      },
    });
  } catch (error) {
    console.error('Error fetching Mux assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Mux assets' },
      { status: 502 }
    );
  }
}
