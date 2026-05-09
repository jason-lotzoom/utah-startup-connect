// Returns the public Mapbox access token for the browser map.
// Mapbox public tokens (pk.*) are safe to expose client-side.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const token = Deno.env.get("MAPBOX") ?? "";
  return new Response(JSON.stringify({ token }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});