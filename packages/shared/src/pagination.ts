/** One page of a list, plus the total so clients can render page controls. */
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export function toPaginated<T>(
  items: T[],
  total: number,
  query: { page: number; limit: number },
): Paginated<T> {
  return { items, total, page: query.page, limit: query.limit };
}
