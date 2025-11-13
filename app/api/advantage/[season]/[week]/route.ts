const JSON_HEADERS = { 'content-type': 'application/json' } as const;

type AdvantageParams = {
  season: string;
  week: string;
};

export async function GET(
  _request: Request,
  { params }: { params: AdvantageParams }
): Promise<Response> {
  const { season, week } = params;

  const body = JSON.stringify({
    season,
    week,
    status: 'ok',
    message: 'Advantage endpoint placeholder response.',
  });

  return new Response(body, { headers: JSON_HEADERS });
}
