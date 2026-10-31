export const TRADES = [
  { id: "shopkeeper", name: "Shopkeeper", line: "Bills and udhaar by voice" },
  { id: "doctor", name: "Doctor", line: "Visit notes and fee receipts" },
  { id: "tailor", name: "Tailor", line: "Orders, measurements, delivery dates" },
  { id: "teacher", name: "Teacher", line: "Fee tracker and parent messages" },
  { id: "driver", name: "Driver", line: "Trip log and daily earnings" },
  { id: "painter", name: "Painter", line: "Quotes with a UPI advance link" },
] as const;

export type TradeId = (typeof TRADES)[number]["id"];

export const LANGUAGES = [
  { id: "hinglish", name: "Hinglish (Hindi + English)" },
  { id: "hindi", name: "Hindi" },
  { id: "english", name: "English" },
  { id: "kannada", name: "Kannada" },
  { id: "tamil", name: "Tamil" },
  { id: "telugu", name: "Telugu" },
  { id: "marathi", name: "Marathi" },
] as const;
