package unsmurf

import (
	"fmt"
	"regexp"
	"regexp/syntax"
	"sort"
	"strings"
	"unicode"
)

const (
	maxPrefixCount  = 256
	maxPrefixLength = 32
	maxClassRunes   = 128
)

// regexPattern is one compiled rule from a regex sheet.
type regexPattern struct {
	Pattern      string // original text, used in warnings and diagnostics
	MatchPattern string // translated to Go regexp syntax
	Master       string
	Sheet        string
	Re           *regexp.Regexp

	Consolidated *consolidatedRule
	SourceIndex  int
}

// consolidatedRule is a group of rules for the same master. It corresponds to
// one alternation branch in the original JavaScript implementation's combined
// regex.
type consolidatedRule struct {
	Master    string
	Patterns  []*regexPattern
	Index     int
	Processor int
}

// prefixNode indexes anchored rules by the literal prefix they require. A
// nation walks the trie once per processor and only runs the regexes whose
// prefix actually matched, which is dramatically cheaper than testing every
// rule for every nation.
type prefixNode struct {
	children map[rune]*prefixNode
	rules    []*regexPattern
}

func newPrefixNode() *prefixNode {
	return &prefixNode{children: make(map[rune]*prefixNode)}
}

type processor struct {
	root    *prefixNode
	general []*regexPattern
}

type matcher struct {
	processors []*processor
}

func buildMatcher(consolidated []*consolidatedRule, opts RegexOptions) *matcher {
	maxPerProcessor := opts.withDefaults().MaxPatternsPerRegex
	processorCount := 0
	if len(consolidated) > 0 {
		processorCount = (len(consolidated) + maxPerProcessor - 1) / maxPerProcessor
	}

	m := &matcher{processors: make([]*processor, processorCount)}
	for i := range m.processors {
		m.processors[i] = &processor{root: newPrefixNode()}
	}

	for index, rule := range consolidated {
		rule.Index = index
		rule.Processor = index / maxPerProcessor
		proc := m.processors[rule.Processor]

		for sourceIndex, pattern := range rule.Patterns {
			pattern.Consolidated = rule
			pattern.SourceIndex = sourceIndex

			prefixes := patternPrefixes(pattern.MatchPattern)
			if len(prefixes) == 0 {
				proc.general = append(proc.general, pattern)
				continue
			}
			for _, prefix := range prefixes {
				insertPrefix(proc.root, prefix, pattern)
			}
		}
	}

	return m
}

func insertPrefix(root *prefixNode, prefix string, pattern *regexPattern) {
	node := root
	for _, r := range prefix {
		r = unicode.ToLower(r)
		child := node.children[r]
		if child == nil {
			child = newPrefixNode()
			node.children[r] = child
		}
		node = child
	}
	node.rules = append(node.rules, pattern)
}

func (p *processor) best(nation string) *regexPattern {
	var best *regexPattern
	bestStart := -1

	consider := func(candidate *regexPattern) {
		location := candidate.Re.FindStringIndex(nation)
		if location == nil {
			return
		}
		if best == nil || location[0] < bestStart {
			best = candidate
			bestStart = location[0]
			return
		}
		if location[0] != bestStart {
			return
		}
		if candidate.Consolidated.Index < best.Consolidated.Index ||
			(candidate.Consolidated.Index == best.Consolidated.Index && candidate.SourceIndex < best.SourceIndex) {
			best = candidate
		}
	}

	node := p.root
	for _, r := range nation {
		child := node.children[unicode.ToLower(r)]
		if child == nil {
			break
		}
		node = child
		for _, candidate := range node.rules {
			consider(candidate)
		}
	}

	for _, candidate := range p.general {
		consider(candidate)
	}
	return best
}

// patternPrefixes returns literal prefixes that every anchored match must
// start with. An empty result means the rule cannot be indexed by prefix and
// must be tested for every nation.
func patternPrefixes(pattern string) []string {
	if strings.Contains(pattern, "(?-i") {
		// The trie lower-cases both sides; inline case-sensitive sections would
		// make that unsafe.
		return nil
	}

	parsed, err := syntax.Parse(pattern, syntax.Perl)
	if err != nil {
		return nil
	}
	if !anchoredAtStart(parsed) {
		return nil
	}

	info := prefixInfoFor(parsed)
	if info.unconstrained || info.nullable || len(info.prefixes) == 0 {
		return nil
	}

	prefixes := reducePrefixes(info.prefixes)
	if len(prefixes) == 0 || len(prefixes) > maxPrefixCount {
		return nil
	}
	for _, prefix := range prefixes {
		if prefix == "" {
			return nil
		}
	}
	return prefixes
}

