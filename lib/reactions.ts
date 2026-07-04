// iMessage-style tapbacks. Stored as stable string keys (not the emoji) so
// validation and rendering stay under our control; the glyph is a display
// concern only.
export const MESSAGE_REACTIONS = [
  'love',
  'like',
  'dislike',
  'haha',
  'emphasize',
  'question',
] as const;

export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

export const REACTION_GLYPH: Record<MessageReaction, string> = {
  love: '❤️',
  like: '👍',
  dislike: '👎',
  haha: '😂',
  emphasize: '‼️',
  question: '❓',
};

export const REACTION_LABEL: Record<MessageReaction, string> = {
  love: 'Love',
  like: 'Like',
  dislike: 'Dislike',
  haha: 'Haha',
  emphasize: 'Exclamation',
  question: 'Question',
};

export type MessageReactionSummary = {
  reaction: MessageReaction;
  count: number;
  viewerReacted: boolean;
};

export function isMessageReaction(value: unknown): value is MessageReaction {
  return (
    typeof value === 'string' &&
    (MESSAGE_REACTIONS as readonly string[]).includes(value)
  );
}
