// Shared width for the attendee area so the navbar, the product cards, and the
// sticky cart bar all line up to the same phone-sized column. On wide screens
// it caps at 26rem; on mobile it keeps a 1rem gutter on each side.
// Note: BaseNavbar already centers itself, so it takes this without `mx-auto`.
export const ATTENDEE_WIDTH = 'w-[calc(100%_-_2rem)] max-w-[26rem]';
