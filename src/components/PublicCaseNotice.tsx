type PublicCaseNoticeProps = { title: string; body: string }

export function PublicCaseNotice({ title, body }: PublicCaseNoticeProps) {
  return (
    <section className="public-case-notice">
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  )
}
