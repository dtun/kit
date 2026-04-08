// Bullet types — the core entry classification
export type BulletType = "task" | "event" | "note";

// Task states — a task bullet transitions through these
export type TaskState = "open" | "completed" | "migrated" | "scheduled" | "cancelled";

// Signifiers — additional context placed before the bullet
export type Signifier = "priority" | "inspiration" | "person" | "tag";

// How they render in text files:
//
// BULLETS:
//   • Task (open)           → "- [ ] Buy milk"
//   • Task (completed)      → "- [x] Buy milk"
//   • Task (migrated fwd)   → "- [>] Buy milk"
//   • Task (scheduled)      → "- [<] Buy milk → future-log"
//   • Task (cancelled)      → "- [-] Buy milk"
//   • Event                 → "- [o] Soccer game at 10am"
//   • Note                  → "- Note text here"
//
// SIGNIFIERS (prefixed before the bullet):
//   ! Priority              → "! - [ ] Pay rent"
//   * Inspiration           → "* - Important idea"
//   @ Person reference      → "@ Danny - [ ] Call plumber"
//   # Tag                   → "# groceries - [ ] Buy milk"

export interface BulletEntry {
	readonly type: BulletType;
	readonly state?: TaskState; // only for tasks
	readonly signifiers: Signifier[]; // zero or more
	readonly content: string; // the actual text
	readonly person?: string; // @-referenced person
	readonly tags: string[]; // #-referenced tags
	readonly scheduledDate?: string; // ISO date if scheduled
}
