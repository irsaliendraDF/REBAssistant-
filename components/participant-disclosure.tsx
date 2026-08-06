import { acknowledgeParticipantDisclosure } from '@/app/project/[id]/actions'
import { PARTICIPANT_CONSENT_DISCLOSURE } from '@/lib/disclosure/text'

/**
 * Guardrail 8, surface (b).
 *
 * The participant is the only person in this chain who never sees the tool, so
 * the wording that reaches them depends entirely on the researcher carrying it
 * across into their own consent form. That is a handoff, and a handoff nobody
 * confirms is a handoff that quietly does not happen.
 *
 * So this is not a notice. It is the text to copy, plus a recorded
 * acknowledgement that it was handed over. What the researcher then does with it
 * is theirs; what is on record is that they were given it and said so.
 */
export function ParticipantDisclosure({
  projectId,
  acknowledged,
}: {
  projectId: string
  acknowledged: boolean
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <p className="text-sm font-medium text-ink">
        Text for Your Participant Consent Form
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        This is not part of the application. Participants have to be told that an AI-assisted system
        was involved in preparing what they are being asked to agree to, and this is the wording for
        that. It is also included at the end of the downloaded document.
      </p>

      <div className="mt-3 rounded-md border border-line bg-surface p-4">
        <p className="text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {PARTICIPANT_CONSENT_DISCLOSURE}
        </p>
      </div>

      {acknowledged ? (
        <p className="mt-3 text-xs font-medium text-forest">
          ✓ Recorded: you have this wording for your consent form.
        </p>
      ) : (
        <form action={acknowledgeParticipantDisclosure} className="mt-3">
          <input type="hidden" name="projectId" value={projectId} />
          <button
            type="submit"
            className="rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2"
          >
            I Have This, and Will Include It
          </button>
        </form>
      )}
    </div>
  )
}
