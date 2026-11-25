package unsmurf

import (
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

// DirectSheet is a sheet of explicit puppet -> master rows.
type DirectSheet struct {
	Name         string
	Source       Source
	HeaderRows   int
	PuppetColumn int
	MasterColumn int
}

// RegexSheet is a sheet of regex -> master rules.
type RegexSheet struct {
	Name         string
	Source       Source
	HeaderRows   int
	RegexColumn  int
	MasterColumn int
}

// ExcludeSheet removes explicit puppet/master pairs from the generated data.
type ExcludeSheet struct {
	Name         string
	Source       Source
	HeaderRows   int
	PuppetColumn int
	MasterColumn int
}

// RedirectSheet rewrites a master nation to another master nation.
type RedirectSheet struct {
	Name            string
	Source          Source
	HeaderRows      int
	OldMasterColumn int
	NewMasterColumn int
}

// SheetConfig describes every Google Sheet-like input used by the generator.
//
// Adding a community sheet is just appending to one of these slices. A Source
// can be a URL, a local file, or any custom fetcher.
type SheetConfig struct {
	Direct   []DirectSheet
	Regex    []RegexSheet
	Exclude  []ExcludeSheet
	Redirect []RedirectSheet

	// Regex tuning. Zero values fall back to the historical defaults.
	MaxGroupsPerPattern int
	MaxPatternsPerGroup int
	MaxPatternsPerRegex int

	// ContinueOnSheetError preserves the old scripts' behaviour of logging a
	// failed sheet and continuing. The 50% shrink guards still protect the
	// published files. Set to false to fail fast instead.
	ContinueOnSheetError bool
}

// RegexOptions returns the configured regex limits with defaults applied.
func (c SheetConfig) RegexOptions() RegexOptions {
	return RegexOptions{
		MaxGroupsPerPattern: c.MaxGroupsPerPattern,
		MaxPatternsPerGroup: c.MaxPatternsPerGroup,
		MaxPatternsPerRegex: c.MaxPatternsPerRegex,
	}.withDefaults()
}

// RegexOptions controls how many patterns are combined before matching.
//
// These exist only for parity with the original JavaScript implementation and
// as a safety valve for very large sheets. The Go matcher indexes individual
// rules, so callers normally do not need to change them.
type RegexOptions struct {
	MaxGroupsPerPattern int
	MaxPatternsPerGroup int
	MaxPatternsPerRegex int
}

func (o RegexOptions) withDefaults() RegexOptions {
	if o.MaxGroupsPerPattern <= 0 {
		o.MaxGroupsPerPattern = 800
	}
	if o.MaxPatternsPerGroup <= 0 {
		o.MaxPatternsPerGroup = 25
	}
	if o.MaxPatternsPerRegex <= 0 {
		o.MaxPatternsPerRegex = 100
	}
	return o
}

// NationStatesConfig controls the two NationStates API requests.
//
// NationsSource and MembersSource take precedence over NationsURL and
// MembersURL when set, allowing offline files or custom fetchers.
type NationStatesConfig struct {
	NationsURL     string
	MembersURL     string
	NationsSource  Source
	MembersSource  Source
	UserAgent      string
	MinNations     int
	MinWAMembers   int
	ArchiveQuality int
}

// Paths lists the files the aggregator reads and writes.
//
// Use PathsFor to derive the standard layout from a data worktree directory.
type Paths struct {
	DataDir        string
	PuppetData     string
	AllNations     string
	CurrentNations string
	WANations      string
}

// PathsFor returns the standard .data/static layout.
func PathsFor(dataDir string) Paths {
	static := filepath.Join(dataDir, "static")
	return Paths{
		DataDir:        dataDir,
		PuppetData:     filepath.Join(static, "puppetData.tsv"),
		AllNations:     filepath.Join(static, "allNations.txt.br"),
		CurrentNations: filepath.Join(static, "currentNations.txt"),
		WANations:      filepath.Join(static, "currentWANations.txt"),
	}
}

func replaceSuffix(path, oldSuffix, newSuffix string) string {
	return strings.TrimSuffix(path, oldSuffix) + newSuffix
}

// PuppetJSON returns the JSON path derived from PuppetData.
func (p Paths) PuppetJSON() string {
	return replaceSuffix(p.PuppetData, ".tsv", ".json")
}

// ConflictsTSV returns the conflicts path derived from PuppetData.
func (p Paths) ConflictsTSV() string {
	return replaceSuffix(p.PuppetData, ".tsv", ".conflicts.tsv")
}

// CurrentNationsJSON returns the JSON path derived from CurrentNations.
func (p Paths) CurrentNationsJSON() string {
	return replaceSuffix(p.CurrentNations, ".txt", ".json")
}

// WANationsJSON returns the JSON path derived from WANations.
func (p Paths) WANationsJSON() string {
	return replaceSuffix(p.WANations, ".txt", ".json")
}

// Config is the complete aggregator configuration.
type Config struct {
	Sheets       SheetConfig
	NationStates NationStatesConfig
	Paths        Paths
	HTTP         *HTTPClient
	Logger       *slog.Logger

	// Workers controls parallel regex matching. Zero uses runtime.NumCPU()
	// capped at 8. Output is deterministic regardless of worker count.
	Workers int
}

// DefaultConfig returns the live unsmurf configuration.
func DefaultConfig() Config {
	return Config{
		HTTP:   NewHTTPClient(),
		Logger: slog.Default(),
		Paths:  PathsFor(".data"),
		Sheets: SheetConfig{
			Direct: []DirectSheet{
				{
					Name:         "XKI's Sheet",
					Source:       URLSource("https://docs.google.com/spreadsheets/d/e/2PACX-1vSem15AVLXgdjxWBZOnWRFnF6NwkY0gVKPYI8aWuHJzlbyILBL3o1F5GK1hSK3iiBlXLIZBI5jdpkVr/pub?gid=916202163&single=true&output=tsv"),
					HeaderRows:   0,
					PuppetColumn: 0,
					MasterColumn: 1,
				},
				{
					Name:         "Rot's Sheet",
					Source:       URLSource("https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4"),
					HeaderRows:   1,
					PuppetColumn: 0,
					MasterColumn: 1,
				},
				{
					Name:         "9003's Sheet",
					Source:       URLSource("https://docs.google.com/spreadsheets/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/export?format=tsv&id=1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4&gid=733627866"),
					HeaderRows:   1,
					PuppetColumn: 0,
					MasterColumn: 1,
				},
			},
			Regex: []RegexSheet{
				{
					Name:         "Rot's Regex Sheet",
					Source:       URLSource("https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ"),
					HeaderRows:   1,
					RegexColumn:  0,
					MasterColumn: 1,
				},
			},
			Exclude: []ExcludeSheet{
				{
					Name:         "Exclude",
					Source:       URLSource("https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1034512747"),
					HeaderRows:   1,
					PuppetColumn: 0,
					MasterColumn: 1,
				},
			},
			Redirect: []RedirectSheet{
				{
					Name:            "Redir",
					Source:          URLSource("https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1440877244"),
					HeaderRows:      1,
					OldMasterColumn: 0,
					NewMasterColumn: 1,
				},
			},
			ContinueOnSheetError: true,
		},
		NationStates: NationStatesConfig{
			NationsURL:     "https://www.nationstates.net/cgi-bin/api.cgi?q=nations",
			MembersURL:     "https://www.nationstates.net/cgi-bin/api.cgi?wa=1&q=members",
			UserAgent:      DefaultUserAgent,
			MinNations:     250000,
			MinWAMembers:   5000,
			ArchiveQuality: 4,
		},
	}
}

// HTTPClient returns the configured client, creating a default one if needed.
func (c *Config) httpClient() *HTTPClient {
	if c.HTTP != nil {
		return c.HTTP
	}
	c.HTTP = NewHTTPClient()
	return c.HTTP
}

func (c *Config) logger() *slog.Logger {
	if c.Logger != nil {
		return c.Logger
	}
	return slog.Default()
}

// NewHTTPClientWithTimeout is a small helper for callers that only need to
// adjust the timeout.
func NewHTTPClientWithTimeout(timeout time.Duration) *HTTPClient {
	client := NewHTTPClient()
	if client.Client == nil {
		client.Client = &http.Client{}
	}
	client.Client.Timeout = timeout
	return client
}
