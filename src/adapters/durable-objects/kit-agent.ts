import { DurableObject } from "cloudflare:workers";
import { WorkersAIService } from "@adapters/ai/workers-ai-service";
import { EmailMessageGateway } from "@adapters/email/email-message-gateway";
import { parseInboundEmail } from "@adapters/email/email-parser";
import { R2JournalRepository } from "@adapters/persistence/r2-journal-repository";
import { SqliteConversationStore } from "@adapters/persistence/sqlite-conversation-store";
import { NoOpMessageGateway } from "@adapters/sms/noop-message-gateway";
import { TwilioMessageGateway } from "@adapters/sms/twilio-message-gateway";
import { initializeJournal } from "@application/use-cases/initialize-journal";
import { processInboundMessage } from "@application/use-cases/process-inbound-message";
import { runMorningRoutine } from "@application/use-cases/run-morning-routine";
import type { MorningRoutineResult } from "@application/use-cases/run-morning-routine";
import { AI_MODEL, JOURNAL_CONFIG, KIT, parseFamilyMembers } from "@config";
import { createJournalPaths } from "@domain/entities/journal-path";
import type { Env } from "@infrastructure/env";

export class KitAgent extends DurableObject<Env> {
	private initialized = false;

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;
		const journal = new R2JournalRepository(this.env.JOURNAL);
		const paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
		await initializeJournal({ journal, paths }, new Date());
		this.initialized = true;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/email" && request.method === "POST") {
			return this.handleEmail(request);
		}

		if (url.pathname === "/scheduled" && request.method === "POST") {
			return this.handleScheduled();
		}

		return new Response(
			JSON.stringify({
				agent: "kit",
				status: "ready",
				timestamp: new Date().toISOString(),
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	private async handleScheduled(): Promise<Response> {
		try {
			await this.ensureInitialized();
			const result = await this.runScheduledRoutine();
			return new Response(JSON.stringify(result), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			console.error("Error running scheduled routine:", err);
			return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
		}
	}

	private async runScheduledRoutine(): Promise<MorningRoutineResult> {
		const journal = new R2JournalRepository(this.env.JOURNAL);
		const ai = new WorkersAIService(this.env.AI, AI_MODEL);
		const paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
		const familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);

		const emailGateway = new EmailMessageGateway(this.env.SEND_EMAIL, KIT.email, KIT.name);
		const smsGateway = this.env.TWILIO_ACCOUNT_SID
			? new TwilioMessageGateway(
					this.env.TWILIO_ACCOUNT_SID,
					this.env.TWILIO_AUTH_TOKEN || "",
					this.env.TWILIO_PHONE_NUMBER || "",
				)
			: new NoOpMessageGateway();

		return runMorningRoutine({
			journal,
			ai,
			gateways: { email: emailGateway, sms: smsGateway },
			paths,
			familyMembers,
		});
	}

	private async handleEmail(request: Request): Promise<Response> {
		const from = request.headers.get("X-Email-From") || "";
		const to = request.headers.get("X-Email-To") || "";

		try {
			await this.ensureInitialized();

			const rawBody = await request.arrayBuffer();
			const message = await parseInboundEmail(rawBody, from, to);

			const journal = new R2JournalRepository(this.env.JOURNAL);
			const ai = new WorkersAIService(this.env.AI, AI_MODEL);
			const messenger = new EmailMessageGateway(
				this.env.SEND_EMAIL,
				KIT.email,
				KIT.name,
				message.messageId,
			);
			const paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
			const conversationStore = new SqliteConversationStore(this.ctx.storage.sql);

			const familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);
			const result = await processInboundMessage(
				{ journal, ai, messenger, paths, familyMembers, kitConfig: KIT, conversationStore },
				message,
			);

			console.log(`Processed email from ${from}: intent=${result.intent.intent}`);
			return new Response("OK", { status: 200 });
		} catch (err) {
			console.error(`Error processing email from ${from}:`, err);
			return new Response("Error", { status: 500 });
		}
	}
}
