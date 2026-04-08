export interface DateContext {
	readonly now: Date;
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly dayOfWeek: string;
	readonly isWeekend: boolean;
	readonly isSunday: boolean;
	readonly isMonday: boolean;
	readonly isFirstOfMonth: boolean;
	readonly daysLeftInWeek: number;
	readonly weekNumber: number;
}

export function createDateContext(now: Date): DateContext {
	const dayOfWeekIndex = now.getDay(); // 0=Sun, 6=Sat
	const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

	// Days until end of week (Saturday)
	let daysLeftInWeek = 6 - dayOfWeekIndex;
	if (dayOfWeekIndex === 0) daysLeftInWeek = 6; // Sunday = full week ahead

	// ISO 8601 week number: find the Thursday of this week, then count weeks from Jan 1 of that year
	const thursday = new Date(now.getTime());
	thursday.setDate(thursday.getDate() + (4 - (now.getDay() || 7)));
	const yearStart = new Date(thursday.getFullYear(), 0, 1);
	const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

	return {
		now,
		year: now.getFullYear(),
		month: now.getMonth() + 1,
		day: now.getDate(),
		dayOfWeek: dayNames[dayOfWeekIndex],
		isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
		isSunday: dayOfWeekIndex === 0,
		isMonday: dayOfWeekIndex === 1,
		isFirstOfMonth: now.getDate() === 1,
		daysLeftInWeek,
		weekNumber,
	};
}
