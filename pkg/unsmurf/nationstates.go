package unsmurf

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/andybalholm/brotli"
)

// NationStatesReport summarises one NationStates update.
type NationStatesReport struct {
	Current   int
	WA        int
	All       int
	WAUpdated bool
	Duration  time.Duration
}

// UpdateNationStates fetches the current nation list and WA membership list,
// merges the current list into the historical Brotli archive, and writes the
// published .data/static files.
//
// A failure to update WA membership is non-fatal, matching the old scripts:
// the existing WA file is kept and the generator will warn about it later.
func (c *Config) UpdateNationStates(ctx context.Context) (*NationStatesReport, error) {
	started := time.Now()
	logger := c.logger()
	paths := c.Paths

	config := c.NationStates
	if config.NationsURL == "" {
		config.NationsURL = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations"
	}
	if config.MembersURL == "" {
		config.MembersURL = "https://www.nationstates.net/cgi-bin/api.cgi?wa=1&q=members"
	}
	if config.MinNations <= 0 {
		config.MinNations = 250000
	}
	if config.MinWAMembers <= 0 {
		config.MinWAMembers = 5000
	}
	if config.ArchiveQuality <= 0 || config.ArchiveQuality > 11 {
		config.ArchiveQuality = 4
	}
	if config.UserAgent == "" {
		config.UserAgent = c.httpClient().UserAgent
	}
	if config.UserAgent == "" {
		config.UserAgent = DefaultUserAgent
	}

	httpClient := c.httpClient()

	logger.Info("fetching NationStates nations", "url", config.NationsURL)
	raw, err := fetchNationStatesSource(ctx, httpClient, config.NationsSource, config.NationsURL, config.UserAgent)
	if err != nil {
		return nil, fmt.Errorf("fetch nations: %w", err)
	}
	text := string(raw)
	logger.Info("received nations response", "bytes", len(raw))

	if !strings.Contains(text, "</NATIONS>") {
		return nil, fmt.Errorf("response is truncated: missing </NATIONS> (%d bytes)", len(raw))
	}
	body, ok := extractTag(text, "<NATIONS>", "</NATIONS>")
	if !ok {
		return nil, errors.New("no <NATIONS> collection in response")
	}

	current := parseNationList(body)
	hasY := hasNationPrefix(current, "y")
	hasZ := hasNationPrefix(current, "z")
	logger.Info("parsed nations", "count", len(current), "has_y", hasY, "has_z", hasZ)
	if len(current) < config.MinNations || !hasY || !hasZ {
		return nil, fmt.Errorf(
			"response appears truncated (%d nations, y=%t, z=%t); refusing to overwrite existing data",
			len(current), hasY, hasZ,
		)
	}

	currentContent := []byte(strings.Join(current, "\n"))
	if err := guardShrink(paths.CurrentNations, int64(len(currentContent)), "currentNations"); err != nil {
		return nil, err
	}
	currentJSON, err := marshalJSON(current)
	if err != nil {
		return nil, err
	}

	logger.Info("reading historical nations archive", "path", paths.AllNations)
	existing, err := readNationsArchive(paths.AllNations, true)
	if err != nil {
		return nil, err
	}
	logger.Info("loaded historical nations", "count", len(existing))

	allNations := mergeSortedDedup(existing, current)
	if len(existing) > len(allNations) {
		return nil, fmt.Errorf(
			"allNations lost nations (%d now vs %d previously); refusing to overwrite existing data",
			len(allNations), len(existing),
		)
	}

	compressed, err := compressBrotli([]byte(strings.Join(allNations, "\n")), config.ArchiveQuality)
	if err != nil {
		return nil, fmt.Errorf("compress nations archive: %w", err)
	}

	if err := writeFile(paths.CurrentNations, currentContent); err != nil {
		return nil, err
	}
	if err := writeFile(paths.CurrentNationsJSON(), currentJSON); err != nil {
		return nil, err
	}
	if err := writeFile(paths.AllNations, compressed); err != nil {
		return nil, err
	}
	logger.Info("wrote nations archive", "nations", len(allNations), "path", paths.AllNations, "bytes", len(compressed))

	report := &NationStatesReport{
		Current: len(current),
		All:     len(allNations),
	}

	waNations, waErr := c.updateWANations(ctx, httpClient, config, paths, logger)
	if waErr != nil {
		logger.Warn("WA membership update failed; preserving existing file", "error", waErr)
	} else {
		report.WA = len(waNations)
		report.WAUpdated = true
	}

	report.Duration = time.Since(started)
	logger.Info("NationStates update complete",
		"current", report.Current,
		"wa", report.WA,
		"all", report.All,
		"wa_updated", report.WAUpdated,
		"duration_s", fmt.Sprintf("%.1f", report.Duration.Seconds()),
	)
	return report, nil
}

