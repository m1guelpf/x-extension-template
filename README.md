# x-extension-template

A Chrome extension template that captures tweets in real-time as you browse Twitter/X.

The extension intercepts X's API responses, normalizes the tweet data into a clean schema, and forwards it to a background service worker where you can process it however you like.

### Supported feeds

-   Main feed
-   Bookmarks
-   Post notifications
-   Tweet view (thread + replies)
-   User profile (tweets/replies/highlights)

## How it works

1. **Interceptor** (`contents/interceptor.ts`) — Runs in the page's main world and monkey-patches `fetch` and `XMLHttpRequest` to capture responses from Twitter's GraphQL and REST APIs.

2. **Capture** (`contents/capture.ts`) — Runs in the isolated world, receives intercepted payloads via `CustomEvent`, extracts and normalizes tweets, then sends them to the background.

3. **Background handler** (`background/messages/capture.ts`) — Receives normalized tweets via Plasmo messaging. This is where you add your own logic (store to a database, send to an API, etc.).

## Getting started

```bash
bun install
bun dev
```

Load the extension in Chrome by navigating to `chrome://extensions`, enabling Developer Mode, and loading the `build/chrome-mv3-dev` directory.

To build for production:

```bash
bun build
```

## Making it your own

Edit `src/background/messages/capture.ts` to do something with the captured tweets. The handler receives a typed payload with:

```ts
{
    capturedAt: string        // ISO 8601 timestamp
    context: TrackedEndpoint  // page we got the tweets from
    tweets: NormalizedTweet[] // extracted tweets
}
```

You should also update `CAPTURE_EVENT` in `src/utils/types.ts` and `INSTALLED_FLAG` in `src/contents/interceptor.ts` to something unique to your extension, to avoid collisions if the user has multiple extensions based on this template.

## License

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
