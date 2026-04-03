import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web shell: mobile viewport, safe-area, app-like chrome on iOS Safari.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#2d9e6b" />
        <meta name="description" content="QuickSend — Interledger payments" />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; }
              body { margin: 0; background: #dfe8e3; -webkit-tap-highlight-color: transparent; }
              #root { display: flex; justify-content: center; }
              /* Softer focus than browser default black ring on RN Web inputs */
              #root input:focus, #root input:focus-visible,
              #root textarea:focus, #root textarea:focus-visible {
                outline: none !important;
                box-shadow: 0 0 0 2px rgba(45, 158, 107, 0.35);
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
