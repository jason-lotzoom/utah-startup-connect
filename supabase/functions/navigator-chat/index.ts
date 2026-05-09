import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { messages, quiz, resources } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const stage = quiz?.stage ?? "early-stage";
    const industry = quiz?.industry ?? "a Utah company";
    const location = quiz?.location ?? "Utah";
    const needs = (quiz?.needs ?? []).join(", ") || "general guidance";
    const community = quiz?.community && quiz.community !== "Any" ? quiz.community : "";

    const resourceList = Array.isArray(resources) && resources.length > 0
      ? resources.map((r: any, i: number) => {
          const parts = [`${i + 1}. **${r.title}**`];
          if (r.description) parts.push(`   ${r.description}`);
          const tags: string[] = [];
          if (r.topics?.length) tags.push(`Topics: ${r.topics.join(", ")}`);
          if (r.industries?.length) tags.push(`Industries: ${r.industries.join(", ")}`);
          if (r.communities?.length) tags.push(`Communities: ${r.communities.join(", ")}`);
          if (r.locations?.length) tags.push(`Locations: ${r.locations.join(", ")}`);
          if (r.link) tags.push(`Link: ${r.link}`);
          if (r.email) tags.push(`Contact: ${r.email}`);
          if (tags.length) parts.push(`   (${tags.join(" | ")})`);
          return parts.join("\n");
        }).join("\n\n")
      : null;

    const sys = `You are the 5iO Navigator AI — the official AI guide for Utah's startup ecosystem.

## YOUR ROLE
You give specific, actionable advice about the programs and resources available to this founder. Every recommendation must reference a real program from the list below by name. Do not invent programs that are not in the list.

## THE USER'S PROFILE
- **Stage**: ${stage}
- **Industry**: ${industry}
- **Location**: ${location}
- **Needs**: ${needs}${community ? `\n- **Community**: ${community}` : ""}

## MATCHED PROGRAMS FOR THIS FOUNDER
These are the actual programs from the 5iO database matched to this user's profile. Use these as your primary source of truth — reference them by their exact titles and use their descriptions to answer questions specifically:

${resourceList ?? "No specific programs were pre-matched. Give general Utah ecosystem guidance and suggest the user restart the quiz for better matches."}

## RESPONSE RULES
1. Only recommend programs from the list above — these are real, verified entries in our database
2. Quote or paraphrase their actual descriptions when explaining what a program does
3. Be concise — 2-4 short paragraphs max
4. Be warm but professional
5. If the user asks about something none of the programs cover, say so honestly and point them to the program's contact or link
6. Always end with a specific next step (e.g. "Apply at [link]" or "Email [contact]")`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro-preview",
        stream: true,
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });

    if (r.status === 429)
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    if (r.status === 402)
      return new Response(JSON.stringify({ error: "Credits exhausted" }), {
        status: 402,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(r.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
