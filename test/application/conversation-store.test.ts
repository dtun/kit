import type { ConversationTurn } from "@domain/entities/conversation-turn";
import { describe, expect, it } from "vitest";
import { InMemoryConversationStore } from "../helpers/mocks";

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
	return {
		role: "user",
		content: "hello",
		timestamp: new Date().toISOString(),
		memberName: "Danny",
		...overrides,
	};
}

describe("InMemoryConversationStore", () => {
	it("round-trips a turn via addTurn and getRecentTurns", async () => {
		const store = new InMemoryConversationStore();
		const turn = makeTurn({ content: "Remember the plumber is Bob" });

		await store.addTurn("danny@example.com", turn);
		const turns = await store.getRecentTurns("danny@example.com");

		expect(turns).toHaveLength(1);
		expect(turns[0].content).toBe("Remember the plumber is Bob");
	});

	it("respects the limit parameter", async () => {
		const store = new InMemoryConversationStore();

		for (let i = 0; i < 5; i++) {
			await store.addTurn("danny@example.com", makeTurn({ content: `msg ${i}` }));
		}

		const turns = await store.getRecentTurns("danny@example.com", 3);
		expect(turns).toHaveLength(3);
		// Should return the most recent 3
		expect(turns[0].content).toBe("msg 2");
		expect(turns[2].content).toBe("msg 4");
	});

	it("isolates turns by memberContact", async () => {
		const store = new InMemoryConversationStore();

		await store.addTurn("danny@example.com", makeTurn({ memberName: "Danny", content: "Danny's msg" }));
		await store.addTurn("ellen@example.com", makeTurn({ memberName: "Ellen", content: "Ellen's msg" }));

		const dannyTurns = await store.getRecentTurns("danny@example.com");
		const ellenTurns = await store.getRecentTurns("ellen@example.com");

		expect(dannyTurns).toHaveLength(1);
		expect(dannyTurns[0].content).toBe("Danny's msg");
		expect(ellenTurns).toHaveLength(1);
		expect(ellenTurns[0].content).toBe("Ellen's msg");
	});

	it("clears turns for a specific member only", async () => {
		const store = new InMemoryConversationStore();

		await store.addTurn("danny@example.com", makeTurn({ content: "Danny's msg" }));
		await store.addTurn("ellen@example.com", makeTurn({ content: "Ellen's msg" }));

		await store.clear("danny@example.com");

		const dannyTurns = await store.getRecentTurns("danny@example.com");
		const ellenTurns = await store.getRecentTurns("ellen@example.com");

		expect(dannyTurns).toHaveLength(0);
		expect(ellenTurns).toHaveLength(1);
	});
});
