import type { IntentType } from "@domain/entities/intent";

export interface IntentTestCase {
	input: string;
	expected: {
		intent: IntentType;
		shouldExtract?: {
			content?: string;
			date?: string;
			person?: string;
			category?: string;
		};
	};
	tags?: string[];
}

export let intentDataset: IntentTestCase[] = [
	// --- REMEMBER ---
	{
		input: "Remember that trash day is Thursday",
		expected: {
			intent: "remember",
			shouldExtract: { content: "trash day is Thursday" },
		},
		tags: ["remember", "basic"],
	},
	{
		input: "The WiFi password is sunflower42",
		expected: {
			intent: "remember",
			shouldExtract: { content: "WiFi password is sunflower42" },
		},
		tags: ["remember", "no-verb"],
	},
	{
		input: "Plumber is Bob, 555-1234",
		expected: {
			intent: "remember",
			shouldExtract: { content: "Plumber is Bob, 555-1234", person: "Bob" },
		},
		tags: ["remember", "contact"],
	},
	{
		input: "Note this date for me!",
		expected: { intent: "remember" },
		tags: ["remember", "forward-instruction"],
	},
	{
		input: "Soccer Saturday",
		expected: { intent: "remember" },
		tags: ["remember", "terse"],
	},
	{
		input: "Dentist 3pm Thursday for the kid",
		expected: { intent: "remember" },
		tags: ["remember", "no-verb"],
	},

	// --- RECALL ---
	{
		input: "What's the plumber's number?",
		expected: { intent: "recall", shouldExtract: { content: "plumber" } },
		tags: ["recall", "basic"],
	},
	{
		input: "When is trash day?",
		expected: { intent: "recall", shouldExtract: { content: "trash day" } },
		tags: ["recall", "basic"],
	},
	{
		input: "What did I tell you about the dentist?",
		expected: { intent: "recall", shouldExtract: { content: "dentist" } },
		tags: ["recall", "past-reference"],
	},

	// --- TASK ---
	{
		input: "Add call the dentist to my list",
		expected: { intent: "task", shouldExtract: { content: "call the dentist" } },
		tags: ["task", "basic"],
	},
	{
		input: "Remind me to buy milk Friday",
		expected: { intent: "task", shouldExtract: { content: "buy milk", date: "Friday" } },
		tags: ["task", "with-date"],
	},
	{
		input: "I need to fix the fence",
		expected: { intent: "task", shouldExtract: { content: "fix the fence" } },
		tags: ["task", "implicit"],
	},

	// --- STATUS ---
	{
		input: "What's this week look like?",
		expected: { intent: "status" },
		tags: ["status", "basic"],
	},
	{
		input: "Give me a daily update",
		expected: { intent: "status" },
		tags: ["status", "basic"],
	},
	{
		input: "What's up?",
		expected: { intent: "status" },
		tags: ["status", "casual"],
	},
	{
		input: "Hey Kit what's today like?",
		expected: { intent: "status" },
		tags: ["status", "casual"],
	},

	// --- GREETING ---
	{
		input: "Hey Kit",
		expected: { intent: "greeting" },
		tags: ["greeting"],
	},
	{
		input: "Thanks!",
		expected: { intent: "greeting" },
		tags: ["greeting"],
	},
	{
		input: "Good morning",
		expected: { intent: "greeting" },
		tags: ["greeting"],
	},

	// --- LIST ---
	{
		input: "Add milk and eggs to the grocery list",
		expected: { intent: "list_add", shouldExtract: { category: "grocery" } },
		tags: ["list", "add"],
	},
	{
		input: "Put laundry detergent on the grocery list",
		expected: { intent: "list_add", shouldExtract: { category: "grocery" } },
		tags: ["list", "add"],
	},
	{
		input: "Show me the grocery list",
		expected: { intent: "list_view", shouldExtract: { category: "grocery" } },
		tags: ["list", "view"],
	},
	{
		input: "What's on my todo list?",
		expected: { intent: "list_view", shouldExtract: { category: "todo" } },
		tags: ["list", "view"],
	},
	{
		input: "Clear the grocery list",
		expected: { intent: "list_clear", shouldExtract: { category: "grocery" } },
		tags: ["list", "clear"],
	},

	// --- EDIT HISTORY ---
	{
		input: "What changes did you make today?",
		expected: { intent: "edit_history" },
		tags: ["edit_history"],
	},
	{
		input: "Show me your edits",
		expected: { intent: "edit_history" },
		tags: ["edit_history"],
	},
];
