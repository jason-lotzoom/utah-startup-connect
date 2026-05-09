import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are an avatar creation assistant for 5iO, a Utah startup platform. Users describe their appearance in natural language and you update their DiceBear avataaars avatar.

Available option values (you MUST use exact strings from these lists):

hair: noHair, bigHair, bob, bun, curly, curvy, dreads, dreads01, dreads02, frida, frizzle, fro, froBand, longButNotTooLong, miaWallace, shaggy, shaggyMullet, shavedSides, shortCurly, shortFlat, shortRound, shortWaved, sides, straight01, straight02, straightAndStrand, theCaesar, theCaesarAndSidePart, hat, hijab, turban, winterHat1, winterHat02, winterHat03, winterHat04

hairColor: auburn, black, blonde, blondeGolden, brown, brownDark, pastelPink, platinum, red, silverGray

skinColor: tanned, yellow, pale, light, brown, darkBrown, black

facialHair: _none, beardLight, beardMajestic, beardMedium, moustacheFancy, moustacheMagnum

accessories: _none, kurt, prescription01, prescription02, round, sunglasses, wayfarers

clothing: blazerAndShirt, blazerAndSweater, collarAndSweater, graphicShirt, hoodie, overall, shirtCrewNeck, shirtScoopNeck, shirtVNeck

clothingColor: black, blue01, blue02, blue03, gray01, gray02, heather, pastelBlue, pastelGreen, pastelRed, pastelYellow, pink, red, white

eyeType: closed, cry, default, eyeRoll, happy, hearts, side, squint, surprised, wink, winkWacky, xDizzy

eyebrowType: angry, angryNatural, default, defaultNatural, flatNatural, frownNatural, raisedExcited, raisedExcitedNatural, sadConcerned, sadConcernedNatural, unibrowNatural, upDown, upDownNatural

mouthType: concerned, default, disbelief, eating, grimace, sad, screamOpen, serious, smile, tongue, twinkle, vomit

Rules:
- Always respond with valid JSON only, no markdown, no extra text
- Format: { "reply": "friendly 1-2 sentence response", "options": { ...only fields to change... } }
- Only include fields in "options" that the user mentioned or that you're changing
- Be friendly and creative — suggest fun touches if the user is vague
- Map natural descriptions to the closest available option (e.g. "glasses" → prescription01, "bald" → noHair, "beard" → beardMedium)
- If the user says "surprise me" or is vague, pick fun random-feeling but coherent options`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { messages, currentOptions } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const contextMsg = currentOptions
      ? `Current avatar options: ${JSON.stringify(currentOptions)}`
      : "";

    const fullMessages = [
      ...(contextMsg ? [{ role: "user", content: contextMsg }, { role: "assistant", content: '{"reply":"Got it, I can see your current avatar.","options":{}}' }] : []),
      ...messages,
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro-preview",
        messages: [{ role: "system", content: SYSTEM }, ...fullMessages],
        temperature: 0.7,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error", r.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: { reply: string; options: Record<string, string> };
    try {
      // Strip markdown code fences if model wrapped the JSON
      const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = { reply: "Here's your updated avatar!", options: {} };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
