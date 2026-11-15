import { randomUUID } from 'node:crypto';
import {
  buildDoctorReport,
  mealResponseFor,
  READING_LIMITS,
  type CreateMealRequest,
  type CreateReadingRequest,
  type DoctorReport,
  type GlucoseTiming,
  type HealthConsentState,
  type HealthExport,
  type HealthReading,
  type MealLog,
  type MealResponse,
  type HealthMealType,
  type ReadingKind,
  type ReadingSource,
  type ReadingsPage,
  type ReportRange,
} from '@shared';
import type { Db } from '../db';
import { errors } from '../errors';
import type { HealthCipher } from './crypto';

const MAX_PER_USER = 50_000;
const MAX_REPORT_ROWS = 5_000;
const MAX_PAGE = 200;
const FIVE_YEARS_MS = 5 * 365 * 86_400_000;

type Numbers = { mmol: number; timing: GlucoseTiming } | { systolic: number; diastolic: number } | { ldl: number };
type MealNumbers = Omit<MealLog, 'id' | 'at'>;
const label = (userId: string, id: string) => `${userId}:${id}`;

/**
 * Health readings and meals. Everything here needs the person's health consent, is only ever read back by its owner, and
 * keeps the numbers encrypted in the database. Only the kind and the time stay readable, so lists can be cut by date.
 */
