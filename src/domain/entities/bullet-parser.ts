import type { BulletEntry, BulletType, Signifier, TaskState } from "./signifier";

// Parse a single line from a daily log into a BulletEntry
export function parseBulletLine(line: string): BulletEntry | null {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#")) return null; // skip headers & blanks

	const signifiers: Signifier[] = [];
	let working = trimmed;

	// Extract leading signifiers
	if (working.startsWith("! ")) {
		signifiers.push("priority");
		working = working.slice(2);
	}
	if (working.startsWith("* ")) {
		signifiers.push("inspiration");
		working = working.slice(2);
	}

	// Parse bullet type
	if (working.startsWith("- [ ] ")) {
		return buildEntry("task", "open", working.slice(6), signifiers);
	}
	if (working.startsWith("- [x] ")) {
		return buildEntry("task", "completed", working.slice(6), signifiers);
	}
	if (working.startsWith("- [>] ")) {
		return buildEntry("task", "migrated", working.slice(6), signifiers);
	}
	if (working.startsWith("- [<] ")) {
		return buildEntry("task", "scheduled", working.slice(6), signifiers);
	}
	if (working.startsWith("- [-] ")) {
		return buildEntry("task", "cancelled", working.slice(6), signifiers);
	}
	if (working.startsWith("- [o] ")) {
		return buildEntry("event", undefined, working.slice(6), signifiers);
	}
	if (working.startsWith("- ")) {
		return buildEntry("note", undefined, working.slice(2), signifiers);
	}

	return null; // unparseable line
}

// Serialize a BulletEntry back to a text line
export function serializeBullet(entry: BulletEntry): string {
	const parts: string[] = [];

	// Signifiers
	if (entry.signifiers.includes("priority")) parts.push("!");
	if (entry.signifiers.includes("inspiration")) parts.push("*");

	// Bullet
	if (entry.type === "task") {
		const stateMap: Record<TaskState, string> = {
			open: "[ ]",
			completed: "[x]",
			migrated: "[>]",
			scheduled: "[<]",
			cancelled: "[-]",
		};
		parts.push(`- ${stateMap[entry.state || "open"]} ${entry.content}`);
	} else if (entry.type === "event") {
		parts.push(`- [o] ${entry.content}`);
	} else {
		parts.push(`- ${entry.content}`);
	}

	return parts.join(" ");
}

function buildEntry(
	type: BulletType,
	state: TaskState | undefined,
	content: string,
	signifiers: Signifier[],
): BulletEntry {
	// Extract @person and #tags from content
	let person: string | undefined;
	const tags: string[] = [];

	const personMatch = content.match(/@(\w+)/);
	if (personMatch) person = personMatch[1];

	const tagMatches = content.matchAll(/#(\w+)/g);
	for (const m of tagMatches) tags.push(m[1]);

	return { type, state, signifiers, content, person, tags };
}
