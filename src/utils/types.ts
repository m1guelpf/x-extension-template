export const CAPTURE_EVENT = 'ext:tweets-captured'

export const TRACKED_ENDPOINTS = [
	'Bookmarks',
	'Followers',
	'Following',
	'UserTweets',
	'TweetDetail',
	'DeviceFollow',
	'HomeTimeline',
	'UserByScreenName',
	'TweetResultByRestId',
	'UserTweetsAndReplies',
	'UserHighlightsTweets',
] as const

export type TrackedEndpoint = (typeof TRACKED_ENDPOINTS)[number]

export interface CapturedPayload {
	endpoint: TrackedEndpoint | 'Unknown'
	requestUrl: string
	capturedAt: string
	transport: 'fetch' | 'xhr'
	payload: unknown
}

// ── Normalized tweet types ──

export interface NormalizedUrl {
	url: string
	display_url: string
	expanded_url: string
}

export interface NormalizedMention {
	id: string
	screen_name: string
	name: string
}

export interface NormalizedMedia {
	id: string
	type: string
	media_url: string
	url: string
	display_url: string
	expanded_url: string
	alt_text: string | null
}

export interface ProfessionalCategory {
	id: number | null
	name: string
	icon_name: string | null
}

export interface NormalizedUser {
	id: string
	name: string
	screen_name: string
	created_at: string

	description: string
	description_urls: NormalizedUrl[]
	profile_description_language: string | null
	location: string
	url: string | null
	url_expanded: string | null

	avatar_url: string
	profile_banner_url: string | null
	profile_image_shape: string

	is_blue_verified: boolean
	verified: boolean
	verified_type: string | null

	is_protected: boolean
	possibly_sensitive: boolean

	followers_count: number
	following_count: number
	tweet_count: number
	like_count: number
	media_count: number
	listed_count: number

	default_profile: boolean
	default_profile_image: boolean
	has_custom_timelines: boolean
	pinned_tweet_ids: string[]

	professional_type: string | null
	professional_category: ProfessionalCategory[]
}

export interface NormalizedTweet {
	id: string
	conversation_id: string | null
	user_id: string
	created_at: string

	full_text: string
	display_text_range: number[]
	lang: string | null
	source: string | null

	author: NormalizedUser

	favorite_count: number
	reply_count: number
	retweet_count: number
	quote_count: number
	bookmark_count: number
	view_count: number | null

	in_reply_to_status_id: string | null
	in_reply_to_user_id: string | null
	in_reply_to_screen_name: string | null

	is_quote_status: boolean
	quoted_status_id: string | null
	quoted_tweet: NormalizedTweet | null
	parent_tweet?: NormalizedTweet

	possibly_sensitive: boolean
	has_birdwatch_notes: boolean

	retweeted: boolean
	bookmarked: boolean
	favorited: boolean

	hashtags: string[]
	urls: NormalizedUrl[]
	mentions: NormalizedMention[]
	media: NormalizedMedia[]
}
