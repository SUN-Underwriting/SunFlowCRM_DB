import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';

interface SubmissionLike {
  reference: string;
  policyNumber?: string | null;
  vesselName?: string | null;
  vesselType?: string | null;
  yearBuilt?: number | null;
  lengthFeet?: number | null;
  hullValue?: number | string | null;
  territory?: string | null;
  useType?: string | null;
  brokerName?: string | null;
  brokerCompany?: string | null;
  brokerEmail?: string | null;
  createdAt?: Date | string | null;
}

interface QuoteLike {
  quoteNumber?: string | null;
  totalPremium?: number | string | null;
  hullPremium?: number | string | null;
  liabilityPremium?: number | string | null;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
}

function fmtUSD(value: number | string | null | undefined) {
  if (value == null) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });
}

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 140, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22 })]
  });
}

function kvRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 3200, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 19 })]
          })
        ]
      }),
      new TableCell({
        width: { size: 6400, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
        },
        children: [
          new Paragraph({ children: [new TextRun({ text: value, size: 19 })] })
        ]
      })
    ]
  });
}

export async function buildQuoteSlipBuffer(
  submission: SubmissionLike,
  quote: QuoteLike | null
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'SUN UNDERWRITING MGA',
                    bold: true,
                    size: 28
                  })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Insurance Quote Slip', size: 20 })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Facility SUN-MYC-001 · Page ',
                    size: 16
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16 })
                ]
              })
            ]
          })
        },
        children: [
          sectionTitle('Quote Summary'),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            rows: [
              kvRow('Submission Ref', submission.reference),
              kvRow('Quote Number', quote?.quoteNumber ?? '—'),
              kvRow('Vessel', submission.vesselName ?? '—'),
              kvRow('Total Premium', fmtUSD(quote?.totalPremium)),
              kvRow('Hull Premium', fmtUSD(quote?.hullPremium)),
              kvRow('Liability Premium', fmtUSD(quote?.liabilityPremium)),
              kvRow('Valid From', fmtDate(quote?.validFrom)),
              kvRow('Valid Until', fmtDate(quote?.validUntil))
            ]
          }),
          sectionTitle('Risk Information'),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            rows: [
              kvRow('Vessel Type', submission.vesselType ?? '—'),
              kvRow('Year Built', submission.yearBuilt?.toString() ?? '—'),
              kvRow('Length (ft)', submission.lengthFeet?.toString() ?? '—'),
              kvRow('Hull Value', fmtUSD(submission.hullValue)),
              kvRow('Territory', submission.territory ?? '—'),
              kvRow('Use Type', submission.useType ?? '—')
            ]
          }),
          sectionTitle('Broker'),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            rows: [
              kvRow('Broker Name', submission.brokerName ?? '—'),
              kvRow('Broker Company', submission.brokerCompany ?? '—'),
              kvRow('Broker Email', submission.brokerEmail ?? '—')
            ]
          })
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
}

export async function buildPolicyCertificateBuffer(
  submission: SubmissionLike,
  quote: QuoteLike | null
): Promise<Buffer> {
  const policyNumber =
    submission.policyNumber ??
    `SUN-POL-${new Date().getFullYear()}-${submission.reference.slice(-5)}`;

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'SUN UNDERWRITING MGA',
                    bold: true,
                    size: 28
                  })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Certificate of Insurance', size: 20 })
                ]
              })
            ]
          })
        },
        children: [
          sectionTitle('Policy Details'),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            rows: [
              kvRow('Policy Number', policyNumber),
              kvRow('Submission Ref', submission.reference),
              kvRow('Vessel', submission.vesselName ?? '—'),
              kvRow('Territory', submission.territory ?? '—'),
              kvRow('Use Type', submission.useType ?? '—'),
              kvRow('Annual Premium', fmtUSD(quote?.totalPremium)),
              kvRow('Inception', fmtDate(quote?.validFrom)),
              kvRow('Expiry', fmtDate(quote?.validUntil))
            ]
          })
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
}
