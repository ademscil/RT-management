import { describe, it, expect } from 'vitest';
import {
  PaginationQuerySchema,
  buildPaginationMeta,
} from '@simrt/shared-types';

describe('Pagination and Search Logic', () => {
  it('harus memvalidasi dan mem-parse query pagination dengan default yang tepat', () => {
    const parsed = PaginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
    expect(parsed.sortOrder).toBe('desc');
    expect(parsed.search).toBeUndefined();
  });

  it('harus meng-coerce string query dari URL menjadi integer number', () => {
    const parsed = PaginationQuerySchema.parse({
      page: '3',
      limit: '25',
      search: '  Budi Santoso  ',
      sortBy: 'namaLengkap',
      sortOrder: 'asc',
    });

    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(25);
    expect(parsed.search).toBe('Budi Santoso'); // auto-trimmed
    expect(parsed.sortBy).toBe('namaLengkap');
    expect(parsed.sortOrder).toBe('asc');
  });

  it('harus menolak limit melebihi batas maksimum 100 untuk mencegah serangan DoS', () => {
    expect(() =>
      PaginationQuerySchema.parse({
        page: 1,
        limit: 500,
      })
    ).toThrow();
  });

  it('harus mengkalkulasi PaginationMeta dengan benar untuk halaman awal, tengah, dan akhir', () => {
    // Total 45 data, limit 10 -> 5 halaman
    const page1Meta = buildPaginationMeta(45, 1, 10);
    expect(page1Meta.totalPages).toBe(5);
    expect(page1Meta.hasPrevPage).toBe(false);
    expect(page1Meta.hasNextPage).toBe(true);

    const page3Meta = buildPaginationMeta(45, 3, 10);
    expect(page3Meta.hasPrevPage).toBe(true);
    expect(page3Meta.hasNextPage).toBe(true);

    const page5Meta = buildPaginationMeta(45, 5, 10);
    expect(page5Meta.hasPrevPage).toBe(true);
    expect(page5Meta.hasNextPage).toBe(false);
  });
});

