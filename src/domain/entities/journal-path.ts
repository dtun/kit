// All paths are relative to the journal root prefix (configured in config.ts)
//
// Structure:
//   journal/index.txt
//   journal/future-log.txt
//   journal/2026/04/month.txt
//   journal/2026/04/07/daily.txt
//   journal/2026/04/07/edits.log

export interface JournalPaths {
	index(): string;
	futureLog(): string;
	monthlyLog(year: number, month: number): string;
	dailyLog(year: number, month: number, day: number): string;
	editLog(year: number, month: number, day: number): string;
	dailyDir(year: number, month: number, day: number): string;
	monthDir(year: number, month: number): string;
	yearDir(year: number): string;
}

// Implementation — pure function, no dependencies
export function createJournalPaths(rootPrefix: string): JournalPaths {
	const pad2 = (n: number): string => n.toString().padStart(2, "0");

	return {
		index: () => `${rootPrefix}index.txt`,
		futureLog: () => `${rootPrefix}future-log.txt`,
		monthlyLog: (y, m) => `${rootPrefix}${y}/${pad2(m)}/month.txt`,
		dailyLog: (y, m, d) => `${rootPrefix}${y}/${pad2(m)}/${pad2(d)}/daily.txt`,
		editLog: (y, m, d) => `${rootPrefix}${y}/${pad2(m)}/${pad2(d)}/edits.log`,
		dailyDir: (y, m, d) => `${rootPrefix}${y}/${pad2(m)}/${pad2(d)}/`,
		monthDir: (y, m) => `${rootPrefix}${y}/${pad2(m)}/`,
		yearDir: (y) => `${rootPrefix}${y}/`,
	};
}
