import type { IAIService } from "@application/ports/ai-service";
import type { IConversationStore } from "@application/ports/conversation-store";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
import { authorizeSender } from "@domain/entities/authorization";
import { COLD_START_RULES, detectColdStart } from "@domain/entities/cold-start";
import type { ConversationTurn } from "@domain/entities/conversation-turn";
import { createDateContext } from "@domain/entities/date-context";
import type { Channel, FamilyMember } from "@domain/entities/family-member";
import type { MessageClassification } from "@domain/entities/intent";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { KitMessage, KitResponse } from "@domain/entities/kit-message";
import { CHANNEL_TONE, KIT_PERSONA } from "@domain/entities/persona";
import { UnauthorizedSenderError } from "@domain/errors";
import { answerQuestion } from "./answer-question";
import { compileStatus } from "./compile-status";
import { createDailyLog } from "./create-daily-log";
import { recallFromJournal } from "./recall-from-journal";

export interface ProcessInboundMessageDeps {
	journal: IJournalRepository;
	ai: IAIService;
	messenger: IMessageGateway;
	paths: JournalPaths;
	familyMembers: readonly FamilyMember[];
	kitConfig: { readonly name: string; readonly email: string };
	conversationStore?: IConversationStore;
}

export interface ProcessingResult {
	readonly intent: MessageClassification;
	readonly reply: KitResponse;
	readonly journalUpdates: string[];
}

export async function processInboundMessage(
	deps: ProcessInboundMessageDeps,
	message: KitMessage,
): Promise<ProcessingResult> {
	let { journal, ai, messenger, paths, familyMembers, kitConfig } = deps;

	// 1. Authorize sender
	let auth = authorizeSender(message.from, familyMembers);
	if (!auth.authorized) {
		throw new UnauthorizedSenderError(message.from);
	}

	// auth.authorized guarantees member is present
	if (!auth.member) throw new UnauthorizedSenderError(message.from);
	let member = auth.member;
	let now = new Date();
	let journalUpdates: string[] = [];

	// 2. Ensure today's daily log exists
	await createDailyLog({ journal, paths }, now);

	// 3. Detect cold start (journal has < 3 daily logs across the current year)
	let yearKeys = await journal.list(paths.yearDir(now.getFullYear()));
	let dailyLogCount = yearKeys.filter((k) => k.endsWith("/daily.txt")).length;
	let coldStart = detectColdStart(dailyLogCount, null, now);
	let coldStartRules = coldStart.isNew ? COLD_START_RULES : undefined;

	// 4. Get context for the AI (recent journal entries)
	let context = await buildContext(journal, paths, now);

	// 5. Classify intent
	let intent = await ai.classifyIntent(message.body, context);

	// 6. Take action based on intent
	let actionResult = await executeIntent(deps, intent, message, member, now, coldStartRules);
	journalUpdates.push(...actionResult.paths);

	// 7. Generate reply (skip if use case already produced a complete response)
	let replyBody: string;
	if (actionResult.directReply) {
		replyBody = actionResult.directReply;
	} else {
		replyBody = await generateReply(
			ai,
			intent,
			actionResult.summary,
			context,
			member,
			message.channel,
			coldStartRules,
		);
	}

	// 7. Send reply
	let reply: KitResponse = {
		to: message.from,
		channel: message.channel,
		subject: message.subject ? `Re: ${message.subject}` : `From ${kitConfig.name}`,
		body: replyBody,
		timestamp: now.toISOString(),
	};

	await messenger.send(reply);

	// 8. Store conversation turns if conversation store is available
	if (deps.conversationStore) {
		let userTurn: ConversationTurn = {
			role: "user",
			content: message.body,
			memberName: member.name,
			intent: intent.intent,
			timestamp: message.timestamp,
		};
		let kitTurn: ConversationTurn = {
			role: "kit",
			content: replyBody,
			memberName: "Kit",
			timestamp: reply.timestamp,
		};
		await deps.conversationStore.addTurn(message.from, userTurn);
		await deps.conversationStore.addTurn(message.from, kitTurn);
	}

	// 9. Log the interaction in today's daily log
	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let d = now.getDate();
	let channelLabel = message.channel === "sms" ? "SMS" : "Email";
	await journal.append(
		paths.dailyLog(y, m, d),
		`\n- [o] ${channelLabel} from ${member.name}: "${truncate(message.body, 60)}" → ${intent.intent}\n`,
		`Logged inbound ${channelLabel.toLowerCase()} from ${member.name}`,
	);

	return { intent, reply, journalUpdates };
}

