import { useCallback, useMemo, useState } from 'react';
import { evaluateTest, TEST_MODULES_BY_TYPE } from '@nawi/shared';

/** Immutable set of a nested value, creating arrays/objects along the path. */
export function setIn(obj, [key, ...rest], value) {
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[key] = rest.length ? setIn(obj?.[key] ?? (typeof rest[0] === 'number' ? [] : {}), rest, value) : value;
  return copy;
}

/**
 * Local observation state for one test, evaluated live by the shared engine
 * (the same code the server uses to decide compliance).
 */
export function useTestForm(record, type) {
  const module = TEST_MODULES_BY_TYPE[type];
  const spec = record.instrument;
  const [obs, setObs] = useState(() => record.tests?.[type] ?? module.defaults(spec));
  const [dirty, setDirty] = useState(false);

  const result = useMemo(() => evaluateTest(type, obs, spec), [type, obs, spec]);
  const rowByKey = useMemo(() => Object.fromEntries(result.rows.map((r) => [r.key, r])), [result]);

  const set = useCallback((path, value) => {
    setObs((o) => setIn(o, path, value));
    setDirty(true);
  }, []);

  const replace = useCallback((next) => {
    setObs(next);
    setDirty(true);
  }, []);

  return { module, spec, obs, set, replace, result, rowByKey, dirty, markSaved: () => setDirty(false) };
}
