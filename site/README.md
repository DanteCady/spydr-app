# SPYDR — product site

A static page. No build step, no framework, no dependencies: `index.html`, `styles.css`, and four
screenshots taken from the real application.

## Running it

```sh
cd site && python3 -m http.server 8000
```

## Deploying it

Any static host serves it as-is — GitHub Pages, Cloudflare Pages, Netlify, Vercel, or a directory
behind nginx. Publish the `site/` folder; there is nothing to compile.

## Before it goes live

- **Download links.** `window.SPYDR_RELEASES` near the top of `index.html` is the one place a
  release URL belongs; every card reads it. It currently points at `#downloads`, which is a
  deliberate dead end rather than a broken link to a page that does not exist yet.
- **Version.** `0.1.0` appears in the nav button, the download heading, and four filenames.
- **Sizes.** The download cards quote real artefact sizes from the 0.1.0 build. Re-check them when
  the build changes.

## Refreshing the screenshots

They are captures of the app in its dark theme, cropped to the workspace column and saved at 2×, so
they stay sharp at the width the page renders them. The regions are `x: 214–1136` with the top edge
chosen per workspace. If the UI moves, retake them at 1440×900 and crop to the same left edge.