func fetchNationStatesSource(ctx context.Context, httpClient *HTTPClient, source Source, fallbackURL, userAgent string) ([]byte, error) {
	if source != nil {
		if urlSource, ok := source.(URLSource); ok {
			return httpClient.fetchWithUserAgent(ctx, string(urlSource), userAgent)
		}
		return source.Fetch(ctx)
	}
	return httpClient.fetchWithUserAgent(ctx, fallbackURL, userAgent)
}

func (c *Config) updateWANations(
	ctx context.Context,
	httpClient *HTTPClient,
	config NationStatesConfig,
	paths Paths,
	logger *slog.Logger,
) ([]string, error) {
	logger.Info("fetching WA membership", "url", config.MembersURL)
	raw, err := fetchNationStatesSource(ctx, httpClient, config.MembersSource, config.MembersURL, config.UserAgent)
	if err != nil {
		return nil, fmt.Errorf("fetch WA membership: %w", err)
	}

	text := string(raw)
	logger.Info("received WA response", "bytes", len(raw))
	if !strings.Contains(text, "</MEMBERS>") {
		return nil, fmt.Errorf("WA response is truncated: missing </MEMBERS> (%d bytes)", len(raw))
	}
	body, ok := extractTag(text, "<MEMBERS>", "</MEMBERS>")
	if !ok {
		return nil, errors.New("no <MEMBERS> collection in WA response")
	}

	waNations := parseNationList(body)
	logger.Info("parsed WA members", "count", len(waNations))
	if len(waNations) < config.MinWAMembers {
		return nil, fmt.Errorf("WA response appears truncated (%d members); refusing to overwrite existing data", len(waNations))
	}

	content := []byte(strings.Join(waNations, "\n"))
	if err := guardShrink(paths.WANations, int64(len(content)), "currentWANations"); err != nil {
		return nil, err
	}
	jsonContent, err := marshalJSON(waNations)
	if err != nil {
		return nil, err
	}
	if err := writeFile(paths.WANations, content); err != nil {
		return nil, err
	}
	if err := writeFile(paths.WANationsJSON(), jsonContent); err != nil {
		return nil, err
	}

	logger.Info("wrote WA member nations", "count", len(waNations), "path", paths.WANations)
	return waNations, nil
}

func extractTag(text, open, close string) (string, bool) {
	start := strings.Index(text, open)
	if start < 0 {
		return "", false
	}
	start += len(open)
	end := strings.Index(text[start:], close)
	if end < 0 {
		return "", false
	}
	return text[start : start+end], true
}

func parseNationList(body string) []string {
	parts := strings.Split(body, ",")
	nations := make([]string, len(parts))
	for index, part := range parts {
		nations[index] = NormalizeNation(part)
	}
	sort.Strings(nations)
	return nations
}

func hasNationPrefix(nations []string, prefix string) bool {
	for _, nation := range nations {
		if strings.HasPrefix(nation, prefix) {
			return true
		}
	}
	return false
}

func mergeSortedDedup(left, right []string) []string {
	result := make([]string, 0, len(left)+len(right))
	i, j := 0, 0
	for i < len(left) || j < len(right) {
		var value string
		if j >= len(right) || (i < len(left) && left[i] <= right[j]) {
			value = left[i]
			i++
		} else {
			value = right[j]
			j++
		}
		if len(result) == 0 || value != result[len(result)-1] {
			result = append(result, value)
		}
	}
	return result
}

func readNationsArchive(path string, allowMissing bool) ([]string, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) && allowMissing {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	reader := brotli.NewReader(bytes.NewReader(raw))
	decompressed, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("decompress %s: %w", path, err)
	}
	return splitNonEmptyLines(string(decompressed)), nil
}

func readNationSet(path string) (map[string]struct{}, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return map[string]struct{}{}, nil
	}
	if err != nil {
		return nil, err
	}

	lines := splitNonEmptyLines(string(raw))
	result := make(map[string]struct{}, len(lines))
	for _, line := range lines {
		result[line] = struct{}{}
	}
	return result, nil
}

func splitNonEmptyLines(text string) []string {
	lines := strings.Split(text, "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		result = append(result, line)
	}
	return result
}

func compressBrotli(data []byte, quality int) ([]byte, error) {
	var buffer bytes.Buffer
	writer := brotli.NewWriterLevel(&buffer, quality)
	if _, err := writer.Write(data); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}