func anchoredAtStart(expression *syntax.Regexp) bool {
	switch expression.Op {
	case syntax.OpBeginText:
		return true

	case syntax.OpCapture:
		return len(expression.Sub) > 0 && anchoredAtStart(expression.Sub[0])

	case syntax.OpConcat:
		for _, sub := range expression.Sub {
			switch sub.Op {
			case syntax.OpBeginText:
				return true
			case syntax.OpEmptyMatch, syntax.OpEndText, syntax.OpEndLine,
				syntax.OpWordBoundary, syntax.OpNoWordBoundary:
				continue
			default:
				return anchoredAtStart(sub)
			}
		}
		return false

	case syntax.OpAlternate:
		if len(expression.Sub) == 0 {
			return false
		}
		for _, sub := range expression.Sub {
			if !anchoredAtStart(sub) {
				return false
			}
		}
		return true

	case syntax.OpPlus:
		return len(expression.Sub) > 0 && anchoredAtStart(expression.Sub[0])

	case syntax.OpRepeat:
		return expression.Min > 0 && len(expression.Sub) > 0 && anchoredAtStart(expression.Sub[0])

	default:
		return false
	}
}

type prefixInfo struct {
	prefixes      []string
	unconstrained bool
	variable      bool
	nullable      bool
	consumes      bool
}

func prefixInfoFor(expression *syntax.Regexp) prefixInfo {
	switch expression.Op {
	case syntax.OpNoMatch:
		return prefixInfo{}

	case syntax.OpEmptyMatch, syntax.OpEndText, syntax.OpEndLine,
		syntax.OpWordBoundary, syntax.OpNoWordBoundary, syntax.OpBeginText,
		syntax.OpBeginLine:
		return prefixInfo{prefixes: []string{""}, nullable: true}

	case syntax.OpLiteral:
		if len(expression.Rune) == 0 {
			return prefixInfo{prefixes: []string{""}, nullable: true}
		}
		runes := expression.Rune
		if len(runes) > maxPrefixLength {
			runes = runes[:maxPrefixLength]
		}
		return prefixInfo{prefixes: []string{string(runes)}, consumes: true}

	case syntax.OpCharClass:
		prefixes := make([]string, 0, 8)
		count := 0
		for i := 0; i+1 < len(expression.Rune); i += 2 {
			low, high := expression.Rune[i], expression.Rune[i+1]
			if high < low {
				continue
			}
			count += int(high - low + 1)
			if count > maxClassRunes {
				return prefixInfo{unconstrained: true, consumes: true}
			}
			for r := low; r <= high; r++ {
				prefixes = append(prefixes, string(r))
			}
		}
		return prefixInfo{prefixes: dedupePrefixes(prefixes), consumes: true}

	case syntax.OpAnyCharNotNL, syntax.OpAnyChar:
		return prefixInfo{unconstrained: true, consumes: true}

	case syntax.OpCapture:
		if len(expression.Sub) == 0 {
			return prefixInfo{prefixes: []string{""}, nullable: true}
		}
		return prefixInfoFor(expression.Sub[0])

	case syntax.OpConcat:
		return concatPrefixInfo(expression.Sub)

	case syntax.OpAlternate:
		return alternatePrefixInfo(expression.Sub)

	case syntax.OpStar:
		if len(expression.Sub) == 0 {
			return prefixInfo{prefixes: []string{""}, nullable: true}
		}
		sub := prefixInfoFor(expression.Sub[0])
		return prefixInfo{
			prefixes:      sub.prefixes,
			unconstrained: sub.unconstrained,
			variable:      true,
			nullable:      true,
			consumes:      sub.consumes,
		}

	case syntax.OpQuest:
		if len(expression.Sub) == 0 {
			return prefixInfo{prefixes: []string{""}, nullable: true}
		}
		sub := prefixInfoFor(expression.Sub[0])
		prefixes := append([]string(nil), sub.prefixes...)
		if !sub.variable {
			prefixes = append(prefixes, "")
		}
		return prefixInfo{
			prefixes:      dedupePrefixes(prefixes),
			unconstrained: sub.unconstrained,
			variable:      sub.variable,
			nullable:      true,
			consumes:      sub.consumes,
		}

	case syntax.OpPlus:
		if len(expression.Sub) == 0 {
			return prefixInfo{prefixes: []string{""}, nullable: true}
		}
		sub := prefixInfoFor(expression.Sub[0])
		sub.variable = true
		return sub

	case syntax.OpRepeat:
		if len(expression.Sub) == 0 || expression.Max == 0 {
			return prefixInfo{prefixes: []string{""}, nullable: true}
		}
		sub := prefixInfoFor(expression.Sub[0])
		if expression.Min == 1 && expression.Max == 1 {
			return sub
		}
		sub.variable = true
		sub.nullable = expression.Min == 0 || sub.nullable
		return sub

	default:
		return prefixInfo{unconstrained: true, consumes: true}
	}
}

