import type { NormalizedTweet, NormalizedUser, NormalizedUrl, NormalizedMention, NormalizedMedia } from './types'

/** Unwrap the TweetWithVisibilityResults wrapper X sometimes uses. */
const unwrapTweet = (result: any): any | null => {
	if (!result) return null
	if (result.__typename === 'TweetWithVisibilityResults') return result.tweet || null
	return result
}

/** Pull raw tweet objects from a single timeline entry. */
const collectFromEntry = (entry: any, results: any[]): void => {
	const content = entry.content
	if (!content) return

	// Single tweet entry
	if (content.itemContent) {
		const raw = unwrapTweet(content.itemContent.tweet_results?.result)
		if (raw) results.push(raw)
	}

	// Conversation module (thread)
	if (content.items) {
		for (const item of content.items) {
			const itemContent = item.item?.itemContent
			if (itemContent) {
				const raw = unwrapTweet(itemContent.tweet_results?.result)
				if (raw) results.push(raw)
			}
		}
	}
}

/** Iterate instructions → entries and collect tweets. */
const collectFromInstructions = (instructions: any[], { checkSingularEntry = true } = {}): any[] => {
	const results: any[] = []
	for (const instruction of instructions) {
		for (const entry of instruction.entries || []) collectFromEntry(entry, results)
		if (checkSingularEntry && instruction.entry) collectFromEntry(instruction.entry, results)
	}
	return results
}

const extractHomeTimeline = (data: any): any[] => {
	const instructions =
		data.home?.home_timeline_urt?.instructions ||
		data.home?.home_timeline?.instructions ||
		data.home?.timeline?.instructions ||
		[]
	return collectFromInstructions(instructions)
}

const extractBookmarks = (data: any): any[] => {
	const instructions =
		data.bookmark_timeline_v2?.timeline?.instructions ||
		data.bookmark_timeline?.timeline?.instructions ||
		data.bookmarks?.timeline?.instructions ||
		[]
	return collectFromInstructions(instructions)
}

const extractTweetDetail = (data: any): any[] => {
	const instructions = data.threaded_conversation_with_injections_v2?.instructions || []
	return collectFromInstructions(instructions, { checkSingularEntry: false })
}

const extractUserTimeline = (data: any): any[] => {
	const instructions =
		data.user?.result?.timeline?.timeline?.instructions ||
		data.user?.result?.timeline_v2?.timeline?.instructions ||
		[]

	return collectFromInstructions(instructions)
}

const extractTweetResultByRestId = (data: any): any[] => {
	const candidates = [
		data.tweetResult?.result,
		data.tweet_result?.result,
		data.tweet?.result,
		data.tweet,
		data.tweet_result_by_rest_id?.result,
	]

	for (const c of candidates) {
		const tweet = unwrapTweet(c)
		if (tweet) return [tweet]
	}

	return []
}

/**
 * Shim a v1.1 flat user object into the GraphQL-like shape
 * so normalizeUser() works unchanged.
 */
const shimV1User = (user: any): any => {
	if (!user) return {}

	return {
		rest_id: user.id_str || '',
		location: { location: user.location || '' },
		privacy: { protected: user.protected ?? false },
		is_blue_verified: user.ext_is_blue_verified ?? false,
		profile_image_shape: user.ext_profile_image_shape || '',
		avatar: { image_url: user.profile_image_url_https || '' },
		verification: {
			verified: user.verified ?? false,
			verified_type: user.ext_verified_type || null,
		},
		core: {
			name: user.name || '',
			screen_name: user.screen_name || '',
			created_at: user.created_at || '',
		},
		legacy: {
			url: user.url || null,
			entities: user.entities || {},
			media_count: user.media_count ?? 0,
			description: user.description || '',
			listed_count: user.listed_count ?? 0,
			friends_count: user.friends_count ?? 0,
			statuses_count: user.statuses_count ?? 0,
			followers_count: user.followers_count ?? 0,
			favourites_count: user.favourites_count ?? 0,
			default_profile: user.default_profile ?? false,
			profile_banner_url: user.profile_banner_url || null,
			possibly_sensitive: user.possibly_sensitive ?? false,
			pinned_tweet_ids_str: user.pinned_tweet_ids_str || [],
			has_custom_timelines: user.has_custom_timelines ?? false,
			default_profile_image: user.default_profile_image ?? false,
		},
	}
}

