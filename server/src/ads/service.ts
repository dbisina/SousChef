import type {
  AdDayStat,
  AdFormat,
  AdInquiry,
  AdInquiryRequest,
  AdInquiryStatus,
  AdMetrics,
  AdPlacement,
  AdStatus,
  AdminAd,
  CreateAdRequest,
  PublicAd,
  UpdateAdRequest,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Db } from '../db';
import { errors } from '../errors';

const DAY_MS = 86_400_000;

/** SousChef's own ad, shown when no campaign is running. Never counted. */
export const FALLBACK_AD: PublicAd = {
  id: 'fallback',
  advertiserName: 'enplace',
  advertiserLogoUrl: null,
  title: 'Import any recipe video',
  subtitle: 'Paste a TikTok, Instagram or YouTube link and cook it step by step.',
  imageUrl: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=800&q=80',
  ctaText: 'Try it',
  ctaUrl: '',
  format: 'card',
  accentColor: '#22C55E',
  darkMode: false,
  isFallback: true,
};

type AdRow = Prisma.AdGetPayload<object>;

/** Money spent so far: impressions x price per thousand. Whole cents. */
export const spentCents = (impressions: number, cpmCents: number): number => Math.round((impressions * cpmCents) / 1000);

const statusOut: Record<AdRow['status'], AdStatus> = { ACTIVE: 'active', PAUSED: 'paused', PENDING_REVIEW: 'pending_review' };
const statusIn: Record<AdStatus, AdRow['status']> = { active: 'ACTIVE', paused: 'PAUSED', pending_review: 'PENDING_REVIEW' };

const toPublic = (r: AdRow): PublicAd => ({
  id: r.id,
  advertiserName: r.advertiserName,
  advertiserLogoUrl: r.advertiserLogoUrl,
  title: r.title,
  subtitle: r.subtitle,
  imageUrl: r.imageUrl,
  ctaText: r.ctaText,
  ctaUrl: r.ctaUrl,
  format: r.format as AdFormat, // validated on the way in
  accentColor: r.accentColor,
  darkMode: r.darkMode,
  isFallback: false,
});

function metricsOf(r: AdRow): AdMetrics {
  const spent = spentCents(r.impressions, r.cpmCents);
  return {
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.impressions > 0 ? Math.round((r.clicks / r.impressions) * 10_000) / 100 : 0,
    spend: spent / 100,
    remaining: r.budgetCents > 0 ? Math.max(0, r.budgetCents - spent) / 100 : 0,
  };
}

