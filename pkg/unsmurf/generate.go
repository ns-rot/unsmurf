package unsmurf

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

type puppetRecord struct {
	Puppet string
	Master string
	Sheet  string
}

type identification struct {
	Master string
	Sheet  string
}

// Conflict captures a puppet that resolves to more than one master after
// redirects and exclusions.
type Conflict struct {
	Puppet  string
	Masters []string
	Sheets  map[string][]string
}

// GenerateReport summarises one generator run.
type GenerateReport struct {
	Records      int
	Matched      int
	Conflicts    int
	ExtraSheets  int
	Masters      []string
	Sheets       []string
	Redirects    map[string]string
	ConflictList []Conflict
	Duration     time.Duration
}

type identificationList struct {
	entries []identification
	seen    map[string]struct{}
}

func newIdentificationList() *identificationList {
	return &identificationList{seen: make(map[string]struct{})}
}

func (l *identificationList) add(master, sheet string) {
	key := master + "\x00" + sheet
	if _, ok := l.seen[key]; ok {
		return
	}
	l.seen[key] = struct{}{}
	l.entries = append(l.entries, identification{Master: master, Sheet: sheet})
}

func addIdentification(identifications map[string]*identificationList, puppet, master, sheet string) {
	list := identifications[puppet]
	if list == nil {
		list = newIdentificationList()
		identifications[puppet] = list
	}
	list.add(master, sheet)
}

type orderedSet struct {
	order []string
	set   map[string]struct{}
}

func newOrderedSet() *orderedSet {
	return &orderedSet{set: make(map[string]struct{})}
}

func (s *orderedSet) add(value string) {
	if _, ok := s.set[value]; ok {
		return
	}
	s.set[value] = struct{}{}
	s.order = append(s.order, value)
}

type sheetRanker struct {
	rank     map[string]int
	fallback int
}

func newSheetRanker(config SheetConfig) *sheetRanker {
	ranker := &sheetRanker{rank: make(map[string]int)}
	add := func(name string) {
		if _, ok := ranker.rank[name]; ok {
			return
		}
		ranker.rank[name] = ranker.fallback
		ranker.fallback++
	}
	for _, sheet := range config.Direct {
		add(sheet.Name)
	}
	for _, sheet := range config.Regex {
		add(sheet.Name)
	}
	for _, sheet := range config.Exclude {
		add(sheet.Name)
	}
	for _, sheet := range config.Redirect {
		add(sheet.Name)
	}
	return ranker
}

func (r *sheetRanker) of(name string) int {
	if rank, ok := r.rank[name]; ok {
		return rank
	}
	return r.fallback
}

func (r *sheetRanker) sorted(names []string) []string {
	out := append([]string(nil), names...)
	sort.SliceStable(out, func(i, j int) bool {
		return r.of(out[i]) < r.of(out[j])
	})
	return out
}

func joinAnd(names []string) string {
	switch len(names) {
	case 0:
		return ""
	case 1:
		return names[0]
	case 2:
		return names[0] + " and " + names[1]
	default:
		return strings.Join(names[:len(names)-1], ", ") + " and " + names[len(names)-1]
	}
}

func pairKey(puppet, master string) string {
	return puppet + "\x00" + master
}

