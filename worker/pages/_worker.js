export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'sarungan-slayer-pages',
          version: '1.7.0',
          hasGameRoom: Boolean(env.GAME_ROOM),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
    if (match) {
      if (!env.GAME_ROOM) {
        return new Response('GAME_ROOM binding missing', { status: 500 });
      }
      const code = match[1].toUpperCase();
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('code', code);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not Found', { status: 404 });
  },
};
