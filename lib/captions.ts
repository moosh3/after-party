import path from 'path';

export type CaptionTrackFields = {
  captionFilename: string | null;
  captionUrl: string | null;
  captionLabel: string | null;
  captionLanguage: string | null;
};

const CAPTION_FILENAME_PATTERN = /^[a-z0-9][a-z0-9._-]*\.(srt|vtt)$/i;

export function emptyCaptionTrack(): CaptionTrackFields {
  return {
    captionFilename: null,
    captionUrl: null,
    captionLabel: null,
    captionLanguage: null,
  };
}

export function normalizeCaptionFilename(filename: string): string {
  const normalized = filename.trim();

  if (!CAPTION_FILENAME_PATTERN.test(normalized)) {
    throw new Error(`Invalid caption filename "${filename}"`);
  }

  return normalized;
}

export function getCaptionTrack(filename?: string | null): CaptionTrackFields {
  if (!filename) return emptyCaptionTrack();

  const normalized = normalizeCaptionFilename(filename);
  const vttFilename = normalized.replace(/\.(srt|vtt)$/i, '.vtt');

  return {
    captionFilename: normalized,
    captionUrl: `/api/captions/${encodeURIComponent(vttFilename)}`,
    captionLabel: 'English',
    captionLanguage: 'en',
  };
}

export function getCaptionRequestCandidates(requestedFilename: string): string[] {
  const normalized = normalizeCaptionFilename(requestedFilename);

  if (normalized.toLowerCase().endsWith('.vtt')) {
    return [normalized, normalized.replace(/\.vtt$/i, '.srt')];
  }

  return [normalized];
}

export function getCaptionFilePath(filename: string): string {
  const normalized = normalizeCaptionFilename(filename);
  return path.join(process.cwd(), 'public', 'assets', 'captions', normalized);
}

export function srtToWebVtt(source: string): string {
  const normalized = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  const converted = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2'
  );

  return `WEBVTT\n\n${converted}\n`;
}

export function normalizeWebVtt(source: string): string {
  const normalized = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  return normalized.startsWith('WEBVTT')
    ? `${normalized}\n`
    : `WEBVTT\n\n${normalized}\n`;
}
