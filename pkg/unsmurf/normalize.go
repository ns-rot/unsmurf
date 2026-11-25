package unsmurf

import (
	"log/slog"
	"regexp"
	"strings"
)

// jsWhitespaceRun matches JavaScript's \s+ semantics, which include Unicode
// spaces and BOM (U+FEFF) that Go's \s / strings.TrimSpace do not. Sheet
// authors rely on the JS behaviour.
var jsWhitespaceRun = regexp.MustCompile(`[\x{0009}\x{000a}\x{000b}\x{000c}\x{000d} \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]+`)

func isJSWhitespace(r rune) bool {
	switch {
	case r == '\t' || r == '\n' || r == '\v' || r == '\f' || r == '\r' || r == ' ':
		return true
	case r == 0x00a0 || r == 0x1680 || r == 0x2028 || r == 0x2029 || r == 0x202f || r == 0x205f || r == 0x3000 || r == 0xfeff:
		return true
	case r >= 0x2000 && r <= 0x200a:
		return true
	default:
		return false
	}
}

func trimJSWhitespace(value string) string {
	return strings.TrimFunc(value, isJSWhitespace)
}

// RemoveSoftHyphens strips U+00AD, which occasionally appears in sheets copied
// from websites.
func RemoveSoftHyphens(value string) string {
	return strings.ReplaceAll(value, "\u00ad", "")
}

// Normalize turns a sheet value into the canonical puppet/master form:
// soft hyphens removed, trimmed, lower-cased, and whitespace runs replaced
// with underscores.
func Normalize(value string) string {
	value = trimJSWhitespace(RemoveSoftHyphens(value))
	value = strings.ToLower(value)
	return jsWhitespaceRun.ReplaceAllString(value, "_")
}

// NormalizeNation mirrors the NationStates API normalisation. It intentionally
// does not remove soft hyphens because the historical nation archive is kept
// byte-for-byte as published by the API.
func NormalizeNation(value string) string {
	value = trimJSWhitespace(value)
	value = strings.ToLower(value)
	return jsWhitespaceRun.ReplaceAllString(value, "_")
}

func normalizeField(logger *slog.Logger, sheet, row, value string) string {
	if strings.Contains(value, "\u00ad") {
		logger.Warn("removed soft hyphen",
			"sheet", sheet,
			"row", row,
		)
	}
	return Normalize(value)
}
