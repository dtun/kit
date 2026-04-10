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
import type { KitMessage } from "@domain/entities/kit-message";
import type { Env } from "@infrastructure/env";

export class KitAgent extends DurableObject<Env> {
	private initialized = false;

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;
		let journal = new R2JournalRepository(this.env.JOURNAL);
		let paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
		await initializeJournal({ journal, paths }, new Date());
		this.initialized = true;
	}

	async fetch(request: Request): Promise<Response> {
		let url = new URL(request.url);

		if (url.pathname === "/email" && request.method === "POST") {
			return this.handleEmail(request);
		}

		if (url.pathname === "/sms" && request.method === "POST") {
			return this.handleSms(request);
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
			let result = await this.runScheduledRoutine();
			return new Response(JSON.stringify(result), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			console.error("Error running scheduled routine:", err);
			return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
		}
	}

	private async runScheduledRoutine(): Promise<MorningRoutineResult> {
		let journal = new R2JournalRepository(this.env.JOURNAL);
		let ai = new WorkersAIService(this.env.AI, AI_MODEL);
		let paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
		let familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);

		let emailGateway = new EmailMessageGateway(this.env.SEND_EMAIL, KIT.email, KIT.name);
		let smsGateway = this.env.TWILIO_ACCOUNT_SID
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

	private async handleSms(request: Request): Promise<Response> {
		try {
			await this.ensureInitialized();

			let { from, body, messageSid } = (await request.json()) as {
				from: string;
				body: string;
				messageSid: string;
			};

			let message: KitMessage = {
				from,
				channel: "sms",
				body,
				timestamp: new Date().toISOString(),
				messageId: messageSid,
			};

			let journal = new R2JournalRepository(this.env.JOURNAL);
			let ai = new WorkersAIService(this.env.AI, AI_MODEL);
			let messenger = new NoOpMessageGateway();
			let paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
			let conversationStore = new SqliteConversationStore(this.ctx.storage.sql);

			let familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);
			let result = await processInboundMessage(
				{ journal, ai, messenger, paths, familyMembers, kitConfig: KIT, conversationStore },
				message,
			);

			console.log(`Processed SMS from ${from}: intent=${result.intent.intent}`);
			return new Response(JSON.stringify({ reply: result.reply.body }), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			console.error("SMS processing error:", err);
			return new Response(JSON.stringify({ reply: "Sorry, I hit a snag. Try again in a sec." }), {
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	private async handleEmail(request: Request): Promise<Response> {
		let from = request.headers.get("X-Email-From") || "";
		let to = request.headers.get("X-Email-To") || "";

		try {
			await this.ensureInitialized();

			let rawBody = await request.arrayBuffer();
			let message = await parseInboundEmail(rawBody, from, to);

			console.log(
				`[DIAG] parsed body length=${message.body.length}, first 800 chars: ${JSON.stringify(message.body.slice(0, 800))}`,
			);
			console.log(
				`[DIAG] body contains "Begin forwarded message:": ${message.body.includes("Begin forwarded message:")}`,
			);
			console.log(
				`[DIAG] body contains "---------- Forwarded": ${message.body.includes("---------- Forwarded")}`,
			);

			let journal = new R2JournalRepository(this.env.JOURNAL);
			let ai = new WorkersAIService(this.env.AI, AI_MODEL);
			let messenger = new EmailMessageGateway(
				this.env.SEND_EMAIL,
				KIT.email,
				KIT.name,
				message.messageId,
			);
			let paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
			let conversationStore = new SqliteConversationStore(this.ctx.storage.sql);

			let familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);
			let result = await processInboundMessage(
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
