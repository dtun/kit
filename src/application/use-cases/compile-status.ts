import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { DateContext } from "@domain/entities/date-context";
import type { JournalPaths } from "@domain/entities/journal-path";
import { KIT_PERSONA } from "@domain/entities/persona";

export interface CompileStatusDeps {
	journal: IJournalRepository;
	ai: IAIService;
	paths: JournalPaths;
}

export async function compileStatus(
	deps: CompileStatusDeps,
	dateCtx: DateContext,
	memberName: string,
): Promise<string> {
	const { journal, ai, paths } = deps;
	const { year, month, day } = dateCtx;
	const sections: string[] = [];

	// 1. Today's log
	const todayLog = await journal.read(paths.dailyLog(year, month, day));
	if (todayLog) sections.push(`TODAY (${dateCtx.dayOfWeek}):\n${todayLog.content}`);

	// 2. Rest of this week (look ahead)
	for (let offset = 1; offset <= dateCtx.daysLeftInWeek; offset++) {
		const futureDate = new Date(year, month - 1, day + offset);
		const fy = futureDate.getFullYear();
		const fm = futureDate.getMonth() + 1;
		const fd = futureDate.getDate();
		const futurePath = paths.dailyLog(fy, fm, fd);
		const futureLog = await journal.read(futurePath);
		if (futureLog) {
			const label = futureDate.toLocaleString("en-US", { weekday: "long" });
			sections.push(`${label.toUpperCase()}:\n${futureLog.content}`);
		}
	}

	// 3. Monthly context
	const monthLog = await journal.read(paths.monthlyLog(year, month));
	if (monthLog) sections.push(`MONTHLY OVERVIEW:\n${monthLog.content}`);

	// 4. Future log
	const futureLog = await journal.read(paths.futureLog());
	if (futureLog) sections.push(`FUTURE LOG:\n${futureLog.content}`);

	// 5. Frame instruction based on day
	const frameInstruction = dateCtx.isSunday
		? "This is a SUNDAY status — frame it as a week-ahead preview. What's coming this week?"
		: dateCtx.isMonday
			? "This is a MONDAY status — frame it as a fresh start. What needs attention today?"
			: `This is a ${dateCtx.dayOfWeek} status — focus on today and remaining week.`;

	const journalContext =
		sections.join("\n\n---\n\n") || "The journal is empty — nothing logged yet.";

	const systemPrompt = [
		`You are ${KIT_PERSONA.name}. ${KIT_PERSONA.traits[0]}.`,
		"",
		frameInstruction,
		"",
		`Compile a status update for ${memberName} based on the journal below.`,
		"Structure: start with today, then upcoming, then anything overdue or noteworthy.",
		"If there are open tasks from previous days, flag them as overdue.",
		"",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		"",
		"Journal:",
		journalContext,
	].join("\n");

	return ai.complete(systemPrompt, `Give ${memberName} their ${dateCtx.dayOfWeek} status update.`);
}
