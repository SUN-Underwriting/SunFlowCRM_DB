import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
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
const LIGHT = 'EBF2FA';
const WHITE = 'FFFFFF';
const GREY = 'F5F7FA';
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

// ── Helpers ───────────────────────────────────────────────────

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
            italics: italic,
            font: 'Arial'
          })
        ]
      })
    ]
  });
}

function labelCell(text: string) {
  return cell(text, {
    bold: true,
    size: 18,
    color: NAVY,
    bg: GREY,
    width: 4200
  });
}

function valueCell(text: string) {
  return cell(text, { size: 19, color: TEXT, bg: WHITE, width: 5160 });
}

function row2(label: string, value: string) {
  return new TableRow({ children: [labelCell(label), valueCell(value)] });
}

function sectionHeader(title: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders: cellBorders,
        columnSpan: 2,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 110, bottom: 110, left: 160, right: 160 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 21,
                color: WHITE,
                font: 'Arial'
              })
            ]
          })
        ]
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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function validUntil(createdAt: string): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 90);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// ── Document builder ──────────────────────────────────────────

function buildSlip(sub: any, quote: any): Document {
  const optPremiums = (quote?.optionalPremiums ?? {}) as Record<string, number>;
  const medicalPremium = Number(optPremiums.medicalExpenses ?? 0);
  const uninsuredPremium = Number(optPremiums.uninsuredBoaters ?? 0);
  const crewPremium = Number(optPremiums.crewLiability ?? 0);

  const territory =
    sub.territory === 'US_CA_MX_CARIB'
      ? 'US / Canada / Mexico / Caribbean'
      : 'Rest of World';
  const useType =
    { PRIVATE: 'Private', CHARTER: 'Charter', BAREBOAT: 'Bareboat Charter' }[
      sub.useType as string
    ] ??
    sub.useType ??
    '—';

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: TEXT } } }
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
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
                                text: 'INSURANCE QUOTE SLIP',
                                bold: true,
                                size: 22,
                                color: BLUE,
                                font: 'Arial'
                              })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: `Ref: ${sub.reference}`,
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
                    size: 6,
                    color: BLUE,
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
                    text: 'Coverholder: London Marine Insurance Services Ltd.  ·  Facility: SUN-MYC-001  ·  Page ',
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
                    text: 'This document is an indication only and does not constitute a binding contract of insurance.',
                    size: 15,
                    color: MUTED,
                    italics: true,
                    font: 'Arial'
                  })
                ]
              })
            ]
          })
        },

        children: [
          // ── Quote reference bar ────────────────────────────────
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 3120, type: WidthType.DXA },
                    shading: { fill: LIGHT, type: ShadingType.CLEAR },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Quote Number',
                            size: 17,
                            color: MUTED,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: quote?.quoteNumber ?? '—',
                            bold: true,
                            size: 20,
                            color: NAVY,
                            font: 'Arial'
                          })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 3120, type: WidthType.DXA },
                    shading: { fill: LIGHT, type: ShadingType.CLEAR },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Issue Date',
                            size: 17,
                            color: MUTED,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: fmtDate(sub.createdAt),
                            bold: true,
                            size: 20,
                            color: NAVY,
                            font: 'Arial'
                          })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 3120, type: WidthType.DXA },
                    shading: { fill: LIGHT, type: ShadingType.CLEAR },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Valid Until',
                            size: 17,
                            color: MUTED,
                            font: 'Arial'
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: validUntil(sub.createdAt),
                            bold: true,
                            size: 20,
                            color: NAVY,
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

          // ── PARTIES ───────────────────────────────────────────
          table2col([
            sectionHeader('PARTIES'),
            row2('Insured', sub.insuredName ?? '—'),
            row2('Broker', sub.brokerName ?? '—'),
            row2('Broker Company', sub.brokerCompany ?? '—'),
            row2('Broker Email', sub.brokerEmail ?? '—')
          ]),

          spacer(),

          // ── VESSEL ────────────────────────────────────────────
          table2col([
            sectionHeader('VESSEL'),
            row2('Vessel Name', sub.vesselName ?? '—'),
            row2('Type', sub.vesselType ?? '—'),
            row2('Year Built', sub.yearBuilt ? String(sub.yearBuilt) : '—'),
            row2('Length', sub.lengthFeet ? `${sub.lengthFeet} feet` : '—'),
            row2('Territory', territory),
            row2('Use', useType),
            row2('Navigation Area', sub.navAreaModifier ?? 'Standard'),
            row2('Agreed Hull Value', fmtUSD(sub.hullValue))
          ]),

          spacer(),

          // ── PREMIUM ───────────────────────────────────────────
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4200, 5160],
            rows: [
              sectionHeader('PREMIUM'),
              row2('Hull & Machinery', fmtUSD(quote?.hullPremium)),
              row2(
                'P&I / Pollution Liability',
                fmtUSD(quote?.liabilityPremium)
              ),
              ...(medicalPremium > 0
                ? [
                    row2(
                      'Medical Expenses (additional)',
                      fmtUSD(medicalPremium)
                    )
                  ]
                : []),
              ...(uninsuredPremium > 0
                ? [
                    row2(
                      'Uninsured Boaters (additional)',
                      fmtUSD(uninsuredPremium)
                    )
                  ]
                : []),
              ...(crewPremium > 0
                ? [row2('Crew Liability', fmtUSD(crewPremium))]
                : []),
              // Total row — dark background
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    columnSpan: 2,
                    width: { size: 9360, type: WidthType.DXA },
                    shading: { fill: NAVY, type: ShadingType.CLEAR },
                    margins: { top: 140, bottom: 140, left: 160, right: 160 },
                    children: [
                      new Table({
                        width: { size: 9000, type: WidthType.DXA },
                        columnWidths: [6500, 2500],
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                borders: noBorders,
                                width: { size: 6500, type: WidthType.DXA },
                                children: [
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: 'TOTAL ANNUAL PREMIUM (USD)',
                                        bold: true,
                                        size: 22,
                                        color: WHITE,
                                        font: 'Arial'
                                      })
                                    ]
                                  })
                                ]
                              }),
                              new TableCell({
                                borders: noBorders,
                                width: { size: 2500, type: WidthType.DXA },
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [
                                      new TextRun({
                                        text: fmtUSD(quote?.totalPremium),
                                        bold: true,
                                        size: 26,
                                        color: WHITE,
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
                  })
                ]
              })
            ]
          }),

          spacer(),

          // ── DEDUCTIBLES ───────────────────────────────────────
          table2col([
            sectionHeader('DEDUCTIBLES'),
            row2(
              'Hull Deductible',
              quote
                ? `${fmtUSD(quote.hullDeductible)} (${(Number(quote.hullDeductiblePct) * 100).toFixed(0)}%)`
                : '—'
            ),
            row2('P&I Deductible', quote ? fmtUSD(quote.liabilityDed) : '—'),
            row2('P&I / Pollution Liability Limit', fmtUSD(sub.liabilityLimit)),
            ...(sub.medicalExpensesLimit > 10_000
              ? [
                  row2(
                    'Medical Expenses Limit',
                    `$${Number(sub.medicalExpensesLimit).toLocaleString()}`
                  )
                ]
              : []),
            ...(sub.uninsuredBoatersLimit > 25_000
              ? [
                  row2(
                    'Uninsured Boaters Limit',
                    `$${Number(sub.uninsuredBoatersLimit).toLocaleString()}`
                  )
                ]
              : []),
            ...(sub.crewLiabilityLimit > 0
              ? [
                  row2(
                    'Crew Liability Limit',
                    `$${Number(sub.crewLiabilityLimit).toLocaleString()}`
                  )
                ]
              : [])
          ]),

          spacer(),

          // ── POLICY CONDITIONS ─────────────────────────────────
          table2col([
            sectionHeader('POLICY CONDITIONS'),
            row2('Facility Reference', 'SUN-MYC-001'),
            row2('Coverholder', 'London Marine Insurance Services Ltd.'),
            row2('Capacity', "Lloyd's Syndicate(s) per Facility SUN-MYC-001"),
            row2('Class of Business', 'Marine Yacht — Hull & P&I'),
            row2('Policy Wording', 'MAR 91 / Institute Yacht Clauses 1.11.85'),
            row2('Sanctions', 'JH2010/009 Sanction Limitation Clause applies'),
            row2('Law & Jurisdiction', 'English Law & Jurisdiction')
          ]),

          spacer(),

          // ── Disclaimer ────────────────────────────────────────
          new Paragraph({
            children: [
              new TextRun({
                text: 'This quote is an indication only and is subject to satisfactory completion of all underwriting requirements and final approval by the coverholder. Premium is net of all commissions. All amounts in USD.',
                size: 16,
                color: MUTED,
                italics: true,
                font: 'Arial'
              })
            ]
          })
        ]
      }
    ]
  });
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sub = await prisma.submission.findUnique({
      where: { id },
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!sub) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const quote = sub.quotes[0] ?? null;
    const doc = buildSlip(sub, quote);
    const buffer = await Packer.toBuffer(doc);

    const filename = `QuoteSlip_${sub.reference}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length)
      }
    });
  } catch (err) {
    console.error('[slip] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate slip', detail: String(err) },
      { status: 500 }
    );
  }
}
