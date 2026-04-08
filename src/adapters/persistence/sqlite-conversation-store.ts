import type { IConversationStore } from "@application/ports/conversation-store";
import type { ConversationTurn } from "@domain/entities/conversation-turn";

export class SqliteConversationStore implements IConversationStore {
	private sql: SqlStorage;

	constructor(sql: SqlStorage) {
		this.sql = sql;
		this.initialize();
	}

	private initialize() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS conversation_turns (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				member_contact TEXT NOT NULL,
				role TEXT NOT NULL,
				content TEXT NOT NULL,
				member_name TEXT NOT NULL,
				intent TEXT,
				timestamp TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_turns_member
			ON conversation_turns(member_contact, created_at DESC)
		`);
	}

	async addTurn(memberContact: string, turn: ConversationTurn): Promise<void> {
		this.sql.exec(
			`INSERT INTO conversation_turns (member_contact, role, content, member_name, intent, timestamp)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			memberContact,
			turn.role,
			turn.content,
			turn.memberName,
			turn.intent || null,
			turn.timestamp,
		);

		// Keep only last 50 turns per member
		this.sql.exec(
			`DELETE FROM conversation_turns
			 WHERE member_contact = ?
			 AND id NOT IN (
				 SELECT id FROM conversation_turns
				 WHERE member_contact = ?
				 ORDER BY created_at DESC
				 LIMIT 50
			 )`,
			memberContact,
			memberContact,
		);
	}

	async getRecentTurns(memberContact: string, limit = 10): Promise<ConversationTurn[]> {
		const result = this.sql.exec(
			`SELECT role, content, member_name, intent, timestamp
			 FROM conversation_turns
			 WHERE member_contact = ?
			 ORDER BY created_at DESC
			 LIMIT ?`,
			memberContact,
			limit,
		);

		return [...result].reverse().map((row) => ({
			role: row.role as "user" | "kit",
			content: row.content as string,
			memberName: row.member_name as string,
			intent: row.intent as string | undefined,
			timestamp: row.timestamp as string,
		}));
	}

	async clear(memberContact: string): Promise<void> {
		this.sql.exec("DELETE FROM conversation_turns WHERE member_contact = ?", memberContact);
	}
}
