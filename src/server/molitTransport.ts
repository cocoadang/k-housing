export async function fetchMolitXml(url: URL, options: {fetcher?:typeof fetch; wait?:(ms:number)=>Promise<void>; attempts?:number} = {}) {
  const fetcher=options.fetcher || fetch;
  const wait=options.wait || ((ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
  const attempts=Math.min(4,Math.max(1,options.attempts || 4));
  for(let attempt=0;attempt<attempts;attempt++){
    try {
      const response=await fetcher(url,{signal:AbortSignal.timeout(30000)});
      const xml=await response.text();
      if(response.status===429||response.status>=500)throw Error('RETRYABLE_UPSTREAM_STATUS');
      return {response,xml};
    } catch {
      if(attempt===attempts-1)throw Error('MOLIT_NETWORK_UNAVAILABLE_AFTER_RETRIES');
      await wait(1000*2**attempt);
    }
  }
  throw Error('MOLIT_NETWORK_UNAVAILABLE_AFTER_RETRIES');
}
