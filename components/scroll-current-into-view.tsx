'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Scrolls whatever is marked `aria-current` into view inside a horizontally
 * scrollable strip.
 *
 * The progress track is 600px wide at minimum and sits in an `overflow-x: auto`
 * container, which is fine on a desktop where the whole thing fits. On a phone
 * the visible strip is about 327px, so a researcher at gap analysis saw steps
 * one to three and no indication of where they actually were. The information
 * was there and simply off to the right, which is the least useful place for it.
 *
 * Client-side because there is no way to scroll a container from the server, and
 * no CSS that positions a scroll container on one of its children.
 *
 * Deliberately narrow:
 *
 * - It does nothing when the track already fits, so desktop is untouched.
 * - It does nothing when the current step is already visible.
 * - It sets `scrollLeft` rather than calling `scrollIntoView`, which would also
 *   scroll the page vertically and move the thing the researcher was reading.
 * - It runs once on mount. Each stage is a fresh navigation, so there is nothing
 *   to react to afterwards.
 */
export function ScrollCurrentIntoView({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const strip = ref.current
    if (!strip) return

    // Already fits, so there is nothing off screen and nothing to do.
    if (strip.scrollWidth <= strip.clientWidth) return

    const current = strip.querySelector('[aria-current]')
    if (!current) return

    const stripBox = strip.getBoundingClientRect()
    const currentBox = current.getBoundingClientRect()

    const alreadyVisible = currentBox.left >= stripBox.left && currentBox.right <= stripBox.right
    if (alreadyVisible) return

    // Centre it in the strip, clamped by the browser to the scrollable range.
    strip.scrollLeft += currentBox.left - stripBox.left - (stripBox.width - currentBox.width) / 2
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
