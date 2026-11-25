# Aggregator

`pkg/unsmurf` builds the dataset published on the `data` branch:

- `puppetData.tsv`
- `puppetData.json`
- `puppetData.conflicts.tsv`
- `currentNations.txt` / `.json`
- `currentWANations.txt` / `.json`
- `allNations.txt.br`

The GitHub Action currently runs the existing JavaScript scripts as the
authoritative source alongside `cmd/unsmurf` to verify output parity.

## CLI

```sh
go run ./cmd/unsmurf all                 # nation lists + puppet data
go run ./cmd/unsmurf nations             # nation lists only
go run ./cmd/unsmurf sheets              # puppet data only
go run ./cmd/unsmurf -data .data sheets  # alternate data worktree
go run ./cmd/unsmurf -workers 4 sheets   # limit matching parallelism
```

`go run ./cmd/unsmurf -h` lists every flag.

## Library

Everything is configured through `unsmurf.Config`. The default configuration
uses the live Google Sheets and NationStates endpoints; callers can replace any
input with a URL, local file, in-memory bytes, or a custom `Source`.

```go
ctx := context.Background()

cfg := unsmurf.DefaultConfig()
cfg.Paths = unsmurf.PathsFor(".data")

// Add a community sheet, read from disk for this run.
cfg.Sheets.Direct = append(cfg.Sheets.Direct, unsmurf.DirectSheet{
	Name:         "Community Sheet",
	Source:       unsmurf.FileSource("cache/community.tsv"),
	HeaderRows:   1,
	PuppetColumn: 0,
	MasterColumn: 1,
})

if _, err := cfg.GeneratePuppetData(ctx); err != nil {
	log.Fatal(err)
}
```

A `Source` is just:

```go
type Source interface {
	Fetch(ctx context.Context) ([]byte, error)
}
```

so an existing downloader or cache can be plugged in without changing the
aggregation pipeline:

```go
type cachedSource struct {
	client *http.Client
	url    string
}

func (s cachedSource) Fetch(ctx context.Context) ([]byte, error) {
	// return cached bytes, a database row, an embedded file, ...
}
```

`BytesSource` is useful for tests. `DefaultConfig()` uses `URLSource` for its
default sheets so they always pick up changes to `cfg.HTTP`, including
replacing `cfg.HTTP` with a custom `*HTTPClient`.

## Pipeline notes

- Direct, regex, exclusion, and redirect sheets are ordinary slices in
  `SheetConfig`. Appending a sheet is enough to include it.
- Regexes are compiled with Go's RE2 engine and matched case-insensitively.
  Live sheets use patterns that work in both JavaScript and Go. A pattern
  using lookarounds or backreferences is logged as invalid and skipped.
- Anchored rules are indexed by the literal prefix they require. This is why
  most nations never reach a regex call.
- Matching runs in parallel over nations (`Config.Workers`), while state
  updates stay ordered so the generated files are deterministic.
- The 50% shrink guards remain: the generator refuses to overwrite a file with
  data that is less than half its previous size.
- `NationStatesConfig` controls the two API URLs, User-Agent, minimum
  completeness thresholds, and Brotli quality.
