const transientCodes = new Set(['1','2','4','5','99']);

export async function fetchMolitXml(url: URL, options: {fetcher?: typeof fetch; wait?: (ms: number) => Promise<void>; attempts?: number} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const attempts = Math.min(4, Math.max(1, options.attempts || 4));
  const scope = ['LAWD_CD', 'DEAL_YMD', 'pageNo'].map(key => {
    const value = url.searchParams.get(key) ?? '';
    return /^\d{1,6}$/.test(value) ? value : '?';
  }).join('/');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let detail: string;
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(30_000) });
      const xml = await response.text();
      const code = /<(?:resultCode|returnReasonCode)>\s*(\d{1,3})\s*<\//i.exec(xml)?.[1];
      if (response.status !== 408 && response.status !== 429 && response.status < 500 &&
          (code === undefined || !transientCodes.has(String(Number(code))))) return { response, xml };
      detail = 'HTTP_' + response.status + (code ? '_CODE_' + code : '');
    } catch (error) {
      const e = error as { name?: string; cause?: { code?: string } };
      const cause = e?.cause?.code ?? e?.name ?? '';
      detail = /^[A-Za-z0-9_]{1,48}$/.test(cause) ? cause : 'TRANSPORT_ERROR';
    }
    console.warn(JSON.stringify({ event: 'MOLIT_RETRYABLE_FAILURE', scope, attempt, attempts, detail }));
    if (attempt === attempts) throw Error('MOLIT_NETWORK_UNAVAILABLE_AFTER_RETRIES: ' + scope + ' ' + detail);
    await wait(2000 * 2 ** (attempt - 1));
  }
  throw Error('MOLIT_NETWORK_UNAVAILABLE_AFTER_RETRIES');
}