async function buildContext(
	journal: IJournalRepository,
	paths: JournalPaths,
	now: Date,
): Promise<string> {
	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let d = now.getDate();

	let parts: string[] = [];

	let today = await journal.read(paths.dailyLog(y, m, d));
	if (today) parts.push(`TODAY'S LOG:\n${today.content}`);

	let month = await journal.read(paths.monthlyLog(y, m));
	if (month) parts.push(`MONTHLY LOG:\n${month.content}`);

	let index = await journal.read(paths.index());
	if (index) parts.push(`INDEX:\n${index.content}`);

	return parts.join("\n\n---\n\n") || "No journal context available yet.";
}

interface ActionResult {
	summary: string;
	paths: string[];
	directReply?: string;
}

async function executeIntent(
	deps: ProcessInboundMessageDeps,
	intent: MessageClassification,
	message: KitMessage,
	member: FamilyMember,
	now: Date,
	coldStartRules?: readonly string[],
): Promise<ActionResult> {
	let { journal, paths } = deps;
	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let d = now.getDate();
	let updatedPaths: string[] = [];

	switch (intent.intent) {
		case "remember": {
			let content = intent.extractedData.content || message.body;
			let dailyPath = paths.dailyLog(y, m, d);
			await journal.append(dailyPath, `- ${content}\n`, `${member.name} asked to remember`);
			updatedPaths.push(dailyPath);
			return { summary: `Stored: "${content}"`, paths: updatedPaths };
		}

		case "task": {
			let content = intent.extractedData.content || message.body;
			let dailyPath = paths.dailyLog(y, m, d);
			await journal.append(dailyPath, `- [ ] ${content}\n`, `${member.name} added task`);
			updatedPaths.push(dailyPath);
			return { summary: `Added task: "${content}"`, paths: updatedPaths };
		}

		case "list_add": {
			let content = intent.extractedData.content || message.body;
			let dailyPath = paths.dailyLog(y, m, d);
			await journal.append(
				dailyPath,
				`- [ ] ${content} #${intent.extractedData.category || "list"}\n`,
				`${member.name} added to list`,
			);
			updatedPaths.push(dailyPath);
			return { summary: `Added to list: "${content}"`, paths: updatedPaths };
		}

		case "recall": {
			let query = intent.extractedData.content || message.body;
			let replyBody = await recallFromJournal(
				{ journal: deps.journal, ai: deps.ai, coldStartRules },
				query,
				member.name,
			);
			return { summary: replyBody, paths: [], directReply: replyBody };
		}

		case "status": {
			let dateCtx = createDateContext(now);
			let replyBody = await compileStatus(
				{ journal: deps.journal, ai: deps.ai, paths: deps.paths, coldStartRules },
				dateCtx,
				member.name,
			);
			return { summary: "Status compiled", paths: [], directReply: replyBody };
		}

		case "question": {
			let dateCtx = createDateContext(now);
			let replyBody = await answerQuestion(
				{ journal: deps.journal, ai: deps.ai, paths: deps.paths, coldStartRules },
				message.body,
				member.name,
				dateCtx,
			);
			return { summary: "Question answered", paths: [], directReply: replyBody };
		}

		case "edit_history": {
			let editLog = await deps.journal.getEditLog(
				now.getFullYear(),
				now.getMonth() + 1,
				now.getDate(),
			);
			let replyBody = editLog
				? `Here's what I changed today:\n\n${editLog}\n\n${KIT_PERSONA.signOff}`
				: `No changes today yet. ${KIT_PERSONA.signOff}`;
			return { summary: "Edit history returned", paths: [], directReply: replyBody };
		}

		case "list_view":
		case "list_clear":
		case "greeting":
		case "unknown":
			return { summary: intent.intent, paths: [] };
	}
}

async function generateReply(
	ai: IAIService,
	intent: MessageClassification,
	actionSummary: string,
	context: string,
	member: FamilyMember,
	channel: Channel,
	coldStartRules?: readonly string[],
): Promise<string> {
	let systemPrompt = [
		`You are ${KIT_PERSONA.name} (${KIT_PERSONA.fullName}).`,
		"",
		"Personality:",
		...KIT_PERSONA.traits.map((t) => `- ${t}`),
		"",
		"Rules:",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		...(coldStartRules && coldStartRules.length > 0
			? ["", "COLD START BEHAVIOR:", ...coldStartRules.map((r) => `- ${r}`)]
			: []),
		"",
		`Tone: ${CHANNEL_TONE[channel]}`,
		"",
		`You are replying to ${member.name}.`,
		`Intent: ${intent.intent} (confidence: ${intent.confidence})`,
		`Action taken: ${actionSummary}`,
		"",
		"Journal context:",
		context,
	].join("\n");

	return ai.complete(systemPrompt, `Reply to ${member.name}'s message.`);
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s;
}
