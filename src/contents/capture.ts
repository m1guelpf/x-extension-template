import type { PlasmoCSConfig } from 'plasmo'
import { isKnownEndpoint } from '~utils/endpoints'
import { sendToBackground } from '@plasmohq/messaging'
import type { RequestBody } from '~background/messages/capture'
import { extractTweets, normalizeTweet } from '~utils/normalize'
import { CAPTURE_EVENT, type CapturedPayload } from '~utils/types'

export const config: PlasmoCSConfig = {
	run_at: 'document_start',
	matches: ['https://x.com/*'],
}

const isExpectedDisconnectError = (message: string): boolean => {
	const lower = message.toLowerCase()

	return (
		lower.includes('context invalidated') ||
		lower.includes('message port closed') ||
		lower.includes('extension context invalidated') ||
		lower.includes('could not establish connection')
	)
}

window.addEventListener(CAPTURE_EVENT, (event: Event) => {
	if (!(event instanceof CustomEvent)) return
	const detail = event.detail as CapturedPayload | undefined
	if (!detail || !isKnownEndpoint(detail.endpoint)) return

	setTimeout(async () => {
		if (!chrome.runtime?.id) return
		if (!isKnownEndpoint(detail.endpoint)) return // needs duplication to make TS happy

		const tweets = extractTweets(detail.endpoint, detail.payload).map(normalizeTweet)

		if (tweets.length && chrome.runtime?.id) {
			try {
				await sendToBackground<RequestBody>({
					name: 'capture',
					body: { tweets, context: detail.endpoint, capturedAt: detail.capturedAt },
				})
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				if (!isExpectedDisconnectError(msg)) {
					console.warn('[tweet-logger] Failed to send to background:', msg)
				}
			}
		}
	}, 0)
})
