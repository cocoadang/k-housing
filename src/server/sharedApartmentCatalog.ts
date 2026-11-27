import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getReaderDb } from './firestoreReader';

const revision = 'kapt-20261127-fc274fd1312b';

export function createSharedApartmentCatalogHandler(): RequestHandler {
  let cache: Promise<unknown> | undefined;
  return async (_request, response) => {
    if (!cache) {
      const lookup = (async () => {
        const db = getReaderDb();
        const snapshot = await db.collection('apartmentSearchCatalogRevisions').doc(revision).get();
        const source = snapshot.data();
        if (!source || typeof source.catalogJson !== 'string' ||
            createHash('sha256').update(source.catalogJson).digest('hex') !== source.catalogSha256) {
          throw Error('CATALOG_HASH_MISMATCH');
        }
        const catalog = JSON.parse(source.catalogJson);
        if (!Array.isArray(catalog.complexes) || catalog.complexes.length !== Number(source.count) ||
            !catalog.complexes.length) throw Error('CATALOG_COUNT_MISMATCH');
        return { revision, ...catalog };
      })();
      cache = lookup;
      void lookup.catch(() => { if (cache === lookup) cache = undefined; });
    }
    try {
      const catalog = await cache;
      response.setHeader('Cache-Control', 'public, max-age=300');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.json(catalog);
    } catch {
      response.setHeader('Cache-Control', 'no-store');
      response.status(503).json({ error: 'SHARED_APARTMENT_CATALOG_UNAVAILABLE' });
    }
  };
}