/**
 * Shim a v1.1 flat tweet + user into the GraphQL-like shape
 * so normalizeTweet() works unchanged.
 */
const shimV1Tweet = (tweet: any, users: Record<string, any>, allTweets: Record<string, any>): any => {
	const user = users[tweet.user_id_str] || {}

	const shimmed: any = {
		legacy: tweet,
		rest_id: tweet.id_str || '',
		source: tweet.source || null,
		edit_control: tweet.ext?.editControl?.r?.ok || {},
		core: { user_results: { result: shimV1User(user) } },
		views: { count: tweet.ext?.views?.r?.ok?.count ?? null },
	}

	// Resolve retweet from globalObjects so the normalizer can unwrap it
	const rtId = tweet.retweeted_status_id_str
	if (rtId && allTweets[rtId]) {
		shimmed.legacy = {
			...tweet,
			retweeted_status_result: {
				result: shimV1Tweet(allTweets[rtId], users, allTweets),
			},
		}
	}

	// Resolve quoted tweet from globalObjects
	const qtId = tweet.quoted_status_id_str
	if (qtId && allTweets[qtId]) {
		shimmed.quoted_status_result = {
			result: shimV1Tweet(allTweets[qtId], users, allTweets),
		}
	}

	return shimmed
}

/**
 * Extract tweets from a globalObjects-style response (v1.1 REST API).
 * Entries reference tweet IDs; actual data lives in globalObjects.tweets/users.
 */
const extractDeviceFollow = (response: any): any[] => {
	const globalObjects = response?.globalObjects
	if (!globalObjects) return []

	const instructions = response.timeline?.instructions || []
	const users: Record<string, any> = globalObjects.users || {}
	const tweets: Record<string, any> = globalObjects.tweets || {}

	// Collect tweet IDs from timeline entries
	const tweetIds = new Set<string>()
	for (const instruction of instructions) {
		const entries = instruction.addEntries?.entries || instruction.entries || []
		for (const entry of entries) {
			const tweetId = entry.content?.item?.content?.tweet?.id || entry.content?.item?.content?.tweet?.id_str
			if (tweetId && tweets[tweetId]) tweetIds.add(tweetId)
		}
	}

	return Array.from(tweetIds)
		.map(id => shimV1Tweet(tweets[id], users, tweets))
		.filter(Boolean)
}

/** Extract raw tweet result objects from an API response based on endpoint. */
export const extractTweets = (endpoint: string, response: any): any[] => {
	if (endpoint === 'DeviceFollow') return extractDeviceFollow(response)

	const data = response?.data
	if (!data) return []

	switch (endpoint) {
		case 'HomeTimeline':
			return extractHomeTimeline(data)
		case 'Bookmarks':
			return extractBookmarks(data)
		case 'TweetDetail':
			return extractTweetDetail(data)
		case 'TweetResultByRestId':
			return extractTweetResultByRestId(data)
		case 'UserTweets':
		case 'UserTweetsAndReplies':
		case 'UserHighlightsTweets':
			return extractUserTimeline(data)
		default:
			return []
	}
}

const normalizeUser = (raw: any): NormalizedUser => {
	const core = raw.core || {}
	const loc = raw.location || {}
	const legacy = raw.legacy || {}
	const avatar = raw.avatar || {}
	const privacy = raw.privacy || {}
	const verification = raw.verification || {}
	const professional = raw.professional || {}

	return {
		id: raw.rest_id || '',
		name: core.name || '',
		created_at: core.created_at || '',
		screen_name: core.screen_name || '',

		url: legacy.url || null,
		location: loc.location || '',
		description: legacy.description || '',
		url_expanded: legacy.entities?.url?.urls?.[0]?.expanded_url || null,
		profile_description_language: raw.profile_description_language || null,
		description_urls: (legacy.entities?.description?.urls || []).map(
			(u: any): NormalizedUrl => ({
				url: u.url || '',
				display_url: u.display_url || '',
				expanded_url: u.expanded_url || '',
			})
		),

		avatar_url: avatar.image_url || '',
		profile_image_shape: raw.profile_image_shape || '',
		profile_banner_url: legacy.profile_banner_url || null,

		verified: verification.verified ?? false,
		is_blue_verified: raw.is_blue_verified ?? false,
		verified_type: verification.verified_type || null,

		is_protected: privacy.protected ?? false,
		possibly_sensitive: legacy.possibly_sensitive ?? false,

		media_count: legacy.media_count ?? 0,
		listed_count: legacy.listed_count ?? 0,
		tweet_count: legacy.statuses_count ?? 0,
		like_count: legacy.favourites_count ?? 0,
		following_count: legacy.friends_count ?? 0,
		followers_count: legacy.followers_count ?? 0,

		default_profile: legacy.default_profile ?? false,
		pinned_tweet_ids: legacy.pinned_tweet_ids_str || [],
		has_custom_timelines: legacy.has_custom_timelines ?? false,
		default_profile_image: legacy.default_profile_image ?? false,

		professional_type: professional.professional_type || null,
		professional_category: (professional.category || []).map((c: any) => ({
			id: c.id || null,
			name: c.name || '',
			icon_name: c.icon_name || null,
		})),
	}
}

