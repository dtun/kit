import type { IJournalRepository } from "@application/ports/journal-repository";
import { parseBulletLine, serializeBullet } from "@domain/entities/bullet-parser";
import type { DateContext } from "@domain/entities/date-context";
import type { JournalPaths } from "@domain/entities/journal-path";

export interface BuildBulletDigestDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
}

const OVERDUE_LOOKBACK_DAYS = 7;
const WEEKDAY_NAMES = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];
const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export async function buildBulletDigest(
	deps: BuildBulletDigestDeps,
	dateCtx: DateContext,
): Promise<string> {
	let { journal, paths } = deps;
	let { year, month, day } = dateCtx;

	let sections: string[] = [];

	let todayEntry = await journal.read(paths.dailyLog(year, month, day));
	if (todayEntry) {
		sections.push(`## today\n${todayEntry.content.trim()}`);
	}

	for (let offset = 1; offset <= dateCtx.daysLeftInWeek; offset++) {
		let futureDate = new Date(year, month - 1, day + offset);
		let fy = futureDate.getFullYear();
		let fm = futureDate.getMonth() + 1;
		let fd = futureDate.getDate();
		let entry = await journal.read(paths.dailyLog(fy, fm, fd));
		if (entry) {
			let label = WEEKDAY_NAMES[futureDate.getDay()];
			sections.push(`## ${label}\n${entry.content.trim()}`);
		}
	}

	let overdue = await collectOverdueTasks(journal, paths, dateCtx);
	if (overdue.length > 0) {
		sections.push(`## overdue\n${overdue.join("\n")}`);
	}

	if (dateCtx.isSunday) {
		let monthEntry = await journal.read(paths.monthlyLog(year, month));
		if (monthEntry) {
			sections.push(`## this month\n${monthEntry.content.trim()}`);
		}
		let futureEntry = await journal.read(paths.futureLog());
		if (futureEntry) {
			sections.push(`## future log\n${futureEntry.content.trim()}`);
		}
	}

	if (sections.length === 0) return "";

	let header = `---\n\njournal\n\n# ${dateCtx.dayOfWeek}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
	return `${header}\n\n${sections.join("\n\n")}`;
}

async function collectOverdueTasks(
	journal: IJournalRepository,
	paths: JournalPaths,
	dateCtx: DateContext,
): Promise<string[]> {
	let { year, month, day } = dateCtx;
	let results: string[] = [];

	for (let offset = 1; offset <= OVERDUE_LOOKBACK_DAYS; offset++) {
		let pastDate = new Date(year, month - 1, day - offset);
		let py = pastDate.getFullYear();
		let pm = pastDate.getMonth() + 1;
		let pd = pastDate.getDate();
		let entry = await journal.read(paths.dailyLog(py, pm, pd));
		if (!entry) continue;

		let sourceLabel = `${MONTH_NAMES[pm - 1]} ${pd}`;
		for (let line of entry.content.split("\n")) {
			let bullet = parseBulletLine(line);
			if (!bullet) continue;
			if (bullet.type !== "task") continue;
			if (bullet.state !== "open") continue;
			results.push(`${serializeBullet(bullet)} (from ${sourceLabel})`);
		}
	}

	return results;
}
