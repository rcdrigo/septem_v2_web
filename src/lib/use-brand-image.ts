import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Assets públicos da API precisam da mesma origem e identificação de ambiente do bootstrap. */
export function useBrandImage(source: string | null | undefined, tenantId?: string): string | undefined {
  const [loaded, setLoaded] = useState<{ source: string; tenantId?: string; url: string }>();
  const fromApi = source?.startsWith('/api/') ?? false;

  useEffect(() => {
    setLoaded(undefined);
    if (!source || !fromApi) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void api.getBlob(source, { anonymous: true, signal: controller.signal })
      .then(image => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(image);
        setLoaded({ source, tenantId, url: objectUrl });
      })
      .catch(() => { /* Mantém a identidade textual se o asset estiver indisponível. */ });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, tenantId, fromApi]);

  if (!fromApi) return source || undefined;
  return loaded && loaded.source === source && loaded.tenantId === tenantId ? loaded.url : undefined;
}
