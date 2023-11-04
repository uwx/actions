import Octokit from '@octokit/rest'
import api from './github-api'
import githubEvent from './github-event'

const createComment = async (
  body: string
): Promise<Octokit.RestEndpointMethodTypes["issues"]["createComment"]["response"]> => {
  const event = await githubEvent()
  const owner: string = event.repository.owner.login
  const repo: string = event.repository.name
  const issue_number: number = event.issue_number ?? event.number

  return api.issues.createComment({ owner, repo, issue_number, body })
}

export default createComment
