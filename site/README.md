# SPYDR — product site

A Next.js app. The landing page is hand-written; the documentation is not — it is the desktop
app's own guide, imported from `src/help/` and rendered here, so the help inside SPYDR and the docs
on this site are the same words and cannot drift apart.

```sh
npm install
npm run dev     # http://localhost:4200
npm run build
npm start
```

## How the docs work

`src/help/articles.tsx` exports every article: id, section, title, blurb, and a React body.
`lib/docs.ts` reads that for navigation and metadata, `app/docs/[slug]/page.tsx` generates one
static page per article, and `components/DocBody.tsx` renders the body on the client — a couple of
articles use hooks, and the About page asks the desktop app for build information, which on the web
correctly reports that there is no desktop app to ask.

Adding an article to the app adds a page here. Nothing needs to be written twice.

## Release links

`lib/releases.ts` builds the download cards. Set `GITHUB_REPO` (for example
`GITHUB_REPO=owner/spydr`) and the build asks GitHub for the latest release, using the real
filenames, byte sizes and download URLs. Without it the page falls back to the 0.1.0 artefacts and
says so under the cards, rather than pretending to link to something.

## Screenshots

`public/assets/*.png` are captures of the app in its dark theme, cropped to the workspace column
(`x: 214–1136`) and saved at 2× so they stay sharp at the width the page renders them. `next/image`
serves AVIF and WebP from them. Retake at 1440×900 if the interface moves.

## Deploying

Vercel needs no configuration. Anywhere else, `npm run build && npm start` behind a proxy works; if
you want a purely static drop, add `output: 'export'` to `next.config.ts` and set
`images.unoptimized`.
