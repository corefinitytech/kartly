# Search Ranking

Kartly has **no paid or sponsored ranking** (FR-SRCH-06). No position in any result list can be bought. There are no ads, affiliate boosts, or preferential placements anywhere in the catalog.

## How results are produced

1. **Full text match.** The query is parsed with `websearch_to_tsquery('english', q)` and matched against `products.search_vector`, a generated `tsvector` column weighted:
   - title — weight A (highest)
   - brand — weight B
   - description — weight C
2. **Ranking.** Full text matches are ordered by `ts_rank_cd`, a cover-density score that rewards matches in weighted fields and proximity, so a title hit outranks a description mention.
3. **Typo tolerance.** If full text returns nothing, a trigram fallback (`similarity(title, q) > 0.3` via `pg_trgm`) runs and results are ordered by similarity. This catches misspellings like "iphnoe".
4. **Sort.** The user can sort by price ascending/descending, rating, or newest; "Relevance" uses the ranking above (rating/count when there is no query).

## What does not affect ranking

Payment, margin, stock pressure, and personalization never influence order. Filters (category, price, rating, brand, in stock) only restrict the set. Catalog pages with no query sort by rating as a stable, honest default.

## Indexes

- GIN index on `search_vector` for full text matching.
- GiST trigram index on `title` for typeahead and similarity fallback.