/** Normalize a raw GraphQL tweet result into a clean schema. */
export const normalizeTweet = (raw: any): NormalizedTweet => {
	// Unwrap retweets — always normalize the original tweet
	const retweeted = unwrapTweet(raw.legacy?.retweeted_status_result?.result || raw.retweeted_status_result?.result)
	if (retweeted) return normalizeTweet(retweeted)

	const legacy = raw.legacy || {}
	const userRes = raw.core?.user_results?.result || {}
	const views = raw.views || {}
	const edit = raw.edit_control || {}
	const entities = legacy.entities || {}
	const mediaArray = legacy.extended_entities?.media || entities.media || []

	const tweet: NormalizedTweet = {
		user_id: legacy.user_id_str || '',
		created_at: legacy.created_at || '',
		id: raw.rest_id || legacy.id_str || '',
		conversation_id: legacy.conversation_id_str || null,

		lang: legacy.lang || null,
		source: raw.source || null,
		full_text: legacy.full_text || '',
		display_text_range: legacy.display_text_range || [],

		author: normalizeUser(userRes),

		reply_count: legacy.reply_count ?? 0,
		quote_count: legacy.quote_count ?? 0,
		retweet_count: legacy.retweet_count ?? 0,
		favorite_count: legacy.favorite_count ?? 0,
		bookmark_count: legacy.bookmark_count ?? 0,
		view_count: views.count ? parseInt(views.count, 10) : null,

		in_reply_to_user_id: legacy.in_reply_to_user_id_str || null,
		in_reply_to_status_id: legacy.in_reply_to_status_id_str || null,
		in_reply_to_screen_name: legacy.in_reply_to_screen_name || null,

		quoted_tweet: null,
		is_quote_status: legacy.is_quote_status ?? false,
		quoted_status_id: legacy.quoted_status_id_str || null,

		has_birdwatch_notes: raw.has_birdwatch_notes ?? false,
		possibly_sensitive: legacy.possibly_sensitive ?? false,

		retweeted: legacy.retweeted ?? false,
		favorited: legacy.favorited ?? false,
		bookmarked: legacy.bookmarked ?? false,

		hashtags: (entities.hashtags || []).map((h: any) => h.text).filter(Boolean),
		urls: (entities.urls || []).map(
			(u: any): NormalizedUrl => ({
				url: u.url || '',
				display_url: u.display_url || '',
				expanded_url: u.expanded_url || '',
			})
		),
		mentions: (entities.user_mentions || []).map(
			(m: any): NormalizedMention => ({
				id: m.id_str || '',
				screen_name: m.screen_name || '',
				name: m.name || '',
			})
		),
		media: mediaArray.map(
			(m: any): NormalizedMedia => ({
				url: m.url || '',
				id: m.id_str || '',
				type: m.type || '',
				display_url: m.display_url || '',
				alt_text: m.ext_alt_text || null,
				media_url: m.media_url_https || '',
				expanded_url: m.expanded_url || '',
			})
		),
	}

	// Quoted tweet (recursive)
	if (raw.quoted_status_result?.result) {
		let quoted = raw.quoted_status_result.result
		if (quoted.__typename === 'TweetWithVisibilityResults' && quoted.tweet) quoted = quoted.tweet
		tweet.quoted_tweet = normalizeTweet(quoted)
	}

	// Parent tweet (recursive, only if present)
	if (raw.in_reply_to_status_result?.result) {
		let parent = raw.in_reply_to_status_result.result
		if (parent.__typename === 'TweetWithVisibilityResults' && parent.tweet) parent = parent.tweet
		tweet.parent_tweet = normalizeTweet(parent)
	}

	return tweet
}
