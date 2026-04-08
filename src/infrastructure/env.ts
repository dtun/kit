export interface Env {
	AI: Ai;
	KIT_AGENT: DurableObjectNamespace;
	JOURNAL: R2Bucket;
	SEND_EMAIL: SendEmail;
	FAMILY_MEMBERS: string;
}

export type AppEnv = {
	Bindings: Env;
};
