// Cold start: Kit's behavior when its journal has little or no history.
//
// When the journal is mostly empty, naive AI prompts default to confused
// responses ("I'm not sure what you're looking for"). These rules give Kit
// a confident posture even with no context.

export interface ColdStartContext {
	readonly isNew: boolean;
	readonly daysSinceFirstEntry: number;
	readonly totalEntries: number;
}

export function detectColdStart(
	totalDailyLogs: number,
	firstEntryDate: Date | null,
	now: Date,
): ColdStartContext {
	let daysSinceFirst = firstEntryDate
		? Math.floor((now.getTime() - firstEntryDate.getTime()) / 86400000)
		: 0;

	return {
		isNew: totalDailyLogs < 3,
		daysSinceFirstEntry: daysSinceFirst,
		totalEntries: totalDailyLogs,
	};
}

export let COLD_START_RULES: readonly string[] = [
	"You are brand new. Your journal is mostly empty. That's fine.",
	"Never say 'I don't have context' or 'I'm not sure what you're looking for.'",
	"Always take action first. Store what you can, then confirm what you did.",
	"If a message is ambiguous, make your best guess and say what you assumed.",
	"You're building up your knowledge of this family. Every message is useful.",
	"Be confident and helpful, not confused and hand-wavy.",
	"Say 'I'm just getting started, but here's what I captured' — not 'Can you tell me more?'",
];
