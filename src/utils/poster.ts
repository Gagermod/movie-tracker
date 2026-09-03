const UX_REGEX = /_UX(\d+)_CR(\d+),(\d+),(\d+),(\d+)_/i
const SX_REGEX = /_SX(\d+)(?=_|\.)/i

/**
 * Requests a smaller poster from the Amazon CDN while preserving the
 * cropped aspect ratio baked into the URL's magic tokens.
 */
export function smallPoster(url: string, width = 148): string {
  if (!url || !url.includes('m.media-amazon.com')) return url

  const ux = url.match(UX_REGEX)
  if (ux) {
    const [, , cx, cy, cw, ch] = ux
    const h = Math.round((width * Number(ch)) / Number(cw))
    return url.replace(UX_REGEX, `_UX${width}_CR${cx},${cy},${width},${h}_`)
  }

  if (SX_REGEX.test(url)) {
    return url.replace(SX_REGEX, `_SX${width}`)
  }

  return url
}
