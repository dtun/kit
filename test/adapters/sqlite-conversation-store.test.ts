import { SqliteConversationStore } from "@adapters/persistence/sqlite-conversation-store";
import type { ConversationTurn } from "@domain/entities/conversation-turn";
import { describe, expect, it, vi } from "vitest";

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
	return {
		role: "user",
		content: "hello",
		timestamp: new Date().toISOString(),
		memberName: "Danny",
		...overrides,
	};
}

/**
 * Minimal mock of Cloudflare's SqlStorage interface.
 * Tracks exec calls and allows configuring query results.
 */
function createMockSqlStorage() {
	const rows: Record<string, unknown>[] = [];
	let insertedRows: Record<string, unknown>[] = [];

	return {
		exec: vi.fn().mockImplementation((...args: unknown[]) => {
			const sql = (args[0] as string).trim();
			if (sql.startsWith("INSERT")) {
				insertedRows.push({
					member_contact: args[1],
					role: args[2],
					content: args[3],
					member_name: args[4],
					intent: args[5],
					timestamp: args[6],
				});
				return { toArray: () => [] };
			}
			if (sql.startsWith("SELECT")) {
				// Return in DESC order (most recent first) to match real SQL behavior
				const memberContact = args[1];
				const limit = args[2] as number;
				const filtered = insertedRows
					.filter((r) => r.member_contact === memberContact)
					.slice(-limit)
					.reverse();
				return {
					[Symbol.iterator]: function* () {
						for (const row of filtered) {
							yield row;
						}
					},
				};
			}
			if (sql.startsWith("DELETE FROM conversation_turns")) {
				// Pruning or clear
				if (sql.includes("NOT IN")) {
					// Pruning — keep last 50
					const memberContact = args[1];
					const filtered = insertedRows.filter((r) => r.member_contact === memberContact);
					if (filtered.length > 50) {
						const toKeep = filtered.slice(-50);
						insertedRows = [
							...insertedRows.filter((r) => r.member_contact !== memberContact),
							...toKeep,
						];
					}
				} else {
					// Clear for specific member
					const memberContact = args[1];
					insertedRows = insertedRows.filter((r) => r.member_contact !== memberContact);
				}
				return { toArray: () => [] };
			}
			// CREATE TABLE, CREATE INDEX — no-op
			return { toArray: () => [] };
		}),
		_getInsertedRows: () => insertedRows,
	};
}

describe("SqliteConversationStore", () => {
	it("creates the table on construction", () => {
		const sql = createMockSqlStorage();
		new SqliteConversationStore(sql as unknown as SqlStorage);

		const calls = sql.exec.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
		expect(
			calls.some((c: string) => c.includes("CREATE TABLE IF NOT EXISTS conversation_turns")),
		).toBe(true);
		expect(calls.some((c: string) => c.includes("CREATE INDEX IF NOT EXISTS"))).toBe(true);
	});

	it("inserts a turn with correct values", async () => {
		const sql = createMockSqlStorage();
		const store = new SqliteConversationStore(sql as unknown as SqlStorage);

		const turn = makeTurn({ content: "Remember the plumber", intent: "remember" });
		await store.addTurn("danny@example.com", turn);

		const inserted = sql._getInsertedRows();
		expect(inserted).toHaveLength(1);
		expect(inserted[0].member_contact).toBe("danny@example.com");
		expect(inserted[0].content).toBe("Remember the plumber");
		expect(inserted[0].role).toBe("user");
		expect(inserted[0].intent).toBe("remember");
	});

	it("retrieves turns in chronological order", async () => {
		const sql = createMockSqlStorage();
		const store = new SqliteConversationStore(sql as unknown as SqlStorage);

		await store.addTurn("danny@example.com", makeTurn({ content: "first" }));
		await store.addTurn("danny@example.com", makeTurn({ content: "second" }));
		await store.addTurn("danny@example.com", makeTurn({ content: "third" }));

		const turns = await store.getRecentTurns("danny@example.com", 10);

		expect(turns).toHaveLength(3);
		expect(turns[0].content).toBe("first");
		expect(turns[2].content).toBe("third");
	});

	it("clears turns for a member", async () => {
		const sql = createMockSqlStorage();
		const store = new SqliteConversationStore(sql as unknown as SqlStorage);

		await store.addTurn("danny@example.com", makeTurn({ content: "msg" }));
		await store.clear("danny@example.com");

		const turns = await store.getRecentTurns("danny@example.com", 10);
		expect(turns).toHaveLength(0);
	});
});
