export function keyToLabel(key) {
  return String(key || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeCategoryPayload(payload) {
  if (Array.isArray(payload)) {
    const flat = payload.map((item) => ({
      key: item.key,
      label: item.label || keyToLabel(item.key),
      mainKey: item.mainKey || 'other',
      mainLabel: item.mainLabel || keyToLabel(item.mainKey || 'other')
    }));

    const grouped = new Map();
    for (const item of flat) {
      if (!grouped.has(item.mainKey)) {
        grouped.set(item.mainKey, {
          key: item.mainKey,
          label: item.mainLabel,
          subcategories: []
        });
      }
      grouped.get(item.mainKey).subcategories.push({ key: item.key, label: item.label });
    }

    return {
      flat,
      tree: Array.from(grouped.values())
    };
  }

  const tree = Array.isArray(payload?.tree) ? payload.tree : [];
  const flat = Array.isArray(payload?.flat)
    ? payload.flat
    : tree.flatMap((main) =>
        (main.subcategories || []).map((sub) => ({
          key: sub.key,
          label: sub.label || keyToLabel(sub.key),
          mainKey: main.key,
          mainLabel: main.label || keyToLabel(main.key)
        }))
      );

  return { tree, flat };
}

export function getSubcategoriesByMain(tree, mainKey) {
  const selected = (tree || []).find((main) => main.key === mainKey);
  return selected?.subcategories || [];
}
