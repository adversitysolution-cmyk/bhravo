export const SPEECH_LANG: Record<string, string> = {
  hinglish: "hi-IN",
  hindi: "hi-IN",
  english: "en-IN",
  kannada: "kn-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  marathi: "mr-IN",
};

/** Reads text aloud so a shopkeeper can check a bill without reading it. */
export function speak(text: string, language: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG[language] ?? "hi-IN";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
  return true;
}
