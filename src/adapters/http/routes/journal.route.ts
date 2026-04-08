import { R2JournalRepository } from "@adapters/persistence/r2-journal-repository";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export const journalRoute = new Hono<AppEnv>();

// Read any journal file by path
// GET /journal/2026/04/07/daily.txt
journalRoute.get("/*", async (c) => {
	const rawUrl = decodeURIComponent(new URL(c.req.url).pathname);
	const subpath = rawUrl.replace(/^\/journal\//, "");
	if (!subpath || subpath === rawUrl || subpath.includes("..")) {
		return c.json({ error: "Invalid path" }, 400);
	}
	const path = `journal/${subpath}`;
	const repo = new R2JournalRepository(c.env.JOURNAL);
	const entry = await repo.read(path);

	if (!entry) {
		return c.json({ error: "Not found", path }, 404);
	}

	return c.text(entry.content, 200, {
		"Content-Type": "text/plain; charset=utf-8",
	});
});
