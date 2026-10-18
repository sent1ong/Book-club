import legacyManifest from "../../manifest";
import { groupQuery, readGroup } from "../group";
import { NextRequest } from "next/server";
import { authorize, fail } from "../../security/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const group = readGroup(request.url);
  if (group === null) return new Response("Invalid group", { status: 400 });
  try {
    await authorize(request, group);
  } catch (error) {
    return fail(error);
  }
  const query = groupQuery(group);

  return Response.json(
    {
      ...legacyManifest(),
      id: "/pwa/apps?" + query,
      start_url: "/?" + query,
      scope: "/",
      name: "Book Club 98 - " + group,
      short_name: group,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
