export interface ForwardedEmailTestCase {
	input: string;
	expected: {
		isForward: boolean;
		userInstruction: string;
		fromOriginal?: string;
		subject?: string;
		dateExtracted?: string;
		keyFacts: string[];
	};
}

export let forwardedEmailDataset: ForwardedEmailTestCase[] = [
	// Apple Mail style
	{
		input: [
			"Note this date for me!",
			"",
			"Sent from my iPhone",
			"",
			"Begin forwarded message:",
			"",
			"From: Jimi Clayton <info@graciemesa.com>",
			"Date: April 9, 2026 at 11:29:40 AM MST",
			"To: Danny Tunney <dtun@me.com>",
			"Subject: Re: Combatives Belt Test - April 18th",
			"",
			"Perfect I have you down/ I also ordered your uniform as well. No charge at the moment, I want to make sure it fits you like you like.",
			"",
			"Jimi Clayton",
			"Owner and Certified Instructor",
		].join("\n"),
		expected: {
			isForward: true,
			userInstruction: "Note this date for me!",
			fromOriginal: "Jimi Clayton",
			subject: "Combatives Belt Test - April 18th",
			dateExtracted: "2026-04-18",
			keyFacts: ["Belt test April 18th", "Registered confirmed", "Uniform ordered"],
		},
	},
	// Gmail style
	{
		input: [
			"FYI",
			"",
			"---------- Forwarded message ---------",
			"From: school@mesa.k12.az.us",
			"Date: April 7, 2026",
			"Subject: Early Release - April 14",
			"",
			"Reminder: Monday April 14 is an early release day. Students dismissed at 1:30 PM.",
		].join("\n"),
		expected: {
			isForward: true,
			userInstruction: "FYI",
			fromOriginal: "school@mesa.k12.az.us",
			subject: "Early Release - April 14",
			dateExtracted: "2026-04-14",
			keyFacts: ["Early release April 14", "Dismissed 1:30 PM"],
		},
	},
	// Outlook style
	{
		input: [
			"Can you handle this one?",
			"",
			"-------- Original Message --------",
			"From: Coach Martinez <coach@youthsoccer.org>",
			"Sent: Tuesday, April 8, 2026 4:15 PM",
			"Subject: Practice rescheduled",
			"",
			"Parents, Tuesday practice moved to Wednesday April 15 at 5pm due to field conditions.",
		].join("\n"),
		expected: {
			isForward: true,
			userInstruction: "Can you handle this one?",
			fromOriginal: "Coach Martinez",
			subject: "Practice rescheduled",
			dateExtracted: "2026-04-15",
			keyFacts: ["Practice moved Wednesday April 15", "5pm start", "Field conditions"],
		},
	},
	// Minimal FYI with bare headers
	{
		input: [
			"",
			"From: pediatrics@healthclinic.com",
			"Subject: Appointment confirmation",
			"Date: April 10, 2026",
			"",
			"This confirms your appointment on April 22 at 10am with Dr. Chen.",
		].join("\n"),
		expected: {
			isForward: true,
			userInstruction: "",
			fromOriginal: "pediatrics@healthclinic.com",
			subject: "Appointment confirmation",
			dateExtracted: "2026-04-22",
			keyFacts: ["Appointment April 22", "10am", "Dr. Chen"],
		},
	},
	// Non-forward control
	{
		input: "Remember that trash day is Thursday",
		expected: {
			isForward: false,
			userInstruction: "Remember that trash day is Thursday",
			keyFacts: ["trash day Thursday"],
		},
	},
];
