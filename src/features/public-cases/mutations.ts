import { useMutation } from '@tanstack/react-query'
import {
  createShareAttribution,
  recordShareAttribution,
  submitContentReport,
} from './api'

export function useRecordShareAttributionMutation() {
  return useMutation({
    mutationFn: ({ slug, token }: { slug: string; token: string }) =>
      recordShareAttribution(slug, token),
  })
}

export function useCreateShareAttributionMutation() {
  return useMutation({
    mutationFn: ({
      slug,
      channel,
    }: {
      slug: string
      channel: 'copy' | 'web_share' | 'whatsapp' | 'poster'
    }) => createShareAttribution(slug, channel),
  })
}

export function useSubmitContentReportMutation() {
  return useMutation({ mutationFn: submitContentReport })
}
