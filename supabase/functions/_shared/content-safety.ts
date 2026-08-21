export type ContentSafetyInput = { text: string; imageDataUrl?: string }
export type ContentSafetyResult = { flagged: boolean; categories: string[] }

export interface ContentSafetyProvider {
  screen(input: ContentSafetyInput): Promise<ContentSafetyResult>
}

type OpenAiModerationResponse = {
  results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>
}

class OpenAiModerationProvider implements ContentSafetyProvider {
  constructor(private readonly apiKey: string) {}

  async screen(input: ContentSafetyInput): Promise<ContentSafetyResult> {
    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: input.text },
    ]
    if (input.imageDataUrl)
      content.push({
        type: 'image_url',
        image_url: { url: input.imageDataUrl },
      })
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: content }),
    })
    if (!response.ok)
      throw new Error(`OpenAI moderation request failed (${response.status})`)
    const body = (await response.json()) as OpenAiModerationResponse
    const result = body.results?.[0]
    if (!result || typeof result.flagged !== 'boolean')
      throw new Error('OpenAI moderation response was incomplete')
    return {
      flagged: result.flagged,
      categories: Object.entries(result.categories ?? {})
        .filter(([, flagged]) => flagged)
        .map(([category]) => category),
    }
  }
}

// Add a provider here, then select it with CONTENT_SAFETY_PROVIDER. Callers
// depend only on this interface, not on a provider's HTTP contract.
export function contentSafetyProvider(): ContentSafetyProvider {
  const provider = Deno.env.get('CONTENT_SAFETY_PROVIDER') ?? 'openai'
  if (provider !== 'openai')
    throw new Error(`Unsupported content safety provider: ${provider}`)
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('Content safety is not configured')
  return new OpenAiModerationProvider(apiKey)
}
