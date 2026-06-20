import type { IAIService } from "@application/ports/ai-service";
import type { ICalendarService } from "@application/ports/calendar-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
import { KIT } from "@config";
import type { DateContext } from "@domain/entities/date-context";
import type { DigestPreferences } from "@domain/entities/digest-preferences";
import type { Channel, FamilyMember } from "@domain/entities/family-member";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { MigrationResult } from "@domain/entities/migration-result";
import { buildBulletDigest } from "./build-bullet-digest";
import { compileStatus } from "./compile-status";

export interface SendDigestDeps {
	journal: IJournalRepository;
	ai: IAIService;
	gateways: Record<Channel, IMessageGateway>;
	paths: JournalPaths;
	calendar?: ICalendarService;
}

export interface DigestResult {
	readonly sentTo: string[];
	readonly skipped: string[];
	readonly fallbackUsed: string[];
}

export async function sendDigest(
	deps: SendDigestDeps,
	members: readonly FamilyMember[],
	preferences: DigestPreferences,
	dateCtx: DateContext,
	migrationResult?: MigrationResult,
): Promise<DigestResult> {
	if (!preferences.enabled) {
		return { sentTo: [], skipped: members.map((m) => m.name), fallbackUsed: [] };
	}

	let sentTo: string[] = [];
	let skipped: string[] = [];
	let fallbackUsed: string[] = [];

	for (let member of members) {
		let statusBody = "";
		let usedFallback = false;

		try {
			statusBody = await compileStatus(
				{ journal: deps.journal, ai: deps.ai, paths: deps.paths, calendar: deps.calendar },
				dateCtx,
				member.name,
			);
			if (!statusBody) throw new Error("AI returned empty response");
		} catch (err) {
			console.error("DIGEST_FALLBACK_USED", { member: member.name, reason: String(err) });
			statusBody = await buildFallbackBody(
				{ journal: deps.journal, paths: deps.paths },
				dateCtx,
				member.name,
			);
			usedFallback = true;
		}

		try {
			if (migrationResult && migrationResult.migrated.length > 0) {
				let migrationNote = `\nI also moved ${migrationResult.migrated.length} task(s) forward from yesterday:\n${migrationResult.migrated.map((m) => `  - ${m.content}`).join("\n")}\n`;
				statusBody += migrationNote;
			}

			// The fallback body already embeds the deterministic bullet digest, so
			// only append it here when the AI summary succeeded.
			if (member.channel === "email" && !usedFallback) {
				let bulletDigest = await buildBulletDigest(
					{ journal: deps.journal, paths: deps.paths },
					dateCtx,
				);
				if (bulletDigest) {
					statusBody += `\n\n${bulletDigest}`;
				}
			}

			let gateway = deps.gateways[member.channel];
			await gateway.send({
				to: member.contact,
				channel: member.channel,
				subject: member.channel === "email" ? `${dateCtx.dayOfWeek} — ${KIT.name}` : undefined,
				body: statusBody,
				timestamp: new Date().toISOString(),
			});

			sentTo.push(member.name);
			if (usedFallback) fallbackUsed.push(member.name);
		} catch (err) {
			console.error(`Failed to send digest to ${member.name}:`, err);
			skipped.push(member.name);
		}
	}

	return { sentTo, skipped, fallbackUsed };
}

// When the AI summary can't be produced (model error or empty output) we still
// want a genuinely useful digest, so render the deterministic bullet digest with
// a short note explaining the missing prose rather than just a bare header.
async function buildFallbackBody(
	deps: { journal: IJournalRepository; paths: JournalPaths },
	dateCtx: DateContext,
	memberName: string,
): Promise<string> {
	let header = `${dateCtx.dayOfWeek} update for ${memberName}:\nAI summary unavailable this morning — here's your deterministic view.`;
	let bulletDigest = await buildBulletDigest(deps, dateCtx);
	return bulletDigest ? `${header}\n\n${bulletDigest}` : header;
}