func (c *Config) workerCount() int {
	workers := c.Workers
	if workers <= 0 {
		workers = runtime.NumCPU()
		if workers > 8 {
			workers = 8
		}
	}
	if workers < 1 {
		workers = 1
	}
	return workers
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

type conflictEntry struct {
	Puppet  string
	Masters []string
	Sheets  map[string]*orderedSet
}

func (c *conflictEntry) firstMaster() string {
	masters := append([]string(nil), c.Masters...)
	sort.Strings(masters)
	return masters[0]
}

// GeneratePuppetData downloads the configured sheets, applies exclusions,
// regex matches, and redirects, and writes puppetData.tsv, puppetData.json and
// puppetData.conflicts.tsv.
func (c *Config) GeneratePuppetData(ctx context.Context) (*GenerateReport, error) {
	started := time.Now()
	logger := c.logger()
	paths := c.Paths
	options := c.Sheets.RegexOptions()
	ranker := newSheetRanker(c.Sheets)

	records := make([]puppetRecord, 0, 4096)
	seen := make(map[string]puppetRecord)
	identifications := make(map[string]*identificationList, 4096)
	httpClient := c.httpClient()

	fetch := func(name string, source Source, headerRows int) ([]Row, bool, error) {
		rows, err := fetchRows(ctx, httpClient, source, name, headerRows)
		if err != nil {
			if c.Sheets.ContinueOnSheetError {
				logger.Error("error fetching sheet", "sheet", name, "error", err)
				return nil, false, nil
			}
			return nil, false, err
		}
		return rows, true, nil
	}

	// STEP 1: direct puppet mappings.
	logger.Info("=== STEP 1: processing direct puppet mappings ===")
	for _, sheet := range c.Sheets.Direct {
		rows, ok, err := fetch(sheet.Name, sheet.Source, sheet.HeaderRows)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		added := 0
		for _, row := range rows {
			puppet := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.PuppetColumn))
			master := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.MasterColumn))
			if puppet == "" || master == "" {
				continue
			}
			addIdentification(identifications, puppet, master, sheet.Name)
			if _, exists := seen[puppet]; exists {
				continue
			}
			record := puppetRecord{Puppet: puppet, Master: master, Sheet: sheet.Name}
			seen[puppet] = record
			records = append(records, record)
			added++
		}
		logger.Info("added direct puppets", "sheet", sheet.Name, "count", added)
	}
	logger.Info("total direct puppets", "count", len(seen))

	// STEP 2: exclusions.
	logger.Info("=== STEP 2: loading exclusion rules ===")
	excluded := make(map[string]struct{})
	for _, sheet := range c.Sheets.Exclude {
		rows, ok, err := fetch(sheet.Name, sheet.Source, sheet.HeaderRows)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		for _, row := range rows {
			puppet := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.PuppetColumn))
			master := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.MasterColumn))
			if puppet == "" || master == "" {
				continue
			}
			excluded[pairKey(puppet, master)] = struct{}{}
		}
	}
	logger.Info("loaded exclusion rules", "count", len(excluded))

	pruned := 0
	kept := records[:0]
	for _, record := range records {
		if _, ok := excluded[pairKey(record.Puppet, record.Master)]; ok {
			delete(seen, record.Puppet)
			pruned++
			continue
		}
		kept = append(kept, record)
	}
	records = kept

	for puppet, list := range identifications {
		filtered := make([]identification, 0, len(list.entries))
		seenEntries := make(map[string]struct{}, len(list.entries))
		for _, entry := range list.entries {
			if _, ok := excluded[pairKey(puppet, entry.Master)]; ok {
				continue
			}
			filtered = append(filtered, entry)
			seenEntries[entry.Master+"\x00"+entry.Sheet] = struct{}{}
		}
		if len(filtered) == 0 {
			delete(identifications, puppet)
			continue
		}
		list.entries = filtered
		list.seen = seenEntries
	}
	if pruned > 0 {
		logger.Info("removed rows matching exclusion rules", "count", pruned)
	}

	// STEP 3: compile regex rules.
	logger.Info("=== STEP 3: loading and compiling regex patterns ===")
	patterns := make([]*regexPattern, 0, 2048)
	for _, sheet := range c.Sheets.Regex {
		rows, ok, err := fetch(sheet.Name, sheet.Source, sheet.HeaderRows)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		valid, invalid := 0, 0
		for _, row := range rows {
			rawPattern := row.Column(sheet.RegexColumn)
			if strings.Contains(rawPattern, "\u00ad") {
				logger.Warn("removed soft hyphen", "sheet", sheet.Name, "row", row.Line)
				rawPattern = RemoveSoftHyphens(rawPattern)
			}
			rawPattern = strings.TrimSpace(rawPattern)
			master := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.MasterColumn))
			if rawPattern == "" || master == "" {
				continue
			}
			compiled, translated, err := compilePattern(rawPattern)
			if err != nil {
				logger.Error("invalid regex", "sheet", sheet.Name, "master", master, "pattern", rawPattern, "error", err)
				invalid++
				continue
			}
			patterns = append(patterns, &regexPattern{
				Pattern:      rawPattern,
				MatchPattern: translated,
				Master:       master,
				Sheet:        sheet.Name,
				Re:           compiled,
			})
			valid++
		}
		logger.Info("compiled regex patterns", "sheet", sheet.Name, "valid", valid, "invalid", invalid)
	}
	logger.Info("total regex patterns", "count", len(patterns))

	// STEP 3.5: consolidate patterns by master, preserving the old ordering.
	logger.Info("=== STEP 3.5: consolidating patterns by master ===")
	consolidated, saved := consolidatePatterns(patterns, options)
	logger.Info("consolidated patterns", "before", len(patterns), "after", len(consolidated), "saved", saved)

	// STEP 4: build the matcher.
	logger.Info("=== STEP 4: building regex matcher ===")
	matcher := buildMatcher(consolidated, options)
	logger.Info("built regex processors", "count", len(matcher.processors))

	// STEP 5: match historical nations.
	logger.Info("=== STEP 5: testing nations against regex patterns ===")
	allNations, err := readNationsArchive(paths.AllNations, false)
	if err != nil {
		return nil, fmt.Errorf("read nations archive: %w", err)
	}
	logger.Info("loaded historical nations", "count", len(allNations))

	matched := 0
	matchedPatterns := make(map[*regexPattern]struct{}, len(patterns))
	matchStats := make(map[string]int)
	matchStarted := time.Now()

	workers := c.workerCount()
	processorCount := len(matcher.processors)
	logger.Info("matching nations", "nations", len(allNations), "workers", workers)

	const matchChunkSize = 8192
	tested := 0

	cleanedBuf := make([]string, matchChunkSize)
	detailsBuf := make([]*regexPattern, matchChunkSize*processorCount)

	for chunkStart := 0; chunkStart < len(allNations); chunkStart += matchChunkSize {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		chunkEnd := chunkStart + matchChunkSize
		if chunkEnd > len(allNations) {
			chunkEnd = len(allNations)
		}
		rawChunk := allNations[chunkStart:chunkEnd]
		chunkLen := len(rawChunk)

		cleaned := cleanedBuf[:chunkLen]
		for index, rawNation := range rawChunk {
			nation := trimJSWhitespace(rawNation)
			if strings.Contains(nation, "\u00ad") {
				nation = RemoveSoftHyphens(nation)
			}
			cleaned[index] = nation
		}

		// Matching is pure and read-only, so it can run in parallel over
		// contiguous sub-slices. The stateful seen/exclusion logic below stays
		// single-threaded to keep output byte-for-byte deterministic.
		details := detailsBuf[:chunkLen*processorCount]
		if processorCount > 0 {
			if workers == 1 || chunkLen < workers {
				for index, nation := range cleaned {
					base := index * processorCount
					if nation == "" {
						clear(details[base : base+processorCount])
						continue
					}
					for processorIndex, proc := range matcher.processors {
						details[base+processorIndex] = proc.best(nation)
					}
				}
			} else {
				var waitGroup sync.WaitGroup
				for worker := 0; worker < workers; worker++ {
					start := worker * chunkLen / workers
					end := (worker + 1) * chunkLen / workers
					if start >= end {
						continue
					}
					waitGroup.Add(1)
					go func(start, end int) {
						defer waitGroup.Done()
						for index := start; index < end; index++ {
							nation := cleaned[index]
							base := index * processorCount
							if nation == "" {
								clear(details[base : base+processorCount])
								continue
							}
							for processorIndex, proc := range matcher.processors {
								details[base+processorIndex] = proc.best(nation)
							}
						}
					}(start, end)
				}
				waitGroup.Wait()
			}
		}

		for index, nation := range cleaned {
			if nation == "" {
				continue
			}
			tested++

			_, isSeen := seen[nation]

			base := index * processorCount
			for processorIndex := 0; processorIndex < processorCount; processorIndex++ {
				detail := details[base+processorIndex]
				if detail == nil {
					continue
				}

				key := pairKey(nation, detail.Master)
				_, isExcluded := excluded[key]

				if !isExcluded {
					if len(detail.Consolidated.Patterns) == 1 {
						matchedPatterns[detail.Consolidated.Patterns[0]] = struct{}{}
						addIdentification(identifications, nation, detail.Master, detail.Sheet)
					} else {
						for _, source := range detail.Consolidated.Patterns {
							if source.Re.MatchString(nation) {
								matchedPatterns[source] = struct{}{}
								addIdentification(identifications, nation, source.Master, source.Sheet)
							}
						}
					}

					if !isSeen {
						record := puppetRecord{Puppet: nation, Master: detail.Master, Sheet: detail.Sheet}
						seen[nation] = record
						records = append(records, record)
						matched++
						matchStats[detail.Master]++
						isSeen = true
					}
					break
				}

				if isSeen {
					break
				}
			}

			if tested%50000 == 0 {
				elapsed := time.Since(started).Seconds()
				rate := 0.0
				if elapsed > 0 {
					rate = float64(tested) / elapsed
				}
				logger.Info("regex progress",
					"tested", tested,
					"matched", matched,
					"elapsed_s", fmt.Sprintf("%.1f", elapsed),
					"nations_per_sec", fmt.Sprintf("%.0f", rate),
				)
			}
		}
	}

	for _, pattern := range patterns {
		if _, ok := matchedPatterns[pattern]; ok {
			continue
		}
		logger.Warn("regex pattern returned no results",
			"sheet", pattern.Sheet,
			"master", pattern.Master,
			"pattern", pattern.Pattern,
		)
	}

	topMasters := topCounts(matchStats, 10)
	for _, pair := range topMasters {
		logger.Info("top master", "master", pair.key, "count", pair.count)
	}
	logger.Info("regex matching complete", "matched", matched, "duration_s", fmt.Sprintf("%.1f", time.Since(matchStarted).Seconds()))

	// STEP 6: redirects.
	logger.Info("=== STEP 6: loading redirect rules ===")
	redirects := make(map[string]string)
	for _, sheet := range c.Sheets.Redirect {
		rows, ok, err := fetch(sheet.Name, sheet.Source, sheet.HeaderRows)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		for _, row := range rows {
			oldMaster := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.OldMasterColumn))
			newMaster := normalizeField(logger, sheet.Name, row.Line, row.Column(sheet.NewMasterColumn))
			if oldMaster == "" || newMaster == "" {
				continue
			}
			redirects[oldMaster] = newMaster
		}
	}
	logger.Info("loaded redirects", "count", len(redirects))

	// STEP 7: apply redirects.
	redirectCount := 0
	for index := range records {
		if replacement, ok := redirects[records[index].Master]; ok {
			records[index].Master = replacement
			redirectCount++
		}
	}
	logger.Info("applied redirects", "count", redirectCount)

	// STEP 7.5: conflicts after redirects.
	logger.Info("=== STEP 7.5: analyzing post-redirect identifications ===")
	var conflicts []*conflictEntry
	tally := make(map[string]int)
	singleSheetTally := make(map[string]int)

	for puppet, list := range identifications {
		states := make(map[string]*orderedSet)
		masters := make([]string, 0, len(list.entries))
		for _, entry := range list.entries {
			if _, ok := excluded[pairKey(puppet, entry.Master)]; ok {
				continue
			}
			resolved := entry.Master
			if replacement, ok := redirects[entry.Master]; ok {
				resolved = replacement
			}
			state := states[resolved]
			if state == nil {
				state = newOrderedSet()
				states[resolved] = state
				masters = append(masters, resolved)
			}
			state.add(entry.Sheet)
		}

		if len(masters) == 0 {
			continue
		}
		if len(masters) == 1 {
			sheets := states[masters[0]].order
			if len(sheets) >= 2 {
				tally[joinAnd(ranker.sorted(sheets))]++
			} else {
				singleSheetTally[sheets[0]]++
			}
			continue
		}

		conflicts = append(conflicts, &conflictEntry{
			Puppet:  puppet,
			Masters: masters,
			Sheets:  states,
		})
	}

	sort.Slice(conflicts, func(i, j int) bool {
		left, right := conflicts[i].firstMaster(), conflicts[j].firstMaster()
		if left != right {
			return left < right
		}
		return conflicts[i].Puppet < conflicts[j].Puppet
	})

	for _, conflict := range conflicts {
		masters := append([]string(nil), conflict.Masters...)
		sort.Strings(masters)
		parts := make([]string, 0, len(masters))
		for _, master := range masters {
			parts = append(parts, fmt.Sprintf("%s (%s)", master, strings.Join(ranker.sorted(conflict.Sheets[master].order), ", ")))
		}
		logger.Info("nation conflict", "nation", conflict.Puppet, "masters", strings.Join(parts, "; "))
	}

	firstFound, err := readFirstFound(paths.ConflictsTSV())
	if err != nil {
		return nil, err
	}
	firstFoundNow := time.Now().Unix()
	conflictRows := make([]string, 0, len(conflicts))
	conflictList := make([]Conflict, 0, len(conflicts))
	for _, conflict := range conflicts {
		masters := append([]string(nil), conflict.Masters...)
		sort.Strings(masters)

		sheetsByMaster := make(map[string][]string, len(masters))
		for _, master := range masters {
			sheetsByMaster[master] = ranker.sorted(conflict.Sheets[master].order)
		}
		conflictList = append(conflictList, Conflict{
			Puppet:  conflict.Puppet,
			Masters: masters,
			Sheets:  sheetsByMaster,
		})

		master1, master2 := "", ""
		sheets1, sheets2 := "", ""
		if len(masters) > 0 {
			master1 = masters[0]
			sheets1 = strings.Join(sheetsByMaster[master1], ", ")
		}
		if len(masters) > 1 {
			master2 = masters[1]
			sheets2 = strings.Join(sheetsByMaster[master2], ", ")
		}

		var extra strings.Builder
		for _, master := range masters[2:] {
			extra.WriteByte('\t')
			extra.WriteString(master)
			extra.WriteByte('\t')
			extra.WriteString(strings.Join(sheetsByMaster[master], ", "))
		}

		found := firstFound[conflict.Puppet]
		if found == "" {
			found = fmt.Sprintf("%d", firstFoundNow)
		}

		conflictRows = append(conflictRows, fmt.Sprintf(
			"%s\t%s\t%s\t%s\t%s\t%s%s",
			conflict.Puppet, found, master1, sheets1, master2, sheets2, extra.String(),
		))
	}

	conflictsContent := "nation\tcollisionFirstFoundUnix\tmaster1\tsheet1\tmaster2\tsheet2\n" +
		strings.Join(conflictRows, "\n") + "\n"

	logCounts := func(label string, counts map[string]int) {
		pairs := topCounts(counts, len(counts))
		for _, pair := range pairs {
			logger.Info(label, "shape", pair.key, "count", pair.count)
		}
	}
	logCounts("nations identified by multiple sheets", tally)
	logCounts("nations identified by a single sheet", singleSheetTally)

	// STEP 8: sort and format TSV.
	logger.Info("=== STEP 8: sorting data ===")
	sort.SliceStable(records, func(i, j int) bool {
		if records[i].Master != records[j].Master {
			return records[i].Master < records[j].Master
		}
		return records[i].Puppet < records[j].Puppet
	})

	extraByPuppet := make(map[string][]string)
	extraOrder := make([]string, 0)
	maxExtras := 0
	for _, record := range records {
		list := identifications[record.Puppet]
		if list == nil {
			continue
		}
		extras := make([]string, 0, 2)
		for _, entry := range list.entries {
			if entry.Sheet == record.Sheet {
				continue
			}
			resolved := entry.Master
			if replacement, ok := redirects[entry.Master]; ok {
				resolved = replacement
			}
			if resolved != record.Master {
				continue
			}
			if !containsString(extras, entry.Sheet) {
				extras = append(extras, entry.Sheet)
			}
		}
		if len(extras) == 0 {
			continue
		}
		ordered := ranker.sorted(extras)
		extraByPuppet[record.Puppet] = ordered
		extraOrder = append(extraOrder, record.Puppet)
		if len(ordered) > maxExtras {
			maxExtras = len(ordered)
		}
	}

	header := []string{"puppet", "master", "sheet"}
	for index := 2; index < 2+maxExtras; index++ {
		header = append(header, fmt.Sprintf("sheet%d", index))
	}

	tsvLines := make([]string, 0, len(records)+1)
	tsvLines = append(tsvLines, strings.Join(header, "\t"))
	for _, record := range records {
		columns := make([]string, 0, len(header))
		columns = append(columns, record.Puppet, record.Master, record.Sheet)
		columns = append(columns, extraByPuppet[record.Puppet]...)
		for len(columns) < len(header) {
			columns = append(columns, "")
		}
		tsvLines = append(tsvLines, strings.Join(columns, "\t"))
	}

	tsvContent := strings.Join(tsvLines, "\n")
	logger.Info("total entries", "count", len(records))
	if len(extraByPuppet) > 0 {
		logger.Info("puppets with additional source sheets", "count", len(extraByPuppet))
	}

	// STEP 8.5: WA membership sanity check.
	logger.Info("=== STEP 8.5: checking WA membership per master ===")
	waSet, err := readNationSet(paths.WANations)
	if err != nil {
		return nil, err
	}
	if len(waSet) == 0 {
		logger.Warn("WA membership data unavailable; skipping WA check",
			"path", paths.WANations,
		)
	} else {
		masterGroups := make(map[string]*orderedSet)
		for _, record := range records {
			group := masterGroups[record.Master]
			if group == nil {
				group = newOrderedSet()
				masterGroups[record.Master] = group
			}
			group.add(record.Puppet)
		}

		type waWarning struct {
			Master  string
			Members []string
		}
		warnings := make([]waWarning, 0)
		for master, group := range masterGroups {
			group.add(master)
			members := make([]string, 0, 2)
			for _, nation := range group.order {
				if _, ok := waSet[nation]; ok {
					members = append(members, nation)
				}
			}
			if len(members) > 1 {
				sort.Strings(members)
				warnings = append(warnings, waWarning{Master: master, Members: members})
			}
		}

		sort.Slice(warnings, func(i, j int) bool { return warnings[i].Master < warnings[j].Master })
		if len(warnings) > 0 {
			for _, warning := range warnings {
				logger.Warn("master has more than one WA member",
					"master", warning.Master,
					"members", strings.Join(warning.Members, ", "),
				)
			}
		} else {
			logger.Info("all master groups have at most one WA member", "groups", len(masterGroups))
		}
	}

	// STEP 9: JSON with frequency-ordered master/sheet indices, shrink guards, and writes.
	logger.Info("=== STEP 9: writing outputs ===")
	masterCounts := make(map[string]int)
	sheetCounts := make(map[string]int)
	masterOrder := make([]string, 0)
	sheetOrder := make([]string, 0)

	for _, record := range records {
		if _, ok := masterCounts[record.Master]; !ok {
			masterOrder = append(masterOrder, record.Master)
		}
		masterCounts[record.Master]++

		if _, ok := sheetCounts[record.Sheet]; !ok {
			sheetOrder = append(sheetOrder, record.Sheet)
		}
		sheetCounts[record.Sheet]++
	}
	for _, puppet := range extraOrder {
		for _, sheet := range extraByPuppet[puppet] {
			if _, ok := sheetCounts[sheet]; !ok {
				sheetOrder = append(sheetOrder, sheet)
			}
			sheetCounts[sheet]++
		}
	}

	mastersList := append([]string(nil), masterOrder...)
	sort.SliceStable(mastersList, func(i, j int) bool {
		return masterCounts[mastersList[i]] > masterCounts[mastersList[j]]
	})
	sheetsList := append([]string(nil), sheetOrder...)
	sort.SliceStable(sheetsList, func(i, j int) bool {
		return sheetCounts[sheetsList[i]] > sheetCounts[sheetsList[j]]
	})

	if len(sheetsList) > 31 {
		return nil, fmt.Errorf("too many source sheets (%d) for 32-bit bitmask encoding (max 31)", len(sheetsList))
	}

	masterIndex := make(map[string]int, len(mastersList))
	for index, master := range mastersList {
		masterIndex[master] = index
	}
	sheetIndex := make(map[string]int, len(sheetsList))
	for index, sheet := range sheetsList {
		sheetIndex[sheet] = index
	}

	for _, extras := range extraByPuppet {
		for _, sheet := range extras {
			if _, ok := sheetIndex[sheet]; !ok {
				return nil, fmt.Errorf("extra sheet %q has no bitmask index", sheet)
			}
		}
	}

	extraCount := 0
	puppetsList := make([][]any, 0, len(records))
	for _, record := range records {
		mask := int64(1) << uint(sheetIndex[record.Sheet])
		for _, sheet := range extraByPuppet[record.Puppet] {
			mask |= int64(1) << uint(sheetIndex[sheet])
			extraCount++
		}
		puppetsList = append(puppetsList, []any{record.Puppet, masterIndex[record.Master], mask})
	}

	payload := struct {
		Version int      `json:"version"`
		Masters []string `json:"masters"`
		Sheets  []string `json:"sheets"`
		Puppets [][]any  `json:"puppets"`
	}{
		Version: 2,
		Masters: mastersList,
		Sheets:  sheetsList,
		Puppets: puppetsList,
	}

	jsonContent, err := marshalJSON(payload)
	if err != nil {
		return nil, err
	}

	// Validate all shrink guards before modifying any output file.
	if err := guardShrink(paths.PuppetData, int64(len(tsvContent)), "puppetData.tsv"); err != nil {
		return nil, err
	}
	if err := guardShrink(paths.PuppetJSON(), int64(len(jsonContent)), "puppetData.json"); err != nil {
		return nil, err
	}

	if err := writeFile(paths.ConflictsTSV(), []byte(conflictsContent)); err != nil {
		return nil, err
	}
	logger.Info("wrote conflicts TSV", "rows", len(conflictRows))

	if err := writeFile(paths.PuppetData, []byte(tsvContent)); err != nil {
		return nil, err
	}
	if err := writeFile(paths.PuppetJSON(), jsonContent); err != nil {
		return nil, err
	}

	tsvInfo, err := os.Stat(paths.PuppetData)
	if err != nil {
		return nil, err
	}
	jsonInfo, err := os.Stat(paths.PuppetJSON())
	if err != nil {
		return nil, err
	}

	logger.Info("generated puppetData.json",
		"masters", len(mastersList),
		"sheets", len(sheetsList),
		"puppets", len(puppetsList),
		"extra_sheets", extraCount,
	)
	if len(mastersList) > 0 {
		logger.Info("most frequent master index",
			"master", mastersList[0],
			"occurrences", masterCounts[mastersList[0]],
			"index", 0,
		)
	}
	logger.Info("file sizes",
		"tsv_mb", fmt.Sprintf("%.2f", float64(tsvInfo.Size())/1024/1024),
		"json_mb", fmt.Sprintf("%.2f", float64(jsonInfo.Size())/1024/1024),
	)

	report := &GenerateReport{
		Records:      len(records),
		Matched:      matched,
		Conflicts:    len(conflicts),
		ExtraSheets:  extraCount,
		Masters:      mastersList,
		Sheets:       sheetsList,
		Redirects:    redirects,
		ConflictList: conflictList,
		Duration:     time.Since(started),
	}
	logger.Info("puppet data complete", "duration_s", fmt.Sprintf("%.1f", report.Duration.Seconds()))
	return report, nil
}

