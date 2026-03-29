import { TRACKED_ENDPOINTS, type TrackedEndpoint } from './types'

const GRAPHQL_PATH = '/i/api/graphql/'

/** Map of known REST API paths (not GraphQL) to endpoint names. */
const REST_ENDPOINTS: Record<string, TrackedEndpoint> = {
	'/i/api/2/notifications/device_follow.json': 'DeviceFollow',
}

/** Extract the endpoint name from an X API URL. */
export const resolveEndpoint = (url: string): TrackedEndpoint | 'Unknown' => {
	const [pathPart = ''] = url.split('?')

	for (const [path, endpoint] of Object.entries(REST_ENDPOINTS)) {
		if (pathPart.endsWith(path)) return endpoint
	}

	if (!url.includes(GRAPHQL_PATH)) return 'Unknown'

	const segments = pathPart.split('/').filter(Boolean)
	const lastSegment = segments[segments.length - 1] ?? ''
	return fuzzyMatch(lastSegment)
}

export const isKnownEndpoint = (endpoint: string): endpoint is TrackedEndpoint => {
	return TRACKED_ENDPOINTS.includes(endpoint as TrackedEndpoint)
}

const fuzzyMatch = (name: string): TrackedEndpoint | 'Unknown' => {
	if (!name) return 'Unknown'
	if ((TRACKED_ENDPOINTS as readonly string[]).includes(name)) return name as TrackedEndpoint

	const n = name.replace(/[^a-z0-9]/gi, '').toLowerCase()
	if (!n) return 'Unknown'

	if (n.includes('home') && n.includes('timeline')) return 'HomeTimeline'
	if (n.includes('bookmark')) return 'Bookmarks'
	if (n.includes('tweetdetail')) return 'TweetDetail'
	if (n.includes('tweetresultbyrestid')) return 'TweetResultByRestId'
	// Must check compound name before simple substring
	if (n.includes('usertweetsandreplies')) return 'UserTweetsAndReplies'
	if (n.includes('userhighlightstweets')) return 'UserHighlightsTweets'
	if (n === 'usertweets') return 'UserTweets'
	if (n === 'userbyscreenname') return 'UserByScreenName'
	if (n === 'followers') return 'Followers'
	if (n === 'following') return 'Following'

	return 'Unknown'
}
