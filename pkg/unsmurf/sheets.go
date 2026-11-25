package unsmurf

import (
	"context"
	"fmt"
	"strings"
)

// Row is one non-empty TSV line from a sheet.
type Row struct {
	Line string
	Cols []string
}

// Column returns the column at index, or an empty string when it is absent.
func (r Row) Column(index int) string {
	if index < 0 || index >= len(r.Cols) {
		return ""
	}
	return r.Cols[index]
}

// ParseRows splits a TSV payload the same way the old scripts did: split on
// newlines, skip header rows, then drop blank lines. CRLF is left in the value
// for Normalize to trim.
func ParseRows(raw []byte, headerRows int) []Row {
	text := string(raw)
	lines := strings.Split(text, "\n")
	if headerRows < 0 {
		headerRows = 0
	}
	if headerRows >= len(lines) {
		return nil
	}
	lines = lines[headerRows:]

	rows := make([]Row, 0, len(lines))
	for _, line := range lines {
		if trimJSWhitespace(line) == "" {
			continue
		}
		rows = append(rows, Row{Line: line, Cols: strings.Split(line, "\t")})
	}
	return rows
}

func fetchRows(ctx context.Context, client *HTTPClient, source Source, name string, headerRows int) ([]Row, error) {
	if source == nil {
		return nil, fmt.Errorf("%s: no source configured", name)
	}
	var (
		raw []byte
		err error
	)
	if urlSource, ok := source.(URLSource); ok {
		raw, err = client.Fetch(ctx, string(urlSource))
	} else {
		raw, err = source.Fetch(ctx)
	}
	if err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	return ParseRows(raw, headerRows), nil
}
