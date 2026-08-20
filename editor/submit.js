/**
 * Proposing a map, without a secret and without a server.
 *
 * The obvious way to open a pull request from a page is to call GitHub's API
 * with a token — and this page cannot have one. **Anything this page knows,
 * every child who opens it knows**: a token in a static site is a token you have
 * given away, and there is no server here to keep one on your behalf. That is
 * not a limitation to work around, it is the first thing the lesson is about.
 *
 * So the button does not call an API at all. It opens GitHub's own "create a new
 * file" page with the file already filled in:
 *
 *     https://github.com/OWNER/REPO/new/BRANCH?filename=…&value=…
 *
 * The student is signed in as themselves. GitHub forks the repository for them,
 * makes the branch, and opens the pull request through its own interface, under
 * their own name, with their own commit. Nothing here ever holds their account.
 *
 * **The catch is length.** A URL is not a file upload, and a big map does not
 * fit in one: `data/maps/town.json` is about 11,000 bytes, and once every comma
 * has become `%2C` it is far past what a server will accept. So this measures
 * the encoded length first and, when it will not fit, says so and hands over the
 * copy-and-paste route instead — which always works, and is the same three steps
 * with one of them done by hand.
 */

export const REPO = { owner: 'KakkoiSchool', name: 'kakkoi-online', branch: 'main' };

/**
 * How long an encoded map may be before GitHub refuses the request.
 *
 * Servers commonly stop somewhere around 8 KB of URL. This leaves room for the
 * rest of the address and stops well short of the cliff, because "it worked on
 * my map" is not a thing to find out from a stranger's failed pull request.
 */
export const URL_BUDGET = 7000;

/** Where the file will live, from the name the map was given. */
export function pathFor(slug) {
  return `data/maps/${slug}.json`;
}

/**
 * The address that opens GitHub with this map ready to propose, and how big it
 * turned out to be.
 *
 *   plan(json, slug) -> { url, size, fits }
 */
export function plan(json, slug, repo = REPO) {
  const path = pathFor(slug);
  const base = `https://github.com/${repo.owner}/${repo.name}/new/${repo.branch}`;
  const query = `?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(json)}`;
  const url = base + query;
  return { url, path, size: url.length, fits: url.length <= URL_BUDGET };
}

/** The page to open when the map is too big to carry in an address. */
export function blankUrl(repo = REPO) {
  return `https://github.com/${repo.owner}/${repo.name}/new/${repo.branch}`;
}

/**
 * What to tell somebody whose map does not fit, in the order they have to do it.
 * Written here rather than in the markup because the numbers come from the map.
 */
export function longWay(size) {
  return [
    `This map is ${Math.round(size / 1000)} KB once it is written into an address, and GitHub will `
      + `not take one that long.`,
    'Press Copy below to put the map on your clipboard.',
    'Press Propose again: GitHub will open an empty new file.',
    'Paste the map in, give it a name ending in .json, and press "Propose new file".',
  ];
}
