import 'server-only'

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

import { PARTICIPANT_CONSENT_DISCLOSURE } from '@/lib/disclosure/text'

import type { DraftPackage, DraftSection } from './assemble'

/**
 * Renders the assembled draft as a Word document.
 *
 * The researcher reviews, completes and submits this themselves. The tool does
 * not submit anything, which the agreement puts out of scope, and the cover page
 * says so in as many words.
 *
 * Every section that has not been drafted is labelled in the document itself,
 * not only in the interface. A .docx leaves this tool and gets forwarded,
 * printed and read by people who never saw the screen it came from, so it has to
 * carry its own caveats.
 */

const STATUS_LABELS: Record<DraftSection['status'], string> = {
  from_record: 'From your project details',
  awaiting_drafting: 'Not yet drafted',
  ai_drafted: 'Drafted with AI assistance',
  routed: 'Not drafted by this tool',
  no_answers_yet: 'No answers captured yet',
}

export async function renderDocx(draft: DraftPackage): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: draft.title,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: 'Research Ethics Board application, working draft',
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Institution: ${draft.institution}`, size: 20 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${new Date(draft.generatedAt).toISOString().slice(0, 10)}`,
          size: 20,
        }),
      ],
    }),

    paragraphSpacer(),

    new Paragraph({
      children: [
        new TextRun({
          text:
            'This is a working draft prepared with Research Ethics Board Assistant. It is not a ' +
            'submission. It has not been reviewed by a Research Ethics Board, and the tool that ' +
            'produced it does not decide whether research is approved. Complete, check and submit ' +
            'it yourself.',
          bold: true,
        }),
      ],
    }),

    paragraphSpacer(),
    ...disclosureParagraphs(draft.disclosure),
  ]

  if (draft.incompleteSections.length > 0) {
    children.push(
      paragraphSpacer(),
      new Paragraph({
        children: [
          new TextRun({
            text: `Sections with no answers captured yet: ${draft.incompleteSections.join(', ')}.`,
            italics: true,
          }),
        ],
      }),
    )
  }

  for (const section of draft.sections) {
    children.push(...sectionParagraphs(section))
  }

  // Guardrail 8, surface (b). It travels with the document because that is the
  // artefact the researcher works from when they write their consent form. Left
  // only on a screen it would be read once and forgotten, and the participant is
  // the one person in this chain who never sees the tool at all.
  children.push(
    paragraphSpacer(),
    new Paragraph({
      text: 'For Your Participant Consent Form',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            'This is not part of the application. Include the following in the consent form ' +
            'participants read, so they are told that an AI-assisted system was involved.',
          italics: true,
        }),
      ],
    }),
    paragraphSpacer(),
    ...disclosureParagraphs(PARTICIPANT_CONSENT_DISCLOSURE),
  )

  const document = new Document({
    creator: 'Research Ethics Board Assistant',
    title: draft.title,
    description: 'Working draft of a Research Ethics Board application. Not a submission.',
    sections: [{ children }],
  })

  // Buffer rather than Blob: the route hands this straight to a Response body.
  return Packer.toBuffer(document)
}

function sectionParagraphs(section: DraftSection): Paragraph[] {
  const paragraphs: Paragraph[] = [
    paragraphSpacer(),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      text: `${section.number}  ${section.title}`,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: STATUS_LABELS[section.status],
          italics: true,
          size: 18,
        }),
      ],
    }),
  ]

  if (section.note) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: section.note, size: 18, italics: true })],
      }),
    )
  }

  if (section.content) {
    for (const line of section.content.split('\n')) {
      paragraphs.push(new Paragraph({ text: line }))
    }

    if (section.wordLimit) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${section.wordCount} words. The form allows ${section.wordLimit}.`,
              size: 18,
              italics: true,
              // Advisory, per guardrail 6. Over the cap is worth knowing, not a
              // verdict on the application.
              bold: section.overWordLimit,
            }),
          ],
        }),
      )
    }
  }

  if (section.sources.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Your answers for this section', bold: true, size: 20 }),
        ],
      }),
    )

    for (const source of section.sources) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: source.question, size: 19, italics: true })],
        }),
      )
      for (const line of source.answer.split('\n')) {
        paragraphs.push(new Paragraph({ text: line, bullet: { level: 0 } }))
      }
    }
  }

  return paragraphs
}

function disclosureParagraphs(disclosure: string): Paragraph[] {
  return disclosure.split('\n').map(
    (line, index) =>
      new Paragraph({
        children: [new TextRun({ text: line, bold: index === 0, size: index === 0 ? 24 : 20 })],
      }),
  )
}

function paragraphSpacer(): Paragraph {
  return new Paragraph({ text: '' })
}
