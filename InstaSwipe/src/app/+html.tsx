import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { getMediaOrigin } from '@/hooks/media';

// Origins the very first paint depends on. Deriving them here (from the same
// EXPO_PUBLIC_* vars the app uses) lets the browser open the API + media
// connections while the JS bundle is still downloading, so the post fetch and
// its image don't each pay DNS/TCP/TLS setup on the critical path.
// Mirrors the API_BASE_URL logic in src/hooks/api.ts.
const apiHost = process.env.EXPO_PUBLIC_API_HOST;
const apiPort = process.env.EXPO_PUBLIC_API_PORT;
const apiOrigin = apiHost
  ? apiPort === '443'
    ? `https://${apiHost}`
    : apiPort === '80'
      ? `http://${apiHost}`
      : `http://${apiHost}:${apiPort}`
  : undefined;

// Origin serving post media (S3/MinIO). Set EXPO_PUBLIC_MEDIA_ORIGIN to override
// it; otherwise we reuse the API host on port 9000 so local and device access
// stay on the same machine.
const mediaOrigin = process.env.EXPO_PUBLIC_MEDIA_ORIGIN ?? getMediaOrigin();

// This file is web-only and runs during static rendering to shape the root HTML
// document. It has no effect on native.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* API is a CORS fetch (Authorization header) -> anonymous crossorigin. */}
        {apiOrigin ? <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" /> : null}
        {/* Media loads as a plain <img src> (no-cors) -> no crossorigin. */}
        {mediaOrigin ? <link rel="preconnect" href={mediaOrigin} /> : null}

        {/*
          Disable body scrolling on web. This makes ScrollView components work
          closer to how they do on native. However, body scrolling is often
          nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
