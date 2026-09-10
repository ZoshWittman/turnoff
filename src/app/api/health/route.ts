export async function GET() {
  return Response.json({
    ok: true,
    name: "WonderFact Kids",
    time: new Date().toISOString(),
  });
}
