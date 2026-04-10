import type { JournalPaths } from "@domain/entities/journal-path";
import type { InMemoryJournalRepository } from "./in-memory-impls";

// Deterministic fixture for "seeded" eval deps — a handful of real-looking
// journal entries so recall/status evals have something to answer from.
export function seedJournal(journal: InMemoryJournalRepository, paths: JournalPaths): void {
	let y = 2026;
	let m = 4;
	let d = 9;

	let daily = paths.dailyLog(y, m, d);
	journal.write(
		daily,
		[
			"# Thursday, April 9 2026",
			"",
			"- [x] Paid water bill",
			"- [ ] Call plumber about leaky sink",
			"- Trash day is Thursday",
			"- WiFi password: sunflower42",
			"- Plumber is Bob, 555-1234",
		].join("\n"),
		"seed",
	);

	let monthly = paths.monthlyLog(y, m);
	journal.write(
		monthly,
		["# April 2026", "", "- [o] Combatives belt test April 18th", "- Soccer Saturdays"].join("\n"),
		"seed",
	);

	let index = paths.index();
	journal.write(
		index,
		[
			"# Kit Index",
			"",
			"- trash day → Thursday",
			"- wifi password → sunflower42",
			"- plumber → Bob, 555-1234",
		].join("\n"),
		"seed",
	);
}
