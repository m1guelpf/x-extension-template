import type { NormalizedTweet, TrackedEndpoint } from '~utils/types'
import type { PlasmoMessaging } from '@plasmohq/messaging'

export type RequestBody = {
	capturedAt: string
	context: TrackedEndpoint
	tweets: NormalizedTweet[]
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
	const { context, tweets } = req.body

	// process tweets here...
	console.log(`[background] ${context}: ${tweets.length} tweets captured`, tweets)

	res.send({})
}

export default handler
