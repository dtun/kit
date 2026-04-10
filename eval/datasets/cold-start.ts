export interface ColdStartTestCase {
	input: string;
	journalState: "empty" | "minimal";
	expected: {
		shouldNotContain: string[];
		shouldContain: string[];
	};
}

let UNIVERSAL_BANNED = [
	"I'm not sure what you're looking for",
	"Can you tell me a bit more",
	"I don't have any context",
	"could you clarify",
];

export let coldStartDataset: ColdStartTestCase[] = [
	{
		input: "Hey Kit what's up, what's today like?",
		journalState: "empty",
		expected: {
			shouldNotContain: UNIVERSAL_BANNED,
			shouldContain: ["— Kit"],
		},
	},
	{
		input: "Kit?",
		journalState: "empty",
		expected: {
			shouldNotContain: ["I'm not sure what you're looking for", "Can you tell me more"],
			shouldContain: ["— Kit"],
		},
	},
	{
		input: "What do I have going on?",
		journalState: "empty",
		expected: {
			shouldNotContain: ["I don't have any context", "Can you tell me"],
			shouldContain: ["— Kit"],
		},
	},
	{
		input: "Remind me what I told you about the plumber",
		journalState: "empty",
		expected: {
			shouldNotContain: UNIVERSAL_BANNED,
			shouldContain: ["— Kit"],
		},
	},
	{
		input: "Good morning Kit",
		journalState: "empty",
		expected: {
			shouldNotContain: UNIVERSAL_BANNED,
			shouldContain: ["— Kit"],
		},
	},
];
