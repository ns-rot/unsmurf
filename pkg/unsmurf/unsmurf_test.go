package unsmurf

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestNormalize(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"  Rot's Puppet  ", "rot's_puppet"},
		{"Foo\u00adBar", "foobar"},
		{"Many\t \nSpaces", "many_spaces"},
		{"\ufeffLeading BOM\ufeff", "leading_bom"},
		{"", ""},
	}
	for _, test := range tests {
		if got := Normalize(test.input); got != test.want {
			t.Errorf("Normalize(%q) = %q, want %q", test.input, got, test.want)
		}
	}
}

func TestParseRows(t *testing.T) {
	rows := ParseRows([]byte("header\trow\n\npuppet\tmaster\r\n"), 1)
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if got := rows[0].Column(0); got != "puppet" {
		t.Errorf("column 0 = %q", got)
	}
	if got := rows[0].Column(9); got != "" {
		t.Errorf("missing column = %q", got)
	}
}

func TestTranslateJSEscapes(t *testing.T) {
	tests := map[string]string{
		`\u00AD`:  `\x{00AD}`,
		`\cA`:     `\x{01}`,
		`[\b]`:    `[\x{08}]`,
		`\\u1234`: `\\u1234`,
	}
	for input, want := range tests {
		if got := translateJSEscapes(input); got != want {
			t.Errorf("translateJSEscapes(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestPatternPrefixes(t *testing.T) {
	tests := []struct {
		pattern string
		want    []string
	}{
		{"^foo", []string{"foo"}},
		{"^(foo|bar)", []string{"bar", "foo"}},
		{"^(?:foo)?bar", []string{"bar", "foobar"}},
		{"^[ab]x", []string{"ax", "bx"}},
		{"^[0-9]+cala$", []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9"}},
		{"^a+b", []string{"a"}},
		{"^a*b", []string{"a", "b"}},
		{"^a{2}b", []string{"a"}},
		{"^a?b", []string{"ab", "b"}},
		{"^a(_[0-9]*)_page_thesis$", []string{"a_"}},
		{"^a[0-9]+b", []string{"a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"}},
		{"^a(?:b)*c", []string{"a"}},
		{"^a.b", []string{"a"}},
		{"^.*foo", nil},
		{"foo", nil},
		{"^", nil},
		{"^(a|ab)", []string{"a"}},
		{"^[aA]foo", []string{"afoo"}},
		{"^" + strings.Repeat("é", 40), []string{strings.Repeat("é", maxPrefixLength)}},
	}
	for _, test := range tests {
		got := patternPrefixes(test.pattern)
		sort.Strings(got)
		if !reflect.DeepEqual(got, test.want) {
			t.Errorf("patternPrefixes(%q) = %v, want %v", test.pattern, got, test.want)
		}
	}
}

func TestMatcherPriority(t *testing.T) {
	compile := func(master, pattern string) *regexPattern {
		re, translated, err := compilePattern(pattern)
		if err != nil {
			t.Fatalf("compile %q: %v", pattern, err)
		}
		return &regexPattern{Pattern: pattern, MatchPattern: translated, Master: master, Re: re}
	}

	first := compile("first", "zzz")
	second := compile("second", "aaa")
	third := compile("third", "^x")
	consolidated := []*consolidatedRule{
		{Master: "first", Patterns: []*regexPattern{first}},
		{Master: "second", Patterns: []*regexPattern{second}},
		{Master: "third", Patterns: []*regexPattern{third}},
	}
	matcher := buildMatcher(consolidated, RegexOptions{MaxPatternsPerRegex: 2})
	if len(matcher.processors) != 2 {
		t.Fatalf("processors = %d, want 2", len(matcher.processors))
	}

	// Processor 0 has two unanchored rules; the leftmost match (aaa) wins.
	best := matcher.processors[0].best("aaaazzz")
	if best == nil || best.Master != "second" {
		t.Fatalf("processor 0 winner = %v, want second", best)
	}
	// Processor 1 is only considered if processor 0 has no match.
	best = matcher.processors[0].best("xyz")
	if best != nil {
		t.Fatalf("processor 0 winner = %v, want nil", best)
	}
	best = matcher.processors[1].best("xyz")
	if best == nil || best.Master != "third" {
		t.Fatalf("processor 1 winner = %v, want third", best)
	}
}

func TestGeneratePuppetData(t *testing.T) {
	dir := t.TempDir()
	paths := PathsFor(filepath.Join(dir, ".data"))
	if err := os.MkdirAll(filepath.Dir(paths.AllNations), 0o755); err != nil {
		t.Fatal(err)
	}

	nations := []string{
		"puppet_a",
		"puppet_b",
		"regex_1",
		"regex_2",
		"shared",
		"conflict",
		"unmatched",
	}
	compressed, err := compressBrotli([]byte(strings.Join(nations, "\n")), 4)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.AllNations, compressed, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.WANations, []byte("puppet_a\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	config := Config{
		Logger: testLogger(),
		Paths:  paths,
		Sheets: SheetConfig{
			ContinueOnSheetError: false,
			Direct: []DirectSheet{{
				Name:         "Direct Sheet",
				Source:       BytesSource([]byte("Puppet\tMaster\npuppet_a\tmaster_one\npuppet_a\tmaster_one\npuppet_b\tmaster_two\nconflict\tmaster_one\n")),
				HeaderRows:   1,
				PuppetColumn: 0,
				MasterColumn: 1,
			}},
			Regex: []RegexSheet{{
				Name:         "Rot's Regex Sheet",
				Source:       BytesSource([]byte("Regex\tMaster\n^regex_[0-9]+$\tmaster_regex\n^shared$\tmaster_one\n^puppet_a$\tmaster_one\n^conflict$\tmaster_two\n")),
				HeaderRows:   1,
				RegexColumn:  0,
				MasterColumn: 1,
			}},
			Exclude: []ExcludeSheet{{
				Name:         "Exclude",
				Source:       BytesSource([]byte("Puppet\tMaster\npuppet_b\tmaster_two\n")),
				HeaderRows:   1,
				PuppetColumn: 0,
				MasterColumn: 1,
			}},
			Redirect: []RedirectSheet{{
				Name:            "Redir",
				Source:          BytesSource([]byte("Old\tNew\nmaster_regex\tmaster_final\n")),
				HeaderRows:      1,
				OldMasterColumn: 0,
				NewMasterColumn: 1,
			}},
		},
	}

	report, err := config.GeneratePuppetData(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if report.Records != 5 || report.Matched != 3 || report.Conflicts != 1 {
		t.Fatalf("unexpected report: %+v", report)
	}
	if report.Redirects["master_regex"] != "master_final" {
		t.Fatalf("unexpected redirects: %+v", report.Redirects)
	}
	if len(report.ConflictList) != 1 || report.ConflictList[0].Puppet != "conflict" {
		t.Fatalf("unexpected conflict list: %+v", report.ConflictList)
	}

	tsv, err := os.ReadFile(paths.PuppetData)
	if err != nil {
		t.Fatal(err)
	}
	wantTSV := "puppet\tmaster\tsheet\tsheet2\n" +
		"regex_1\tmaster_final\tRot's Regex Sheet\t\n" +
		"regex_2\tmaster_final\tRot's Regex Sheet\t\n" +
		"conflict\tmaster_one\tDirect Sheet\t\n" +
		"puppet_a\tmaster_one\tDirect Sheet\tRot's Regex Sheet\n" +
		"shared\tmaster_one\tRot's Regex Sheet\t"
	if string(tsv) != wantTSV {
		t.Fatalf("TSV mismatch\n--- got ---\n%s\n--- want ---\n%s", tsv, wantTSV)
	}

	jsonRaw, err := os.ReadFile(paths.PuppetJSON())
	if err != nil {
		t.Fatal(err)
	}
	var payload struct {
		Version int      `json:"version"`
		Masters []string `json:"masters"`
		Sheets  []string `json:"sheets"`
		Puppets [][]any  `json:"puppets"`
	}
	if err := json.Unmarshal(jsonRaw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Version != 2 {
		t.Errorf("version = %d", payload.Version)
	}
	if !reflect.DeepEqual(payload.Masters, []string{"master_one", "master_final"}) {
		t.Errorf("masters = %v", payload.Masters)
	}
	if !reflect.DeepEqual(payload.Sheets, []string{"Rot's Regex Sheet", "Direct Sheet"}) {
		t.Errorf("sheets = %v", payload.Sheets)
	}
	if len(payload.Puppets) != 5 {
		t.Fatalf("puppets = %d", len(payload.Puppets))
	}
	if got := payload.Puppets[3]; got[0] != "puppet_a" || got[2].(float64) != 3 {
		t.Errorf("puppet_a entry = %v, want [puppet_a 0 3]", got)
	}

	conflicts, err := os.ReadFile(paths.ConflictsTSV())
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(string(conflicts), "\n")
	if len(lines) < 2 || !strings.HasPrefix(lines[1], "conflict\t") {
		t.Fatalf("unexpected conflicts file:\n%s", conflicts)
	}
	fields := strings.Split(lines[1], "\t")
	if len(fields) != 6 || fields[2] != "master_one" || fields[4] != "master_two" {
		t.Fatalf("unexpected conflict row: %v", fields)
	}
}

func TestMergeSortedDedup(t *testing.T) {
	got := mergeSortedDedup([]string{"a", "c", "e"}, []string{"b", "c", "f"})
	want := []string{"a", "b", "c", "e", "f"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("mergeSortedDedup = %v, want %v", got, want)
	}
}

func TestExtractTag(t *testing.T) {
	body, ok := extractTag("<A>one,two</A>", "<A>", "</A>")
	if !ok || body != "one,two" {
		t.Fatalf("extractTag = %q, %v", body, ok)
	}
}

func TestPathsDerivedSuffixes(t *testing.T) {
	paths := Paths{
		PuppetData:     filepath.Join("dir.tsv.backup", "puppetData.tsv"),
		CurrentNations: filepath.Join("dir.txt.backup", "currentNations.txt"),
		WANations:      filepath.Join("dir.txt.backup", "currentWANations.dat"),
	}
	if got, want := paths.PuppetJSON(), filepath.Join("dir.tsv.backup", "puppetData.json"); got != want {
		t.Errorf("PuppetJSON = %q, want %q", got, want)
	}
	if got, want := paths.ConflictsTSV(), filepath.Join("dir.tsv.backup", "puppetData.conflicts.tsv"); got != want {
		t.Errorf("ConflictsTSV = %q, want %q", got, want)
	}
	if got, want := paths.CurrentNationsJSON(), filepath.Join("dir.txt.backup", "currentNations.json"); got != want {
		t.Errorf("CurrentNationsJSON = %q, want %q", got, want)
	}
	if got, want := paths.WANationsJSON(), filepath.Join("dir.txt.backup", "currentWANations.dat.json"); got != want {
		t.Errorf("WANationsJSON = %q, want %q", got, want)
	}
}

func TestGeneratePuppetDataErrorsOnMissingArchive(t *testing.T) {
	paths := PathsFor(filepath.Join(t.TempDir(), ".data"))
	config := Config{
		Logger: testLogger(),
		Paths:  paths,
		Sheets: SheetConfig{ContinueOnSheetError: false},
	}
	if _, err := config.GeneratePuppetData(context.Background()); err == nil {
		t.Fatal("expected error when allNations.txt.br is missing")
	}
}

func TestGeneratePuppetDataShrinkGuardPreservesAllOutputs(t *testing.T) {
	dir := t.TempDir()
	paths := PathsFor(filepath.Join(dir, ".data"))
	if err := os.MkdirAll(filepath.Dir(paths.AllNations), 0o755); err != nil {
		t.Fatal(err)
	}

	compressed, err := compressBrotli([]byte("puppet_a\n"), 4)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.AllNations, compressed, 0o644); err != nil {
		t.Fatal(err)
	}

	origTSV := strings.Repeat("puppet_x\tmaster_x\tDirect Sheet\n", 100)
	origConflicts := "nation\tcollisionFirstFoundUnix\tmaster1\tsheet1\tmaster2\tsheet2\nold_conflict\t12345\ta\ts1\tb\ts2\n"
	if err := os.WriteFile(paths.PuppetData, []byte(origTSV), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.ConflictsTSV(), []byte(origConflicts), 0o644); err != nil {
		t.Fatal(err)
	}

	config := Config{
		Logger: testLogger(),
		Paths:  paths,
		Sheets: SheetConfig{
			Direct: []DirectSheet{{
				Name:         "Direct Sheet",
				Source:       BytesSource([]byte("puppet_a\tmaster_a\n")),
				PuppetColumn: 0,
				MasterColumn: 1,
			}},
		},
	}

	if _, err := config.GeneratePuppetData(context.Background()); err == nil {
		t.Fatal("expected shrink guard error")
	}

	gotConflicts, err := os.ReadFile(paths.ConflictsTSV())
	if err != nil {
		t.Fatal(err)
	}
	if string(gotConflicts) != origConflicts {
		t.Fatalf("conflicts file was modified despite shrink guard:\n%s", gotConflicts)
	}
}

func TestGeneratePuppetDataMultiRegexSheetAttribution(t *testing.T) {
	dir := t.TempDir()
	paths := PathsFor(filepath.Join(dir, ".data"))
	if err := os.MkdirAll(filepath.Dir(paths.AllNations), 0o755); err != nil {
		t.Fatal(err)
	}

	compressed, err := compressBrotli([]byte("shared_puppet\n"), 4)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.AllNations, compressed, 0o644); err != nil {
		t.Fatal(err)
	}

	config := Config{
		Logger: testLogger(),
		Paths:  paths,
		Sheets: SheetConfig{
			Regex: []RegexSheet{
				{
					Name:         "Regex Sheet A",
					Source:       BytesSource([]byte("^shared_\tmaster_one\n")),
					RegexColumn:  0,
					MasterColumn: 1,
				},
				{
					Name:         "Regex Sheet B",
					Source:       BytesSource([]byte("^shared_puppet$\tmaster_one\n")),
					RegexColumn:  0,
					MasterColumn: 1,
				},
			},
		},
	}

	report, err := config.GeneratePuppetData(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if report.ExtraSheets != 1 {
		t.Fatalf("ExtraSheets = %d, want 1", report.ExtraSheets)
	}
	tsv, err := os.ReadFile(paths.PuppetData)
	if err != nil {
		t.Fatal(err)
	}
	want := "puppet\tmaster\tsheet\tsheet2\nshared_puppet\tmaster_one\tRegex Sheet A\tRegex Sheet B"
	if string(tsv) != want {
		t.Fatalf("TSV = %q, want %q", tsv, want)
	}
}
