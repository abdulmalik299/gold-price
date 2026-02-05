import React from 'react'
import { FORMSPREE_ENDPOINT } from '../env'

type Status = 'idle' | 'sending' | 'success' | 'error'

type FieldErrors = {
  message?: string
  email?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function FeedbackCard() {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [honeypot, setHoneypot] = React.useState('')
  const [status, setStatus] = React.useState<Status>('idle')
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [statusMessage, setStatusMessage] = React.useState('')

  const validate = () => {
    const nextErrors: FieldErrors = {}
    if (!message.trim()) {
      nextErrors.message = 'Message is required.'
    }
    if (email.trim() && !emailPattern.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatusMessage('')

    if (status === 'sending') return

    if (!validate()) {
      setStatus('error')
      setStatusMessage('Please fix the highlighted fields.')
      return
    }

    if (honeypot) {
      setStatus('success')
      setStatusMessage('Sent. Thank you!')
      setName('')
      setEmail('')
      setMessage('')
      setErrors({})
      return
    }

    setStatus('sending')

    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          _gotcha: honeypot,
        }),
      })

      if (!response.ok) {
        throw new Error('Submission failed.')
      }

      setStatus('success')
      setStatusMessage('Sent. Thank you!')
      setName('')
      setEmail('')
      setMessage('')
      setErrors({})
    } catch {
      setStatus('error')
      setStatusMessage('Unable to send right now. Please try again.')
    }
  }

  const isSending = status === 'sending'

  return (
    <section className="card feedbackCard" aria-labelledby="feedback-title">
      <div className="cardTop">
        <div>
          <div className="cardTitle" id="feedback-title">Feedback / Suggestions</div>
          <div className="feedbackSub">Share ideas or report issues</div>
        </div>
      </div>

      <form className="feedbackForm" onSubmit={handleSubmit} noValidate>
        <div className="feedbackFields">
          <div className="field">
            <label className="fieldLabel" htmlFor="feedback-name">Name (optional)</label>
            <input
              id="feedback-name"
              name="name"
              className="input"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="fieldLabel" htmlFor="feedback-email">Email (optional)</label>
            <input
              id="feedback-email"
              name="email"
              className={`input${errors.email ? ' inputInvalid' : ''}`}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'feedback-email-error' : undefined}
            />
            {errors.email ? (
              <span className="feedbackError" id="feedback-email-error">{errors.email}</span>
            ) : null}
          </div>

          <div className="field feedbackMessage">
            <label className="fieldLabel" htmlFor="feedback-message">Message *</label>
            <textarea
              id="feedback-message"
              name="message"
              className={`input feedbackTextarea${errors.message ? ' inputInvalid' : ''}`}
              rows={4}
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'feedback-message-error' : undefined}
            />
            {errors.message ? (
              <span className="feedbackError" id="feedback-message-error">{errors.message}</span>
            ) : null}
          </div>
        </div>

        <div className="feedbackHoneypot" aria-hidden="true">
          <label htmlFor="feedback-website">Website</label>
          <input
            id="feedback-website"
            name="_gotcha"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div className="feedbackActions">
          <button className="btn btnGold" type="submit" disabled={isSending}>
            <span className="btnGlow" />
            {isSending ? 'Sending...' : 'Send feedback'}
          </button>
          <span className={`feedbackStatus feedbackStatus-${status}`} role="status" aria-live="polite">
            {statusMessage}
          </span>
        </div>
      </form>
    </section>
  )
}
