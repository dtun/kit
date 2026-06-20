import { DurableObject } from "cloudflare:workers";
import { AnthropicAIService } from "@adapters/ai/anthropic-ai-service";
import { WorkersAIService } from "@adapters/ai/workers-ai-service";
import { ICloudCalendarService } from "@adapters/calendar/icloud-calendar-service";
import { NoOpCalendarService } from "@adapters/calendar/noop-calendar-service";
import { EmailMessageGateway, EmailSendError } from "@adapters/email/email-message-gateway";
import { parseInboundEmail } from "@adapters/email/email-parser";
import { R2JournalRepository } from "@adapters/persistence/r2-journal-repository";
import { SqliteConversationStore } from "@adapters/persistence/sqlite-conversation-store";
import { NoOpMessageGateway } from "@adapters/sms/noop-message-gateway";
import { TwilioMessageGateway } from "@adapters/sms/twilio-message-gateway";
import Anthropic from "@anthropic-ai/sdk";
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

	private createCalendarService() {
		return this.env.ICLOUD_APPLE_ID && this.env.ICLOUD_APP_PASSWORD
			? new ICloudCalendarService(this.env.ICLOUD_APPLE_ID, this.env.ICLOUD_APP_PASSWORD)
			: new NoOpCalendarService();
	}

	// Reasoning brain for digests/replies: Claude when configured, else Workers AI
	// (graceful degradation). Classification always stays on the cheap llama path.
	private createReasoningAIService() {
		let workersAI = new WorkersAIService(this.env.AI, AI_MODEL);
		return this.env.ANTHROPIC_API_KEY
			? new AnthropicAIService(new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY }), workersAI)
			: workersAI;
	}

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
		let ai = this.createReasoningAIService();
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

		let calendar = this.createCalendarService();

		return runMorningRoutine({
			journal,
			ai,
			gateways: { email: emailGateway, sms: smsGateway },
			paths,
			familyMembers,
			calendar,
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

			let calendar = this.createCalendarService();
			let familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);
			let result = await processInboundMessage(
				{
					journal,
					ai,
					messenger,
					paths,
					familyMembers,
					kitConfig: KIT,
					calendar,
					conversationStore,
				},
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

			let calendar = this.createCalendarService();
			let familyMembers = parseFamilyMembers(this.env.FAMILY_MEMBERS);
			let result = await processInboundMessage(
				{
					journal,
					ai,
					messenger,
					paths,
					familyMembers,
					kitConfig: KIT,
					calendar,
					conversationStore,
				},
				message,
			);

			console.log(`Processed email from ${from}: intent=${result.intent.intent}`);
			return new Response(JSON.stringify({ ok: true, replied: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			// Processing runs before the reply is sent, so an EmailSendError means
			// we understood the message but couldn't deliver the reply.
			if (err instanceof EmailSendError) {
				console.error(`EMAIL_REPLY_FAILED from ${from}:`, err);
				return new Response(JSON.stringify({ ok: true, replied: false }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			console.error(`Error processing email from ${from}:`, err);
			return new Response("Error", { status: 500 });
		}
	}
}
