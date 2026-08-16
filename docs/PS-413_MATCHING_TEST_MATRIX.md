# PS-413 deterministic matching test matrix

These cases keep the baseline fixed at 85 points: same species (35), within 2 km (30), and reported within two days of the missing case (20). They make it easy to see exactly what breed and colour/markings add.

| Scenario | Breed points | Markings points | Expected score |
| --- | ---: | ---: | ---: |
| No descriptive evidence | 0 | 0 | 85 |
| Exact breed after case, spacing or hyphen normalization | 10 | 0 | 95 |
| Specific partial breed, such as British Shorthair / British Shorthair cat | 5 | 0 | 90 |
| Generic partial breed, such as Terrier / Jack Russell terrier | 0 | 0 | 85 |
| Unknown, Mixed or Other | 0 | 0 | 85 |
| Exact markings after order and punctuation normalization | 0 | 5 | 90 |
| Gray / grey alias | 0 | 5 | 90 |
| One shared marking, such as black / black and white | 0 | 2 | 87 |
| Unrelated markings | 0 | 0 | 85 |
| Exact breed and markings | 10 | 5 | 100 |
| Specific partial breed plus one shared marking | 5 | 2 | 92 |

Run the primary, database-free unit test from the repository root:

```sh
npm run test:unit
```

The Vitest suite is the fast behavioural specification used while refining this scoring policy. It has no database, Supabase, Docker or network dependency.

The SQL contract check remains available to compare the PostgreSQL implementation with the same expected score matrix:

```sh
docker exec -i supabase_db_pet-seen psql -U postgres -d postgres < tests/sql/ps413_matching.sql
```

The script prints each expected and actual value, then exits with an error if a score changes unexpectedly. It only creates temporary tables and rolls the transaction back.
