import type { NextRequest } from "next/server";
import { WeatherError, findCity, getWeather, placeFromCoords } from "@/lib/openweather";

// ブラウザはここを呼ぶだけ。API キーはサーバー内でのみ使われ、ブラウザには届かない。
//   /api/weather?q=東京
//   /api/weather?lat=35.68&lon=139.76
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));

  try {
    let place;
    if (q) {
      place = await findCity(q.slice(0, 100));
    } else if (sp.has("lat") && sp.has("lon") && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      place = await placeFromCoords(lat, lon);
    } else {
      return Response.json({ error: "都市名か現在地を指定してください" }, { status: 400 });
    }
    return Response.json(await getWeather(place));
  } catch (e) {
    if (e instanceof WeatherError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "予期しないエラーが発生しました" }, { status: 500 });
  }
}