func concatPrefixInfo(expressions []*syntax.Regexp) prefixInfo {
	return concatPrefixInfoFrom(expressions, prefixInfo{prefixes: []string{""}, nullable: true}, false)
}

func concatPrefixInfoFrom(expressions []*syntax.Regexp, current prefixInfo, started bool) prefixInfo {
	for index, expression := range expressions {
		sub := prefixInfoFor(expression)

		if !sub.consumes {
			current.nullable = current.nullable && sub.nullable
			continue
		}

		current.consumes = true
		if sub.unconstrained {
			if started {
				current.variable = true
				return current
			}
			return prefixInfo{
				unconstrained: true,
				consumes:      true,
				nullable:      current.nullable && sub.nullable,
			}
		}
		if started && sub.variable {
			if !sub.nullable {
				if combined := combinePrefixes(current.prefixes, sub.prefixes); len(combined) > 0 && len(combined) <= maxPrefixCount {
					current.prefixes = combined
				}
			}
			current.variable = true
			return current
		}

		previous := current.prefixes
		previousNullable := current.nullable
		combined := combinePrefixes(previous, sub.prefixes)
		if sub.nullable && !sub.variable {
			combined = append(combined, previous...)
		}
		combined = dedupePrefixes(combined)
		if len(combined) == 0 || len(combined) > maxPrefixCount {
			if started {
				current.variable = true
				return current
			}
			return prefixInfo{unconstrained: true, consumes: true}
		}

		current.prefixes = combined
		current.nullable = current.nullable && sub.nullable
		current.variable = sub.variable

		if sub.variable {
			if sub.nullable {
				current.nullable = false
				skip := concatPrefixInfoFrom(
					expressions[index+1:],
					prefixInfo{prefixes: previous, nullable: previousNullable},
					started,
				)
				return unionPrefixInfo(current, skip)
			}
			return current
		}

		if !sub.nullable {
			started = true
		}
	}

	return current
}

func alternatePrefixInfo(expressions []*syntax.Regexp) prefixInfo {
	if len(expressions) == 0 {
		return prefixInfo{prefixes: []string{""}, nullable: true}
	}

	result := prefixInfo{}
	for _, expression := range expressions {
		sub := prefixInfoFor(expression)
		if sub.unconstrained {
			result.unconstrained = true
		} else {
			result.prefixes = append(result.prefixes, sub.prefixes...)
		}
		result.nullable = result.nullable || sub.nullable
		result.consumes = result.consumes || sub.consumes
		result.variable = result.variable || sub.variable
		if len(result.prefixes) > maxPrefixCount {
			result.unconstrained = true
			result.prefixes = nil
			break
		}
	}
	if !result.unconstrained {
		result.prefixes = dedupePrefixes(result.prefixes)
	}
	return result
}

func unionPrefixInfo(left, right prefixInfo) prefixInfo {
	if left.unconstrained || right.unconstrained {
		return prefixInfo{
			unconstrained: true,
			nullable:      left.nullable || right.nullable,
			consumes:      left.consumes || right.consumes,
			variable:      left.variable || right.variable,
		}
	}

	prefixes := dedupePrefixes(append(append([]string(nil), left.prefixes...), right.prefixes...))
	if len(prefixes) > maxPrefixCount {
		return prefixInfo{
			unconstrained: true,
			nullable:      left.nullable || right.nullable,
			consumes:      left.consumes || right.consumes,
			variable:      left.variable || right.variable,
		}
	}

	return prefixInfo{
		prefixes: prefixes,
		nullable: left.nullable || right.nullable,
		consumes: left.consumes || right.consumes,
		variable: left.variable || right.variable,
	}
}