const toAdmin = (r: AdRow, now: Date): AdminAd => {
  const { isFallback: _unused, ...pub } = toPublic(r);
  return {
    ...pub,
    placements: r.placements as AdPlacement[],
    status: statusOut[r.status],
    expired: r.endsAt < now,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    budgetCents: r.budgetCents,
    cpmCents: r.cpmCents,
    metrics: metricsOf(r),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
};

export class AdService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The ad to show in a place: the most recently started campaign that is active, in its dates, includes the place and
   * still has budget left. SousChef's own ad when there is none.
   */
  async forPlacement(placement: AdPlacement): Promise<PublicAd> {
    const now = this.now();
    const hit = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Ad"
      WHERE "status" = 'ACTIVE'
        AND ${placement}::text = ANY("placements")
        AND "startsAt" <= ${now}::timestamptz AND "endsAt" >= ${now}::timestamptz
        AND ("budgetCents" = 0 OR ("impressions"::bigint * "cpmCents") / 1000 < "budgetCents")
      ORDER BY "startsAt" DESC, "id" DESC
      LIMIT 1`;
    const id = hit[0]?.id;
    if (!id) return FALLBACK_AD;
    const row = await this.db.ad.findUnique({ where: { id } });
    return row ? toPublic(row) : FALLBACK_AD;
  }

  /** Counts a view or a click, in the ad's total and in today's row. The fallback ad is not counted. */
  async record(id: string, kind: 'impression' | 'click'): Promise<void> {
    if (id === 'fallback') return;
    const day = this.now().toISOString().slice(0, 10);
    await this.db.$transaction(async (tx) => {
      const changed =
        kind === 'impression'
          ? await tx.$executeRaw`UPDATE "Ad" SET "impressions" = "impressions" + 1 WHERE "id" = ${id}::uuid`
          : await tx.$executeRaw`UPDATE "Ad" SET "clicks" = "clicks" + 1 WHERE "id" = ${id}::uuid`;
      if (changed === 0) throw errors.notFound('Ad not found');
      if (kind === 'impression') {
        await tx.$executeRaw`
          INSERT INTO "AdDay" ("adId", "day", "impressions", "clicks") VALUES (${id}::uuid, ${day}::date, 1, 0)
          ON CONFLICT ("adId", "day") DO UPDATE SET "impressions" = "AdDay"."impressions" + 1`;
      } else {
        await tx.$executeRaw`
          INSERT INTO "AdDay" ("adId", "day", "impressions", "clicks") VALUES (${id}::uuid, ${day}::date, 0, 1)
          ON CONFLICT ("adId", "day") DO UPDATE SET "clicks" = "AdDay"."clicks" + 1`;
      }
    });
  }

  /* ---- inquiries ---- */

  async submitInquiry(input: AdInquiryRequest): Promise<void> {
    await this.db.adInquiry.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        company: input.company,
        website: input.website ?? null,
        budget: input.budget,
        placements: input.placements,
        startDate: input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null,
        message: input.message,
      },
    });
  }

  /* ---- staff ---- */

  async listAll(): Promise<AdminAd[]> {
    const now = this.now();
    const rows = await this.db.ad.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 500 });
    // Active campaigns first, then the rest, each newest first.
    rows.sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'));
    return rows.map((r) => toAdmin(r, now));
  }

  async create(input: CreateAdRequest): Promise<AdminAd> {
    const row = await this.db.ad.create({
      data: {
        advertiserName: input.advertiserName,
        advertiserLogoUrl: input.advertiserLogoUrl ?? null,
        title: input.title,
        subtitle: input.subtitle,
        imageUrl: input.imageUrl,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
        placements: [...new Set(input.placements)],
        format: input.format,
        status: statusIn[input.status ?? 'active'],
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        budgetCents: input.budgetCents ?? 0,
        cpmCents: input.cpmCents ?? 0,
        accentColor: input.accentColor ?? null,
        darkMode: input.darkMode ?? false,
      },
    });
    return toAdmin(row, this.now());
  }

  async update(id: string, input: UpdateAdRequest): Promise<AdminAd> {
    const existing = await this.db.ad.findUnique({ where: { id }, select: { startsAt: true, endsAt: true } });
    if (!existing) throw errors.notFound('Ad not found');
    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (endsAt <= startsAt) throw errors.validation({ endsAt: 'The end must be after the start' });

    const data: Prisma.AdUpdateInput = { startsAt, endsAt };
    if (input.advertiserName !== undefined) data.advertiserName = input.advertiserName;
    if (input.advertiserLogoUrl !== undefined) data.advertiserLogoUrl = input.advertiserLogoUrl;
    if (input.title !== undefined) data.title = input.title;
    if (input.subtitle !== undefined) data.subtitle = input.subtitle;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.ctaText !== undefined) data.ctaText = input.ctaText;
    if (input.ctaUrl !== undefined) data.ctaUrl = input.ctaUrl;
    if (input.placements !== undefined) data.placements = [...new Set(input.placements)];
    if (input.format !== undefined) data.format = input.format;
    if (input.status !== undefined) data.status = statusIn[input.status];
    if (input.budgetCents !== undefined) data.budgetCents = input.budgetCents;
    if (input.cpmCents !== undefined) data.cpmCents = input.cpmCents;
    if (input.accentColor !== undefined) data.accentColor = input.accentColor;
    if (input.darkMode !== undefined) data.darkMode = input.darkMode;
    return toAdmin(await this.db.ad.update({ where: { id }, data }), this.now());
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.db.ad.deleteMany({ where: { id } });
    if (count === 0) throw errors.notFound('Ad not found');
  }

  /** Day-by-day counts for the last `days` days, oldest first, with quiet days included as zeros. */
  async dailyStats(id: string, days: number): Promise<AdDayStat[]> {
    if (!(await this.db.ad.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('Ad not found');
    const today = this.now().getTime();
    const from = new Date(Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), new Date(today).getUTCDate()) - (days - 1) * DAY_MS);
    const rows = await this.db.adDay.findMany({ where: { adId: id, day: { gte: from } } });
    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      const row = byDay.get(day);
      return { day, impressions: row?.impressions ?? 0, clicks: row?.clicks ?? 0 };
    });
  }

  async listInquiries(status: AdInquiryStatus | undefined, limit: number, cursor?: string): Promise<{ items: AdInquiry[]; nextCursor: string | null }> {
    const rows = await this.db.adInquiry.findMany({
      where: status ? { status: status.toUpperCase() as 'NEW' | 'CONTACTED' | 'ACTIVE' | 'DECLINED' } : {},
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map(toInquiry), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  async setInquiryStatus(id: string, status: AdInquiryStatus): Promise<AdInquiry> {
    const { count } = await this.db.adInquiry.updateMany({ where: { id }, data: { status: status.toUpperCase() as 'NEW' | 'CONTACTED' | 'ACTIVE' | 'DECLINED' } });
    if (count === 0) throw errors.notFound('Inquiry not found');
    return toInquiry(await this.db.adInquiry.findUniqueOrThrow({ where: { id } }));
  }
}

const toInquiry = (r: Prisma.AdInquiryGetPayload<object>): AdInquiry => ({
  id: r.id,
  name: r.name,
  email: r.email,
  company: r.company,
  website: r.website,
  budget: r.budget as AdInquiry['budget'],
  placements: r.placements as AdPlacement[],
  startDate: r.startDate?.toISOString().slice(0, 10) ?? null,
  message: r.message,
  status: r.status.toLowerCase() as AdInquiryStatus,
  submittedAt: r.submittedAt.toISOString(),
});