export class VitalsService {
  constructor(
    private readonly db: Db,
    private readonly cipher: HealthCipher | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /* ------------------------------------------------------------------ consent */

  async consent(userId: string): Promise<HealthConsentState> {
    const row = await this.db.consent.findFirst({ where: { userId, kind: 'HEALTH', withdrawnAt: null }, orderBy: { grantedAt: 'desc' } });
    return { granted: row !== null, version: row?.version ?? null, grantedAt: row?.grantedAt.toISOString() ?? null };
  }

  async grantConsent(userId: string, version: string): Promise<HealthConsentState> {
    this.needCipher();
    const current = await this.consent(userId);
    if (current.granted && current.version === version) return current;
    await this.db.$transaction([
      this.db.consent.updateMany({ where: { userId, kind: 'HEALTH', withdrawnAt: null }, data: { withdrawnAt: this.now() } }),
      this.db.consent.create({ data: { userId, kind: 'HEALTH', version, grantedAt: this.now() } }),
    ]);
    return this.consent(userId);
  }

  /** Stops all access to health data. The stored data stays (encrypted) until the person erases it. */
  async withdrawConsent(userId: string): Promise<HealthConsentState> {
    await this.db.consent.updateMany({ where: { userId, kind: 'HEALTH', withdrawnAt: null }, data: { withdrawnAt: this.now() } });
    return this.consent(userId);
  }

  /* ------------------------------------------------------------------ readings */

  async addReading(userId: string, req: CreateReadingRequest): Promise<HealthReading> {
    await this.ready(userId);
    const at = this.checkTime(req.at);
    this.checkNumbers(req);
    await this.checkRoom(userId);
    if (req.mealId && !(await this.db.healthMeal.findFirst({ where: { id: req.mealId, userId }, select: { id: true } }))) {
      throw errors.validation({ mealId: 'That meal was not found' });
    }
    const id = randomUUID();
    const source: ReadingSource = req.source ?? 'manual';
    const row = { id, userId, kind: req.kind, at, source, mealId: req.mealId ?? null, payload: this.sealed(userId, id, numbersOf(req)) };
    await this.db.healthReading.create({ data: row });
    return this.readingFrom(row);
  }

  async listReadings(userId: string, q: { from?: string; to?: string; kind?: ReadingKind; limit?: number; cursor?: string }): Promise<ReadingsPage> {
    await this.ready(userId);
    const limit = Math.min(MAX_PAGE, Math.max(1, q.limit ?? 50));
    const cursor = q.cursor ? parseCursor(q.cursor) : null;
    const rows = await this.db.healthReading.findMany({
      where: {
        userId,
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.from || q.to ? { at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
        ...(cursor ? { OR: [{ at: { lt: cursor.at } }, { at: cursor.at, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { items: page.map((r) => this.readingFrom(r)), nextCursor: rows.length > limit && last ? makeCursor(last.at, last.id) : null };
  }

  async deleteReading(userId: string, id: string): Promise<void> {
    await this.ready(userId);
    const done = await this.db.healthReading.deleteMany({ where: { id, userId } });
    if (done.count === 0) throw errors.notFound('Reading not found');
  }

  /* ------------------------------------------------------------------ meals */

  async addMeal(userId: string, req: CreateMealRequest): Promise<MealLog> {
    await this.ready(userId);
    const at = this.checkTime(req.at);
    await this.checkRoom(userId);
    const id = randomUUID();
    const numbers: MealNumbers = mealNumbers(req);
    await this.db.healthMeal.create({ data: { id, userId, at, payload: Uint8Array.from(this.needCipher().seal(numbers, label(userId, id))) } });
    return { id, at: at.toISOString(), ...numbers };
  }

  async listMeals(userId: string, q: { from?: string; to?: string; limit?: number }): Promise<MealLog[]> {
    await this.ready(userId);
    const rows = await this.db.healthMeal.findMany({
      where: { userId, ...(q.from || q.to ? { at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}) },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: Math.min(MAX_PAGE, Math.max(1, q.limit ?? 50)),
    });
    return rows.map((r) => this.mealFrom(r));
  }

  async deleteMeal(userId: string, id: string): Promise<void> {
    await this.ready(userId);
    const done = await this.db.healthMeal.deleteMany({ where: { id, userId } }); // its readings stay, unlinked
    if (done.count === 0) throw errors.notFound('Meal not found');
  }

  /** The rise after a meal, from its readings, next to how similar meals went. */
  async mealResponse(userId: string, id: string): Promise<MealResponse> {
    await this.ready(userId);
    const row = await this.db.healthMeal.findFirst({ where: { id, userId } });
    if (!row) throw errors.notFound('Meal not found');
    const meal = this.mealFrom(row);
    const group = await this.db.healthMeal.findMany({ where: { userId }, orderBy: { at: 'desc' }, take: MAX_REPORT_ROWS });
    const meals = group.map((m) => this.mealFrom(m));
    const readings = (await this.db.healthReading.findMany({ where: { userId, kind: 'glucose', mealId: { not: null } }, orderBy: { at: 'desc' }, take: MAX_REPORT_ROWS })).map((r) => this.readingFrom(r));
    return mealResponseFor(meal, readings, meals);
  }

  /* ------------------------------------------------------------------ report, export, erase */

  async report(userId: string, range: ReportRange): Promise<DoctorReport> {
    await this.ready(userId);
    const now = this.now();
    const from = new Date(now.getTime() - { '2w': 14, '30d': 30, '90d': 90 }[range] * 86_400_000);
    const [readings, meals] = await Promise.all([
      this.db.healthReading.findMany({ where: { userId, at: { gte: from, lte: now } }, orderBy: { at: 'desc' }, take: MAX_REPORT_ROWS }),
      this.db.healthMeal.findMany({ where: { userId, at: { gte: from, lte: now } }, orderBy: { at: 'desc' }, take: MAX_REPORT_ROWS }),
    ]);
    return buildDoctorReport(range, readings.map((r) => this.readingFrom(r)), meals.map((m) => this.mealFrom(m)), now);
  }

  /** Everything stored for the person, readable, so they can take it with them. */
  async export(userId: string): Promise<HealthExport> {
    await this.ready(userId);
    const [readings, meals] = await Promise.all([
      this.db.healthReading.findMany({ where: { userId }, orderBy: [{ at: 'asc' }, { id: 'asc' }] }),
      this.db.healthMeal.findMany({ where: { userId }, orderBy: [{ at: 'asc' }, { id: 'asc' }] }),
    ]);
    return { exportedAt: this.now().toISOString(), readings: readings.map((r) => this.readingFrom(r)), meals: meals.map((m) => this.mealFrom(m)) };
  }

  /** Deletes every reading and meal. Allowed after withdrawing consent, so people can always remove their data. */
  async erase(userId: string): Promise<{ readings: number; meals: number }> {
    const [readings, meals] = await this.db.$transaction([this.db.healthReading.deleteMany({ where: { userId } }), this.db.healthMeal.deleteMany({ where: { userId } })]);
    return { readings: readings.count, meals: meals.count };
  }

  /* ------------------------------------------------------------------ helpers */

  private needCipher(): HealthCipher {
    if (!this.cipher) throw errors.notConfigured('Health tracking is not set up on this server');
    return this.cipher;
  }

  private async ready(userId: string): Promise<void> {
    this.needCipher();
    if (!(await this.consent(userId)).granted) throw errors.consentRequired('health');
  }

  private checkTime(iso: string): Date {
    const at = new Date(iso);
    const now = this.now().getTime();
    if (Number.isNaN(at.getTime()) || at.getTime() > now + 5 * 60_000 || at.getTime() < now - FIVE_YEARS_MS) throw errors.validation({ at: 'That time is not valid' });
    return at;
  }

  private checkNumbers(req: CreateReadingRequest): void {
    const bad = (field: string) => errors.validation({ [field]: 'That number is outside what a reading can be' });
    const out = (n: number, r: { min: number; max: number }) => !Number.isFinite(n) || n < r.min || n > r.max;
    if (req.kind === 'glucose' && out(req.mmol, READING_LIMITS.mmol)) throw bad('mmol');
    if (req.kind === 'bp') {
      if (out(req.systolic, READING_LIMITS.systolic)) throw bad('systolic');
      if (out(req.diastolic, READING_LIMITS.diastolic)) throw bad('diastolic');
      if (req.diastolic >= req.systolic) throw errors.validation({ diastolic: 'The lower number must be lower' });
    }
    if (req.kind === 'cholesterol' && out(req.ldl, READING_LIMITS.ldl)) throw bad('ldl');
  }

  private async checkRoom(userId: string): Promise<void> {
    const [a, b] = await Promise.all([this.db.healthReading.count({ where: { userId } }), this.db.healthMeal.count({ where: { userId } })]);
    if (a + b >= MAX_PER_USER) throw errors.limitReached('You have reached the most health entries we can keep. Delete some old ones first');
  }

  private sealed(userId: string, id: string, numbers: Numbers): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.needCipher().seal(numbers, label(userId, id)));
  }

  private readingFrom(r: { id: string; userId: string; kind: string; at: Date; source: string; mealId: string | null; payload: Uint8Array }): HealthReading {
    const n = this.needCipher().open<Numbers>(r.payload, label(r.userId, r.id));
    const base = { id: r.id, at: r.at.toISOString(), source: r.source as ReadingSource, ...(r.mealId ? { mealId: r.mealId } : {}) };
    if (r.kind === 'glucose') return { ...base, kind: 'glucose', ...(n as { mmol: number; timing: GlucoseTiming }) };
    if (r.kind === 'bp') return { ...base, kind: 'bp', ...(n as { systolic: number; diastolic: number }) };
    return { ...base, kind: 'cholesterol', ...(n as { ldl: number }) };
  }

  private mealFrom(r: { id: string; userId: string; at: Date; payload: Uint8Array }): MealLog {
    return { id: r.id, at: r.at.toISOString(), ...this.needCipher().open<MealNumbers>(r.payload, label(r.userId, r.id)) };
  }
}

function numbersOf(req: CreateReadingRequest): Numbers {
  if (req.kind === 'glucose') return { mmol: req.mmol, timing: req.timing };
  if (req.kind === 'bp') return { systolic: req.systolic, diastolic: req.diastolic };
  return { ldl: req.ldl };
}

function mealNumbers(req: CreateMealRequest): MealNumbers {
  const mealType: HealthMealType = req.mealType;
  return {
    title: req.title,
    mealType,
    carbsG: req.carbsG,
    portionLabel: req.portionLabel,
    group: req.group,
    ...(req.variant ? { variant: req.variant } : {}),
  };
}

const makeCursor = (at: Date, id: string): string => Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
function parseCursor(cursor: string): { at: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const at = new Date(iso ?? '');
  if (!id || Number.isNaN(at.getTime())) throw errors.validation({ cursor: 'That page marker is not valid' });
  return { at, id };
}
