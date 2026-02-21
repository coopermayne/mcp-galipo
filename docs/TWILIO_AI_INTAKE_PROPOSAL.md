# Twilio AI Phone Intake — Proposal

## Summary

Allow potential clients to call a Galipo phone number and tell their story to an AI. The AI guides them through a minimal intake, transcribes everything, and creates a case lead for attorney review.

## What We Tested

We ran four experiments on 2026-02-20 using Twilio's programmable voice API:

### 1. Basic outbound call (TwiML only)
- Twilio calls a number, plays a scripted message using `<Say>` with Polly voices
- No server needed — inline TwiML passed directly to `calls.create()`
- Works perfectly for one-way messages

### 2. Voice memo recording
- Call → beep → record up to 30s → hang up
- Audio saved to Twilio, downloaded via API as MP3
- Built-in `transcribe="true"` on `<Record>` sends async transcription
- **Transcription quality is decent for general speech but terrible for names** (see below)

### 3. Structured multi-question intake
- Flask server + localtunnel for webhook callbacks
- 6 sequential questions (name, injured person, date, location, narrative, injuries)
- Each answer recorded separately with `<Record>`, transcribed via Twilio
- Caller presses `*` after each answer
- Audio + transcripts saved locally

### 4. AI conversational intake (Claude + Twilio speech recognition)
- Flask server handles the call loop
- `<Gather input="speech" speechModel="experimental_conversations">` for real-time STT
- Each caller utterance sent to Claude, which generates the next response
- `<Say>` speaks Claude's response back, then listens again
- Conversation ends when Claude emits `[INTAKE_COMPLETE]` tag
- Full transcript saved

## Key Findings

### Speech-to-text mangles names
This is the biggest problem. Twilio's STT consistently butchers proper names:

| Said | Transcribed (structured) | Transcribed (AI/speech) |
|------|--------------------------|-------------------------|
| "Cooper Allison Mayne" | "Super allison man" | "Cooper, Allison, Maine" |
| "Cooper Mayne" | — | "Speaker Maine" / "Spencer Maine" |

The AI conversational approach is *slightly* better because it allows the caller to spell out their name letter-by-letter ("C-O-O-P-E-R") and the AI can piece it together. But it's still unreliable.

**Recommendation:** Don't try to capture names via speech recognition. Either:
- Ask callers to spell their name at the start ("Please spell your first and last name, one letter at a time")
- Skip name capture entirely and get it from caller ID / follow-up contact
- Use DTMF keypad entry for names (tedious but accurate)

### The AI talks too much
In testing, Claude was too conversational — asking follow-up questions, making small talk, and not letting callers just tell their story. Callers got impatient:
- "I don't want to talk about it. I just want you guys to take the case."
- "Not really, you just submit the case now."

The AI should be more like a listener than an interviewer.

### The conversational approach works
Despite the chattiness problem (fixable via prompt), the AI intake produced the best results. The third test captured all key facts correctly:
- Name: Cooper Mayne (after spelling)
- Date: February 19th, 2026
- Location: Palmdale Sheriff's Station, Los Angeles, CA
- Incident: Beaten by police
- Injuries: Back injury requiring surgery

### Architecture works well
- Flask + localtunnel for local dev is straightforward
- Twilio's `<Gather input="speech" speechModel="experimental_conversations">` provides real-time STT
- Claude responds fast enough for natural conversation flow (~1-2s latency)
- `<Say voice="Polly.Matthew">` sounds natural

## Proposed Design: "Tell Us Your Story" Intake Line

### Philosophy
Minimize AI conversationality. The caller should do 90% of the talking. The AI is just there to:
1. Greet them briefly
2. Ask them to spell their name (or skip it)
3. Say "tell us everything" and then **shut up and listen**
4. When they stop talking, ask if there's anything else
5. When they say no, thank them and hang up

### Flow

```
1. Caller dials Galipo intake number
2. AI: "Hi, thanks for calling Galipo Law. I'm going to take down your
        information. First — could you please spell your first and last
        name, one letter at a time?"
3. [Caller spells name or says it — best effort capture]
4. AI: "Got it. Now please tell me everything about what happened —
        when it was, where it was, what injuries you have, anything
        you think is important. Take as long as you need. When you're
        done, just say 'that's it' or press the pound key."
5. [Caller talks — could be 30 seconds or 10 minutes]
6. AI: "Thank you. Is there anything else you'd like to add?"
7. [If yes, listen again. If no, wrap up.]
8. AI: "We have your information. Someone from our team will be in
        touch. Thank you for calling."
9. Hang up → save transcript → create intake lead in Galipo
```

### What the AI should NOT do
- Ask clarifying questions mid-story (let them finish first)
- Make empathetic small talk ("I'm so sorry to hear that")
- Ask for information piece by piece (date? location? injuries?)
- Summarize back what they said (wastes time on a phone call)
- Introduce itself with a fake name

### Technical Architecture

```
Inbound call → Twilio webhook → Galipo backend endpoint
  → /api/v1/intake/voice/start     (greeting + name capture)
  → /api/v1/intake/voice/story     (open-ended recording/STT)
  → /api/v1/intake/voice/followup  (anything else?)
  → /api/v1/intake/voice/status    (call ended callback)

On completion:
  → Claude analyzes full transcript (extract date, location, injuries, etc.)
  → Creates intake record in DB
  → Notifies team via dashboard
```

### Infrastructure Needed
- **Twilio account** with a phone number (already have this)
- **Public URL** for webhooks (production server already has this)
- **New routes** in `routes/` for voice intake endpoints
- **New db module** for intake records (or extend existing intake/chat system)
- **Claude post-processing** to extract structured data from the raw transcript

### Cost Estimate
- Twilio phone number: ~$1/month
- Inbound calls: ~$0.0085/min
- Speech recognition (enhanced): ~$0.02/min
- Claude API for conversation + extraction: ~$0.01-0.05 per call
- **Total per 5-minute intake call: ~$0.20**

### Open Questions
- Do we want inbound only, or also outbound (firm calls the lead)?
- Should the raw audio be saved, or just the transcript?
- How does this integrate with the existing chat-based intake?
- Do we need Spanish language support? (Twilio supports it)
- Should there be a "press 1 to speak to a person" escape hatch?

## Status

**Proof of concept: complete.** The core Twilio + Claude integration works. Next steps would be building it into the actual Galipo backend and designing the intake record storage.
