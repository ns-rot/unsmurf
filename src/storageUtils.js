export function createVersionedStorage(key, { defaults, migrations, currentVersion, repair }) {
  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        let state = JSON.parse(raw);
        const ver = state.version || 0;
        if (ver !== currentVersion) {
          for (let v = ver; v < currentVersion; v++) {
            const fn = migrations[v + 1];
            if (fn) state = fn(state);
          }
          state.version = currentVersion;
        }
        if (repair) state = repair(state);
        return state;
      }
    } catch (e) {}
    return { ...defaults, version: currentVersion };
  }

  function save(state) {
    localStorage.setItem(key, JSON.stringify(state));
  }

  return { read, save };
}