func consolidatePatterns(patterns []*regexPattern, options RegexOptions) ([]*consolidatedRule, int) {
	options = options.withDefaults()

	byMaster := make(map[string][]*regexPattern)
	order := make([]string, 0)
	groupCounts := make(map[string]int)

	for _, pattern := range patterns {
		if _, ok := byMaster[pattern.Master]; !ok {
			order = append(order, pattern.Master)
		}
		byMaster[pattern.Master] = append(byMaster[pattern.Master], pattern)
		if _, ok := groupCounts[pattern.Pattern]; !ok {
			groupCounts[pattern.Pattern] = countGroups(pattern.Pattern)
		}
	}

	consolidated := make([]*consolidatedRule, 0, len(patterns))
	saved := 0

	for _, master := range order {
		points := byMaster[master]
		if len(points) == 1 {
			consolidated = append(consolidated, &consolidatedRule{
				Master:   master,
				Patterns: points,
			})
			continue
		}

		group := make([]*regexPattern, 0, 4)
		groupCount := 0
		flush := func() {
			if len(group) == 0 {
				return
			}
			consolidated = append(consolidated, &consolidatedRule{
				Master:   master,
				Patterns: append([]*regexPattern(nil), group...),
			})
			saved += len(group) - 1
			group = group[:0]
			groupCount = 0
		}

		for _, pattern := range points {
			patternCount := groupCounts[pattern.Pattern]
			if len(group) > 0 && (groupCount+patternCount > options.MaxGroupsPerPattern || len(group) >= options.MaxPatternsPerGroup) {
				flush()
			}
			group = append(group, pattern)
			groupCount += patternCount
		}
		flush()
	}

	return consolidated, saved
}

