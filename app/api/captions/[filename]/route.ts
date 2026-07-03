import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import {
  getCaptionFilePath,
  getCaptionRequestCandidates,
  normalizeWebVtt,
  srtToWebVtt,
} from '@/lib/captions';

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const candidates = getCaptionRequestCandidates(params.filename);

    for (const candidate of candidates) {
      try {
        const source = await fs.readFile(getCaptionFilePath(candidate), 'utf8');
        const body = candidate.toLowerCase().endsWith('.srt')
          ? srtToWebVtt(source)
          : normalizeWebVtt(source);

        return new NextResponse(body, {
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return NextResponse.json({ error: 'Caption file not found' }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid caption filename')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error loading captions:', error);
    return NextResponse.json({ error: 'Failed to load captions' }, { status: 500 });
  }
}
