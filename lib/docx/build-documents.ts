import {
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";

export interface TranscriptSection {
  /** Original filename — used as heading */
  title: string;
  body: string;
  failed?: boolean;
}

function transcriptParagraphs(text: string): Paragraph[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) {
    return [
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: " ", size: 22 })],
      }),
    ];
  }
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: line, size: 22 })],
      })
  );
}

export function buildCombinedDocument(sections: TranscriptSection[]): Document {
  const paragraphs: Paragraph[] = [];

  sections.forEach((sec, index) => {
    if (index > 0) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
    }

    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 200 },
        children: [new TextRun({ text: sec.title, bold: true, size: 32 })],
      })
    );

    const bodyText = sec.failed
      ? "Transcription failed for this file."
      : sec.body || "";

    paragraphs.push(...transcriptParagraphs(bodyText));
  });

  return new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
}

export async function packDocumentToBlob(doc: Document): Promise<Blob> {
  return Packer.toBlob(doc);
}

export async function buildCombinedDocxBlob(
  sections: TranscriptSection[]
): Promise<Blob> {
  const doc = buildCombinedDocument(sections);
  return packDocumentToBlob(doc);
}

export async function buildSingleFileDocxBlob(
  section: TranscriptSection
): Promise<Blob> {
  return buildCombinedDocxBlob([section]);
}
