import { describe, expect, it } from 'vitest';
import { isPagedList, patchById, removeById } from './hooks';

const page = (ids: string[]) => ({
  items: ids.map((id) => ({ id, name: `Cup ${id}` })),
  meta: { page: 1, limit: 10, itemCount: ids.length, pageCount: 1, hasPreviousPage: false, hasNextPage: false },
});

describe('optimistic helpers on a paginated list', () => {
  it('recognises the paged shape and not a plain array or record', () => {
    expect(isPagedList(page(['a']))).toBe(true);
    expect(isPagedList([{ id: 'a' }])).toBe(false);
    expect(isPagedList({ id: 'a' })).toBe(false);
  });

  it('removing an item drops it from the page and lowers the count', () => {
    const out = removeById('b')(page(['a', 'b', 'c'])) as ReturnType<typeof page>;
    expect(out.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(out.meta.itemCount).toBe(2);
    expect(out.meta.page).toBe(1); // the rest of the meta is kept
  });

  it('removing an id that is not on this page leaves the count alone', () => {
    const out = removeById('zzz')(page(['a', 'b'])) as ReturnType<typeof page>;
    expect(out.items).toHaveLength(2);
    expect(out.meta.itemCount).toBe(2);
  });

  it('patching an item changes only that item, and skips undefined fields', () => {
    const out = patchById('b', { name: 'Renamed', venue: undefined })(page(['a', 'b'])) as ReturnType<typeof page>;
    expect(out.items[1]).toEqual({ id: 'b', name: 'Renamed' });
    expect(out.items[0]).toEqual({ id: 'a', name: 'Cup a' });
  });

  it('leaves non-list data alone', () => {
    expect(removeById('a')(undefined)).toBeUndefined();
    expect(patchById('a', { name: 'x' })({ foo: 1 })).toEqual({ foo: 1 });
  });
});
