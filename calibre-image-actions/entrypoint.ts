#!/usr/bin/env node

import { GITHUB_TOKEN, GITHUB_EVENT_NAME, COMPRESS_ONLY } from './src/constants'

import githubEvent from './src/github-event'
import run from './src/index'

if (!GITHUB_TOKEN) {
  console.log('::error:: You must enable the GITHUB_TOKEN secret')
  process.exit(1)
}

const main = async () => {
  if (!COMPRESS_ONLY) {
    // Bail out if the event that executed the action wasn’t a pull_request
    if (GITHUB_EVENT_NAME !== 'pull_request') {
      console.log('::error:: This action only runs for pushes to PRs')
      process.exit(78)
    }

    // Bail out if the pull_request event wasn't synchronize or opened
    const event = await githubEvent()
    if (event.action !== 'synchronize' && event.action !== 'opened') {
      console.log(
        '::error:: Check run has action',
        event.action,
        '. Wants: synchronize or opened'
      )
      process.exit(0)
    }
  }

  await run()
}

main()
