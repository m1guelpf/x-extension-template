import type { PlasmoCSConfig } from 'plasmo'
import { CAPTURE_EVENT, type CapturedPayload } from '~utils/types'
import { isKnownEndpoint, resolveEndpoint } from '~utils/endpoints'

export const config: PlasmoCSConfig = {
	world: 'MAIN',
	run_at: 'document_start',
	matches: ['https://x.com/*'],
}

const INSTALLED_FLAG = '__extInterceptorInstalled'

const extractUrl = (input: RequestInfo | URL): string => {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.toString()
	return input.url
}

const dispatch = (detail: CapturedPayload): void => {
	window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, { detail }))
}

const scheduleIdle = (cb: () => void): void => {
	if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 1200 })
	else setTimeout(cb, 0)
}

const processAndDispatch = (requestUrl: string, transport: 'fetch' | 'xhr', payload: unknown): void => {
	dispatch({
		payload,
		transport,
		requestUrl,
		capturedAt: new Date().toISOString(),
		endpoint: resolveEndpoint(requestUrl),
	})
}

const patchFetch = (): void => {
	const originalFetch = window.fetch.bind(window)

	const patched = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const response = await originalFetch(input, init)
		const url = extractUrl(input)
		const endpoint = resolveEndpoint(url)

		if (endpoint && isKnownEndpoint(endpoint)) {
			const ct = response.headers.get('content-type') ?? ''
			if (ct.includes('application/json')) {
				scheduleIdle(() => {
					response
						.clone()
						.json()
						.then(json => processAndDispatch(url, 'fetch', json))
						.catch(() => {})
				})
			}
		}

		return response
	}
	window.fetch = patched as typeof window.fetch
}

const patchXHR = (): void => {
	const originalOpen = XMLHttpRequest.prototype.open
	const originalSend = XMLHttpRequest.prototype.send

	XMLHttpRequest.prototype.open = function (
		method: string,
		url: string | URL,
		async?: boolean,
		username?: string | null,
		password?: string | null
	): void {
		;(this as any).__interceptedUrl = typeof url === 'string' ? url : url.toString()
		originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null)
	}

	XMLHttpRequest.prototype.send = function (body?: any): void {
		this.addEventListener('load', function () {
			const url: string | undefined = (this as any).__interceptedUrl
			if (!url) return

			const endpoint = resolveEndpoint(url)
			if (!isKnownEndpoint(endpoint)) return

			const ct = this.getResponseHeader('content-type') ?? ''
			if (!ct.includes('application/json')) return

			const text = this.responseText
			if (!text) return

			scheduleIdle(() => {
				try {
					processAndDispatch(url, 'xhr', JSON.parse(text))
				} catch {}
			})
		})

		originalSend.call(this, body)
	}
}

if (!(window as any)[INSTALLED_FLAG]) {
	;(window as any)[INSTALLED_FLAG] = true
	patchFetch()
	patchXHR()
}
