import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
import { createDateContext } from "@domain/entities/date-context";
import { DEFAULT_DIGEST_PREFERENCES } from "@domain/entities/digest-preferences";
import type { Channel, FamilyMember } from "@domain/entities/family-member";
import type { JournalPaths } from "@domain/entities/journal-path";
import { archiveOldEntries } from "./archive-old-entries";
import { createDailyLog } from "./create-daily-log";
import { migrateTasks } from "./migrate-tasks";
import { rollMonthForward } from "./roll-month-forward";
import { sendDigest } from "./send-digest";

export interface RunMorningRoutineDeps {
	journal: IJournalRepository;
	ai: IAIService;
	gateways: Record<Channel, IMessageGateway>;
	paths: JournalPaths;
	familyMembers: readonly FamilyMember[];
}

export interface MorningRoutineResult {
	readonly dailyLogCreated: boolean;
	readonly tasksMigrated: number;
	readonly entriesArchived: number;
	readonly digestsSent: string[];
	readonly monthRolled: boolean;
	readonly errors: string[];
}

export async function runMorningRoutine(
	deps: RunMorningRoutineDeps,
): Promise<MorningRoutineResult> {
	const now = new Date();
	const dateCtx = createDateContext(now);
	const errors: string[] = [];

	// 1. Roll month forward if first of month
	const monthRecords = await rollMonthForward(
		{ journal: deps.journal, paths: deps.paths },
		dateCtx,
	).catch((err) => {
		errors.push(`Month roll: ${err}`);
		return [];
	});

	// 2. Create today's daily log
	const dailyRecord = await createDailyLog({ journal: deps.journal, paths: deps.paths }, now).catch(
		(err) => {
			errors.push(`Daily log: ${err}`);
			return null;
		},
	);

	// 3. Migrate yesterday's open tasks
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const migrationResult = await migrateTasks(
		{ journal: deps.journal, paths: deps.paths },
		yesterday,
		now,
	).catch((err) => {
		errors.push(`Migration: ${err}`);
		return null;
	});

	// 4. Archive old entries (weekly — only run on Sundays to save compute)
	let archiveResult = null;
	if (dateCtx.isSunday) {
		archiveResult = await archiveOldEntries(
			{ journal: deps.journal, ai: deps.ai, paths: deps.paths },
			now,
		).catch((err) => {
			errors.push(`Archive: ${err}`);
			return null;
		});
	}

	// 5. Send morning digest to family
	const digestResult = await sendDigest(
		{
			journal: deps.journal,
			ai: deps.ai,
			gateways: deps.gateways,
			paths: deps.paths,
		},
		deps.familyMembers,
		DEFAULT_DIGEST_PREFERENCES,
		dateCtx,
		migrationResult || undefined,
	).catch((err) => {
		errors.push(`Digest: ${err}`);
		return { sentTo: [] as string[], skipped: [] as string[] };
	});

	return {
		dailyLogCreated: dailyRecord?.action === "create",
		tasksMigrated: migrationResult?.migrated.length || 0,
		entriesArchived: archiveResult?.archived.length || 0,
		digestsSent: digestResult.sentTo,
		monthRolled: monthRecords.length > 0,
		errors,
	};
}
