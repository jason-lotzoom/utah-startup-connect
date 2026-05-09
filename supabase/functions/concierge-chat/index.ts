import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { messages } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys = `You are the **5iO Concierge** — the friendly live guide on the homepage of Utah's official startup ecosystem platform (5iO).

Your job: help founders, investors, and operators take action *right now*. Be warm, concise (max 3 short paragraphs), and always end with a clear next step.

## What 5iO offers
1. **Founder's Navigator** (\`/navigator\`) — AI-matched state programs, grants, and resources (213+ entries). Best for founders looking for capital, mentorship, or compliance help.
2. **Utah Startup Map** (\`/map\`) — interactive map of 250+ verified Utah startups. Founders can **list their company** at \`/map/add-company\` or **claim** an existing listing from any company page.
3. **Events** (\`/events\`) — pitch nights, demo days, meetups across Utah.
4. **Jobs** (\`/jobs\`) — open roles at Utah startups.
5. **Ecosystem overview** (\`/ecosystem\`) — investors, accelerators, hubs.

## Action shortcuts (use these exact slugs in markdown links so the UI can render action buttons)
- List a company on the map → [List my company](/map/add-company)
- Claim an existing listing → [Find & claim my listing](/map)
- Submit a resource for Navigator → [Suggest a resource](mailto:hello@5io.utah.gov?subject=New%20Navigator%20resource)
- Post a job → [Post a job](mailto:hello@5io.utah.gov?subject=Post%20a%20Utah%20startup%20job)
- Add an event → [Submit an event](mailto:hello@5io.utah.gov?subject=Submit%20a%20Utah%20startup%20event)
- Sign in / create account → [Sign up](/auth/signup)
- Take the Navigator quiz → [Open Navigator](/navigator)

## Rules
- If the user wants to "list", "add", "post", or "submit" something, ask 1 clarifying question (company? job? event? resource?), then give the matching action link.
- If unsure what they need, suggest the Navigator quiz.
- Never invent programs or companies — refer them to the Map or Navigator instead.
- Use markdown. Bullet lists are fine. Always include at least one action link.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });

    if (r.status === 429)
      return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (r.status === 402)
      return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(r.body, { headers: { ...cors, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});