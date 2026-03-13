import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
  Footer,
  Header
} from 'docx';

// ── Design tokens ─────────────────────────────────────────────
const NAVY = '1B3A5C';
const BLUE = '2E6DA4';
const GREEN = '166534';
const GREEN_LIGHT = 'DCFCE7';
const WHITE = 'FFFFFF';
const TEXT = '1A1A2E';
const MUTED = '6B7280';

const solidBorder = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
const cellBorders = {
  top: solidBorder,
  bottom: solidBorder,
  left: solidBorder,
  right: solidBorder
};
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder
};

function cell(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    bg?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    width?: number;
    italic?: boolean;
    colSpan?: number;
  } = {}
) {
  const {
    bold = false,
    size = 19,
    color = TEXT,
    bg = WHITE,
    align = AlignmentType.LEFT,
    width = 4680,
    italic = false,
    colSpan
  } = opts;
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    ...(colSpan ? { columnSpan: colSpan } : {}),
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold,
            size,
            color,
            font: 'Arial',
            italics: italic
          })
        ]
      })
    ]
  });
}

function row2(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      cell(label, { bold: true, color: '374151', bg: 'F9FAFB', width: 4200 }),
      cell(value, { width: 5160 })
    ]
  });
}

function sectionHeader(title: string): TableRow {
  return new TableRow({
    children: [
      cell(title, {
        bold: true,
        size: 18,
        color: WHITE,
        bg: NAVY,
        colSpan: 2,
        width: 9360
      })
    ]
  });
}

function table2col(rows: TableRow[]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4200, 5160],
    rows
  });
}

function spacer() {
  return new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: { before: 0, after: 140 }
  });
}

function fmtUSD(val: string | number | null | undefined): string {
  if (val == null) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });
}

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function fmtPct(value: number | null | undefined, signed = false): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  let pct = Number(value);
  // Guard: some legacy values may already be scaled by 100 (e.g. -1000 for -10.0%).
  if (Math.abs(pct) > 100) {
    pct = pct / 100;
  }
  const normalized = pct.toFixed(1);
  if (signed && pct > 0) return `+${normalized}%`;
  return `${normalized}%`;
}

