export interface Env {
	AI: Ai;
	KIT_AGENT: DurableObjectNamespace;
	JOURNAL: R2Bucket;
	SEND_EMAIL: SendEmail;
	FAMILY_MEMBERS: string;
	API_KEY: string;
	TWILIO_ACCOUNT_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_PHONE_NUMBER?: string;
	ICLOUD_APPLE_ID?: string;
	ICLOUD_APP_PASSWORD?: string;
}

export type AppEnv = {
	Bindings: Env;
};