func combinePrefixes(left, right []string) []string {
	if len(left) == 0 || len(right) == 0 {
		return nil
	}

	result := make([]string, 0, len(left)*len(right))
	for _, first := range left {
		for _, second := range right {
			var joined string
			switch {
			case first == "":
				joined = second
			case second == "":
				joined = first
			default:
				joined = first + second
			}
			joined = truncatePrefix(joined)
			result = append(result, joined)
			if len(result) > maxPrefixCount {
				return nil
			}
		}
	}
	return dedupePrefixes(result)
}

func truncatePrefix(s string) string {
	runes := 0
	for index := range s {
		if runes == maxPrefixLength {
			return s[:index]
		}
		runes++
	}
	return s
}

func dedupePrefixes(prefixes []string) []string {
	if len(prefixes) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(prefixes))
	result := make([]string, 0, len(prefixes))
	for _, prefix := range prefixes {
		if _, ok := seen[prefix]; ok {
			continue
		}
		seen[prefix] = struct{}{}
		result = append(result, prefix)
	}
	return result
}

// reducePrefixes lower-cases prefixes, removes prefixes that are covered by
// another shorter prefix, and rejects the unconstrained empty prefix. This
// keeps the trie small and ensures a nation can match at most one prefix of a
// rule without duplicate entries.
func reducePrefixes(prefixes []string) []string {
	lowered := make([]string, len(prefixes))
	for i, prefix := range prefixes {
		lowered[i] = strings.ToLower(prefix)
	}
	prefixes = dedupePrefixes(lowered)
	sort.Slice(prefixes, func(i, j int) bool {
		if len(prefixes[i]) != len(prefixes[j]) {
			return len(prefixes[i]) < len(prefixes[j])
		}
		return prefixes[i] < prefixes[j]
	})

	result := make([]string, 0, len(prefixes))
	for _, prefix := range prefixes {
		if prefix == "" {
			return nil
		}
		covered := false
		for _, kept := range result {
			if strings.HasPrefix(prefix, kept) {
				covered = true
				break
			}
		}
		if !covered {
			result = append(result, prefix)
		}
	}
	return result
}

// compilePattern compiles a JavaScript-style regex with case-insensitive
// matching. Go's RE2 engine covers the patterns used by the live sheets;
// unsupported constructs are reported as invalid rather than silently
// producing different matches.
func compilePattern(pattern string) (*regexp.Regexp, string, error) {
	translated := translateJSEscapes(pattern)
	compiled, err := regexp.Compile("(?i)" + translated)
	if err != nil {
		return nil, translated, err
	}
	return compiled, translated, nil
}

// translateJSEscapes converts the handful of JavaScript-only escapes that
// sheet authors occasionally use into their Go equivalents.
func translateJSEscapes(pattern string) string {
	pattern = strings.ReplaceAll(pattern, `[\b]`, `[\x{08}]`)

	var builder strings.Builder
	builder.Grow(len(pattern))

	for i := 0; i < len(pattern); i++ {
		ch := pattern[i]
		if ch != '\\' || i+1 >= len(pattern) {
			builder.WriteByte(ch)
			continue
		}

		next := pattern[i+1]
		if next == '\\' {
			builder.WriteString(`\\`)
			i++
			continue
		}

		if next == 'u' && i+5 < len(pattern) {
			hex := pattern[i+2 : i+6]
			if isHex4(hex) {
				builder.WriteString(`\x{`)
				builder.WriteString(hex)
				builder.WriteByte('}')
				i += 5
				continue
			}
		}

		if next == 'c' && i+2 < len(pattern) && isASCIILetter(pattern[i+2]) {
			code := pattern[i+2] & 0x1f
			fmt.Fprintf(&builder, `\x{%02x}`, code)
			i += 2
			continue
		}

		builder.WriteByte(ch)
	}

	return builder.String()
}

func isHex4(value string) bool {
	if len(value) != 4 {
		return false
	}
	for i := 0; i < 4; i++ {
		ch := value[i]
		if !(ch >= '0' && ch <= '9') && !(ch >= 'a' && ch <= 'f') && !(ch >= 'A' && ch <= 'F') {
			return false
		}
	}
	return true
}

func isASCIILetter(ch byte) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}