func countGroups(pattern string) int {
	count := 0
	for index := 0; index < len(pattern); index++ {
		if pattern[index] == '(' && (index+1 >= len(pattern) || pattern[index+1] != '?') {
			count++
		}
	}
	return count
}

type countPair struct {
	key   string
	count int
}

func topCounts(counts map[string]int, limit int) []countPair {
	pairs := make([]countPair, 0, len(counts))
	for key, count := range counts {
		pairs = append(pairs, countPair{key: key, count: count})
	}
	sort.SliceStable(pairs, func(i, j int) bool {
		if pairs[i].count != pairs[j].count {
			return pairs[i].count > pairs[j].count
		}
		return pairs[i].key < pairs[j].key
	})
	if limit > 0 && len(pairs) > limit {
		pairs = pairs[:limit]
	}
	return pairs
}

func readFirstFound(path string) (map[string]string, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return make(map[string]string), nil
	}
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	lines := strings.Split(string(raw), "\n")
	if len(lines) > 0 {
		lines = lines[1:]
	}
	for _, line := range lines {
		columns := strings.Split(line, "\t")
		if len(columns) >= 2 && columns[0] != "" && columns[1] != "" {
			result[columns[0]] = columns[1]
		}
	}
	return result, nil
}

func guardShrink(path string, newSize int64, label string) error {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if info.Size() == 0 {
		return nil
	}
	if float64(newSize) < float64(info.Size())*0.5 {
		percentage := (1 - float64(newSize)/float64(info.Size())) * 100
		return fmt.Errorf("%s is %.0f%% smaller than existing (%d vs %d bytes); refusing to overwrite", label, percentage, newSize, info.Size())
	}
	return nil
}

func writeFile(path string, content []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".unsmurf-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpPath)
		}
	}()

	if _, err := tmp.Write(content); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o644); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	cleanup = false
	return nil
}

func marshalJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}
