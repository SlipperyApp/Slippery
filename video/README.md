# The product explainer

A Remotion project that renders one video. **It is a build-time tool.** It has
its own `package.json`, it is not a workspace of the site, and nothing in
`src/` is imported by anything outside this directory. The site bundle is
unaffected by it, and a test asserts that rather than trusting it.

```
npm install          # inside video/, not at the repo root
npm run studio       # preview and scrub
npm run render       # all four outputs into ../public/video/
```

Four outputs, all into `public/video/`:

| File | What it is |
|---|---|
| `explainer.mp4` | h264, 16:9, the landing page embed |
| `explainer.webm` | vp8, same cut, for browsers that prefer it |
| `explainer-9x16.mp4` | the vertical cut for social |
| `explainer-poster.jpg` | the still behind `preload="none"` |

**Why the six storyboard scenes on the landing page are not this video.**
They are live components rendering real figures and reacting to the theme
switcher. Rendering them to MP4 would freeze them to one palette and break
seven of the eight themes. They stay as DOM. This video is a separate thing:
a linear explanation of the loop, for somebody who has not scrolled yet.

There is no audio track, deliberately. The embed is muted, `playsinline`, with
`preload="none"` and a click-to-play overlay, so it costs nothing until
somebody asks for it.

## Why this is not part of the app's build

Remotion is a dev dependency of the video and of nothing else, and it is
installed here rather than at the root. The app's `tsconfig.json` therefore
excludes `video/`: without that, `next build` on a clean checkout type-checks
`src/Explainer.tsx` against a `remotion` package that was never installed and
fails, which is exactly how the first deployment of the video broke. The
rendered files in `public/video/` are checked in, so the site needs nothing
from this directory at build time.
