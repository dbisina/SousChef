// A picture is always the address of a real one (from the server or the phone), never a bundled stand-in.
const isAddress = (ref: string) => /^(https?:|file:|data:|content:)/i.test(ref);

/** The image source for an address; null when there is none, so the screen shows initials or the brand backdrop. */
export function photoSource(ref: string | null | undefined): { uri: string } | null {
  return ref && isAddress(ref) ? { uri: ref } : null;
}
