// Pick a random index into an array of the given length. Pass `exclude` to
// guarantee the result differs from the previous index (avoids repeating the
// same item back-to-back in a rotation).
export function randomIndex(length: number, exclude?: number): number {
  if (length <= 1) return 0;

  let index = Math.floor(Math.random() * length);
  if (exclude !== undefined) {
    while (index === exclude) {
      index = Math.floor(Math.random() * length);
    }
  }
  return index;
}