function buildPolicy(sub: any, quote: any): Document {
  const policyNumber = `POL-${sub.reference.replace('SUN-', '')}`;
  const boundQuote =
    sub.quotes?.find((q: any) => q.status === 'BOUND') ?? quote;
  const inceptionDate = boundQuote?.validFrom
    ? fmtDate(boundQuote.validFrom)
    : fmtDate(new Date().toISOString());
  const expiryDate = boundQuote?.validUntil
    ? fmtDate(boundQuote.validUntil)
    : (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return fmtDate(d.toISOString());
      })();

  const territory =
    sub.territory === 'US_CA_MX_CARIB'
      ? 'US / Canada / Mexico / Caribbean'
      : 'Rest of World';
  const useType =
    {
      PRIVATE: 'Private Pleasure',
      CHARTER: 'Charter',
      BAREBOAT: 'Bareboat Charter'
    }[sub.useType as string] ??
    sub.useType ??
    '—';

  const discounts: Array<{ label: string; pct: number }> =
    boundQuote?.discountsApplied ?? [];
  const loadings: Array<{ label: string; pct: number }> =
    boundQuote?.loadingsApplied ?? [];
  const optPremiums = (boundQuote?.optionalPremiums ?? {}) as Record<
    string,
    number
  >;
  const medicalPremium = Number(optPremiums.medicalExpenses ?? 0);
  const uninsuredPremium = Number(optPremiums.uninsuredBoaters ?? 0);
  const crewPremium = Number(optPremiums.crewLiability ?? 0);

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: TEXT } } }
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
          }
        },

        // ── Header ──────────────────────────────────────────────
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9638, type: WidthType.DXA },
                columnWidths: [6000, 3638],
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: noBorders,
                        width: { size: 6000, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: 'SUN UNDERWRITING MGA',
                                bold: true,
                                size: 28,
                                color: NAVY,
                                font: 'Arial'
                              })
                            ]
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: 'Marine Yacht Division  ·  sunuw.ae',
                                size: 17,
                                color: MUTED,
                                font: 'Arial'
                              })
                            ]
                          })
                        ]
                      }),
                      new TableCell({
                        borders: noBorders,
                        width: { size: 3638, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: 'CERTIFICATE OF INSURANCE',
                                bold: true,
                                size: 22,
                                color: GREEN,
                                font: 'Arial'
                              })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: `Policy: ${policyNumber}`,
                                size: 17,
                                color: MUTED,
                                font: 'Arial'
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  })
                ]
              }),
              new Paragraph({
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 8,
                    color: GREEN,
                    space: 1
                  }
                },
                children: [],
                spacing: { after: 160 }
              })
            ]
          })
        },

        // ── Footer ──────────────────────────────────────────────
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: 'D1D5DB',
                    space: 1
                  }
                },
                children: [],
                spacing: { before: 120 }
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Facility: SUN-MYC-001  ·  Policy: ${policyNumber}  ·  Page `,
                    size: 16,
                    color: MUTED,
                    font: 'Arial'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: MUTED,
                    font: 'Arial'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'This Certificate of Insurance is evidence of insurance cover placed in accordance with the above Facility.',
                    size: 15,
                    italics: true,
                    color: MUTED,
                    font: 'Arial'
                  })
                ]
              })
            ]
          })
        },

        // ── Body ────────────────────────────────────────────────
        children: [
          // ── BOUND banner ────────────────────────────────────
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [9360],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    shading: { fill: GREEN_LIGHT, type: ShadingType.CLEAR },
                    margins: { top: 160, bottom: 160, left: 240, right: 240 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: '✓  POLICY IN FORCE',
                            bold: true,
                            size: 26,
                            color: GREEN,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `Policy Number: ${policyNumber}   ·   Period: ${inceptionDate} to ${expiryDate}`,
                            size: 19,
                            color: GREEN,
                            font: 'Arial'
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          spacer(),

          // ── INSURED ───────────────────────────────────────────
          table2col([
            sectionHeader('INSURED'),
            row2('Named Insured', sub.insuredName ?? sub.brokerName ?? '—'),
            row2('Broker', sub.brokerName ?? '—'),
            row2('Broker Company', sub.brokerCompany ?? '—'),
            row2('Broker Email', sub.brokerEmail ?? '—')
          ]),

          spacer(),

          // ── VESSEL ────────────────────────────────────────────
          table2col([
            sectionHeader('VESSEL'),
            row2('Vessel Name', sub.vesselName ?? '—'),
            row2('Type', sub.vesselType?.replace(/_/g, ' ') ?? '—'),
            row2('Year of Build', sub.yearBuilt?.toString() ?? '—'),
            row2('Length (ft)', sub.lengthFeet?.toString() ?? '—'),
            row2('Navigation Area', territory),
            row2('Use', useType)
          ]),

          spacer(),

          // ── COVERAGE ──────────────────────────────────────────
          table2col([
            sectionHeader('COVERAGE & LIMITS'),
            row2('Hull & Machinery — Agreed Value', fmtUSD(sub.hullValue)),
            row2(
              'Hull Deductible',
              fmtUSD(boundQuote?.hullDeductible) +
                (boundQuote?.hullDeductiblePct
                  ? ` (${(Number(boundQuote.hullDeductiblePct) * 100).toFixed(0)}%)`
                  : '')
            ),
            row2(
              'Third Party Liability / Pollution',
              fmtUSD(sub.liabilityLimit)
            ),
            row2('P&I Deductible', fmtUSD(boundQuote?.liabilityDed)),
            ...(sub.medicalExpensesLimit > 10_000
              ? [
                  row2(
                    'Medical Expenses',
                    `$${Number(sub.medicalExpensesLimit).toLocaleString()}`
                  )
                ]
              : []),
            ...(sub.uninsuredBoatersLimit > 25_000
              ? [
                  row2(
                    'Uninsured Boaters',
                    `$${Number(sub.uninsuredBoatersLimit).toLocaleString()}`
                  )
                ]
              : []),
            ...(sub.crewLiabilityLimit > 0
              ? [
                  row2(
                    'Crew Liability',
                    `$${Number(sub.crewLiabilityLimit).toLocaleString()}`
                  )
                ]
              : [])
          ]),

          spacer(),

          // ── PREMIUM ───────────────────────────────────────────
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4200, 5160],
            rows: [
              sectionHeader('PREMIUM'),
              row2('Hull Premium', fmtUSD(boundQuote?.hullPremium)),
              row2(
                'P&I / Pollution Premium',
                fmtUSD(boundQuote?.liabilityPremium)
              ),
              ...(medicalPremium > 0
                ? [row2('Medical Expenses', fmtUSD(medicalPremium))]
                : []),
              ...(uninsuredPremium > 0
                ? [row2('Uninsured Boaters', fmtUSD(uninsuredPremium))]
                : []),
              ...(crewPremium > 0
                ? [row2('Crew Liability', fmtUSD(crewPremium))]
                : []),
              new TableRow({
                children: [
                  cell('TOTAL ANNUAL PREMIUM', {
                    bold: true,
                    size: 21,
                    color: WHITE,
                    bg: BLUE,
                    width: 4200
                  }),
                  cell(fmtUSD(boundQuote?.totalPremium), {
                    bold: true,
                    size: 24,
                    color: WHITE,
                    bg: BLUE,
                    width: 5160
                  })
                ]
              }),
              row2('Premium Basis', 'Annual — payable in full at inception')
            ]
          }),

          spacer(),

          // ── ADJUSTMENTS ───────────────────────────────────────
          ...(discounts.length > 0 || loadings.length > 0
            ? [
                table2col([
                  sectionHeader('RATING ADJUSTMENTS'),
                  ...discounts.map((d) =>
                    row2(`Discount — ${d.label}`, fmtPct(d.pct))
                  ),
                  ...loadings.map((l) =>
                    row2(`Loading — ${l.label}`, fmtPct(l.pct, true))
                  ),
                  row2(
                    'Net Adjustment',
                    boundQuote
                      ? fmtPct(Number(boundQuote.netAdjustmentPct))
                      : '—'
                  )
                ]),
                spacer()
              ]
            : []),

          // ── CONDITIONS ────────────────────────────────────────
          table2col([
            sectionHeader('POLICY CONDITIONS'),
            row2('Policy Number', policyNumber),
            row2('Facility Reference', 'SUN-MYC-001'),
            row2('Capacity', "Lloyd's Syndicate(s) per Facility SUN-MYC-001"),
            row2('Class of Business', 'Marine Yacht — Hull & P&I'),
            row2('Policy Wording', 'MAR 91 / Institute Yacht Clauses 1.11.85'),
            row2('Inception Date', inceptionDate),
            row2('Expiry Date', expiryDate),
            row2('Law & Jurisdiction', 'English Law & Jurisdiction'),
            row2('Sanctions', 'JH2010/009 Sanction Limitation Clause applies')
          ]),

          spacer(),

          // ── SIGNATURE ─────────────────────────────────────────
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4200, 5160],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: noBorders,
                    width: { size: 4200, type: WidthType.DXA },
                    margins: { top: 300, bottom: 300, left: 0, right: 160 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Authorised Signatory',
                            bold: true,
                            size: 19,
                            color: NAVY,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        spacing: { before: 600 },
                        border: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 4,
                            color: NAVY
                          }
                        },
                        children: []
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Sun Re Marine Underwriting MGA',
                            size: 17,
                            color: MUTED,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Date: ${fmtDate(new Date().toISOString())}`,
                            size: 17,
                            color: MUTED,
                            font: 'Arial'
                          })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    borders: noBorders,
                    width: { size: 5160, type: WidthType.DXA },
                    margins: { top: 300, bottom: 300, left: 160, right: 0 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Important Notice',
                            bold: true,
                            size: 19,
                            color: NAVY,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        spacing: { before: 80 },
                        children: [
                          new TextRun({
                            text: 'This certificate is issued as a matter of information only and confers no rights upon the certificate holder. Coverage is subject to the full terms, conditions, and exclusions of the policy wording. In the event of a claim, notify us immediately.',
                            size: 17,
                            color: MUTED,
                            font: 'Arial'
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(req, async (user) => {
      const { id } = await context.params;

      const submission = await prisma.submission.findFirst({
        where: { id, tenantId: user.tenantId, deleted: false },
        include: { quotes: { orderBy: { createdAt: 'desc' } } }
      });

      if (!submission) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (!['BOUND', 'POLICY_ISSUED'].includes(submission.status)) {
        return NextResponse.json(
          {
            error:
              'Policy is only available for BOUND/POLICY_ISSUED submissions'
          },
          { status: 400 }
        );
      }

      const quote =
        submission.quotes.find((q) => q.status === 'BOUND') ??
        submission.quotes[0];

      const doc = buildPolicy(submission, quote);
      const buffer = await Packer.toBuffer(doc);

      const policyNumber = `POL-${submission.reference.replace('SUN-', '')}`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="Policy_${policyNumber}.docx"`
        }
      });
    });
  } catch (err) {
    console.error('[policy] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate policy', detail: String(err) },
      { status: 500 }
    );
  }
}
