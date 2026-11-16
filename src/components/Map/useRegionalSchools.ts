import { useCallback, useEffect, useState } from 'react';
import { loadRegionalSchools } from '../../services/schoolMapData';
import type { RegionalSchoolData } from '../../types/schools';

export function useRegionalSchools(region: string, load = loadRegionalSchools) {
  const [state, setState] = useState<{ region: string; data: RegionalSchoolData | null; error: boolean }>({ region: '', data: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ region, data: null, error: false });
    if (region !== 'ALL') {
      load(region).then(data => {
        if (!active) return;
        if (data.region !== region) throw new Error('Region mismatch');
        setState({ region, data, error: false });
      }).catch(() => { if (active) setState({ region, data: null, error: true }); });
    }
    return () => { active = false; };
  }, [region, load, attempt]);
  return {
    schoolData: state.region === region ? state.data : null,
    schoolLoadError: state.region === region && state.error,
    retry: useCallback(() => setAttempt(n => n + 1), []),
  };
}
