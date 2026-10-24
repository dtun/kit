/**
 * The receipt printer, reached through the `PRINTER` Service Binding to the
 * receipt-printer Worker. Expected outcomes never throw. Rejections (a line over
 * 48 columns, over 10,000 chars) come back as `ok: false` with a message that
 * says what to fix. Offline means queued, which is `ok: true`.
 */
export interface IReceiptPrinter {
	print(text: string): Promise<PrintOutcome>;
}

export interface PrintOutcome {
	readonly ok: boolean;
	readonly message: string;
}
