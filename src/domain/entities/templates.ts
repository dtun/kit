// Daily log template
export function dailyLogTemplate(date: Date, dayOfWeek: string): string {
	let year = date.getFullYear();
	let month = date.toLocaleString("en-US", { month: "long" });
	let day = date.getDate();

	return [
		`# ${dayOfWeek}, ${month} ${day}, ${year}`,
		"",
		"## Tasks",
		"",
		"## Events",
		"",
		"## Notes",
		"",
	].join("\n");
}

// Monthly log template
export function monthlyLogTemplate(year: number, monthName: string): string {
	return [
		`# ${monthName} ${year}`,
		"",
		"## Overview",
		"",
		"## Recurring",
		"",
		"## Goals",
		"",
		"## Reflection",
		"",
	].join("\n");
}

// Future log template
export function futureLogTemplate(startDate: Date, months: number): string {
	let lines: string[] = ["# Future Log", ""];

	for (let i = 0; i < months; i++) {
		let d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
		let label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
		lines.push(`## ${label}`, "", "");
	}

	return lines.join("\n");
}

// Index template
export function indexTemplate(): string {
	return [
		"# Kit Journal Index",
		"",
		"## People",
		"",
		"## Recurring",
		"",
		"## Collections",
		"",
		"## Tags",
		"",
	].join("\n");
}

// Edit log entry format
export function editLogLine(
	timestamp: string,
	action: string,
	path: string,
	reason: string,
): string {
	return `[${timestamp}] ${action.toUpperCase()} ${path} — ${reason}`;
}
