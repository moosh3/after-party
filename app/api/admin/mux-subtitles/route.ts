import { NextRequest, NextResponse } from 'next/server';
import { addSubtitleTrack, deleteSubtitleTrack, listAssetTracks } from '@/lib/mux';
import { getSession } from '@/lib/session';

/**
 * GET /api/admin/mux-subtitles?assetId=<asset-id>
 * List all subtitle tracks for a Mux asset
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json(
        { error: 'Missing assetId parameter' },
        { status: 400 }
      );
    }

    const tracks = await listAssetTracks(assetId);
    const subtitleTracks = tracks.filter((t: any) => t.type === 'text');

    return NextResponse.json({
      assetId,
      tracks: subtitleTracks,
      count: subtitleTracks.length,
    });
  } catch (error: any) {
    console.error('Error listing subtitle tracks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list subtitle tracks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/mux-subtitles
 * Add a subtitle track to a Mux asset
 * 
 * Body:
 * {
 *   "assetId": "asset-id",
 *   "url": "https://example.com/subtitles.srt",
 *   "languageCode": "en",
 *   "name": "English",
 *   "closedCaptions": true
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {

    const body = await request.json();
    const { assetId, url, languageCode = 'en', name = 'English', closedCaptions = true } = body;

    if (!assetId || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, url' },
        { status: 400 }
      );
    }

    // Validate URL is HTTPS
    if (!url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'URL must use HTTPS protocol' },
        { status: 400 }
      );
    }

    const track = await addSubtitleTrack(assetId, {
      url,
      languageCode,
      name,
      closedCaptions,
    });

    return NextResponse.json({
      success: true,
      track: {
        id: track.id,
        name: track.name,
        language_code: track.language_code,
        status: track.status,
      },
      message: `Subtitle track "${name}" added to asset ${assetId}`,
    });
  } catch (error: any) {
    console.error('Error adding subtitle track:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to add subtitle track',
        details: error.response?.data || null
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/mux-subtitles?assetId=<asset-id>&trackId=<track-id>
 * Delete a subtitle track from a Mux asset
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const trackId = searchParams.get('trackId');

    if (!assetId || !trackId) {
      return NextResponse.json(
        { error: 'Missing required parameters: assetId, trackId' },
        { status: 400 }
      );
    }

    await deleteSubtitleTrack(assetId, trackId);

    return NextResponse.json({
      success: true,
      message: `Subtitle track ${trackId} deleted from asset ${assetId}`,
    });
  } catch (error: any) {
    console.error('Error deleting subtitle track:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete subtitle track' },
      { status: 500 }
    );
  }
}

