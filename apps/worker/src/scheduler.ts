export type CronFieldMatcher = (value: number) => boolean;

export type ParsedSchedule = {
  cron: string;
  timezone: string;
  minute: CronFieldMatcher;
  hour: CronFieldMatcher;
  dayOfMonth: CronFieldMatcher;
  month: CronFieldMatcher;
  dayOfWeek: CronFieldMatcher;
};

export type ScheduledContract = {
  contract_id: string;
  schedule: ParsedSchedule;
  next_run_at: Date;
};

export type ScheduledJob = {
  contract_id: string;
  scheduled_for: string;
  attempt?: number;
  retry_of_run_id?: string | null;
  next_eligible_at?: string | null;
};

const CRON_FIELD_BOUNDS: Array<[number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6]
];

export function parseCronSchedule(cron: string, timezone: string): ParsedSchedule {
  assertTimezone(timezone);

  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error("Cron must have exactly 5 fields: minute hour day month weekday.");
  }

  const [minuteField, hourField, dayField, monthField, weekDayField] = fields;

  return {
    cron,
    timezone,
    minute: compileFieldMatcher(minuteField, ...CRON_FIELD_BOUNDS[0]),
    hour: compileFieldMatcher(hourField, ...CRON_FIELD_BOUNDS[1]),
    dayOfMonth: compileFieldMatcher(dayField, ...CRON_FIELD_BOUNDS[2]),
    month: compileFieldMatcher(monthField, ...CRON_FIELD_BOUNDS[3]),
    dayOfWeek: compileFieldMatcher(weekDayField, ...CRON_FIELD_BOUNDS[4])
  };
}

export function computeNextRun(schedule: ParsedSchedule, from: Date): Date {
  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  for (let step = 0; step < 60 * 24 * 365; step += 1) {
    const parts = getZonedParts(candidate, schedule.timezone);

    if (
      schedule.minute(parts.minute) &&
      schedule.hour(parts.hour) &&
      schedule.dayOfMonth(parts.dayOfMonth) &&
      schedule.month(parts.month) &&
      schedule.dayOfWeek(parts.dayOfWeek)
    ) {
      return new Date(candidate.getTime());
    }

    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  throw new Error("Unable to compute next run within one year.");
}

export class DeterministicScheduler {
  private readonly schedules = new Map<string, ScheduledContract>();

  registerContract(contractId: string, cron: string, timezone: string, now: Date): ScheduledContract {
    const schedule = parseCronSchedule(cron, timezone);
    const nextRunAt = computeNextRun(schedule, now);

    const entry: ScheduledContract = {
      contract_id: contractId,
      schedule,
      next_run_at: nextRunAt
    };

    this.schedules.set(contractId, entry);
    return entry;
  }

  collectDueJobs(now: Date): ScheduledJob[] {
    const dueJobs: ScheduledJob[] = [];

    for (const schedule of this.schedules.values()) {
      if (schedule.next_run_at.getTime() <= now.getTime()) {
        dueJobs.push({
          contract_id: schedule.contract_id,
          scheduled_for: schedule.next_run_at.toISOString(),
          attempt: 1,
          retry_of_run_id: null,
          next_eligible_at: null
        });

        schedule.next_run_at = computeNextRun(schedule.schedule, now);
      }
    }

    return dueJobs;
  }

  unregisterContract(contractId: string): void {
    this.schedules.delete(contractId);
  }
}

function compileFieldMatcher(field: string, min: number, max: number): CronFieldMatcher {
  const segments = field.split(",");
  const values = new Set<number>();

  for (const segment of segments) {
    const trimmed = segment.trim();

    if (trimmed === "*") {
      for (let value = min; value <= max; value += 1) {
        values.add(value);
      }
      continue;
    }

    if (trimmed.startsWith("*/")) {
      const step = Number.parseInt(trimmed.slice(2), 10);
      if (Number.isNaN(step) || step <= 0) {
        throw new Error(`Invalid cron step segment: ${trimmed}`);
      }

      for (let value = min; value <= max; value += step) {
        values.add(value);
      }
      continue;
    }

    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);

      if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
        throw new Error(`Invalid cron range segment: ${trimmed}`);
      }

      assertRange(start, min, max);
      assertRange(end, min, max);

      for (let value = start; value <= end; value += 1) {
        values.add(value);
      }
      continue;
    }

    const exact = Number.parseInt(trimmed, 10);
    if (Number.isNaN(exact)) {
      throw new Error(`Invalid cron segment: ${trimmed}`);
    }

    assertRange(exact, min, max);
    values.add(exact);
  }

  return (value: number) => values.has(value);
}

function assertRange(value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new Error(`Cron value ${value} is out of range (${min}-${max}).`);
  }
}

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  const parts = formatter.formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((item) => item.type === type);
    if (!part) {
      throw new Error(`Missing datetime part: ${type}`);
    }
    return part.value;
  };

  const weekDayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    minute: Number.parseInt(get("minute"), 10),
    hour: Number.parseInt(get("hour"), 10),
    dayOfMonth: Number.parseInt(get("day"), 10),
    month: Number.parseInt(get("month"), 10),
    dayOfWeek: weekDayMap[get("weekday")]
  };
}
